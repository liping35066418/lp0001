import { Router, type Request, type Response } from 'express';
import { ok, fail, notFound, forbidden, unauthorized } from '../utils/response.js';
import { authRequired, adminRequired } from '../middleware/auth.js';
import { BoardgameRepository } from '../repositories/BoardgameRepository.js';
import type { Boardgame } from '../../shared/api-types.js';

const router = Router();
const boardgameRepo = new BoardgameRepository();

router.use(authRequired);

function mapBoardgame(b: {
  id: number; name: string; cover_image: string; category: string;
  difficulty: string; min_players: number; max_players: number;
  play_minutes: number; accessories: string; deposit: number;
  rental_fee: number; stock_total: number; stock_available: number;
  status: string; remark: string; created_at: string;
}): Boardgame.Boardgame {
  return {
    id: b.id,
    name: b.name,
    coverImage: b.cover_image || undefined,
    category: b.category,
    difficulty: b.difficulty as Boardgame.Difficulty,
    minPlayers: b.min_players,
    maxPlayers: b.max_players,
    playMinutes: b.play_minutes,
    accessories: b.accessories,
    deposit: b.deposit,
    rentalFee: b.rental_fee,
    stockTotal: b.stock_total,
    stockAvailable: b.stock_available,
    status: b.status as 'active' | 'archived',
    remark: b.remark || undefined,
    createdAt: b.created_at,
  };
}

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { category, difficulty, status } = req.query;
    const conditions: string[] = ['1=1'];
    const params: unknown[] = [];
    if (category) {
      conditions.push('category = ?');
      params.push(category);
    }
    if (difficulty) {
      conditions.push('difficulty = ?');
      params.push(difficulty);
    }
    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }
    const sql = `SELECT * FROM boardgame WHERE ${conditions.join(' AND ')} ORDER BY id DESC`;
    const rows = boardgameRepo.query(sql, params) as any[];
    const list = rows.map(mapBoardgame);
    ok(res, list);
  } catch (e) {
    fail(res, (e as Error).message);
  }
});

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const b = boardgameRepo.findById(id);
    if (!b) {
      notFound(res, '桌游不存在');
      return;
    }
    ok(res, mapBoardgame(b));
  } catch (e) {
    fail(res, (e as Error).message);
  }
});

router.post('/', adminRequired, async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as Partial<Boardgame.Boardgame> & {
      minPlayers?: number; maxPlayers?: number; playMinutes?: number;
      stockTotal?: number; stockAvailable?: number; rentalFee?: number;
      coverImage?: string;
    };
    if (!body.name || !body.category || !body.difficulty) {
      fail(res, '缺少必填字段');
      return;
    }
    const id = boardgameRepo.create({
      name: body.name,
      cover_image: body.coverImage || '',
      category: body.category,
      difficulty: body.difficulty,
      min_players: body.minPlayers ?? 2,
      max_players: body.maxPlayers ?? 6,
      play_minutes: body.playMinutes ?? 60,
      accessories: body.accessories || '',
      deposit: body.deposit ?? 0,
      rental_fee: body.rentalFee ?? 0,
      stock_total: body.stockTotal ?? 1,
      stock_available: body.stockAvailable ?? body.stockTotal ?? 1,
      status: body.status || 'active',
      remark: body.remark || '',
    });
    const created = boardgameRepo.findById(id);
    ok(res, created ? mapBoardgame(created) : null, '创建成功');
  } catch (e) {
    fail(res, (e as Error).message);
  }
});

router.put('/:id', adminRequired, async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const existing = boardgameRepo.findById(id);
    if (!existing) {
      notFound(res, '桌游不存在');
      return;
    }
    const body = req.body as Partial<Boardgame.Boardgame> & {
      minPlayers?: number; maxPlayers?: number; playMinutes?: number;
      stockTotal?: number; stockAvailable?: number; rentalFee?: number;
      coverImage?: string;
    };
    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.coverImage !== undefined) updateData.cover_image = body.coverImage || '';
    if (body.category !== undefined) updateData.category = body.category;
    if (body.difficulty !== undefined) updateData.difficulty = body.difficulty;
    if (body.minPlayers !== undefined) updateData.min_players = body.minPlayers;
    if (body.maxPlayers !== undefined) updateData.max_players = body.maxPlayers;
    if (body.playMinutes !== undefined) updateData.play_minutes = body.playMinutes;
    if (body.accessories !== undefined) updateData.accessories = body.accessories || '';
    if (body.deposit !== undefined) updateData.deposit = body.deposit;
    if (body.rentalFee !== undefined) updateData.rental_fee = body.rentalFee;
    if (body.stockTotal !== undefined) updateData.stock_total = body.stockTotal;
    if (body.stockAvailable !== undefined) updateData.stock_available = body.stockAvailable;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.remark !== undefined) updateData.remark = body.remark || '';
    boardgameRepo.update(id, updateData);
    const updated = boardgameRepo.findById(id);
    ok(res, updated ? mapBoardgame(updated) : null, '更新成功');
  } catch (e) {
    fail(res, (e as Error).message);
  }
});

router.post('/:id/archive', adminRequired, async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const existing = boardgameRepo.findById(id);
    if (!existing) {
      notFound(res, '桌游不存在');
      return;
    }
    boardgameRepo.update(id, { status: 'archived' });
    ok(res, null, '归档成功');
  } catch (e) {
    fail(res, (e as Error).message);
  }
});

export default router;
