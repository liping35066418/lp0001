import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, LogOut, User as UserIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth';

const pathLabelMap: Record<string, string> = {
  '/dashboard': '工作台',
  '/reservations': '预约管理',
  '/reservations/new': '新建预约',
  '/sessions': '场次运营',
  '/boardgames': '桌游档案',
  '/boardgames/new': '新增桌游',
  '/rentals': '租借归还',
  '/rentals/new': '新建租借',
  '/goods': '商品点单',
  '/goods/manage': '商品管理',
  '/history/bills': '历史账单',
  '/settings/rooms': '包间设置',
  '/settings/pricing': '计费设置',
  '/settings/general': '通用设置',
  '/reports/overview': '经营概览',
  '/reports/revenue': '营收分析',
  '/reports/boardgames': '桌游租借排行',
  '/users': '账号管理',
};

function getBreadcrumb(pathname: string): { path: string; label: string }[] {
  if (pathname === '/' || pathname === '') return [{ path: '/dashboard', label: '工作台' }];
  const parts = pathname.split('/').filter(Boolean);
  const result: { path: string; label: string }[] = [];
  let cur = '';
  for (const p of parts) {
    cur += '/' + p;
    const label = pathLabelMap[cur] || p;
    result.push({ path: cur, label });
  }
  return result;
}

export default function TopBar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const crumbs = getBreadcrumb(pathname);
  const notifCount = 0;

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const initial = user?.realName?.charAt(0) || user?.username?.charAt(0) || '?';
  const isAdmin = user?.role === 'admin';

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0">
      <nav className="flex items-center gap-2 text-sm">
        {crumbs.map((c, i) => (
          <span key={c.path} className="flex items-center gap-2">
            <span
              className={cn(
                i === crumbs.length - 1
                  ? 'text-slate-900 font-medium'
                  : 'text-slate-500 hover:text-primary-600 cursor-pointer'
              )}
              onClick={() => i < crumbs.length - 1 && navigate(c.path)}
            >
              {c.label}
            </span>
            {i < crumbs.length - 1 && <span className="text-slate-300">/</span>}
          </span>
        ))}
      </nav>

      <div className="flex items-center gap-3">
        <button className="relative w-10 h-10 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-600 transition-colors">
          <Bell className="w-5 h-5" />
          {notifCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              {notifCount > 9 ? '9+' : notifCount}
            </span>
          )}
        </button>

        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-primary-600 text-white flex items-center justify-center font-medium">
              {initial}
            </div>
            <div className="hidden sm:flex flex-col items-start text-left">
              <span className="text-sm font-medium text-slate-800 leading-tight">
                {user?.realName || user?.username}
              </span>
              <span
                className={cn(
                  'text-xs leading-tight',
                  isAdmin ? 'text-accent-600' : 'text-slate-500'
                )}
              >
                {isAdmin ? '管理员' : '运营人员'}
              </span>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-card-hover border border-slate-100 py-1 z-20 animate-fade-in">
                <div className="px-4 py-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <UserIcon className="w-4 h-4 text-slate-400" />
                    <span className="text-sm text-slate-700">{user?.username}</span>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  退出登录
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
