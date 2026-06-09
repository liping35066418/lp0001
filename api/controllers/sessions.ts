import { Router, type Request, type Response } from 'express';
import { ok, fail, notFound, forbidden, unauthorized } from '../utils/response.js';
import { authRequired } from '../middleware/auth.js';
import { SessionService } from '../services/SessionService.js';
import { SessionGoodsItemRepository } from '../repositories/SessionGoodsItemRepository.js';
import { InventoryService } from '../services/InventoryService.js';
import { getDb } from '../utils/db.js';
import { PricingService } from '../services/PricingService.js';
import dayjs from 'dayjs';
import type { Session, Goods, Rental } from '../../shared/api-types.js';

const router = Router();
const sessionGoodsItemRepo = new SessionGoodsItemRepository();
const db = getDb();

router.use(authRequired);

function mapSessionWithExtras(row: {
  id: number; room_id: number; room_name: string; reservation_id?: number;
  customer_name?: string; customer_phone?: string; people_count: number;
  start_at: string; scheduled_end_at: string; actual_end_at?: string;
  status: string; room_fee: number; overtime_fee: number; rental_fee: number;
  goods_fee: number; discount_amount: number; total_amount: number;
  created_by: number; created_at: string;
}): Session.Session & { roomName?: string; elapsedMinutes: number; overtimeMinutes: number } {
  const basePrice = (db.prepare('SELECT base_price FROM room WHERE id = ?').get(row.room_id) as { base_price: number } | undefined)?.base_price ?? 0;
  const calc = PricingService.calculateRoomFee(basePrice, row.start_at, row.scheduled_end_at, row.status === 'completed' && row.actual_end_at ? row.actual_end_at : undefined);
  return {
    id: row.id,
    roomId: row.room_id,
    roomName: row.room_name,
    reservationId: row.reservation_id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    peopleCount: row.people_count,
    startAt: row.start_at,
    scheduledEndAt: row.scheduled_end_at,
    actualEndAt: row.actual_end_at,
    elapsedMinutes: calc.elapsedMinutes,
    overtimeMinutes: calc.overtimeMinutes,
    status: row.status as Session.Status,
    roomFee: row.room_fee,
    overtimeFee: row.overtime_fee,
    rentalFee: row.rental_fee,
    goodsFee: row.goods_fee,
    discountAmount: row.discount_amount,
    totalAmount: row.total_amount,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

router.get('/active', async (req: Request, res: Response): Promise<void> => {
  try {
    const rows = db.prepare(`
      SELECT s.*, r.name as room_name
      FROM session s LEFT JOIN room r ON s.room_id = r.id
      WHERE s.status = 'active'
      ORDER BY s.start_at DESC
    `).all() as any[];
    const list = rows.map((row) => {
      const session = mapSessionWithExtras(row);
      const goodsRows = sessionGoodsItemRepo.findBySession(row.id);
      const goodsItems: Goods.GoodsItemInBill[] = goodsRows.map((g) => ({
        id: g.id,
        goodsId: g.goods_id,
        name: g.goods_name,
        quantity: g.quantity,
        unitPrice: g.unit_price,
        subtotal: g.subtotal,
      }));
      const rentalRows = db.prepare(`
        SELECT rt.*, b.name as boardgame_name
        FROM rental rt LEFT JOIN boardgame b ON rt.boardgame_id = b.id
        WHERE rt.session_id = ?
        ORDER BY rt.rented_at DESC
      `).all(row.id) as any[];
      const rentals: Rental.RentalInfo[] = rentalRows.map((r) => ({
        id: r.id,
        boardgameId: r.boardgame_id,
        boardgameName: r.boardgame_name || `桌游#${r.boardgame_id}`,
        rentalFee: r.rental_fee,
        depositCollected: r.deposit_collected,
        status: r.status as Rental.Status,
      }));
      return {
        ...session,
        goodsItems,
        rentals,
      } as Session.SessionDetail;
    });
    ok(res, list);
  } catch (e) {
    fail(res, (e as Error).message);
  }
});

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const row = db.prepare(`
      SELECT s.*, r.name as room_name
      FROM session s LEFT JOIN room r ON s.room_id = r.id
      WHERE s.id = ?
    `).get(id) as any;
    if (!row) {
      notFound(res, '场次不存在');
      return;
    }
    const session = mapSessionWithExtras(row);
    const goodsRows = sessionGoodsItemRepo.findBySession(id);
    const goodsItems: Goods.GoodsItemInBill[] = goodsRows.map((g) => ({
      id: g.id,
      goodsId: g.goods_id,
      name: g.goods_name,
      quantity: g.quantity,
      unitPrice: g.unit_price,
      subtotal: g.subtotal,
    }));
    const rentalRows = db.prepare(`
      SELECT rt.*, b.name as boardgame_name
      FROM rental rt LEFT JOIN boardgame b ON rt.boardgame_id = b.id
      WHERE rt.session_id = ?
      ORDER BY rt.rented_at DESC
    `).all(id) as any[];
    const rentals: Rental.RentalInfo[] = rentalRows.map((r) => ({
      id: r.id,
      boardgameId: r.boardgame_id,
      boardgameName: r.boardgame_name || `桌游#${r.boardgame_id}`,
      rentalFee: r.rental_fee,
      depositCollected: r.deposit_collected,
      status: r.status as Rental.Status,
    }));
    const detail: Session.SessionDetail = {
      ...session,
      goodsItems,
      rentals,
    };
    ok(res, detail);
  } catch (e) {
    fail(res, (e as Error).message);
  }
});

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as Session.CreateSessionReq;
    if (!body.roomId || body.hours === undefined || body.peopleCount === undefined) {
      fail(res, '缺少必填字段');
      return;
    }
    const userId = req.user?.id || 0;
    const session = SessionService.create(body, userId);
    const refreshed = SessionService.refreshSessionCost(session.id);
    ok(res, refreshed, '创建成功');
  } catch (e) {
    fail(res, (e as Error).message);
  }
});

