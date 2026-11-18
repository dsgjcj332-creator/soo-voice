import React from 'react';
import { getSupabase, getSupabaseConfig } from '../lib/supabase';
import type { CartSelectedModifierGroup } from '../contexts/CartContext';

type Group = { id: string; name: string; min_select: number; max_select: number; is_required: boolean; sort_order: number; options: Array<{ id: string; name: string; price_delta: number; sort_order: number }> };
type Props = { item: { id: string; name: string; price: number }; ownerId: string; language: string; localMode?: boolean; onClose: () => void; onAdd: (item: { id: string; name: string; price: number; modifiers: CartSelectedModifierGroup[] }) => void };

export function GuestModifierPicker({ item, ownerId, language, localMode = false, onClose, onAdd }: Props) {
  const ar = language === 'ar';
  const [groups, setGroups] = React.useState<Group[]>([]);
  const [selected, setSelected] = React.useState<Record<string, string[]>>({});
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true); setError('');
      try {
        let gs: any[] = [], os: any[] = [];
        if (localMode) {
          gs = JSON.parse(localStorage.getItem('local_menu_modifier_groups_' + ownerId) || '[]').filter((g: any) => g.menu_item_id === item.id && g.is_active);
          os = JSON.parse(localStorage.getItem('local_menu_modifier_options_' + ownerId) || '[]').filter((o: any) => o.is_active);
        } else {
          const supabase = getSupabase();
          if (!getSupabaseConfig().isConfigured || !supabase) throw new Error(ar ? 'تعذر تحميل اختيارات المنتج.' : 'Could not load product options.');
          const { data: groupData, error: groupError } = await supabase.from('menu_modifier_groups').select('id,name,min_select,max_select,is_required,sort_order').eq('menu_item_id', item.id).eq('owner_id', ownerId).eq('is_active', true).order('sort_order');
          if (groupError) throw groupError;
          gs = groupData || [];
          const ids = gs.map((g: any) => g.id);
          if (ids.length) {
            const { data: optionData, error: optionError } = await supabase.from('menu_modifier_options').select('id,group_id,name,price_delta,sort_order').in('group_id', ids).eq('owner_id', ownerId).eq('is_active', true).order('sort_order');
            if (optionError) throw optionError;
            os = optionData || [];
          }
        }
        if (cancelled) return;
        setGroups(gs.map((g: any) => ({ ...g, options: os.filter((o: any) => o.group_id === g.id).sort((a: any,b: any) => a.sort_order-b.sort_order) })));
      } catch (e) {
        if (!cancelled) {
          // Supabase throws PostgrestError objects (not Error instances);
          // extract their message so guests see a readable reason.
          const msg = e instanceof Error
            ? e.message
            : (e && typeof e === 'object' && typeof (e as { message?: unknown }).message === 'string')
              ? (e as { message: string }).message
              : String(e);
          setError(msg || (ar ? 'تعذر تحميل اختيارات المنتج.' : 'Could not load product options.'));
        }
      }
      finally { if (!cancelled) setLoading(false); }
    };
    void load();
    return () => { cancelled = true; };
  }, [item.id, ownerId, localMode, ar]);

  const toggle = (group: Group, optionId: string) => setSelected(prev => {
    const current = prev[group.id] || [];
    const next = current.includes(optionId) ? current.filter(id => id !== optionId) : group.max_select === 1 ? [optionId] : current.length < group.max_select ? [...current, optionId] : current;
    return { ...prev, [group.id]: next };
  });
  const valid = groups.every(g => (selected[g.id] || []).length >= (g.is_required ? Math.max(1,g.min_select) : g.min_select) && (selected[g.id] || []).length <= g.max_select);
  const chosen = groups.map(g => ({ groupId: g.id, groupName: g.name, options: g.options.filter(o => (selected[g.id] || []).includes(o.id)).map(o => ({ id: o.id, name: o.name, priceDelta: Number(o.price_delta) })) })).filter(g => g.options.length);
  const totalPrice = Number(item.price) + chosen.reduce((sum,g) => sum + g.options.reduce((s,o) => s + o.priceDelta,0),0);

  const submit = () => { setSaving(true); onAdd({ id: item.id, name: item.name, price: totalPrice, modifiers: chosen }); setSaving(false); onClose(); };
  return <div className="fixed inset-0 z-[16000] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4" role="dialog" aria-modal="true" aria-label={ar ? 'اختيارات المنتج' : 'Product options'} dir={ar ? 'rtl' : 'ltr'}>
    <div className="w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white p-5 shadow-2xl">
      <div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-extrabold text-slate-900">{item.name}</h3><p className="text-xs text-slate-500">{ar ? 'اختار الإضافات والتفضيلات' : 'Choose your options and extras'}</p></div><button onClick={onClose} className="rounded-lg px-3 py-1 text-xl text-slate-500" aria-label={ar ? 'إغلاق' : 'Close'}>×</button></div>
      {loading ? <p className="py-8 text-center text-sm text-slate-500">{ar ? 'جاري تحميل الاختيارات...' : 'Loading options...'}</p> : error ? <p role="alert" className="py-5 text-sm text-rose-600">{error}</p> : groups.length === 0 ? <p className="py-5 text-sm text-slate-500">{ar ? 'لا توجد اختيارات إضافية لهذا المنتج.' : 'No extra options for this product.'}</p> : <div className="mt-4 space-y-4">{groups.map(group => <section key={group.id} className="rounded-xl border border-slate-200 p-3"><div className="mb-2 flex justify-between gap-2"><h4 className="font-bold text-sm text-slate-800">{group.name}</h4><span className="text-[10px] text-slate-500">{group.is_required ? (ar ? 'إجباري' : 'Required') : (ar ? 'اختياري' : 'Optional')} · {ar ? 'اختار' : 'Select'} {group.min_select}-{group.max_select}</span></div>{group.options.map(option => { const checked = (selected[group.id] || []).includes(option.id); return <label key={option.id} className="flex cursor-pointer items-center justify-between gap-3 border-t border-slate-100 py-2 text-sm"><span className="flex items-center gap-2"><input type={group.max_select === 1 ? 'radio' : 'checkbox'} name={'modifier-'+group.id} checked={checked} onChange={() => toggle(group,option.id)}/><span className="text-slate-700">{option.name}</span></span><span className="text-xs font-semibold text-slate-500" dir="ltr">{Number(option.price_delta) > 0 ? '+' + Number(option.price_delta).toFixed(2) : '—'}</span></label>;})}</section>)}</div>}
      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4"><div><p className="text-[10px] text-slate-500">{ar ? 'السعر التقديري' : 'Estimated price'}</p><p className="text-lg font-extrabold text-indigo-700" dir="ltr">{totalPrice.toFixed(2)}</p></div><button disabled={loading || !!error || !valid || saving} onClick={submit} className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-40">{ar ? 'إضافة للسلة' : 'Add to cart'}</button></div>
      {!loading && !error && !valid && <p className="mt-2 text-xs text-amber-700">{ar ? 'أكمل الاختيارات الإجبارية والحد الأدنى لكل مجموعة.' : 'Complete required selections and minimums for each group.'}</p>}
    </div>
  </div>;
}
