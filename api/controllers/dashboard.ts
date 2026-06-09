import { Router, type Request, type Response } from 'express';
import { ok, fail, notFound, forbidden, unauthorized } from '../utils/response.js';
import { authRequired } from '../middleware/auth.js';
import { getDb } from '../utils/db.js';
import dayjs from 'dayjs';
import type { Reports, Room, Reservation, Session } from '../../shared/api-types.js';

const router = Router();
const db = getDb();

router.use(authRequired);

router.get('/overview', async (req: Request, res: Response): Promise<void> => {
  try {
    const today = dayjs().format('YYYY-MM-DD');
    const weekAgo = dayjs().subtract(7, 'day').format('YYYY-MM-DD');
    const monthAgo = dayjs().subtract(30, 'day').format('YYYY-MM-DD');
    const prevMonthAgo = dayjs().subtract(60, 'day').format('YYYY-MM-DD');

    const todayStats = db.prepare(`
      SELECT COALESCE(SUM(total_amount), 0) as revenue, COUNT(*) as count
      FROM bill WHERE DATE(created_at) = ?
    `).get(today) as { revenue: number; count: number };

    const weekStats = db.prepare(`
      SELECT COALESCE(SUM(total_amount), 0) as revenue
      FROM bill WHERE DATE(created_at) >= ?
    `).get(weekAgo) as { revenue: number };

    const monthStats = db.prepare(`
      SELECT COALESCE(SUM(total_amount), 0) as revenue
      FROM bill WHERE DATE(created_at) >= ?
    `).get(monthAgo) as { revenue: number };

    const prevMonthStats = db.prepare(`
      SELECT COALESCE(SUM(total_amount), 0) as revenue
      FROM bill WHERE DATE(created_at) >= ? AND DATE(created_at) < ?
    `).get(prevMonthAgo, monthAgo) as { revenue: number };

    const todaySessionsMinutes = db.prepare(`
      SELECT COALESCE(SUM(
        CASE
          WHEN actual_end_at IS NOT NULL THEN
            MAX(0, CAST((julianday(actual_end_at) - julianday(start_at)) * 1440 AS INTEGER))
          ELSE
            MAX(0, CAST((julianday('now', 'localtime') - julianday(start_at)) * 1440 AS INTEGER))
        END
      ), 0) as total_minutes
      FROM session
      WHERE DATE(start_at) = ? AND status IN ('active', 'completed')
    `).get(today) as { total_minutes: number };

    const roomCount = (db.prepare("SELECT COUNT(*) as c FROM room WHERE status != 'disabled'").get() as { c: number }).c;
    const businessMinutes = 12 * 60;
    const totalAvailableMinutes = roomCount * businessMinutes;
    const roomUtilization = totalAvailableMinutes > 0
      ? Number((todaySessionsMinutes.total_minutes / totalAvailableMinutes).toFixed(4))
      : 0;

    const overtimeSessions = db.prepare(`
      SELECT COUNT(*) as c FROM session
      WHERE status = 'active' AND scheduled_end_at < datetime('now', 'localtime')
    `).get() as { c: number };

    const upcomingReservations = db.prepare(`
      SELECT COUNT(*) as c FROM reservation
      WHERE status = 'pending'
      AND DATE(start_at) = ?
      AND start_at <= datetime('now', 'localtime', '+30 minutes')
    `).get(today) as { c: number };

    const monthOnMonth = prevMonthStats.revenue > 0
      ? Number(((monthStats.revenue - prevMonthStats.revenue) / prevMonthStats.revenue).toFixed(4))
      : (monthStats.revenue > 0 ? 1 : 0);

    const data: Reports.OverviewData = {
      todayRevenue: Number(todayStats.revenue.toFixed(2)),
      todayBillCount: todayStats.count,
      todayAvgBill: todayStats.count > 0 ? Number((todayStats.revenue / todayStats.count).toFixed(2)) : 0,
      todayRoomUtilization: roomUtilization,
      weekRevenue: Number(weekStats.revenue.toFixed(2)),
      monthRevenue: Number(monthStats.revenue.toFixed(2)),
      monthOnMonth: monthOnMonth,
      pendingReminders: overtimeSessions.c + upcomingReservations.c,
    };
    ok(res, data);
  } catch (e) {
    fail(res, (e as Error).message);
  }
});

router.get('/room-status', async (req: Request, res: Response): Promise<void> => {
  try {
    const rooms = db.prepare(`
      SELECT r.*,
        s.id as session_id, s.start_at as session_start, s.scheduled_end_at as session_end
      FROM room r
      LEFT JOIN session s ON s.room_id = r.id AND s.status = 'active'
      ORDER BY r.id ASC
    `).all() as Array<{
      id: number; name: string; spec: string; capacity: number;
      base_price: number; status: string; description: string; created_at: string;
      session_id?: number; session_start?: string; session_end?: string;
    }>;

    const today = dayjs().format('YYYY-MM-DD');
    const result: Room.RoomStatus[] = rooms.map((r) => {
      const todayCount = (db.prepare(`
        SELECT COUNT(*) as c FROM reservation
        WHERE room_id = ? AND DATE(start_at) = ?
      `).get(r.id, today) as { c: number }).c;

      let currentState: Room.CurrentState = 'idle';
      if (r.status === 'maintenance') {
        currentState = 'maintenance';
      } else if (r.session_id) {
        currentState = 'in_use';
      } else {
        const hasPending = (db.prepare(`
          SELECT COUNT(*) as c FROM reservation
          WHERE room_id = ? AND status = 'pending'
          AND start_at <= datetime('now', 'localtime', '+15 minutes')
          AND end_at > datetime('now', 'localtime')
        `).get(r.id) as { c: number }).c;
        if (hasPending > 0) currentState = 'reserved';
      }

      let remainingMinutes: number | undefined;
      if (r.session_end) {
        remainingMinutes = Math.max(0, dayjs(r.session_end).diff(dayjs(), 'minute'));
      }

      return {
        id: r.id,
        name: r.name,
        spec: r.spec as Room.Spec,
        capacity: r.capacity,
        basePrice: r.base_price,
        status: r.status as Room.Status,
        description: r.description || undefined,
        createdAt: r.created_at,
        currentState,
        currentSessionId: r.session_id,
        remainingMinutes,
        todayReservationCount: todayCount,
      };
    });

    ok(res, result);
  } catch (e) {
    fail(res, (e as Error).message);
  }
});

router.get('/today-reservations', async (req: Request, res: Response): Promise<void> => {
  try {
    const today = dayjs().format('YYYY-MM-DD');
    const rows = db.prepare(`
      SELECT r.*, rm.name as room_name
      FROM reservation r
      LEFT JOIN room rm ON r.room_id = rm.id
      WHERE DATE(r.start_at) = ?
      ORDER BY r.start_at ASC
    `).all(today) as Array<{
      id: number; room_id: number; room_name?: string;
      customer_name: string; customer_phone: string; people_count: number;
      start_at: string; end_at: string; status: string;
      deposit_amount: number; remark: string;
      created_by: number; session_id?: number; created_at: string;
    }>;

    const reservations: Reservation.Reservation[] = rows.map((r) => ({
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
    }));

    ok(res, reservations);
  } catch (e) {
    fail(res, (e as Error).message);
  }
});

export default router;
