import dayjs from 'dayjs';
import { getDb } from '../utils/db.js';
import { PricingService } from './PricingService.js';
import type { Session } from '../../shared/api-types.js';

const SESSION_COLUMNS = [
  'id', 'room_id', 'reservation_id', 'customer_name', 'customer_phone',
  'people_count', 'start_at', 'scheduled_end_at', 'actual_end_at',
  'status', 'room_fee', 'overtime_fee', 'rental_fee', 'goods_fee',
  'discount_amount', 'total_amount', 'created_by', 'created_at',
];

export class SessionService {
  private static db = getDb();

  static create(req: Session.CreateSessionReq, userId: number): Session.Session {
    return this.db.transaction(() => {
      const activeSession = this.db.prepare(
        "SELECT id FROM session WHERE room_id = ? AND status = 'active' LIMIT 1",
      ).get(req.roomId) as { id: number } | undefined;
      if (activeSession) {
        throw new Error('该包厢当前已有进行中场次');
      }

      const room = this.db.prepare(
        'SELECT id, name, base_price, status FROM room WHERE id = ?',
      ).get(req.roomId) as { id: number; name: string; base_price: number; status: string } | undefined;
      if (!room) {
        throw new Error('包厢不存在');
      }
      if (room.status !== 'available') {
        throw new Error('包厢当前不可用');
      }

      const startAt = dayjs();
      const scheduledEndAt = startAt.add(req.hours, 'hour');
      const initialRoomFee = Number((req.hours * room.base_price).toFixed(2));

      const startAtStr = startAt.format('YYYY-MM-DD HH:mm:ss');
      const scheduledEndStr = scheduledEndAt.format('YYYY-MM-DD HH:mm:ss');

      const stmt = this.db.prepare(`
        INSERT INTO session (
          room_id, reservation_id, customer_name, customer_phone, people_count,
          start_at, scheduled_end_at, room_fee, overtime_fee, rental_fee, goods_fee,
          discount_amount, total_amount, created_by, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, ?, ?, 'active')
      `);

      const totalAmount = initialRoomFee;
      const info = stmt.run(
        req.roomId,
        req.reservationId ?? null,
        req.customerName ?? null,
        req.customerPhone ?? null,
        req.peopleCount,
        startAtStr,
        scheduledEndStr,
        initialRoomFee,
        totalAmount,
        userId,
      );

      const sessionId = Number(info.lastInsertRowid);

      if (req.reservationId) {
        this.db.prepare(
          "UPDATE reservation SET status = 'checked_in', session_id = ? WHERE id = ?",
        ).run(sessionId, req.reservationId);
      }

      return this.getById(sessionId)!;
    })();
  }

  static extend(sessionId: number, addHours: number): Session.Session {
    return this.db.transaction(() => {
      const session = this.getById(sessionId);
      if (!session) {
        throw new Error('场次不存在');
      }
      if (session.status !== 'active') {
        throw new Error('场次状态不支持续时');
      }

      const room = this.db.prepare(
        'SELECT base_price FROM room WHERE id = ?',
      ).get(session.roomId) as { base_price: number } | undefined;
      const basePrice = room?.base_price ?? 0;

      const currentScheduledEnd = dayjs(session.scheduledEndAt);
      const newScheduledEnd = currentScheduledEnd.add(addHours, 'hour');
      const addFee = Number((addHours * basePrice).toFixed(2));
      const newRoomFee = Number((session.roomFee + addFee).toFixed(2));
      const newTotal = Number((session.totalAmount + addFee).toFixed(2));

      this.db.prepare(`
        UPDATE session
        SET scheduled_end_at = ?, room_fee = ?, total_amount = ?
        WHERE id = ?
      `).run(
        newScheduledEnd.format('YYYY-MM-DD HH:mm:ss'),
        newRoomFee,
        newTotal,
        sessionId,
      );

      return this.getById(sessionId)!;
    })();
  }

  static refreshSessionCost(sessionId: number): Session.Session {
    return this.db.transaction(() => {
      const session = this.getById(sessionId);
      if (!session) {
        throw new Error('场次不存在');
      }

      const room = this.db.prepare(
        'SELECT base_price FROM room WHERE id = ?',
      ).get(session.roomId) as { base_price: number } | undefined;
      const basePrice = room?.base_price ?? 0;

      const actualNow = session.status === 'completed' && session.actualEndAt
        ? session.actualEndAt
        : undefined;

      const result = PricingService.calculateRoomFee(
        basePrice,
        session.startAt,
        session.scheduledEndAt,
        actualNow,
      );

      const rentalFee = session.rentalFee || 0;
      const goodsFee = session.goodsFee || 0;
      const discountAmount = session.discountAmount || 0;
      const subtotal = Number((result.roomFee + result.overtimeFee + rentalFee + goodsFee).toFixed(2));
      const totalAmount = Number((subtotal - discountAmount).toFixed(2));

      this.db.prepare(`
        UPDATE session
        SET room_fee = ?, overtime_fee = ?, total_amount = ?
        WHERE id = ?
      `).run(
        result.roomFee,
        result.overtimeFee,
        totalAmount,
        sessionId,
      );

      return this.getById(sessionId)!;
    })();
  }

  static complete(sessionId: number): Session.Session {
    return this.db.transaction(() => {
      const session = this.getById(sessionId);
      if (!session) {
        throw new Error('场次不存在');
      }
      if (session.status !== 'active') {
        throw new Error('场次状态不支持结束');
      }

      const actualEndAt = dayjs().format('YYYY-MM-DD HH:mm:ss');
      this.db.prepare(
        "UPDATE session SET status = 'completed', actual_end_at = ? WHERE id = ?",
      ).run(actualEndAt, sessionId);

      const refreshed = this.refreshSessionCost(sessionId);
      return refreshed;
    })();
  }

  static getById(id: number): Session.Session | null {
    const row = this.db.prepare('SELECT * FROM session WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.mapRowToSession(row);
  }

  private static mapRowToSession(row: Record<string, unknown>): Session.Session {
    return {
      id: Number(row.id),
      roomId: Number(row.room_id),
      reservationId: row.reservation_id ? Number(row.reservation_id) : undefined,
      customerName: row.customer_name as string | undefined,
      customerPhone: row.customer_phone as string | undefined,
      peopleCount: Number(row.people_count),
      startAt: row.start_at as string,
      scheduledEndAt: row.scheduled_end_at as string,
      actualEndAt: row.actual_end_at as string | undefined,
      elapsedMinutes: 0,
      overtimeMinutes: 0,
      status: row.status as Session.Status,
      roomFee: Number(row.room_fee),
      overtimeFee: Number(row.overtime_fee),
      rentalFee: Number(row.rental_fee),
      goodsFee: Number(row.goods_fee),
      discountAmount: Number(row.discount_amount),
      totalAmount: Number(row.total_amount),
      createdBy: Number(row.created_by),
      createdAt: row.created_at as string,
    };
  }
}

export default SessionService;
