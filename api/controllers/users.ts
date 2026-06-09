import { Router, type Request, type Response } from 'express';
import { ok, fail, notFound, forbidden, unauthorized } from '../utils/response.js';
import { authRequired, adminRequired } from '../middleware/auth.js';
import { UserRepository } from '../repositories/UserRepository.js';
import { AuthService } from '../services/AuthService.js';
import type { User } from '../../shared/api-types.js';

const router = Router();
const userRepo = new UserRepository();

router.use(authRequired, adminRequired);

function mapUser(u: {
  id: number; username: string; password_hash: string;
  real_name: string; role: string; phone: string;
  status: string; last_login_at: string; created_at: string;
}): User.User {
  return {
    id: u.id,
    username: u.username,
    realName: u.real_name,
    role: u.role as User.Role,
    phone: u.phone || undefined,
    status: u.status as 'active' | 'disabled',
    lastLoginAt: u.last_login_at || undefined,
    createdAt: u.created_at,
  };
}

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { list } = userRepo.findAll({ orderBy: 'id', orderDir: 'desc' });
    const users = list.map(mapUser);
    ok(res, users);
  } catch (e) {
    fail(res, (e as Error).message);
  }
});

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as User.CreateUserReq;
    if (!body.username || !body.password || !body.realName || !body.role) {
      fail(res, '缺少必填字段');
      return;
    }
    const existing = userRepo.findByUsername(body.username);
    if (existing) {
      fail(res, '用户名已存在');
      return;
    }
    const passwordHash = AuthService.hashPassword(body.password);
    const id = userRepo.create({
      username: body.username,
      password_hash: passwordHash,
      real_name: body.realName,
      role: body.role,
      phone: body.phone || '',
      status: 'active',
    });
    const created = userRepo.findById(id);
    ok(res, created ? mapUser(created) : null, '创建成功');
  } catch (e) {
    fail(res, (e as Error).message);
  }
});

router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const existing = userRepo.findById(id);
    if (!existing) {
      notFound(res, '用户不存在');
      return;
    }
    const body = req.body as User.UpdateUserReq;
    const updateData: Record<string, unknown> = {};
    if (body.realName !== undefined) updateData.real_name = body.realName;
    if (body.role !== undefined) updateData.role = body.role;
    if (body.phone !== undefined) updateData.phone = body.phone || '';
    if (body.status !== undefined) updateData.status = body.status;
    userRepo.update(id, updateData);
    const updated = userRepo.findById(id);
    ok(res, updated ? mapUser(updated) : null, '更新成功');
  } catch (e) {
    fail(res, (e as Error).message);
  }
});

router.post('/:id/reset-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const existing = userRepo.findById(id);
    if (!existing) {
      notFound(res, '用户不存在');
      return;
    }
    const { newPassword } = req.body as { newPassword: string };
    if (!newPassword || newPassword.length < 6) {
      fail(res, '新密码长度至少6位');
      return;
    }
    const passwordHash = AuthService.hashPassword(newPassword);
    userRepo.update(id, { password_hash: passwordHash });
    ok(res, null, '密码重置成功');
  } catch (e) {
    fail(res, (e as Error).message);
  }
});

export default router;
