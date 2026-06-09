import { Router, type Request, type Response } from 'express';
import { ok, fail, notFound, forbidden, unauthorized } from '../utils/response.js';
import { authRequired } from '../middleware/auth.js';
import { BillService } from '../services/BillService.js';
import { getDb } from '../utils/db.js';
import type { Bill, PagedResult } from '../../shared/api-types.js';

const router = Router();
const db = getDb();

router.use(authRequired);

function mapBill(b: any): Bill.Bill {
  return {
    id: b.id,
    billNo: b.bill_no,
    sessionId: b.session_id,
    roomId: b.room_id,
    roomName: b.room_name,
    customerName: b.customer_name,
    startAt: b.start_at,
    endAt: b.end_at,
    durationMinutes: b.duration_minutes,
    roomFee: b.room_fee,
    overtimeFee: b.overtime_fee,
    rentalFee: b.rental_fee,
    goodsFee: b.goods_fee,
    subtotal: b.subtotal,
    discountAmount: b.discount_amount,
    totalAmount: b.total_amount,
    payMethod: b.pay_method as Bill.PayMethod,
    paidAmount: b.paid_amount,
    changeAmount: b.change_amount,
    depositRefund: b.deposit_refund,
    createdBy: b.created_by,
    createdAt: b.created_at,
    items: [],
  };
}

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { dateStart, dateEnd, payMethod, page = 1, pageSize = 20 } = req.query;
    const conditions: string[] = ['1=1'];
    const params: unknown[] = [];
    if (dateStart) {
      conditions.push('DATE(b.created_at) >= ?');
      params.push(dateStart);
    }
    if (dateEnd) {
      conditions.push('DATE(b.created_at) <= ?');
      params.push(dateEnd);
    }
    if (payMethod) {
      conditions.push('b.pay_method = ?');
      params.push(payMethod);
    }
    const pageNum = Number(page) || 1;
    const pageSizeNum = Number(pageSize) || 20;
    const offset = (pageNum - 1) * pageSizeNum;

    const total = (db.prepare(`
      SELECT COUNT(*) as c FROM bill b WHERE ${conditions.join(' AND ')}
    `).get(...params) as { c: number }).c;

    const rows = db.prepare(`
      SELECT b.*, r.name as room_name
      FROM bill b LEFT JOIN room r ON b.room_id = r.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY b.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, pageSizeNum, offset) as any[];

    const list = rows.map(mapBill);
    const result: PagedResult<Bill.Bill> = {
      list,
      total,
      page: pageNum,
      pageSize: pageSizeNum,
    };
    ok(res, result);
  } catch (e) {
    fail(res, (e as Error).message);
  }
});

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const bill = BillService.getBill(id);
    if (!bill) {
      notFound(res, '账单不存在');
      return;
    }
    ok(res, bill);
  } catch (e) {
    fail(res, (e as Error).message);
  }
});

router.post('/checkout', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as Bill.CheckoutReq;
    if (!body.sessionId || body.discountAmount === undefined || !body.payMethod || body.paidAmount === undefined) {
      fail(res, '缺少必填字段');
      return;
    }
    if (body.discountAmount < 0) {
      fail(res, '优惠金额不能为负');
      return;
    }
    const userId = req.user?.id || 0;
    const bill = BillService.checkout(body, userId);
    ok(res, bill, '结账成功');
  } catch (e) {
    fail(res, (e as Error).message);
  }
});

export default router;
