import bcrypt from 'bcryptjs';
import dayjs from 'dayjs';
import { UserRepository } from '../repositories/UserRepository.js';
import { signToken } from '../middleware/auth.js';
import type { Auth, User } from '../../shared/api-types.js';

export class AuthService {
  private static userRepo = new UserRepository();

  static login(username: string, password: string): Auth.LoginResp {
    const userRow = this.userRepo.findByUsername(username);
    if (!userRow) {
      throw new Error('用户名或密码错误');
    }

    if (userRow.status !== 'active') {
      throw new Error('账户已被禁用');
    }

    const valid = bcrypt.compareSync(password, userRow.password_hash);
    if (!valid) {
      throw new Error('用户名或密码错误');
    }

    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    this.userRepo.update(userRow.id, { last_login_at: now });

    const user: User.User = {
      id: userRow.id,
      username: userRow.username,
      realName: userRow.real_name,
      role: userRow.role as User.Role,
      phone: userRow.phone || undefined,
      status: userRow.status as 'active' | 'disabled',
      lastLoginAt: now,
      createdAt: userRow.created_at,
    };

    const token = signToken({
      id: user.id,
      username: user.username,
      realName: user.realName,
      role: user.role,
    });

    return { token, user };
  }

  static hashPassword(pwd: string): string {
    return bcrypt.hashSync(pwd, 10);
  }
}

export default AuthService;
