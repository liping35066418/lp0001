import { Router, type Request, type Response } from 'express';
import { ok, fail, notFound, forbidden, unauthorized } from '../utils/response.js';
import { authRequired, adminRequired } from '../middleware/auth.js';
import { GoodsRepository } from '../repositories/GoodsRepository.js';
import { GoodsCategoryRepository } from '../repositories/GoodsCategoryRepository.js';
import { getDb } from '../utils/db.js';
import type { Goods } from '../../shared/api-types.js';

const router = Router();
const goodsRepo = new GoodsRepository();
const categoryRepo = new GoodsCategoryRepository();
const db = getDb();

router.use(authRequired);

function mapGoods(g: {
  id: number; category_id: number; category_name?: string;
  name: string; image: string; price: number;
  stock: number; unit: string; status: string; created_at: string;
}): Goods.Goods {
  return {
    id: g.id,
    categoryId: g.category_id,
    categoryName: g.category_name,
    name: g.name,
    image: g.image || undefined,
    price: g.price,
    stock: g.stock,
    unit: g.unit,
    status: g.status as 'on_sale' | 'off_sale',
    createdAt: g.created_at,
  };
}

function mapCategory(c: { id: number; name: string; sort: number }): Goods.Category {
  return { id: c.id, name: c.name, sort: c.sort };
}

router.get('/categories', async (req: Request, res: Response): Promise<void> => {
  try {
    const { list } = categoryRepo.findAll({ orderBy: 'sort', orderDir: 'asc' });
    const categories = list.map(mapCategory);
    ok(res, categories);
  } catch (e) {
    fail(res, (e as Error).message);
  }
});

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { categoryId, status } = req.query;
    const conditions: string[] = ['1=1'];
    const params: unknown[] = [];
    if (categoryId) {
      conditions.push('g.category_id = ?');
      params.push(Number(categoryId));
    }
    if (status) {
      conditions.push('g.status = ?');
      params.push(status);
    }
    const rows = db.prepare(`
      SELECT g.*, c.name as category_name
      FROM goods g LEFT JOIN goods_category c ON g.category_id = c.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY g.id DESC
    `).all(...params) as any[];
    const list = rows.map(mapGoods);
    ok(res, list);
  } catch (e) {
    fail(res, (e as Error).message);
  }
});

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const row = db.prepare(`
      SELECT g.*, c.name as category_name
      FROM goods g LEFT JOIN goods_category c ON g.category_id = c.id
      WHERE g.id = ?
    `).get(id) as any;
    if (!row) {
      notFound(res, '商品不存在');
      return;
    }
    ok(res, mapGoods(row));
  } catch (e) {
    fail(res, (e as Error).message);
  }
});

router.post('/categories', adminRequired, async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, sort } = req.body as { name: string; sort?: number };
    if (!name) {
      fail(res, '分类名称不能为空');
      return;
    }
    const id = categoryRepo.create({
      name,
      sort: sort ?? 0,
    });
    const created = categoryRepo.findById(id);
    ok(res, created ? mapCategory(created) : null, '创建成功');
  } catch (e) {
    fail(res, (e as Error).message);
  }
});

router.post('/', adminRequired, async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as Partial<Goods.Goods> & {
      categoryId?: number; price?: number; stock?: number; image?: string;
    };
    if (!body.categoryId || !body.name || body.price === undefined || body.stock === undefined || !body.unit) {
      fail(res, '缺少必填字段');
      return;
    }
    const id = goodsRepo.create({
      category_id: body.categoryId,
      name: body.name,
      image: body.image || '',
      price: body.price,
      stock: body.stock,
      unit: body.unit,
      status: body.status || 'on_sale',
    });
    const row = db.prepare(`
      SELECT g.*, c.name as category_name
      FROM goods g LEFT JOIN goods_category c ON g.category_id = c.id
      WHERE g.id = ?
    `).get(id) as any;
    ok(res, row ? mapGoods(row) : null, '创建成功');
  } catch (e) {
    fail(res, (e as Error).message);
  }
});

router.put('/:id', adminRequired, async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const existing = goodsRepo.findById(id);
    if (!existing) {
      notFound(res, '商品不存在');
      return;
    }
    const body = req.body as Partial<Goods.Goods> & {
      categoryId?: number; price?: number; stock?: number; image?: string;
    };
    const updateData: Record<string, unknown> = {};
    if (body.categoryId !== undefined) updateData.category_id = body.categoryId;
    if (body.name !== undefined) updateData.name = body.name;
    if (body.image !== undefined) updateData.image = body.image || '';
    if (body.price !== undefined) updateData.price = body.price;
    if (body.stock !== undefined) updateData.stock = body.stock;
    if (body.unit !== undefined) updateData.unit = body.unit;
    if (body.status !== undefined) updateData.status = body.status;
    goodsRepo.update(id, updateData);
    const row = db.prepare(`
      SELECT g.*, c.name as category_name
      FROM goods g LEFT JOIN goods_category c ON g.category_id = c.id
      WHERE g.id = ?
    `).get(id) as any;
    ok(res, row ? mapGoods(row) : null, '更新成功');
  } catch (e) {
    fail(res, (e as Error).message);
  }
});

router.post('/:id/adjust-stock', adminRequired, async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const existing = goodsRepo.findById(id);
    if (!existing) {
      notFound(res, '商品不存在');
      return;
    }
    const { delta } = req.body as { delta: number };
    if (delta === undefined) {
      fail(res, '缺少调整数量');
      return;
    }
    const newStock = existing.stock + delta;
    if (newStock < 0) {
      fail(res, '库存不能为负');
      return;
    }
    goodsRepo.update(id, { stock: newStock });
    const row = db.prepare(`
      SELECT g.*, c.name as category_name
      FROM goods g LEFT JOIN goods_category c ON g.category_id = c.id
      WHERE g.id = ?
    `).get(id) as any;
    ok(res, row ? mapGoods(row) : null, '调整成功');
  } catch (e) {
    fail(res, (e as Error).message);
  }
});

export default router;
