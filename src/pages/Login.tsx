import { useState, type FormEvent } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  Loader2,
  LogIn,
  Dice6,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { useUIStore } from '@/store/ui';

function DicePattern() {
  return (
    <svg className="w-full h-full" viewBox="0 0 100 100" fill="none">
      <circle cx="25" cy="25" r="6" fill="currentColor" />
      <circle cx="75" cy="25" r="6" fill="currentColor" />
      <circle cx="50" cy="50" r="6" fill="currentColor" />
      <circle cx="25" cy="75" r="6" fill="currentColor" />
      <circle cx="75" cy="75" r="6" fill="currentColor" />
    </svg>
  );
}

function CardPattern() {
  return (
    <svg className="w-full h-full" viewBox="0 0 100 140" fill="none">
      <rect x="5" y="5" width="90" height="130" rx="6" stroke="currentColor" strokeWidth="2" fill="none" />
      <path d="M30 40 L50 70 L70 40 M30 100 L50 70 L70 100" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="50" cy="25" r="4" fill="currentColor" />
      <circle cx="50" cy="115" r="4" fill="currentColor" />
    </svg>
  );
}

function CheckerPattern() {
  return (
    <svg className="w-full h-full" viewBox="0 0 80 80" fill="none">
      {Array.from({ length: 4 }).map((_, row) =>
        Array.from({ length: 4 }).map((_, col) => (
          <rect
            key={`${row}-${col}`}
            x={col * 20}
            y={row * 20}
            width="20"
            height="20"
            fill={(row + col) % 2 === 0 ? 'currentColor' : 'none'}
            opacity={0.4}
          />
        ))
      )}
    </svg>
  );
}

export default function Login() {
  const { token, login } = useAuthStore();
  const { pushToast } = useUIStore();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);

  if (token) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      pushToast('请输入用户名和密码', 'warn');
      return;
    }
    setLoading(true);
    try {
      await login(username.trim(), password);
      pushToast('登录成功', 'success');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      pushToast((err as Error).message || '登录失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-primary-900 via-primary-800 to-primary-900 p-6">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-10 left-10 w-32 h-32 text-accent-500/20 rotate-12">
          <DicePattern />
        </div>
        <div className="absolute top-32 right-20 w-24 h-36 text-accent-400/15 -rotate-6">
          <CardPattern />
        </div>
        <div className="absolute bottom-20 left-1/4 w-40 h-40 text-accent-500/10 rotate-45">
          <CheckerPattern />
        </div>
        <div className="absolute bottom-10 right-16 w-20 h-20 text-accent-400/20 -rotate-12">
          <DicePattern />
        </div>
        <div className="absolute top-1/2 left-8 w-20 h-28 text-primary-500/15 rotate-12">
          <CardPattern />
        </div>
        <div className="absolute top-1/4 right-1/3 w-28 h-28 text-primary-500/10 -rotate-6">
          <CheckerPattern />
        </div>
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-accent-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-primary-500/20 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-[420px]">
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-accent-400 to-accent-600 text-white flex items-center justify-center shadow-xl shadow-accent-500/30">
            <Dice6 className="w-11 h-11" />
          </div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-accent-300 via-accent-400 to-accent-500 bg-clip-text text-transparent" style={{ fontFamily: '"STKaiti", "KaiTi", "楷体", serif' }}>
            桌游空间站
          </h1>
          <p className="text-primary-300 text-sm tracking-widest">智慧运营管理平台</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="backdrop-blur-xl bg-white/95 rounded-2xl shadow-2xl shadow-black/20 p-8 animate-slide-up border border-white/40"
        >
          <h2 className="text-lg font-semibold text-slate-800 mb-6 flex items-center gap-2">
            <LogIn className="w-5 h-5 text-primary-600" />
            账号登录
          </h2>

          <div className="space-y-5">
            <div>
              <label className="label">账号</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="请输入用户名"
                  className="input pl-10 !py-2.5"
                  autoFocus
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label className="label">密码</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入密码"
                  className="input pl-10 pr-10 !py-2.5"
                  disabled={loading}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit(e as unknown as FormEvent)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center">
              <label className="flex items-center gap-2 cursor-pointer select-none group">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                />
                <span className="text-sm text-slate-600 group-hover:text-slate-800 transition-colors">
                  记住密码
                </span>
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 !py-3 rounded-lg text-white font-medium bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-500 hover:to-primary-600 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-primary-600/30"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                登录中...
              </>
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                登 录
              </>
            )}
          </button>

          <div className="mt-6 pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-400 text-center space-y-1">
              <span className="block">管理员：admin / admin123</span>
              <span className="block">操作员：123456 / operator</span>
            </p>
            <p className="text-xs text-slate-300 text-center mt-3">v1.0.0</p>
          </div>
        </form>
      </div>
    </div>
  );
}
