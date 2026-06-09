import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Edit3,
  X,
  Save,
  Package,
  Tags,
  ArrowLeft,
  AlertCircle,
  Loader2,
  GripVertical,
  ToggleLeft,
  ToggleRight,
  Image,
} from 'lucide-react';
import type { Goods as GD } from '../../shared/api-types';
import { get, post, put } from '@/utils/api';
import { useUIStore } from '@/store/ui';
import { useAuthStore } from '@/store/auth';
import { Navigate } from 'react-router-dom';
import { formatMoney } from '@/utils/format';
import { cn } from '@/lib/utils';

type TabType = 'goods' | 'category';

interface GoodsForm {
  id?: number;
  categoryId: number | '';
  name: string;
  image: string;
  price: number;
  stock: number;
  unit: string;
  status: 'on_sale' | 'off_sale';
}

interface CategoryForm {
  id?: number;
  name: string;
  sort: number;
}

export default function GoodsManage() {
  const navigate = useNavigate();
  const { pushToast, pushLoading, popLoading } = useUIStore();
  const { user } = useAuthStore();

  const [tab, setTab] = useState<TabType>('goods');
  const [loading, setLoading] = useState(true);

  const [goods, setGoods] = useState<GD.Goods[]>([]);
  const [categories, setCategories] = useState<GD.Category[]>([]);

  const [showGoodsModal, setShowGoodsModal] = useState(false);
  const [goodsForm, setGoodsForm] = useState<GoodsForm>({
    categoryId: '',
    name: '',
    image: '',
    price: 0,
    stock: 0,
    unit: '份',
    status: 'on_sale',
  });
  const [goodsErrors, setGoodsErrors] = useState<Record<string, string>>({});
  const [goodsSubmitting, setGoodsSubmitting] = useState(false);

  const [showCatModal, setShowCatModal] = useState(false);
  const [catForm, setCatForm] = useState<CategoryForm>({ name: '', sort: 0 });
  const [catErrors, setCatErrors] = useState<Record<string, string>>({});
  const [catSubmitting, setCatSubmitting] = useState(false);

  if (user?.role !== 'admin') {
    return <Navigate to="/goods" replace />;
  }

  const fetchAll = async () => {
    setLoading(true);
    pushLoading();
    try {
      const [gs, cats] = await Promise.all([
        get<GD.Goods[]>('/goods'),
        get<GD.Category[]>('/goods/categories'),
      ]);
      setGoods(gs);
      setCategories(cats);
    } catch (e) {
      pushToast((e as Error).message, 'error');
    } finally {
      setLoading(false);
      popLoading();
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const openGoodsCreate = () => {
    setGoodsForm({
      categoryId: categories[0]?.id ?? '',
      name: '',
      image: '',
      price: 0,
      stock: 0,
      unit: '份',
      status: 'on_sale',
    });
    setGoodsErrors({});
    setShowGoodsModal(true);
  };

  const openGoodsEdit = (g: GD.Goods) => {
    setGoodsForm({
      id: g.id,
      categoryId: g.categoryId,
      name: g.name,
      image: g.image || '',
      price: g.price,
      stock: g.stock,
      unit: g.unit,
      status: g.status,
    });
    setGoodsErrors({});
    setShowGoodsModal(true);
  };

  const toggleGoodsStatus = async (g: GD.Goods) => {
    try {
      const newStatus = g.status === 'on_sale' ? 'off_sale' : 'on_sale';
      await put(`/goods/${g.id}`, { status: newStatus });
      pushToast(`已${newStatus === 'on_sale' ? '上架' : '下架'}`, 'success');
      fetchAll();
    } catch (e) {
      pushToast((e as Error).message, 'error');
    }
  };

  const validateGoods = (): boolean => {
    const e: Record<string, string> = {};
    if (!goodsForm.categoryId) e.categoryId = '请选择分类';
    if (!goodsForm.name.trim()) e.name = '请输入商品名称';
    if (goodsForm.price < 0) e.price = '价格不能为负';
    if (goodsForm.stock < 0) e.stock = '库存不能为负';
    if (!goodsForm.unit.trim()) e.unit = '请输入单位';
    setGoodsErrors(e);
    return Object.keys(e).length === 0;
  };

  const submitGoods = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!validateGoods()) {
      pushToast('请检查表单填写', 'warn');
      return;
    }
    setGoodsSubmitting(true);
    pushLoading();
    try {
      const payload = {
        categoryId: Number(goodsForm.categoryId),
        name: goodsForm.name.trim(),
        image: goodsForm.image.trim(),
        price: Number(goodsForm.price),
        stock: Number(goodsForm.stock),
        unit: goodsForm.unit.trim(),
        status: goodsForm.status,
      };
      if (goodsForm.id) {
        await put(`/goods/${goodsForm.id}`, payload);
        pushToast('商品更新成功', 'success');
      } else {
        await post('/goods', payload);
        pushToast('商品创建成功', 'success');
      }
      setShowGoodsModal(false);
      fetchAll();
    } catch (e) {
      pushToast((e as Error).message, 'error');
    } finally {
      setGoodsSubmitting(false);
      popLoading();
    }
  };

  const openCatCreate = () => {
    setCatForm({ name: '', sort: categories.length });
    setCatErrors({});
    setShowCatModal(true);
  };

  const openCatEdit = (c: GD.Category) => {
    setCatForm({ id: c.id, name: c.name, sort: c.sort });
    setCatErrors({});
    setShowCatModal(true);
  };

  const validateCat = (): boolean => {
    const e: Record<string, string> = {};
    if (!catForm.name.trim()) e.name = '请输入分类名称';
    setCatErrors(e);
    return Object.keys(e).length === 0;
  };

  const submitCat = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!validateCat()) {
      pushToast('请检查表单填写', 'warn');
      return;
    }
    setCatSubmitting(true);
    pushLoading();
    try {
      const payload = {
        name: catForm.name.trim(),
        sort: Number(catForm.sort),
      };
      if (catForm.id) {
        await put(`/goods/categories/${catForm.id}`, payload);
        pushToast('分类更新成功', 'success');
      } else {
        await post('/goods/categories', payload);
        pushToast('分类创建成功', 'success');
      }
      setShowCatModal(false);
      fetchAll();
    } catch (e) {
      pushToast((e as Error).message, 'error');
    } finally {
      setCatSubmitting(false);
      popLoading();
    }
  };

  const getCatName = (id: number) => {
    return categories.find((c) => c.id === id)?.name || '-';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3 flex-wrap">
        <button
          className="btn-ghost btn-sm"
          onClick={() => navigate('/goods')}
        >
          <ArrowLeft className="w-4 h-4" />
          返回点单
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">商品管理</h1>
          <p className="text-sm text-slate-500 mt-1">商品资料和库存管理</p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex border-b border-slate-100 px-4">
          {[
            { k: 'goods', label: '商品', icon: Package, count: goods.length },
            { k: 'category', label: '分类', icon: Tags, count: categories.length },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.k}
                onClick={() => setTab(t.k as TabType)}
                className={cn(
                  'px-5 py-3 text-sm font-medium relative transition-colors flex items-center gap-2 border-b-2 -mb-px',
                  tab === t.k
                    ? 'text-primary-700 border-primary-600'
                    : 'text-slate-500 hover:text-slate-700 border-transparent'
                )}
              >
                <Icon className="w-4 h-4" />
                {t.label}
                {t.count > 0 && (
                  <span
                    className={cn(
                      'px-1.5 py-0.5 rounded-full text-xs font-semibold',
                      tab === t.k
                        ? 'bg-primary-100 text-primary-700'
                        : 'bg-slate-100 text-slate-500'
                    )}
                  >
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="p-4">
          {loading ? (
            <div className="p-12 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />
            </div>
          ) : tab === 'goods' ? (
            <div>
              <div className="flex justify-end mb-4">
                <button className="btn-primary" onClick={openGoodsCreate}>
                  <Plus className="w-4 h-4" />
                  新增商品
                </button>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr className="text-slate-500">
                      <th className="text-left font-medium px-4 py-3">商品</th>
                      <th className="text-left font-medium px-4 py-3">分类</th>
                      <th className="text-right font-medium px-4 py-3">价格</th>
                      <th className="text-right font-medium px-4 py-3">库存</th>
                      <th className="text-left font-medium px-4 py-3">单位</th>
                      <th className="text-center font-medium px-4 py-3">状态</th>
                      <th className="text-right font-medium px-4 py-3">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {goods.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-4 py-16 text-center text-slate-400"
                        >
                          <Package className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                          <p>暂无商品，点击右上角新增</p>
                        </td>
                      </tr>
                    ) : (
                      goods.map((g) => (
                        <tr
                          key={g.id}
                          className="border-t border-slate-50 hover:bg-slate-50/50"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-lg bg-slate-50 border border-slate-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                                {g.image ? (
                                  <img
                                    src={g.image}
                                    alt={g.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <Package className="w-5 h-5 text-slate-300" />
                                )}
                              </div>
                              <div>
                                <div className="font-medium text-slate-800">
                                  {g.name}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="badge bg-slate-100 text-slate-600">
                              {getCatName(g.categoryId)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-primary-600">
                            {formatMoney(g.price)}
                          </td>
                          <td
                            className={cn(
                              'px-4 py-3 text-right font-medium',
                              g.stock <= 3
                                ? 'text-red-500'
                                : g.stock <= 10
                                ? 'text-orange-500'
                                : 'text-slate-700'
                            )}
                          >
                            {g.stock}
                          </td>
                          <td className="px-4 py-3 text-slate-600">{g.unit}</td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => toggleGoodsStatus(g)}
                              className="inline-flex items-center gap-1"
                            >
                              {g.status === 'on_sale' ? (
                                <ToggleRight className="w-6 h-6 text-primary-600" />
                              ) : (
                                <ToggleLeft className="w-6 h-6 text-slate-400" />
                              )}
                              <span
                                className={cn(
                                  'text-xs font-medium',
                                  g.status === 'on_sale'
                                    ? 'text-green-600'
                                    : 'text-slate-400'
                                )}
                              >
                                {g.status === 'on_sale' ? '在售' : '下架'}
                              </span>
                            </button>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              className="btn-ghost btn-sm"
                              onClick={() => openGoodsEdit(g)}
                            >
                              <Edit3 className="w-4 h-4" />
                              编辑
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex justify-end mb-4">
                <button className="btn-primary" onClick={openCatCreate}>
                  <Plus className="w-4 h-4" />
                  新增分类
                </button>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr className="text-slate-500">
                      <th className="text-left font-medium px-4 py-3 w-12"></th>
                      <th className="text-left font-medium px-4 py-3">分类名称</th>
                      <th className="text-left font-medium px-4 py-3 w-24">排序</th>
                      <th className="text-left font-medium px-4 py-3">商品数</th>
                      <th className="text-right font-medium px-4 py-3">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 py-16 text-center text-slate-400"
                        >
                          <Tags className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                          <p>暂无分类，点击右上角新增</p>
                        </td>
                      </tr>
                    ) : (
                      categories.map((c) => {
                        const count = goods.filter(
                          (g) => g.categoryId === c.id
                        ).length;
                        return (
                          <tr
                            key={c.id}
                            className="border-t border-slate-50 hover:bg-slate-50/50"
                          >
                            <td className="px-4 py-3 text-slate-300">
                              <GripVertical className="w-4 h-4" />
                            </td>
                            <td className="px-4 py-3">
                              <span className="font-medium text-slate-800 flex items-center gap-2">
                                <Tags className="w-4 h-4 text-primary-500" />
                                {c.name}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-500 font-mono">
                              #{c.sort}
                            </td>
                            <td className="px-4 py-3">
                              <span className="badge bg-primary-50 text-primary-700">
                                {count} 件商品
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                className="btn-ghost btn-sm"
                                onClick={() => openCatEdit(c)}
                              >
                                <Edit3 className="w-4 h-4" />
                                编辑
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {showGoodsModal && (
        <div
          className="modal-backdrop"
          onClick={() => !goodsSubmitting && setShowGoodsModal(false)}
        >
          <div
            className="modal max-w-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 className="text-lg font-semibold text-slate-800">
                {goodsForm.id ? '编辑商品' : '新增商品'}
              </h3>
              <button
                className="btn-ghost btn-sm"
                onClick={() => setShowGoodsModal(false)}
                disabled={goodsSubmitting}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={submitGoods}>
              <div className="modal-body space-y-4">
                <div>
                  <label className="label">
                    商品名称 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={goodsForm.name}
                    onChange={(e) =>
                      setGoodsForm({ ...goodsForm, name: e.target.value })
                    }
                    placeholder="例如：可乐"
                    className={cn(
                      'input',
                      goodsErrors.name && 'border-red-500 focus:ring-red-500'
                    )}
                  />
                  {goodsErrors.name && (
                    <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {goodsErrors.name}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">
                      分类 <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={goodsForm.categoryId}
                      onChange={(e) =>
                        setGoodsForm({
                          ...goodsForm,
                          categoryId: e.target.value === '' ? '' : Number(e.target.value),
                        })
                      }
                      className={cn(
                        'input',
                        goodsErrors.categoryId &&
                          'border-red-500 focus:ring-red-500'
                      )}
                    >
                      <option value="">请选择</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    {goodsErrors.categoryId && (
                      <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {goodsErrors.categoryId}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="label">
                      单位 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={goodsForm.unit}
                      onChange={(e) =>
                        setGoodsForm({ ...goodsForm, unit: e.target.value })
                      }
                      placeholder="份、瓶、杯..."
                      className={cn(
                        'input',
                        goodsErrors.unit && 'border-red-500 focus:ring-red-500'
                      )}
                    />
                    {goodsErrors.unit && (
                      <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {goodsErrors.unit}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">
                      价格（元） <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                        ￥
                      </span>
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={goodsForm.price}
                        onChange={(e) =>
                          setGoodsForm({
                            ...goodsForm,
                            price: Number(e.target.value),
                          })
                        }
                        className={cn(
                          'input pl-7',
                          goodsErrors.price &&
                            'border-red-500 focus:ring-red-500'
                        )}
                      />
                    </div>
                    {goodsErrors.price && (
                      <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {goodsErrors.price}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="label">
                      库存 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={goodsForm.stock}
                      onChange={(e) =>
                        setGoodsForm({
                          ...goodsForm,
                          stock: Number(e.target.value),
                        })
                      }
                      className={cn(
                        'input',
                        goodsErrors.stock &&
                          'border-red-500 focus:ring-red-500'
                      )}
                    />
                    {goodsErrors.stock && (
                      <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {goodsErrors.stock}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="label">图片 URL（可选）</label>
                  <div className="flex gap-3 flex-col sm:flex-row">
                    <div className="flex-1">
                      <input
                        type="url"
                        value={goodsForm.image}
                        onChange={(e) =>
                          setGoodsForm({ ...goodsForm, image: e.target.value })
                        }
                        placeholder="https://..."
                        className="input"
                      />
                    </div>
                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-slate-50 border border-slate-200 flex-shrink-0 flex items-center justify-center">
                      {goodsForm.image ? (
                        <img
                          src={goodsForm.image}
                          alt="预览"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display =
                              'none';
                          }}
                        />
                      ) : (
                        <Image className="w-6 h-6 text-slate-300" />
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="label">状态</label>
                  <div className="flex gap-2">
                    <label
                      className={cn(
                        'flex-1 cursor-pointer rounded-xl border-2 p-3 text-center transition-all',
                        goodsForm.status === 'on_sale'
                          ? 'border-green-500 bg-green-50 text-green-700'
                          : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                      )}
                    >
                      <input
                        type="radio"
                        name="goodsStatus"
                        value="on_sale"
                        checked={goodsForm.status === 'on_sale'}
                        onChange={() =>
                          setGoodsForm({ ...goodsForm, status: 'on_sale' })
                        }
                        className="sr-only"
                      />
                      <div className="text-sm font-semibold">在售</div>
                      <div className="text-xs mt-0.5 opacity-75">可被点单</div>
                    </label>
                    <label
                      className={cn(
                        'flex-1 cursor-pointer rounded-xl border-2 p-3 text-center transition-all',
                        goodsForm.status === 'off_sale'
                          ? 'border-slate-400 bg-slate-50 text-slate-600'
                          : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                      )}
                    >
                      <input
                        type="radio"
                        name="goodsStatus"
                        value="off_sale"
                        checked={goodsForm.status === 'off_sale'}
                        onChange={() =>
                          setGoodsForm({ ...goodsForm, status: 'off_sale' })
                        }
                        className="sr-only"
                      />
                      <div className="text-sm font-semibold">下架</div>
                      <div className="text-xs mt-0.5 opacity-75">暂不出售</div>
                    </label>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => setShowGoodsModal(false)}
                  disabled={goodsSubmitting}
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={goodsSubmitting}
                >
                  {goodsSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      保存中...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      保存
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCatModal && (
        <div
          className="modal-backdrop"
          onClick={() => !catSubmitting && setShowCatModal(false)}
        >
          <div className="modal max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="text-lg font-semibold text-slate-800">
                {catForm.id ? '编辑分类' : '新增分类'}
              </h3>
              <button
                className="btn-ghost btn-sm"
                onClick={() => setShowCatModal(false)}
                disabled={catSubmitting}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={submitCat}>
              <div className="modal-body space-y-4">
                <div>
                  <label className="label">
                    分类名称 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={catForm.name}
                    onChange={(e) =>
                      setCatForm({ ...catForm, name: e.target.value })
                    }
                    placeholder="例如：瓶装饮料"
                    className={cn(
                      'input',
                      catErrors.name && 'border-red-500 focus:ring-red-500'
                    )}
                  />
                  {catErrors.name && (
                    <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {catErrors.name}
                    </p>
                  )}
                </div>
                <div>
                  <label className="label">排序</label>
                  <input
                    type="number"
                    value={catForm.sort}
                    onChange={(e) =>
                      setCatForm({ ...catForm, sort: Number(e.target.value) })
                    }
                    className="input"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    数字越小越靠前
                  </p>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => setShowCatModal(false)}
                  disabled={catSubmitting}
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={catSubmitting}
                >
                  {catSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      保存中...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      保存
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
