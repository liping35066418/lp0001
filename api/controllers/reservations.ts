import { Router, type Request, type Response } from 'express';
import { ok, fail, notFound, forbidden, unauthorized } from '../utils/response.js';
import { authRequired } from '../middleware/auth.js';
import { ReservationRepository } from '../repositories/ReservationRepository.js';
import { ConflictService } from '../services/ConflictService.js';
import { SessionService } from '../services/SessionService.js';
import { getDb } from '../utils/db.js';
import type { Reservation, Session } from '../../shared/api-types.js';

const router = Router();
const reservationRepo = new ReservationRepository();
const db = getDb();

router.use(authRequired);

function mapReservation(r: {
  id: number; room_id: number; room_name?: string;
  customer_name: string; customer_phone: string; people_count: number;
  start_at: string; end_at: string; status: string;
  deposit_amount: number; remark: string;
  created_by: number; session_id?: number; created_at: string;
}): Reservation.Reservation {
  return {
    id: r.id,
    roomId: r.room_id,
    roomName: r.room_name,
    customerName: r.customer_name,
    customerPhone: r.customer_phone,
    peopleCount: r.people_count,
    startAt: r.start_at,
    endAt: r.end_at,
    status: r.status as Reservation.Status,
    depositAmount: r.deposit_amount,
    remark: r.remark || undefined,
    createdBy: r.created_by,
    sessionId: r.session_id || undefined,
    createdAt: r.created_at,
  };
}

function findReservationWithRoomName(id: number): (ReturnType<typeof mapReservation> | null) {
  const row = db.prepare(`
    SELECT r.*, rm.name as room_name
    FROM reservation r LEFT JOIN room rm ON r.room_id = rm.id
    WHERE r.id = ?
  `).get(id) as any;
  return row ? mapReservation(row) : null;
}

