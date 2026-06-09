import { Router, type Request, type Response } from 'express';
import { ok, fail, notFound, forbidden, unauthorized } from '../utils/response.js';
import { authRequired, adminRequired } from '../middleware/auth.js';
import { RoomRepository } from '../repositories/RoomRepository.js';
import type { Room } from '../../shared/api-types.js';

const router = Router();
const roomRepo = new RoomRepository();

router.use(authRequired);

function mapRoom(r: {
  id: number; name: string; spec: string; capacity: number;
  base_price: number; status: string; description: string; created_at: string;
}): Room.Room {
  return {
    id: r.id,
    name: r.name,
    spec: r.spec as Room.Spec,
    capacity: r.capacity,
    basePrice: r.base_price,
    status: r.status as Room.Status,
    description: r.description || undefined,
    createdAt: r.created_at,
  };
}

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { list } = roomRepo.findAll({ orderBy: 'id', orderDir: 'asc' });
    const rooms = list.map(mapRoom);
    ok(res, rooms);
  } catch (e) {
    fail(res, (e as Error).message);
  }
});

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const r = roomRepo.findById(id);
    if (!r) {
      notFound(res, '包厢不存在');
      return;
    }
    ok(res, mapRoom(r));
  } catch (e) {
    fail(res, (e as Error).message);
  }
});

router.post('/', adminRequired, async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, spec, capacity, basePrice, status, description } = req.body as Partial<Room.Room> & { basePrice?: number };
    if (!name || !spec || capacity === undefined || basePrice === undefined) {
      fail(res, '缺少必填字段');
      return;
    }
    const id = roomRepo.create({
      name,
      spec,
      capacity,
      base_price: basePrice,
      status: status || 'available',
      description: description || '',
    });
    const created = roomRepo.findById(id);
    ok(res, created ? mapRoom(created) : null, '创建成功');
  } catch (e) {
    fail(res, (e as Error).message);
  }
});

router.put('/:id', adminRequired, async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const existing = roomRepo.findById(id);
    if (!existing) {
      notFound(res, '包厢不存在');
      return;
    }
    const body = req.body as Partial<Room.Room> & { basePrice?: number };
    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.spec !== undefined) updateData.spec = body.spec;
    if (body.capacity !== undefined) updateData.capacity = body.capacity;
    if (body.basePrice !== undefined) updateData.base_price = body.basePrice;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.description !== undefined) updateData.description = body.description || '';
    roomRepo.update(id, updateData);
    const updated = roomRepo.findById(id);
    ok(res, updated ? mapRoom(updated) : null, '更新成功');
  } catch (e) {
    fail(res, (e as Error).message);
  }
});

router.delete('/:id', adminRequired, async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const existing = roomRepo.findById(id);
    if (!existing) {
      notFound(res, '包厢不存在');
      return;
    }
    roomRepo.update(id, { status: 'disabled' });
    ok(res, null, '删除成功');
  } catch (e) {
    fail(res, (e as Error).message);
  }
});

export default router;
