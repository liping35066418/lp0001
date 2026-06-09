import { Router, type Request, type Response } from 'express';
import { ok, fail, notFound, forbidden, unauthorized } from '../utils/response.js';
import { authRequired } from '../middleware/auth.js';
import { AuthService } from '../services/AuthService.js';
import { UserRepository } from '../repositories/UserRepository.js';
import type { Auth, User } from '../../shared/api-types.js';

const router = Router();
const userRepo = new UserRepository();

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body as Auth.LoginReq;
    if (!username || !password) {
      fail(res, '用户名和密码不能为空');
      return;
    }
    const result = AuthService.login(username, password);
    ok(res, result);
  } catch (e) {
    fail(res, (e as Error).message);
  }
});

router.get('/me', authRequired, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      unauthorized(res);
      return;
    }
    const userRow = userRepo.findById(req.user.id);
    if (!userRow) {
      notFound(res, '用户不存在');
      return;
    }
    const currentUser: Auth.CurrentUser = {
      id: userRow.id,
      username: userRow.username,
      realName: userRow.real_name,
      role: userRow.role,
      phone: userRow.phone || undefined,
      lastLoginAt: userRow.last_login_at || undefined,
    };
    ok(res, currentUser);
  } catch (e) {
    fail(res, (e as Error).message);
  }
});

export default router;
