import React from 'react';
import { getSupabase, getSupabaseConfig } from '../lib/supabase';

type ModifierOption = { id: string; name: string; price_delta: number; is_active: boolean; sort_order: number };
type ModifierGroup = { id: string; name: string; is_required: boolean; min_select: number; max_select: number; is_active: boolean; sort_order: number; options: ModifierOption[] };

type Props = { itemId: string; ownerId: string; language: string; localMode?: boolean };

export function ModifierManager({ itemId, ownerId, language, localMode = false }: Props) {
  const ar = language === 'ar';
  const [groups, setGroups] = React.useState<ModifierGroup[]>([]);
  const [name, setName] = React.useState('');
  const [required, setRequired] = React.useState(false);
  const [min, setMin] = React.useState('0');
  const [max, setMax] = React.useState('1');
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState('');
  const [optionDrafts, setOptionDrafts] = React.useState<Record<string, { name: string; price: string }>>({});

  const load = React.useCallback(async () => {
    if (localMode) {
      const allGroups = JSON.parse(localStorage.getItem('local_menu_modifier_groups_' + ownerId) || '[]') as ModifierGroup[];
      const allOptions = JSON.parse(localStorage.getItem('local_menu_modifier_options_' + ownerId) || '[]') as ModifierOption[];
      setGroups(allGroups.filter(g => (g as any).menu_item_id === itemId).map(g => ({ ...g, options: allOptions.filter(o => (o as any).group_id === g.id) })));
      return;
    }
    const supabase = getSupabase();
    if (!getSupabaseConfig().isConfigured || !supabase) { setNotice(ar ? 'قاعدة البيانات غير متاحة.' : 'Database is unavailable.'); return; }
    const { data: gs, error: ge } = await supabase.from('menu_modifier_groups').select('*').eq('menu_item_id', itemId).eq('owner_id', ownerId).order('sort_order');
    if (ge) { setNotice(ge.message); return; }
    const ids = (gs || []).map((g: any) => g.id);
    const { data: os, error: oe } = ids.length ? await supabase.from('menu_modifier_options').select('*').in('group_id', ids).eq('owner_id', ownerId).order('sort_order') : { data: [], error: null };
    if (oe) { setNotice(oe.message); return; }
    setGroups((gs || []).map((g: any) => ({ ...g, options: (os || []).filter((o: any) => o.group_id === g.id) })));
  }, [itemId, ownerId, localMode, ar]);

  React.useEffect(() => { void load(); }, [load]);

  const addGroup = async () => {
    const clean = name.trim(), minValue = Number(min), maxValue = Number(max);
    if (!clean || !Number.isInteger(minValue) || !Number.isInteger(maxValue) || minValue < 0 || maxValue < 1 || minValue > maxValue || maxValue > 20 || (required && minValue < 1)) {
      setNotice(ar ? 'راجع الاسم والحد الأدنى والأقصى للاختيارات.' : 'Check the group name and selection limits.'); return;
    }
    setBusy(true); setNotice('');
    try {
      const group: any = { id: crypto.randomUUID(), owner_id: ownerId, menu_item_id: itemId, name: clean, is_required: required, min_select: minValue, max_select: maxValue, sort_order: groups.length, is_active: false };
      if (localMode) {
        const all = JSON.parse(localStorage.getItem('local_menu_modifier_groups_' + ownerId) || '[]'); all.push(group); localStorage.setItem('local_menu_modifier_groups_' + ownerId, JSON.stringify(all));
      } else {
        const supabase = getSupabase(); if (!supabase) throw new Error('Supabase unavailable');
        const { error } = await supabase.from('menu_modifier_groups').insert(group); if (error) throw error;
      }
      setName(''); setRequired(false); setMin('0'); setMax('1'); await load();
    } catch (e) { setNotice(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const addOption = async (group: ModifierGroup) => {
    const draft = optionDrafts[group.id] || { name: '', price: '0' };
    const clean = draft.name.trim(), delta = Number(draft.price);
    if (!clean || !Number.isFinite(delta) || delta < 0 || delta > 1000000) { setNotice(ar ? 'أدخل اسم اختيار وسعراً إضافياً صحيحاً.' : 'Enter an option name and a valid non-negative price.'); return; }
    setBusy(true); setNotice('');
    try {
      const option: any = { id: crypto.randomUUID(), owner_id: ownerId, group_id: group.id, name: clean, price_delta: delta, sort_order: group.options.length, is_active: true };
      if (localMode) {
        const all = JSON.parse(localStorage.getItem('local_menu_modifier_options_' + ownerId) || '[]'); all.push(option); localStorage.setItem('local_menu_modifier_options_' + ownerId, JSON.stringify(all));
      } else {
        const supabase = getSupabase(); if (!supabase) throw new Error('Supabase unavailable');
        const { error } = await supabase.from('menu_modifier_options').insert(option); if (error) throw error;
      }
      setOptionDrafts(prev => ({ ...prev, [group.id]: { name: '', price: '0' } })); await load();
    } catch (e) { setNotice(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const toggleActive = async (kind: 'group' | 'option', id: string, active: boolean) => {
    if (kind === 'group' && active) {
      const group = groups.find(row => row.id === id);
      if (!group || !group.options.some(option => option.is_active)) {
        setNotice(ar ? 'أضف اختياراً واحداً مفعّلاً على الأقل قبل تفعيل المجموعة.' : 'Add at least one active option before enabling this group.');
        return;
      }
    }
    setBusy(true); setNotice('');
    try {
      if (localMode) {
        const key = kind === 'group' ? 'local_menu_modifier_groups_' : 'local_menu_modifier_options_';
        const all = JSON.parse(localStorage.getItem(key + ownerId) || '[]');
        localStorage.setItem(key + ownerId, JSON.stringify(all.map((x: any) => x.id === id ? { ...x, is_active: active } : x)));
      } else {
        const supabase = getSupabase(); if (!supabase) throw new Error('Supabase unavailable');
        const table = kind === 'group' ? 'menu_modifier_groups' : 'menu_modifier_options';
        const { error } = await supabase.from(table).update({ is_active: active, updated_at: new Date().toISOString() }).eq('id', id).eq('owner_id', ownerId);
        if (error) throw error;
      }
      await load();
    } catch (e) { setNotice(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const removeGroup = async (id: string) => {
    if (!window.confirm(ar ? 'حذف مجموعة الاختيارات بكل اختياراتها؟' : 'Delete this modifier group and all its options?')) return;
    setBusy(true);
    try {
      if (localMode) {
        const gs = JSON.parse(localStorage.getItem('local_menu_modifier_groups_' + ownerId) || '[]').filter((g: any) => g.id !== id);
        const os = JSON.parse(localStorage.getItem('local_menu_modifier_options_' + ownerId) || '[]').filter((o: any) => o.group_id !== id);
        localStorage.setItem('local_menu_modifier_groups_' + ownerId, JSON.stringify(gs)); localStorage.setItem('local_menu_modifier_options_' + ownerId, JSON.stringify(os));
      } else {
        const supabase = getSupabase(); if (!supabase) throw new Error('Supabase unavailable');
        const { error } = await supabase.from('menu_modifier_groups').delete().eq('id', id).eq('owner_id', ownerId); if (error) throw error;
      }
      await load();
    } catch (e) { setNotice(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  return <section className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3" dir={ar ? 'rtl' : 'ltr'}>
    <h4 className="text-xs font-extrabold text-indigo-800 mb-3">{ar ? 'الاختيارات والإضافات' : 'Modifiers & options'}</h4>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <input value={name} onChange={e => setName(e.target.value)} placeholder={ar ? 'اسم المجموعة مثل الحجم' : 'Group name, e.g. Size'} className="min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs" maxLength={120}/>
      <div className="flex gap-2">
        <input type="number" min="0" max="20" value={min} onChange={e => setMin(e.target.value)} aria-label={ar ? 'الحد الأدنى' : 'Minimum'} className="w-1/2 rounded-lg border border-slate-200 px-2 py-2 text-xs"/>
        <input type="number" min="1" max="20" value={max} onChange={e => setMax(e.target.value)} aria-label={ar ? 'الحد الأقصى' : 'Maximum'} className="w-1/2 rounded-lg border border-slate-200 px-2 py-2 text-xs"/>
      </div>
    </div>
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
      <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={required} onChange={e => { setRequired(e.target.checked); if (e.target.checked && Number(min) < 1) setMin('1'); }}/> {ar ? 'اختيار إجباري' : 'Required selection'}</label>
      <button type="button" disabled={busy} onClick={() => void addGroup()} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{ar ? 'إضافة مجموعة' : 'Add group'}</button>
    </div>
    {groups.map(group => <div key={group.id} className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><p className="text-sm font-bold text-slate-800">{group.name}</p><p className="text-[10px] text-slate-500">{group.is_required ? (ar ? 'إجباري' : 'Required') : (ar ? 'اختياري' : 'Optional')} · {ar ? 'من' : 'Min'} {group.min_select} / {ar ? 'إلى' : 'Max'} {group.max_select}</p></div>
        <div className="flex gap-2"><button type="button" disabled={busy} onClick={() => void toggleActive('group', group.id, !group.is_active)} className="text-xs font-bold text-indigo-600">{group.is_active ? (ar ? 'تعطيل' : 'Disable') : (ar ? 'تفعيل' : 'Enable')}</button><button type="button" disabled={busy} onClick={() => void removeGroup(group.id)} className="text-xs font-bold text-rose-600">{ar ? 'حذف' : 'Delete'}</button></div>
      </div>
      {(!group.is_active || !group.options.some(option => option.is_active)) && <p className="mt-2 rounded-lg bg-amber-50 px-2 py-2 text-[11px] text-amber-800">{ar ? (group.options.some(option => option.is_active) ? 'المجموعة غير ظاهرة للعملاء بعد: اضغط تفعيل لإظهارها.' : 'المجموعة غير جاهزة: أضف اختياراً وفعّله، ثم فعّل المجموعة.') : (group.options.some(option => option.is_active) ? 'Not visible to guests yet: enable this group to publish it.' : 'Not ready yet: add and activate an option, then enable this group.')}</p>}
      <div className="mt-2 space-y-1">{group.options.map(option => <div key={option.id} className="flex items-center justify-between gap-2 text-xs"><span className={option.is_active ? 'text-slate-700' : 'text-slate-400 line-through'}>{option.name} · +{Number(option.price_delta).toFixed(2)}</span><button type="button" disabled={busy} onClick={() => void toggleActive('option', option.id, !option.is_active)} className="font-semibold text-indigo-600">{option.is_active ? (ar ? 'تعطيل' : 'Disable') : (ar ? 'تفعيل' : 'Enable')}</button></div>)}</div>
      <div className="mt-2 flex gap-2"><input value={(optionDrafts[group.id] || {name:'',price:'0'}).name} onChange={e => setOptionDrafts(p => ({...p,[group.id]:{...(p[group.id]||{name:'',price:'0'}),name:e.target.value}}))} placeholder={ar ? 'اسم الاختيار' : 'Option name'} className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-2 text-xs" maxLength={120}/><input type="number" min="0" step="0.01" value={(optionDrafts[group.id] || {name:'',price:'0'}).price} onChange={e => setOptionDrafts(p => ({...p,[group.id]:{...(p[group.id]||{name:'',price:'0'}),price:e.target.value}}))} aria-label={ar ? 'السعر الإضافي' : 'Price delta'} className="w-24 rounded-lg border border-slate-200 px-2 py-2 text-xs"/><button type="button" disabled={busy} onClick={() => void addOption(group)} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white">{ar ? 'إضافة' : 'Add'}</button></div>
    </div>)}
    {notice && <p role="status" className="mt-2 text-xs text-rose-600">{notice}</p>}
  </section>;
}
