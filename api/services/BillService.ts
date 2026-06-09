import dayjs from 'dayjs';
import { getDb } from '../utils/db.js';
import { SessionService } from './SessionService.js';
import { PricingService } from './PricingService.js';
import { InventoryService } from './InventoryService.js';
import type { Bill, Session, Rental, Goods, Member as M } from '../../shared/api-types.js';
import { markCouponUsed, incrementMemberStats, findMemberByPhone } from '../controllers/members.js';

type MappedMember = {
  id: number; name: string; phone: string; level: M.Level;
  totalSpend: number; totalVisits: number;
};

const BILL_COLUMNS = [
  'id', 'bill_no', 'session_id', 'room_id', 'customer_name',
  'start_at', 'end_at', 'duration_minutes',
  'room_fee', 'overtime_fee', 'rental_fee', 'goods_fee',
  'subtotal', 'discount_amount', 'total_amount',
  'pay_method', 'paid_amount', 'change_amount', 'deposit_refund',
  'created_by', 'created_at',
];

export class BillService {
  private static db = getDb();

  static checkout(req: Bill.CheckoutReq, userId: number): Bill.Bill {
    return this.db.transaction(() => {
      const session = SessionService.getById(req.sessionId);
      if (!session) {
        throw new Error('场次不存在');
      }
      if (session.status === 'completed') {
        throw new Error('场次已结算');
      }

      const completedSession = SessionService.complete(req.sessionId);

      const rentals = this.getRentalsBySessionId(req.sessionId);
      const goodsItems = this.getGoodsItemsBySessionId(req.sessionId);

      const activeRentals = rentals.filter((r) => r.status === 'active');
      let depositRefundTotal = 0;

      for (const rental of activeRentals) {
        const damageFee = rental.damageFee || 0;
        const refundAmount = Math.max(0, rental.depositCollected - damageFee);
        const now = dayjs().format('YYYY-MM-DD HH:mm:ss');

        this.db.prepare(`
          UPDATE rental
          SET status = 'returned', returned_at = ?,
              deposit_refunded = ?, damage_fee = ?
          WHERE id = ?
        `).run(now, refundAmount, damageFee, rental.id);

        InventoryService.incrementBoardgameStock(rental.boardgameId);
        depositRefundTotal += refundAmount;
      }

      const sessionWithDiscount: Session.Session = {
        ...completedSession,
        discountAmount: req.discountAmount,
      };

      const totals = PricingService.calculateSessionTotals(
        sessionWithDiscount,
        rentals,
        goodsItems,
      );

      const room = this.db.prepare(
        'SELECT name FROM room WHERE id = ?',
      ).get(completedSession.roomId) as { name: string } | undefined;

      const startAt = dayjs(completedSession.startAt);
      const endAt = dayjs(completedSession.actualEndAt || completedSession.scheduledEndAt);
      const durationMinutes = Math.max(0, endAt.diff(startAt, 'minute'));

      const billNo = `BG${Date.now()}`;
      const changeAmount = Math.max(0, req.paidAmount - totals.totalAmount);

      const billStmt = this.db.prepare(`
        INSERT INTO bill (
          bill_no, session_id, room_id, customer_name,
          start_at, end_at, duration_minutes,
          room_fee, overtime_fee, rental_fee, goods_fee,
          subtotal, discount_amount, total_amount,
          pay_method, paid_amount, change_amount, deposit_refund,
          created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const billInfo = billStmt.run(
        billNo,
        completedSession.id,
        completedSession.roomId,
        completedSession.customerName ?? null,
        completedSession.startAt,
        completedSession.actualEndAt || completedSession.scheduledEndAt,
        durationMinutes,
        totals.roomFee,
        totals.overtimeFee,
        totals.rentalFee,
        totals.goodsFee,
        totals.subtotal,
        req.discountAmount,
        totals.totalAmount,
        req.payMethod,
        req.paidAmount,
        changeAmount,
        depositRefundTotal,
        userId,
      );

      const billId = Number(billInfo.lastInsertRowid);

      const billItems: Bill.BillItem[] = [];

      if (totals.roomFee > 0) {
        billItems.push({
          billId,
          type: 'room',
          name: `${room?.name ?? '包厢'} 包厢费`,
          quantity: Math.ceil(durationMinutes / 60) || 1,
          unitPrice: Number((totals.roomFee / (Math.ceil(durationMinutes / 60) || 1)).toFixed(2)),
          subtotal: totals.roomFee,
          refId: completedSession.roomId,
        });
      }

      if (totals.overtimeFee > 0) {
        const overtimeHours = PricingService.calculateRoomFee(
          0,
          completedSession.startAt,
          completedSession.scheduledEndAt,
          completedSession.actualEndAt,
        );
        billItems.push({
          billId,
          type: 'overtime',
          name: '超时费用',
          quantity: overtimeHours.overtimeMinutes,
          unitPrice: Number((totals.overtimeFee / Math.max(1, overtimeHours.overtimeMinutes / 60) / 60).toFixed(2)),
          subtotal: totals.overtimeFee,
          refId: completedSession.id,
        });
      }

      for (const rental of rentals) {
        billItems.push({
          billId,
          type: 'rental',
          name: rental.boardgameName || `桌游租赁#${rental.boardgameId}`,
          quantity: 1,
          unitPrice: rental.rentalFee,
          subtotal: rental.rentalFee,
          refId: rental.id,
        });
      }

      for (const goods of goodsItems) {
        billItems.push({
          billId,
          type: 'goods',
          name: goods.name,
          quantity: goods.quantity,
          unitPrice: goods.unitPrice,
          subtotal: goods.subtotal,
          refId: goods.goodsId,
        });
      }

      const billItemStmt = this.db.prepare(`
        INSERT INTO bill_item (bill_id, type, name, quantity, unit_price, subtotal, ref_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of billItems) {
        billItemStmt.run(
          billId,
          item.type,
          item.name,
          item.quantity,
          item.unitPrice,
          item.subtotal,
          item.refId ?? null,
        );
      }

      let member: MappedMember | null = null;
      if (req.memberId) {
        const mRow = this.db.prepare('SELECT * FROM member WHERE id = ?').get(req.memberId) as any;
        if (mRow) {
          member = {
            id: mRow.id, name: mRow.name, phone: mRow.phone,
            level: mRow.level, totalSpend: mRow.total_spend, totalVisits: mRow.total_visits,
          };
        }
        incrementMemberStats(req.memberId, totals.totalAmount);
      } else if (completedSession.customerPhone) {
        const mByPhone = findMemberByPhone(completedSession.customerPhone);
        if (mByPhone) {
          member = {
            id: mByPhone.id, name: mByPhone.name, phone: mByPhone.phone,
            level: mByPhone.level, totalSpend: mByPhone.totalSpend, totalVisits: mByPhone.totalVisits,
          };
          incrementMemberStats(mByPhone.id, totals.totalAmount);
        }
      }

      if (req.useMemberCouponId) {
        markCouponUsed(req.useMemberCouponId);
      }

      const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
      this.db.prepare(`
        UPDATE waiting_queue
        SET status = 'skipped'
        WHERE status = 'calling' AND called_expire_at < ?
      `).run(now);

      const nextRow = this.db.prepare(`
        SELECT * FROM waiting_queue
        WHERE status = 'waiting'
        ORDER BY created_at ASC
        LIMIT 1
      `).get() as any;

      let calledWaiting: any = null;
      if (nextRow) {
        const calledAt = dayjs();
        const calledExpireAt = calledAt.add(15, 'minute');
        this.db.prepare(`
          UPDATE waiting_queue
          SET status = 'calling', called_at = ?, called_expire_at = ?, assigned_room_id = ?
          WHERE id = ?
        `).run(
          calledAt.format('YYYY-MM-DD HH:mm:ss'),
          calledExpireAt.format('YYYY-MM-DD HH:mm:ss'),
          completedSession.roomId,
          nextRow.id,
        );
        const refreshed = this.db.prepare(`
          SELECT wq.*, r.name as room_name
          FROM waiting_queue wq
          LEFT JOIN room r ON wq.assigned_room_id = r.id
          WHERE wq.id = ?
        `).get(nextRow.id) as Record<string, any>;
        calledWaiting = {
          id: refreshed.id,
          customerName: refreshed.customer_name,
          customerPhone: refreshed.customer_phone,
          peopleCount: refreshed.people_count,
          status: refreshed.status,
          queueNumber: refreshed.queue_number,
          assignedRoomName: refreshed.room_name,
          calledAt: refreshed.called_at,
          calledExpireAt: refreshed.called_expire_at,
        };
      }

      const bill = this.getBill(billId)!;
      return { ...bill, _calledWaiting: calledWaiting, _member: member } as any;
    })();
  }

  static getBill(id: number): Bill.Bill | null {
    const row = this.db.prepare('SELECT * FROM bill WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!row) return null;

    const billItems = this.db.prepare(
      'SELECT * FROM bill_item WHERE bill_id = ? ORDER BY id ASC',
    ).all(id) as Record<string, unknown>[];

    const items: Bill.BillItem[] = billItems.map((r) => ({
      id: Number(r.id),
      billId: Number(r.bill_id),
      type: r.type as Bill.ItemType,
      name: r.name as string,
      quantity: Number(r.quantity),
      unitPrice: Number(r.unit_price),
      subtotal: Number(r.subtotal),
      refId: r.ref_id ? Number(r.ref_id) : undefined,
    }));

    const room = this.db.prepare(
      'SELECT name FROM room WHERE id = ?',
    ).get(Number(row.room_id)) as { name: string } | undefined;

    return {
      id: Number(row.id),
      billNo: row.bill_no as string,
      sessionId: Number(row.session_id),
      roomId: Number(row.room_id),
      roomName: room?.name,
      customerName: row.customer_name as string | undefined,
      startAt: row.start_at as string,
      endAt: row.end_at as string,
      durationMinutes: Number(row.duration_minutes),
      roomFee: Number(row.room_fee),
      overtimeFee: Number(row.overtime_fee),
      rentalFee: Number(row.rental_fee),
      goodsFee: Number(row.goods_fee),
      subtotal: Number(row.subtotal),
      discountAmount: Number(row.discount_amount),
      totalAmount: Number(row.total_amount),
      payMethod: row.pay_method as Bill.PayMethod,
      paidAmount: Number(row.paid_amount),
      changeAmount: Number(row.change_amount),
      depositRefund: Number(row.deposit_refund),
      createdBy: Number(row.created_by),
      createdAt: row.created_at as string,
      items,
    };
  }

  private static getRentalsBySessionId(sessionId: number): Rental.Rental[] {
    const rows = this.db.prepare(
      'SELECT r.*, b.name as boardgame_name FROM rental r LEFT JOIN boardgame b ON r.boardgame_id = b.id WHERE r.session_id = ? ORDER BY r.id ASC',
    ).all(sessionId) as Record<string, unknown>[];

    return rows.map((r) => ({
      id: Number(r.id),
      sessionId: r.session_id ? Number(r.session_id) : undefined,
      boardgameId: Number(r.boardgame_id),
      boardgameName: r.boardgame_name as string | undefined,
      depositCollected: Number(r.deposit_collected),
      rentalFee: Number(r.rental_fee),
      accessoriesChecked: r.accessories_checked as string,
      status: r.status as Rental.Status,
      rentedAt: r.rented_at as string,
      returnedAt: r.returned_at as string | undefined,
      accessoriesReturned: r.accessories_returned as string | undefined,
      damageFee: Number(r.damage_fee),
      depositRefunded: Number(r.deposit_refunded),
      createdBy: Number(r.created_by),
      remark: r.remark as string | undefined,
    }));
  }

  private static getGoodsItemsBySessionId(sessionId: number): Goods.GoodsItemInBill[] {
    const rows = this.db.prepare(
      'SELECT * FROM session_goods_item WHERE session_id = ? ORDER BY id ASC',
    ).all(sessionId) as Record<string, unknown>[];

    return rows.map((r) => ({
      id: Number(r.id),
      goodsId: Number(r.goods_id),
      name: r.goods_name as string,
      quantity: Number(r.quantity),
      unitPrice: Number(r.unit_price),
      subtotal: Number(r.subtotal),
    }));
  }
}

export default BillService;
