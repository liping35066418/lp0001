import { Router, type Request, type Response } from 'express';
import { ok, fail, notFound, forbidden, unauthorized } from '../utils/response.js';
import { authRequired } from '../middleware/auth.js';
import { RentalRepository } from '../repositories/RentalRepository.js';
import { InventoryService } from '../services/InventoryService.js';
import { getDb } from '../utils/db.js';
import dayjs from 'dayjs';
import type { Rental, Session } from '../../shared/api-types.js';

const router = Router();
const rentalRepo = new RentalRepository();
const db = getDb();

router.use(authRequired);

function mapRental(r: {
  id: number; session_id?: number; session_room_name?: string; customer_name?: string;
  boardgame_id: number; boardgame_name?: string;
  deposit_collected: number; rental_fee: number; accessories_checked: string;
  status: string; rented_at: string; returned_at?: string;
  accessories_returned?: string; damage_fee: number; deposit_refunded: number;
  created_by: number; remark?: string;
}): Rental.Rental {
  return {
    id: r.id,
    sessionId: r.session_id,
    sessionRoomName: r.session_room_name,
    customerName: r.customer_name,
    boardgameId: r.boardgame_id,
    boardgameName: r.boardgame_name,
    depositCollected: r.deposit_collected,
    rentalFee: r.rental_fee,
    accessoriesChecked: r.accessories_checked,
    status: r.status as Rental.Status,
    rentedAt: r.rented_at,
    returnedAt: r.returned_at,
    accessoriesReturned: r.accessories_returned,
    damageFee: r.damage_fee,
    depositRefunded: r.deposit_refunded,
    createdBy: r.created_by,
    remark: r.remark,
  };
}

function findRentalWithDetails(id: number): (ReturnType<typeof mapRental> | null) {
  const row = db.prepare(`
    SELECT rt.*, b.name as boardgame_name, rm.name as session_room_name,
           s.customer_name as customer_name
    FROM rental rt
    LEFT JOIN boardgame b ON rt.boardgame_id = b.id
    LEFT JOIN session s ON rt.session_id = s.id
    LEFT JOIN room rm ON s.room_id = rm.id
    WHERE rt.id = ?
  `).get(id) as any;
  return row ? mapRental(row) : null;
}

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, sessionId } = req.query;
    const conditions: string[] = ['1=1'];
    const params: unknown[] = [];
    if (status) {
      conditions.push('rt.status = ?');
      params.push(status);
    }
    if (sessionId) {
      conditions.push('rt.session_id = ?');
      params.push(Number(sessionId));
    }
    const rows = db.prepare(`
      SELECT rt.*, b.name as boardgame_name, rm.name as session_room_name,
             s.customer_name as customer_name
      FROM rental rt
      LEFT JOIN boardgame b ON rt.boardgame_id = b.id
      LEFT JOIN session s ON rt.session_id = s.id
      LEFT JOIN room rm ON s.room_id = rm.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY rt.rented_at DESC
    `).all(...params) as any[];
    const list = rows.map(mapRental);
    ok(res, list);
  } catch (e) {
    fail(res, (e as Error).message);
  }
});

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const data = findRentalWithDetails(id);
    if (!data) {
      notFound(res, '租借记录不存在');
      return;
    }
    ok(res, data);
  } catch (e) {
    fail(res, (e as Error).message);
  }
});

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as Rental.CreateRentalReq;
    if (!body.boardgameId || body.depositCollected === undefined || !body.accessoriesChecked) {
      fail(res, '缺少必填字段');
      return;
    }
    if (!InventoryService.verifyBoardgameAvailable(body.boardgameId)) {
      fail(res, '桌游库存不足或已下架');
      return;
    }
    const boardgame = db.prepare('SELECT * FROM boardgame WHERE id = ?').get(body.boardgameId) as {
      rental_fee: number; deposit: number;
    } | undefined;
    if (!boardgame) {
      notFound(res, '桌游不存在');
      return;
    }
    const userId = req.user?.id || 0;
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');

    const id = db.transaction(() => {
      const stmt = db.prepare(`
        INSERT INTO rental (
          session_id, boardgame_id, deposit_collected, rental_fee,
          accessories_checked, status, rented_at, damage_fee,
          deposit_refunded, created_by, remark
        ) VALUES (?, ?, ?, ?, ?, 'active', ?, 0, 0, ?, ?)
      `);
      const info = stmt.run(
        body.sessionId ?? null,
        body.boardgameId,
        body.depositCollected,
        boardgame.rental_fee,
        body.accessoriesChecked,
        now,
        userId,
        body.remark || '',
      );
      InventoryService.decrementBoardgameStock(body.boardgameId);

      if (body.sessionId) {
        const session = db.prepare('SELECT rental_fee, total_amount FROM session WHERE id = ?').get(body.sessionId) as { rental_fee: number; total_amount: number } | undefined;
        if (session) {
          const newRentalFee = Number((session.rental_fee + boardgame.rental_fee).toFixed(2));
          const newTotal = Number((session.total_amount + boardgame.rental_fee).toFixed(2));
          db.prepare('UPDATE session SET rental_fee = ?, total_amount = ? WHERE id = ?').run(newRentalFee, newTotal, body.sessionId);
        }
      }
      return Number(info.lastInsertRowid);
    })();

    const data = findRentalWithDetails(id);
    ok(res, data, '创建成功');
  } catch (e) {
    fail(res, (e as Error).message);
  }
});

router.put('/:id/return', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const existing = rentalRepo.findById(id);
    if (!existing) {
      notFound(res, '租借记录不存在');
      return;
    }
    if (existing.status !== 'active') {
      fail(res, '只有进行中的租借可以归还');
      return;
    }
    const body = req.body as Rental.ReturnRentalReq & { accessoriesReturned: string; damageFee?: number; remark?: string };
    if (!body.accessoriesReturned) {
      fail(res, '缺少归还配件信息');
      return;
    }
    const damageFee = body.damageFee ?? 0;
    const depositRefunded = Math.max(0, existing.deposit_collected - damageFee);
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    const finalStatus: Rental.Status = damageFee > 0 ? 'damaged' : 'returned';

    db.transaction(() => {
      db.prepare(`
        UPDATE rental
        SET status = ?, returned_at = ?, accessories_returned = ?,
            damage_fee = ?, deposit_refunded = ?, remark = ?
        WHERE id = ?
      `).run(
        finalStatus,
        now,
        body.accessoriesReturned,
        damageFee,
        depositRefunded,
        body.remark || existing.remark || '',
        id,
      );
      InventoryService.incrementBoardgameStock(existing.boardgame_id);
    })();

    const data = findRentalWithDetails(id);
    ok(res, data, '归还成功');
  } catch (e) {
    fail(res, (e as Error).message);
  }
});

export default router;
