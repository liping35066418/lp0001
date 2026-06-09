import { create } from 'zustand';
import type { Auth } from '../../shared/api-types';
import { post, get } from '@/utils/api';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

interface AuthState {
  token: string | null;
  user: Auth.CurrentUser | null;
  initialized: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
  init: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem(TOKEN_KEY),
  user: (() => {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as Auth.CurrentUser) : null;
    } catch {
      return null;
    }
  })(),
  initialized: false,

  login: async (username, password) => {
    const resp = await post<Auth.LoginResp>('/auth/login', { username, password });
    const token = resp.token;
    const user = resp.user as Auth.CurrentUser;
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    set({ token, user });
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    set({ token: null, user: null });
  },

  fetchMe: async () => {
    try {
      const user = await get<Auth.CurrentUser>('/auth/me');
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      set({ user });
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      set({ token: null, user: null });
    }
  },

  init: async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      try {
        const user = await get<Auth.CurrentUser>('/auth/me');
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        set({ token, user, initialized: true });
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        set({ token: null, user: null, initialized: true });
      }
    } else {
      set({ initialized: true });
    }
  },
}));