router.post('/:id/extend', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const { addHours } = req.body as { addHours: number };
    if (addHours === undefined || addHours <= 0) {
      fail(res, '续时时长无效');
      return;
    }
    const session = SessionService.extend(id, addHours);
    ok(res, session, '续时成功');
  } catch (e) {
    fail(res, (e as Error).message);
  }
});

router.post('/:id/add-goods', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const session = SessionService.getById(id);
    if (!session) {
      notFound(res, '场次不存在');
      return;
    }
    if (session.status !== 'active') {
      fail(res, '场次状态不支持添加商品');
      return;
    }
    const { goodsId, quantity } = req.body as { goodsId: number; quantity: number };
    if (!goodsId || !quantity || quantity <= 0) {
      fail(res, '参数无效');
      return;
    }
    const goodsRow = db.prepare('SELECT * FROM goods WHERE id = ?').get(goodsId) as {
      id: number; name: string; price: number; stock: number; status: string;
    } | undefined;
    if (!goodsRow) {
      notFound(res, '商品不存在');
      return;
    }
    if (goodsRow.status !== 'on_sale') {
      fail(res, '商品已下架');
      return;
    }
    InventoryService.decrementGoodsStock(goodsId, quantity);
    const subtotal = Number((goodsRow.price * quantity).toFixed(2));
    sessionGoodsItemRepo.create({
      session_id: id,
      goods_id: goodsId,
      goods_name: goodsRow.name,
      quantity,
      unit_price: goodsRow.price,
      subtotal,
    });
    const newGoodsFee = Number((session.goodsFee + subtotal).toFixed(2));
    const newTotal = Number((session.totalAmount + subtotal).toFixed(2));
    db.prepare('UPDATE session SET goods_fee = ?, total_amount = ? WHERE id = ?').run(newGoodsFee, newTotal, id);
    const updated = SessionService.getById(id);
    ok(res, updated, '添加成功');
  } catch (e) {
    fail(res, (e as Error).message);
  }
});

async function handleRefreshFees(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const refreshed = SessionService.refreshSessionCost(id);
    const row = db.prepare(`
      SELECT s.*, r.name as room_name
      FROM session s LEFT JOIN room r ON s.room_id = r.id
      WHERE s.id = ?
    `).get(id) as any;
    let detail: Session.SessionDetail | null = null;
    if (row) {
      const session = mapSessionWithExtras(row);
      const goodsRows = sessionGoodsItemRepo.findBySession(id);
      const goodsItems: Goods.GoodsItemInBill[] = goodsRows.map((g) => ({
        id: g.id,
        goodsId: g.goods_id,
        name: g.goods_name,
        quantity: g.quantity,
        unitPrice: g.unit_price,
        subtotal: g.subtotal,
      }));
      const rentalRows = db.prepare(`
        SELECT rt.*, b.name as boardgame_name
        FROM rental rt LEFT JOIN boardgame b ON rt.boardgame_id = b.id
        WHERE rt.session_id = ?
        ORDER BY rt.rented_at DESC
      `).all(id) as any[];
      const rentals: Rental.RentalInfo[] = rentalRows.map((r) => ({
        id: r.id,
        boardgameId: r.boardgame_id,
        boardgameName: r.boardgame_name || `桌游#${r.boardgame_id}`,
        rentalFee: r.rental_fee,
        depositCollected: r.deposit_collected,
        status: r.status as Rental.Status,
      }));
      detail = {
        ...session,
        goodsItems,
        rentals,
      };
    }
    ok(res, detail, '刷新成功');
  } catch (e) {
    fail(res, (e as Error).message);
  }
}

router.post('/:id/refresh-fees', handleRefreshFees);
router.post('/:id/refresh', handleRefreshFees);

export default router;
