import { Navigate, useOutlet } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

export default function AppLayout() {
  const { user } = useAuthStore();
  const outlet = useOutlet();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen flex bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 overflow-auto p-6">
          {outlet}
        </main>
      </div>
    </div>
  );
}
