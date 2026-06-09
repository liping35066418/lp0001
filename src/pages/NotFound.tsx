import { Link } from 'react-router-dom';
import { Home, Dice6 } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-accent-50 p-6">
      <div className="card p-10 max-w-md w-full text-center animate-fade-in">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-primary-600 text-white flex items-center justify-center">
          <Dice6 className="w-10 h-10" />
        </div>
        <h1 className="text-6xl font-bold text-primary-600 mb-2">404</h1>
        <p className="text-xl text-slate-700 font-medium mb-2">页面未找到</p>
        <p className="text-sm text-slate-500 mb-8">您访问的页面不存在或已被移除</p>
        <Link
          to="/dashboard"
          className="btn-primary btn-lg w-full"
        >
          <Home className="w-5 h-5" />
          返回工作台
        </Link>
      </div>
    </div>
  );
}
