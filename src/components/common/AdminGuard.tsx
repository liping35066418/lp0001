import { ShieldAlert } from 'lucide-react';
import { useAuthStore } from '@/store/auth';

interface AdminGuardProps {
  children: React.ReactNode;
}

export default function AdminGuard({ children }: AdminGuardProps) {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  if (!isAdmin) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="card p-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
            <ShieldAlert className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">权限不足</h2>
          <p className="text-slate-500 max-w-md">
            该页面仅管理员可访问。如需访问，请联系系统管理员开通相应权限。
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