router.get('/all', async (req: Request, res: Response): Promise<void> => {
  try {
    const { date, roomId, status, keyword } = req.query;
    const conditions: string[] = ['1=1'];
    const params: unknown[] = [];

    if (date) {
      conditions.push('DATE(r.start_at) = ?');
      params.push(date);
    }
    if (roomId) {
      conditions.push('r.room_id = ?');
      params.push(Number(roomId));
    }
    if (status) {
      conditions.push('r.status = ?');
      params.push(status);
    }
    if (keyword) {
      conditions.push('(r.customer_name LIKE ? OR r.customer_phone LIKE ?)');
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    const rows = db.prepare(`
      SELECT r.*, rm.name as room_name
      FROM reservation r LEFT JOIN room rm ON r.room_id = rm.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY r.start_at DESC
    `).all(...params) as any[];

    const list = rows.map(mapReservation);
    ok(res, list);
  } catch (e) {
    fail(res, (e as Error).message);
  }
});

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { date, roomId, status, keyword, page, pageSize } = req.query;
    const conditions: string[] = ['1=1'];
    const params: unknown[] = [];

    if (date) {
      conditions.push('DATE(r.start_at) = ?');
      params.push(date);
    }
    if (roomId) {
      conditions.push('r.room_id = ?');
      params.push(Number(roomId));
    }
    if (status) {
      conditions.push('r.status = ?');
      params.push(status);
    }
    if (keyword) {
      conditions.push('(r.customer_name LIKE ? OR r.customer_phone LIKE ?)');
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    const whereSql = conditions.join(' AND ');
    const countRow = db.prepare(`
      SELECT COUNT(*) as total
      FROM reservation r LEFT JOIN room rm ON r.room_id = rm.id
      WHERE ${whereSql}
    `).get(...params) as { total: number };
    const total = countRow.total;

    const p = Number(page) || 1;
    const ps = Number(pageSize) || 10;
    const offset = (p - 1) * ps;

    const rows = db.prepare(`
      SELECT r.*, rm.name as room_name
      FROM reservation r LEFT JOIN room rm ON r.room_id = rm.id
      WHERE ${whereSql}
      ORDER BY r.start_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, ps, offset) as any[];

    const list = rows.map(mapReservation);
    ok(res, {
      list,
      total,
      page: p,
      pageSize: ps,
    });
  } catch (e) {
    fail(res, (e as Error).message);
  }
});

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const data = findReservationWithRoomName(id);
    if (!data) {
      notFound(res, '预约不存在');
      return;
    }
    ok(res, data);
  } catch (e) {
    fail(res, (e as Error).message);
  }
});

router.post('/check-conflict', async (req: Request, res: Response): Promise<void> => {
  try {
    const { roomId, startAt, endAt, excludeId } = req.body as Reservation.CheckConflictReq;
    if (!roomId || !startAt || !endAt) {
      fail(res, '缺少必填字段');
      return;
    }
    const conflict = ConflictService.hasConflict(roomId, startAt, endAt, excludeId);
    const conflicting = conflict
      ? ConflictService.getConflictingReservations(roomId, startAt, endAt, excludeId)
      : undefined;
    ok(res, { conflict, conflicting } as Reservation.CheckConflictResp);
  } catch (e) {
    fail(res, (e as Error).message);
  }
});

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as Omit<Reservation.Reservation, 'id' | 'createdAt' | 'createdBy'> & { createdBy?: number };
    if (!body.roomId || !body.customerName || !body.customerPhone || !body.startAt || !body.endAt) {
      fail(res, '缺少必填字段');
      return;
    }
    if (ConflictService.hasConflict(body.roomId, body.startAt, body.endAt)) {
      fail(res, '该时段存在冲突预约');
      return;
    }
    const userId = req.user?.id || 0;
    const id = reservationRepo.create({
      room_id: body.roomId,
      customer_name: body.customerName,
      customer_phone: body.customerPhone,
      people_count: body.peopleCount ?? 0,
      start_at: body.startAt,
      end_at: body.endAt,
      status: body.status || 'pending',
      deposit_amount: body.depositAmount ?? 0,
      remark: body.remark || '',
      created_by: userId,
    });
    const data = findReservationWithRoomName(id);
    ok(res, data, '创建成功');
  } catch (e) {
    fail(res, (e as Error).message);
  }
});

router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const existing = reservationRepo.findById(id);
    if (!existing) {
      notFound(res, '预约不存在');
      return;
    }
    const body = req.body as Partial<Reservation.Reservation>;
    const roomId = body.roomId ?? existing.room_id;
    const startAt = body.startAt ?? existing.start_at;
    const endAt = body.endAt ?? existing.end_at;
    if (ConflictService.hasConflict(roomId, startAt, endAt, id)) {
      fail(res, '该时段存在冲突预约');
      return;
    }
    const updateData: Record<string, unknown> = {};
    if (body.roomId !== undefined) updateData.room_id = body.roomId;
    if (body.customerName !== undefined) updateData.customer_name = body.customerName;
    if (body.customerPhone !== undefined) updateData.customer_phone = body.customerPhone;
    if (body.peopleCount !== undefined) updateData.people_count = body.peopleCount;
    if (body.startAt !== undefined) updateData.start_at = body.startAt;
    if (body.endAt !== undefined) updateData.end_at = body.endAt;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.depositAmount !== undefined) updateData.deposit_amount = body.depositAmount;
    if (body.remark !== undefined) updateData.remark = body.remark || '';
    reservationRepo.update(id, updateData);
    const data = findReservationWithRoomName(id);
    ok(res, data, '更新成功');
  } catch (e) {
    fail(res, (e as Error).message);
  }
});

router.post('/:id/cancel', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const existing = reservationRepo.findById(id);
    if (!existing) {
      notFound(res, '预约不存在');
      return;
    }
    reservationRepo.update(id, { status: 'cancelled' });
    const data = findReservationWithRoomName(id);
    ok(res, data, '取消成功');
  } catch (e) {
    fail(res, (e as Error).message);
  }
});

router.post('/:id/check-in', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const existing = reservationRepo.findById(id);
    if (!existing) {
      notFound(res, '预约不存在');
      return;
    }
    if (existing.status !== 'pending') {
      fail(res, '只有待确认状态的预约可以开台');
      return;
    }
    const userId = req.user?.id || 0;
    const { hours } = req.body as { hours?: number };
    const startAt = new Date(existing.start_at);
    const defaultHours = hours ?? Math.max(1, Math.ceil((new Date(existing.end_at).getTime() - startAt.getTime()) / 3600000));
    const sessionReq: Session.CreateSessionReq = {
      roomId: existing.room_id,
      reservationId: id,
      customerName: existing.customer_name,
      customerPhone: existing.customer_phone,
      peopleCount: existing.people_count,
      hours: defaultHours,
    };
    const session = SessionService.create(sessionReq, userId);
    const updated = findReservationWithRoomName(id);
    ok(res, { reservation: updated, session }, '开台成功');
  } catch (e) {
    fail(res, (e as Error).message);
  }
});

export default router;
