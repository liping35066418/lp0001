import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarClock,
  Timer,
  Dices,
  Bookmark,
  ShoppingBasket,
  Receipt,
  BarChart3,
  Settings,
  Users,
  ChevronLeft,
  ChevronRight,
  Dice6,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/store/ui';
import { useAuthStore } from '@/store/auth';

interface MenuItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

interface MenuGroup {
  title: string;
  items: MenuItem[];
}

const menuGroups: MenuGroup[] = [
  {
    title: '运营管理',
    items: [
      { path: '/dashboard', label: '工作台', icon: LayoutDashboard },
      { path: '/reservations', label: '预约管理', icon: CalendarClock },
      { path: '/sessions', label: '场次运营', icon: Timer },
      { path: '/boardgames', label: '桌游档案', icon: Dices },
      { path: '/rentals', label: '租借归还', icon: Bookmark },
      { path: '/goods', label: '商品点单', icon: ShoppingBasket },
      { path: '/history/bills', label: '历史账单', icon: Receipt },
    ],
  },
  {
    title: '数据中心',
    items: [
      { path: '/reports/overview', label: '经营报表', icon: BarChart3, adminOnly: true },
    ],
  },
  {
    title: '系统',
    items: [
      { path: '/settings/rooms', label: '系统设置', icon: Settings, adminOnly: true },
      { path: '/users', label: '账号管理', icon: Users, adminOnly: true },
    ],
  },
];

export default function Sidebar() {
  const { pathname } = useLocation();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  return (
    <aside
      className={cn(
        'bg-primary-800 text-primary-100 flex flex-col transition-all duration-300 shrink-0',
        sidebarCollapsed ? 'w-16' : 'w-60'
      )}
    >
      <div className="h-16 flex items-center justify-center border-b border-primary-700/50 px-4">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-accent-500 flex items-center justify-center shrink-0">
            <Dice6 className="w-5 h-5 text-white" />
          </div>
          {!sidebarCollapsed && (
            <span className="font-bold text-white text-lg whitespace-nowrap">桌游管家</span>
          )}
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-6">
        {menuGroups.map((group) => {
          const visibleItems = group.items.filter((it) => !it.adminOnly || isAdmin);
          if (visibleItems.length === 0) return null;
          return (
            <div key={group.title}>
              {!sidebarCollapsed && (
                <div className="px-3 mb-2 text-xs font-medium text-primary-400 uppercase tracking-wider">
                  {group.title}
                </div>
              )}
              <ul className="space-y-1">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    pathname === item.path || pathname.startsWith(item.path + '/');
                  return (
                    <li key={item.path}>
                      <NavLink
                        to={item.path}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                          isActive
                            ? 'bg-primary-600 text-white'
                            : 'text-primary-200 hover:bg-primary-700/50 hover:text-white'
                        )}
                        title={sidebarCollapsed ? item.label : undefined}
                      >
                        <Icon className="w-5 h-5 shrink-0" />
                        {!sidebarCollapsed && (
                          <span className="whitespace-nowrap truncate">{item.label}</span>
                        )}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <button
        onClick={toggleSidebar}
        className="h-12 border-t border-primary-700/50 flex items-center justify-center text-primary-300 hover:text-white hover:bg-primary-700/50 transition-colors"
      >
        {sidebarCollapsed ? (
          <ChevronRight className="w-5 h-5" />
        ) : (
          <ChevronLeft className="w-5 h-5" />
        )}
      </button>
    </aside>
  );
}
