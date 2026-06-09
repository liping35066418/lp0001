import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Edit3,
  FileText,
  ArrowRightLeft,
  X,
  Package,
  Users,
  Clock,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import type { Boardgame as BG } from '../../shared/api-types';
import { get } from '@/utils/api';
import { useUIStore } from '@/store/ui';
import { useAuthStore } from '@/store/auth';
import { formatMoney, cnDifficulty, difficultyColor } from '@/utils/format';
import { cn } from '@/lib/utils';

const CATEGORIES = ['全部', '策略', '卡牌', '聚会', '推理', '亲子'];
const DIFFICULTIES: { label: string; value: BG.Difficulty | 'all' }[] = [
  { label: '全部', value: 'all' },
  { label: '简单', value: 'easy' },
  { label: '中等', value: 'medium' },
  { label: '困难', value: 'hard' },
  { label: '专家', value: 'expert' },
];
const PLAYER_FILTERS = [
  { label: '全部', min: 0, max: Infinity },
  { label: '2人以下', min: 0, max: 2 },
  { label: '2-4人', min: 2, max: 4 },
  { label: '4-6人', min: 4, max: 6 },
  { label: '6人以上', min: 6, max: Infinity },
];

const categoryColor = (cat: string): string => {
  const map: Record<string, string> = {
    策略: 'bg-indigo-100 text-indigo-700',
    卡牌: 'bg-sky-100 text-sky-700',
    聚会: 'bg-pink-100 text-pink-700',
    推理: 'bg-violet-100 text-violet-700',
    亲子: 'bg-amber-100 text-amber-700',
  };
  return map[cat] || 'bg-slate-100 text-slate-700';
};

const playerBadgeColor = (min: number, max: number): string => {
  const avg = (min + max) / 2;
  if (avg <= 2) return 'bg-emerald-100 text-emerald-700';
  if (avg <= 4) return 'bg-teal-100 text-teal-700';
  if (avg <= 6) return 'bg-cyan-100 text-cyan-700';
  return 'bg-blue-100 text-blue-700';
};

const avatarColors = [
  'from-primary-400 to-primary-600',
  'from-accent-400 to-accent-600',
  'from-sky-400 to-indigo-600',
  'from-pink-400 to-rose-600',
  'from-violet-400 to-purple-600',
  'from-teal-400 to-emerald-600',
  'from-amber-400 to-orange-600',
];

function AvatarFallback({ name }: { name: string }) {
  const idx = name.charCodeAt(0) % avatarColors.length;
  return (
    <div
      className={cn(
        'w-full h-full flex items-center justify-center text-white font-bold text-4xl bg-gradient-to-br',
        avatarColors[idx]
      )}
    >
      {name.charAt(0)}
    </div>
  );
}

