import { Router, type Request, type Response } from 'express';
import { ok, fail, notFound } from '../utils/response.js';
import { authRequired } from '../middleware/auth.js';
import { getDb } from '../utils/db.js';
import dayjs from 'dayjs';
import type { Queue as Q } from '../../shared/api-types.js';

const router = Router();
const db = getDb();

router.use(authRequired);

function mapQueueRow(row: any): Q.WaitingItem {
  return {
    id: row.id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    peopleCount: row.people_count,
    status: row.status as Q.Status,
    queueNumber: row.queue_number,
    roomSpec: row.room_spec as Q.RoomSpec | undefined,
    assignedRoomId: row.assigned_room_id ?? undefined,
    assignedRoomName: row.room_name ?? undefined,
    calledAt: row.called_at ?? undefined,
    calledExpireAt: row.called_expire_at ?? undefined,
    sessionId: row.session_id ?? undefined,
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
  };
}

router.get('/summary', async (req: Request, res: Response): Promise<void> => {
  try {
    const today = dayjs().format('YYYY-MM-DD');
    const rows = db.prepare(`
      SELECT wq.*, r.name as room_name
      FROM waiting_queue wq
      LEFT JOIN room r ON wq.assigned_room_id = r.id
      WHERE DATE(wq.created_at) = ?
      ORDER BY
        CASE wq.status
          WHEN 'calling' THEN 0
          WHEN 'waiting' THEN 1
          WHEN 'skipped' THEN 2
          WHEN 'seated' THEN 3
          ELSE 4
        END,
        wq.created_at ASC
    `).all(today) as any[];

    const list = rows.map(mapQueueRow);
    const waitingCount = list.filter(i => i.status === 'waiting').length;
    const callingCount = list.filter(i => i.status === 'calling').length;

    ok(res, { waitingCount, callingCount, totalToday: list.length, list } as Q.QueueSummary);
  } catch (e) {
    fail(res, (e as Error).message);
  }
});

router.post('/join', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as Q.JoinQueueReq;
    if (!body.customerName || !body.customerPhone || body.peopleCount === undefined) {
      fail(res, '缺少必填字段');
      return;
    }
    if (body.peopleCount <= 0) {
      fail(res, '人数必须大于0');
      return;
    }

    const userId = req.user?.id || 0;
    const today = dayjs().format('YYYY-MM-DD');

    const seqRow = db.prepare(`
      SELECT COALESCE(MAX(queue_number), 0) as max_num
      FROM waiting_queue WHERE DATE(created_at) = ?
    `).get(today) as { max_num: number };
    const queueNumber = seqRow.max_num + 1;

    const info = db.prepare(`
      INSERT INTO waiting_queue (
        customer_name, customer_phone, people_count, status, queue_number,
        room_spec, created_by
      ) VALUES (?, ?, ?, 'waiting', ?, ?, ?)
    `).run(
      body.customerName.trim(),
      body.customerPhone.trim(),
      body.peopleCount,
      queueNumber,
      body.roomSpec ?? null,
      userId,
    );

    const row = db.prepare(`
      SELECT wq.*, r.name as room_name
      FROM waiting_queue wq
      LEFT JOIN room r ON wq.assigned_room_id = r.id
      WHERE wq.id = ?
    `).get(Number(info.lastInsertRowid));

    ok(res, mapQueueRow(row), '加入排队成功');
  } catch (e) {
    fail(res, (e as Error).message);
  }
});

