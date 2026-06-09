import { Router, type Request, type Response } from 'express';
import { ok, fail, notFound, forbidden, unauthorized } from '../utils/response.js';
import { authRequired, adminRequired } from '../middleware/auth.js';
import { getDb } from '../utils/db.js';
import dayjs from 'dayjs';
import type { Reports } from '../../shared/api-types.js';

const router = Router();
const db = getDb();

router.use(authRequired, adminRequired);

router.get('/revenue', async (req: Request, res: Response): Promise<void> => {
  try {
    const { period = 'day' } = req.query;
    let startDate: dayjs.Dayjs;
    let dateFormat: string;
    let groupFormat: string;

    switch (period) {
      case 'week':
        startDate = dayjs().subtract(7, 'day');
        dateFormat = 'YYYY-MM-DD';
        groupFormat = '%Y-%m-%d';
        break;
      case 'month':
        startDate = dayjs().subtract(30, 'day');
        dateFormat = 'YYYY-MM-DD';
        groupFormat = '%Y-%m-%d';
        break;
      case 'day':
      default:
        startDate = dayjs().subtract(1, 'day');
        dateFormat = 'YYYY-MM-DD';
        groupFormat = '%Y-%m-%d';
        break;
    }

    const startStr = startDate.format(dateFormat);
    const rows = db.prepare(`
      SELECT
        DATE(created_at) as date,
        COALESCE(SUM(total_amount), 0) as revenue,
        COUNT(*) as bill_count
      FROM bill
      WHERE DATE(created_at) >= ?
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `).all(startStr) as Array<{ date: string; revenue: number; bill_count: number }>;

    const dataMap = new Map<string, { revenue: number; billCount: number }>();
    for (const r of rows) {
      dataMap.set(r.date, { revenue: Number(r.revenue), billCount: r.bill_count });
    }

    const result: Reports.RevenuePoint[] = [];
    const days = period === 'week' ? 7 : period === 'month' ? 30 : 2;
    for (let i = days - 1; i >= 0; i--) {
      const d = dayjs().subtract(i, 'day').format(dateFormat);
      const entry = dataMap.get(d);
      result.push({
        date: d,
        revenue: entry?.revenue ?? 0,
        billCount: entry?.billCount ?? 0,
      });
    }

    ok(res, result);
  } catch (e) {
    fail(res, (e as Error).message);
  }
});

router.get('/room-usage', async (req: Request, res: Response): Promise<void> => {
  try {
    const { start, end } = req.query;
    if (!start || !end) {
      fail(res, '请提供开始和结束日期');
      return;
    }
    const startStr = String(start);
    const endStr = String(end);

    const rooms = db.prepare("SELECT id, name FROM room WHERE status != 'disabled' ORDER BY id ASC").all() as Array<{ id: number; name: string }>;

    const businessMinutes = 12 * 60;
    const days = Math.max(1, dayjs(endStr).diff(dayjs(startStr), 'day') + 1);

    const result: Reports.RoomUsageStat[] = rooms.map((room) => {
      const sessionStats = db.prepare(`
        SELECT
          COALESCE(SUM(
            CASE
              WHEN actual_end_at IS NOT NULL THEN
                MAX(0, CAST((julianday(actual_end_at) - julianday(start_at)) * 1440 AS INTEGER))
              ELSE
                MAX(0, CAST((julianday(scheduled_end_at) - julianday(start_at)) * 1440 AS INTEGER))
            END
          ), 0) as used_minutes,
          COALESCE(SUM(total_amount), 0) as revenue
        FROM session
        WHERE room_id = ?
        AND DATE(start_at) >= ?
        AND DATE(start_at) <= ?
        AND status IN ('active', 'completed')
      `).get(room.id, startStr, endStr) as { used_minutes: number; revenue: number };

      const totalAvailable = days * businessMinutes;
      const usedMinutes = Number(sessionStats.used_minutes);
      const utilizationRate = totalAvailable > 0
        ? Number((usedMinutes / totalAvailable).toFixed(4))
        : 0;

      return {
        roomId: room.id,
        roomName: room.name,
        usedMinutes,
        utilizationRate,
        revenue: Number(Number(sessionStats.revenue).toFixed(2)),
      };
    });

    ok(res, result);
  } catch (e) {
    fail(res, (e as Error).message);
  }
});

router.get('/boardgame-rank', async (req: Request, res: Response): Promise<void> => {
  try {
    const { start, end, limit = 10 } = req.query;
    if (!start || !end) {
      fail(res, '请提供开始和结束日期');
      return;
    }
    const startStr = String(start);
    const endStr = String(end);
    const limitNum = Number(limit) || 10;

    const rows = db.prepare(`
      SELECT
        rt.boardgame_id as boardgame_id,
        b.name as name,
        COUNT(*) as rental_count,
        COALESCE(SUM(rt.rental_fee), 0) as revenue
      FROM rental rt
      LEFT JOIN boardgame b ON rt.boardgame_id = b.id
      WHERE DATE(rt.rented_at) >= ?
      AND DATE(rt.rented_at) <= ?
      GROUP BY rt.boardgame_id, b.name
      ORDER BY rental_count DESC, revenue DESC
      LIMIT ?
    `).all(startStr, endStr, limitNum) as Array<{
      boardgame_id: number; name: string; rental_count: number; revenue: number;
    }>;

    const result: Reports.BoardgameRentalRank[] = rows.map((r) => ({
      boardgameId: r.boardgame_id,
      name: r.name,
      rentalCount: r.rental_count,
      revenue: Number(Number(r.revenue).toFixed(2)),
    }));

    ok(res, result);
  } catch (e) {
    fail(res, (e as Error).message);
  }
});

export default router;