export default function BoardgameList() {
  const navigate = useNavigate();
  const { pushToast, pushLoading, popLoading } = useUIStore();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const [list, setList] = useState<BG.Boardgame[]>([]);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState('全部');
  const [difficulty, setDifficulty] = useState<BG.Difficulty | 'all'>('all');
  const [playerIdx, setPlayerIdx] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [detail, setDetail] = useState<BG.Boardgame | null>(null);
  const [rentalTarget, setRentalTarget] = useState<BG.Boardgame | null>(null);

  const fetchList = async () => {
    setLoading(true);
    pushLoading();
    try {
      const params: Record<string, string> = { status: 'active' };
      if (category !== '全部') params.category = category;
      if (difficulty !== 'all') params.difficulty = difficulty;
      const data = await get<BG.Boardgame[]>('/boardgames', { params });
      setList(data);
    } catch (e) {
      pushToast((e as Error).message, 'error');
    } finally {
      setLoading(false);
      popLoading();
    }
  };

  useEffect(() => {
    fetchList();
  }, [category, difficulty]);

  const filtered = useMemo(() => {
    const pf = PLAYER_FILTERS[playerIdx];
    return list.filter((b) => {
      if (keyword && !b.name.toLowerCase().includes(keyword.toLowerCase())) return false;
      const maxMatch = b.maxPlayers > pf.min && b.minPlayers < pf.max;
      if (!maxMatch) return false;
      return true;
    });
  }, [list, keyword, playerIdx]);

  const handleQuickRental = (bg: BG.Boardgame) => {
    if (bg.stockAvailable <= 0) {
      pushToast('库存不足，无法租借', 'warn');
      return;
    }
    navigate('/rentals/new', { state: { boardgameId: bg.id } });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">桌游档案</h1>
          <p className="text-sm text-slate-500 mt-1">管理桌游资料库和库存</p>
        </div>
        {isAdmin && (
          <button
            className="btn-primary"
            onClick={() => navigate('/boardgames/new')}
          >
            <Plus className="w-4 h-4" />
            新增桌游
          </button>
        )}
      </div>

      <div className="card p-4 space-y-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex flex-wrap gap-1">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  category === c
                    ? 'bg-primary-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                )}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="h-6 w-px bg-slate-200 hidden sm:block" />
          <div className="flex flex-wrap gap-1">
            {DIFFICULTIES.map((d) => (
              <button
                key={d.value}
                onClick={() => setDifficulty(d.value)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  difficulty === d.value
                    ? 'bg-accent-500 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                )}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-4 items-center">
          <select
            value={playerIdx}
            onChange={(e) => setPlayerIdx(Number(e.target.value))}
            className="input w-auto min-w-[160px]"
          >
            {PLAYER_FILTERS.map((p, i) => (
              <option key={i} value={i}>
                {p.label}
              </option>
            ))}
          </select>

          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索桌游名称..."
              className="input pl-10"
            />
          </div>
        </div>
      </div>

      {loading && list.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card overflow-hidden animate-pulse-soft">
              <div className="aspect-[4/3] bg-slate-100" />
              <div className="p-4 space-y-3">
                <div className="h-5 bg-slate-200 rounded w-3/4" />
                <div className="flex gap-1">
                  <div className="h-5 bg-slate-100 rounded-full w-14" />
                  <div className="h-5 bg-slate-100 rounded-full w-14" />
                  <div className="h-5 bg-slate-100 rounded-full w-14" />
                </div>
                <div className="h-4 bg-slate-100 rounded w-2/3" />
                <div className="h-8 bg-slate-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-16 text-center">
          <Package className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <p className="text-slate-400">暂无符合条件的桌游</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {filtered.map((bg) => {
            const soldOut = bg.stockAvailable <= 0;
            return (
              <div
                key={bg.id}
                className={cn(
                  'card-hover overflow-hidden flex flex-col',
                  soldOut && 'opacity-60'
                )}
              >
                <div className="aspect-[4/3] bg-slate-50 overflow-hidden relative">
                  {bg.coverImage ? (
                    <img
                      src={bg.coverImage}
                      alt={bg.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <AvatarFallback name={bg.name} />
                  )}
                  {soldOut && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <span className="bg-red-600 text-white px-4 py-1.5 rounded-lg font-bold">
                        暂无库存
                      </span>
                    </div>
                  )}
                </div>

                <div className="p-4 flex-1 flex flex-col gap-3">
                  <h3 className="font-bold text-slate-800 text-base line-clamp-1">
                    {bg.name}
                  </h3>

                  <div className="flex flex-wrap gap-1.5">
                    <span className={cn('badge', categoryColor(bg.category))}>
                      {bg.category}
                    </span>
                    <span className={cn('badge', difficultyColor(bg.difficulty))}>
                      {cnDifficulty(bg.difficulty)}
                    </span>
                    <span
                      className={cn(
                        'badge',
                        playerBadgeColor(bg.minPlayers, bg.maxPlayers)
                      )}
                    >
                      {bg.minPlayers}-{bg.maxPlayers}人
                    </span>
                  </div>

                  <div className="text-sm">
                    <span
                      className={cn(
                        'font-medium',
                        soldOut ? 'text-red-600' : 'text-slate-600'
                      )}
                    >
                      库存：可用{bg.stockAvailable}/共{bg.stockTotal}
                    </span>
                  </div>

                  <div className="text-sm text-slate-600 flex items-center gap-3 flex-wrap">
                    <span className="font-semibold text-accent-600">
                      押金{formatMoney(bg.deposit)}
                    </span>
                    <span className="font-semibold text-primary-600">
                      {formatMoney(bg.rentalFee)}/场
                    </span>
                  </div>

                  <div className="mt-auto pt-2 flex gap-2 flex-wrap">
                    <button
                      className="btn-outline btn-sm flex-1 min-w-0"
                      onClick={() => setDetail(bg)}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      详情
                    </button>
                    <button
                      className={cn(
                        'btn-sm flex-1 min-w-0',
                        soldOut ? 'btn btn-disabled bg-slate-200 text-slate-400' : 'btn-primary'
                      )}
                      onClick={() => handleQuickRental(bg)}
                      disabled={soldOut}
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      租借
                    </button>
                    {isAdmin && (
                      <button
                        className="btn-ghost btn-sm"
                        onClick={() => navigate(`/boardgames/${bg.id}/edit`)}
                        title="编辑"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {detail && (
        <div className="modal-backdrop" onClick={() => setDetail(null)}>
          <div
            className="modal max-w-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 className="text-lg font-semibold text-slate-800">
                桌游档案详情
              </h3>
              <button
                className="btn-ghost btn-sm"
                onClick={() => setDetail(null)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="modal-body space-y-5">
              <div className="flex gap-5 flex-col sm:flex-row">
                <div className="w-full sm:w-44 aspect-[4/3] rounded-xl overflow-hidden bg-slate-50 flex-shrink-0">
                  {detail.coverImage ? (
                    <img
                      src={detail.coverImage}
                      alt={detail.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <AvatarFallback name={detail.name} />
                  )}
                </div>
                <div className="flex-1 space-y-3">
                  <h2 className="text-xl font-bold text-slate-800">
                    {detail.name}
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    <span className={cn('badge', categoryColor(detail.category))}>
                      {detail.category}
                    </span>
                    <span className={cn('badge', difficultyColor(detail.difficulty))}>
                      {cnDifficulty(detail.difficulty)}
                    </span>
                    <span
                      className={cn(
                        'badge',
                        playerBadgeColor(detail.minPlayers, detail.maxPlayers)
                      )}
                    >
                      <Users className="w-3 h-3 mr-1" />
                      {detail.minPlayers}-{detail.maxPlayers}人
                    </span>
                    <span className="badge bg-slate-100 text-slate-700">
                      <Clock className="w-3 h-3 mr-1" />
                      约{detail.playMinutes}分钟
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-slate-500">押金：</span>
                      <span className="font-semibold text-accent-600">
                        {formatMoney(detail.deposit)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">租借费：</span>
                      <span className="font-semibold text-primary-600">
                        {formatMoney(detail.rentalFee)}/场
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">可用库存：</span>
                      <span
                        className={cn(
                          'font-semibold',
                          detail.stockAvailable > 0
                            ? 'text-green-600'
                            : 'text-red-600'
                        )}
                      >
                        {detail.stockAvailable}/{detail.stockTotal}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">状态：</span>
                      <span className="font-semibold text-green-600">
                        上架中
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-primary-600" />
                  配件清单
                </h4>
                {detail.accessories ? (
                  <div className="flex flex-wrap gap-2">
                    {detail.accessories
                      .split(/[,，、\n]/)
                      .map((s) => s.trim())
                      .filter(Boolean)
                      .map((acc, i) => (
                        <span
                          key={i}
                          className="px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700"
                        >
                          {acc}
                        </span>
                      ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">未填写配件信息</p>
                )}
              </div>

              {detail.remark && (
                <div className="border-t border-slate-100 pt-4">
                  <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-accent-600" />
                    备注
                  </h4>
                  <p className="text-sm text-slate-600 whitespace-pre-wrap">
                    {detail.remark}
                  </p>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                className="btn-outline"
                onClick={() => setDetail(null)}
              >
                关闭
              </button>
              {isAdmin && (
                <button
                  className="btn-primary"
                  onClick={() => {
                    setDetail(null);
                    navigate(`/boardgames/${detail.id}/edit`);
                  }}
                >
                  <Edit3 className="w-4 h-4" />
                  编辑档案
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