router.post('/:id/call', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const { roomId } = req.body as { roomId?: number };

    const row = db.prepare('SELECT * FROM waiting_queue WHERE id = ?').get(id) as any;
    if (!row) {
      notFound(res, '排队记录不存在');
      return;
    }
    if (row.status !== 'waiting' && row.status !== 'skipped') {
      fail(res, '该记录状态不支持叫号');
      return;
    }

    const calledAt = dayjs();
    const calledExpireAt = calledAt.add(15, 'minute');

    db.prepare(`
      UPDATE waiting_queue
      SET status = 'calling', called_at = ?, called_expire_at = ?, assigned_room_id = ?
      WHERE id = ?
    `).run(
      calledAt.format('YYYY-MM-DD HH:mm:ss'),
      calledExpireAt.format('YYYY-MM-DD HH:mm:ss'),
      roomId ?? null,
      id,
    );

    const refreshed = db.prepare(`
      SELECT wq.*, r.name as room_name
      FROM waiting_queue wq
      LEFT JOIN room r ON wq.assigned_room_id = r.id
      WHERE wq.id = ?
    `).get(id);

    ok(res, mapQueueRow(refreshed), '叫号成功');
  } catch (e) {
    fail(res, (e as Error).message);
  }
});

router.post('/:id/skip', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const row = db.prepare('SELECT * FROM waiting_queue WHERE id = ?').get(id) as any;
    if (!row) {
      notFound(res, '排队记录不存在');
      return;
    }
    if (row.status !== 'calling') {
      fail(res, '仅叫号中状态可跳过');
      return;
    }

    db.prepare(`
      UPDATE waiting_queue SET status = 'skipped' WHERE id = ?
    `).run(id);

    ok(res, { id }, '已跳过，将通知下一位');
  } catch (e) {
    fail(res, (e as Error).message);
  }
});

router.post('/:id/cancel', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const row = db.prepare('SELECT * FROM waiting_queue WHERE id = ?').get(id) as any;
    if (!row) {
      notFound(res, '排队记录不存在');
      return;
    }
    if (row.status === 'seated') {
      fail(res, '已入座的记录不能取消');
      return;
    }

    db.prepare(`
      UPDATE waiting_queue SET status = 'cancelled' WHERE id = ?
    `).run(id);

    ok(res, { id }, '已取消排队');
  } catch (e) {
    fail(res, (e as Error).message);
  }
});

router.post('/:id/seated', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const { sessionId } = req.body as { sessionId?: number };
    const row = db.prepare('SELECT * FROM waiting_queue WHERE id = ?').get(id) as any;
    if (!row) {
      notFound(res, '排队记录不存在');
      return;
    }

    db.prepare(`
      UPDATE waiting_queue SET status = 'seated', session_id = ? WHERE id = ?
    `).run(sessionId ?? null, id);

    ok(res, { id }, '已确认入座');
  } catch (e) {
    fail(res, (e as Error).message);
  }
});

router.post('/auto-call-next', async (req: Request, res: Response): Promise<void> => {
  try {
    const { roomId } = req.body as { roomId?: number };

    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    db.prepare(`
      UPDATE waiting_queue
      SET status = 'skipped'
      WHERE status = 'calling' AND called_expire_at < ?
    `).run(now);

    const nextRow = db.prepare(`
      SELECT * FROM waiting_queue
      WHERE status = 'waiting'
      ORDER BY created_at ASC
      LIMIT 1
    `).get() as any;

    if (!nextRow) {
      ok(res, null, '没有等待中的客人');
      return;
    }

    const calledAt = dayjs();
    const calledExpireAt = calledAt.add(15, 'minute');

    db.prepare(`
      UPDATE waiting_queue
      SET status = 'calling', called_at = ?, called_expire_at = ?, assigned_room_id = ?
      WHERE id = ?
    `).run(
      calledAt.format('YYYY-MM-DD HH:mm:ss'),
      calledExpireAt.format('YYYY-MM-DD HH:mm:ss'),
      roomId ?? null,
      nextRow.id,
    );

    const refreshed = db.prepare(`
      SELECT wq.*, r.name as room_name
      FROM waiting_queue wq
      LEFT JOIN room r ON wq.assigned_room_id = r.id
      WHERE wq.id = ?
    `).get(nextRow.id);

    ok(res, mapQueueRow(refreshed), '已自动叫号');
  } catch (e) {
    fail(res, (e as Error).message);
  }
});

export default router;
