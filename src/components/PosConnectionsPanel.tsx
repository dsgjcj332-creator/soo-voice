import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Copy, KeyRound, Loader2, Plus, RefreshCw, ShieldCheck } from 'lucide-react';
import { getSupabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

type PosLocation = { id: string; connection_id: string; provider_location_id: string; name: string; timezone: string | null; currency: string | null; active: boolean; };
type PosOrderRoute = { id: string; connection_id: string; location_id: string; route_type: 'default' | 'table'; route_value: string | null; };
type PosCatalogRow = { id: string; provider_item_id: string; category_id: string | null; name: string; description: string | null; currency: string; unit_price: number; available: boolean; active: boolean; source_updated_at: string; };
type PosMenuItem = { id: string; name: string; description: string | null; price: number; isAiOnly?: boolean };
type PosCatalogField = 'name' | 'description' | 'price' | 'available' | 'categoryId';
type PosApplyField = 'name' | 'description' | 'price';
type PosApplyEvent = { id: string; provider_item_id: string; selected_fields: PosApplyField[]; before_state: Record<string, unknown>; after_state: Record<string, unknown>; created_at: string };
type PosCatalogMapping = { id: string; provider_item_id: string; menu_item_id: string; approved_at: string; field_overrides: Partial<Record<PosCatalogField, boolean>> };
type PosCatalogMappingEvent = { id: string; provider_item_id: string; event_type: 'created' | 'relinked' | 'protection_updated' | 'reapproved'; actor_id: string; created_at: string };

type PosConnection = {
  id: string;
  provider: string;
  display_name: string | null;
  status: string;
  created_at: string;
  inbound_webhooks_configured?: boolean;
  outbound_orders_configured?: boolean;
  inbound_webhooks_active?: boolean;
  outbound_orders_active?: boolean;
};

const PROVIDERS = [
  ['foodics', 'Foodics'], ['toast', 'Toast'], ['square', 'Square'],
  ['clover', 'Clover'], ['lightspeed', 'Lightspeed'],
  ['oracle_simphony', 'Oracle Simphony'], ['odoo', 'Odoo'],
  ['shopify_pos', 'Shopify POS'], ['salla', 'Salla'], ['custom', 'نظام آخر / Custom'],
];

export function PosConnectionsPanel({ language }: { language: string }) {
  const { user } = useAuth();
  const isArabic = language === 'ar';
  const [connections, setConnections] = useState<PosConnection[]>([]);
  const [locations, setLocations] = useState<PosLocation[]>([]);
  const [orderRoutes, setOrderRoutes] = useState<PosOrderRoute[]>([]);
  const [defaultRouteLocationId, setDefaultRouteLocationId] = useState('');
  const [tableRouteValue, setTableRouteValue] = useState('');
  const [tableRouteLocationId, setTableRouteLocationId] = useState('');
  const [savingRoute, setSavingRoute] = useState(false);
  const [reviewLocationId, setReviewLocationId] = useState('');
  const [catalogRows, setCatalogRows] = useState<PosCatalogRow[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState('');
  const [menuItems, setMenuItems] = useState<PosMenuItem[]>([]);
  const [catalogMappings, setCatalogMappings] = useState<PosCatalogMapping[]>([]);
  const [mappingEvents, setMappingEvents] = useState<PosCatalogMappingEvent[]>([]);
  const [applyEvents, setApplyEvents] = useState<PosApplyEvent[]>([]);
  const [selectedApplyFields, setSelectedApplyFields] = useState<Record<string, PosApplyField[]>>({});
  const [applyingProviderId, setApplyingProviderId] = useState('');
  const [mappingSelections, setMappingSelections] = useState<Record<string, string>>({});
  const [mappingOverrides, setMappingOverrides] = useState<Record<string, Partial<Record<PosCatalogField, boolean>>>>({});
  const [savingMappingId, setSavingMappingId] = useState('');
  const [branchConnectionId, setBranchConnectionId] = useState('');
  const [branchProviderId, setBranchProviderId] = useState('');
  const [branchName, setBranchName] = useState('');
  const [branchTimezone, setBranchTimezone] = useState('Africa/Cairo');
  const [branchCurrency, setBranchCurrency] = useState('EGP');
  const [savingBranch, setSavingBranch] = useState(false);
  const [provider, setProvider] = useState('foodics');
  const [displayName, setDisplayName] = useState('');
  const [credentialsText, setCredentialsText] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const [webhookSecret, setWebhookSecret] = useState('');
  const [rotatingWebhookConnectionId, setRotatingWebhookConnectionId] = useState('');
  const [activatingWebhookConnectionId, setActivatingWebhookConnectionId] = useState('');

  const request = useCallback(async (path: 'connections' | 'locations' | 'catalog/mappings' | 'catalog/mapping-events' | 'catalog/apply' | 'catalog/apply-events' | 'menu-items' | 'connections/activate-webhooks' | 'order-routes', method: 'GET' | 'POST' | 'PATCH' | 'DELETE', body?: unknown, resourceId?: string) => {
    const supabase = getSupabase();
    if (!supabase || !user || user.provider !== 'supabase') {
      throw new Error(isArabic ? 'يلزم تسجيل الدخول بحساب موثّق.' : 'A verified Supabase session is required.');
    }
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.access_token) throw new Error(isArabic ? 'انتهت جلسة الدخول. سجّل الدخول مجددًا.' : 'Your session expired. Please sign in again.');
    const endpoint = path === 'connections/activate-webhooks'
      ? `/api/pos/connections/${encodeURIComponent(resourceId || '')}/activate-webhooks`
      : `/api/pos/${path}${resourceId ? `/${encodeURIComponent(resourceId)}` : ''}`;
    const response = await fetch(endpoint, {
      method,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || (isArabic ? 'تعذر إتمام العملية.' : 'The request could not be completed.'));
    return result;
  }, [user, isArabic]);

  const loadConnections = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const rows = await request('connections', 'GET');
      setConnections(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setError(true);
      setMessage(err instanceof Error ? err.message : (isArabic ? 'تعذر تحميل الاتصالات.' : 'Could not load connections.'));
    } finally {
      setLoading(false);
    }
  }, [request, isArabic]);

  const loadLocations = useCallback(async () => {
    try {
      const rows = await request('locations', 'GET');
      setLocations(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setError(true);
      setMessage(err instanceof Error ? err.message : (isArabic ? 'تعذر تحميل الفروع.' : 'Could not load branches.'));
    }
  }, [request, isArabic]);

  const loadOrderRoutes = useCallback(async () => {
    try {
      const rows = await request('order-routes', 'GET');
      const saved = Array.isArray(rows) ? rows as PosOrderRoute[] : [];
      setOrderRoutes(saved);
      setDefaultRouteLocationId(saved.find(route => route.route_type === 'default')?.location_id || '');
    } catch (err) {
      setError(true);
      setMessage(err instanceof Error ? err.message : (isArabic ? 'تعذر تحميل قواعد توجيه الطلبات.' : 'Could not load order routing rules.'));
    }
  }, [request, isArabic]);

  useEffect(() => {
    if (user?.provider === 'supabase') { void loadConnections(); void loadLocations(); void loadOrderRoutes(); }
  }, [user?.provider, user?.uid, loadConnections, loadLocations, loadOrderRoutes]);

  useEffect(() => {
    setCatalogRows([]);
    if (!reviewLocationId) { setCatalogError(''); return; }
    let cancelled = false;
    const loadCatalog = async () => {
      setCatalogLoading(true); setCatalogError('');
      try {
        const supabase = getSupabase();
        if (!supabase || !user || user.provider !== 'supabase') throw new Error(isArabic ? 'يلزم تسجيل الدخول بحساب موثّق.' : 'A verified session is required.');
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session?.access_token) throw new Error(isArabic ? 'انتهت جلسة الدخول.' : 'Your session expired.');
        const response = await fetch(`/api/pos/catalog?locationId=${encodeURIComponent(reviewLocationId)}`, { headers: { Authorization: `Bearer ${session.access_token}` } });
        const result = await response.json().catch(() => []);
        if (!response.ok) throw new Error(result.error || (isArabic ? 'تعذر تحميل المنتجات.' : 'Could not load catalog.'));
        if (!cancelled) setCatalogRows(Array.isArray(result) ? result : []);
      } catch (err) { if (!cancelled) setCatalogError(err instanceof Error ? err.message : 'Catalog unavailable'); }
      finally { if (!cancelled) setCatalogLoading(false); }
    };
    void loadCatalog();
    return () => { cancelled = true; };
  }, [reviewLocationId, user, isArabic]);

  useEffect(() => {
    setMenuItems([]); setCatalogMappings([]); setMappingEvents([]); setApplyEvents([]); setMappingSelections({}); setMappingOverrides({}); setSelectedApplyFields({});
    if (!reviewLocationId) return;
    let cancelled = false;
    const loadMappingOptions = async () => {
      try {
        const [items, mappings, mappingHistory, applyHistory] = await Promise.all([
          request('menu-items', 'GET'), request('catalog/mappings', 'GET'),
          request('catalog/mapping-events', 'GET', undefined, reviewLocationId),
          request('catalog/apply-events', 'GET', undefined, reviewLocationId),
        ]);
        if (!cancelled) {
          setMenuItems(Array.isArray(items) ? items : []);
          setCatalogMappings(Array.isArray(mappings) ? mappings : []);
          setMappingEvents(Array.isArray(mappingHistory) ? mappingHistory : []);
          setApplyEvents(Array.isArray(applyHistory) ? applyHistory : []);
        }
      } catch (err) { if (!cancelled) setCatalogError(err instanceof Error ? err.message : (isArabic ? 'تعذر تحميل عناصر المنيو والربط.' : 'Could not load menu items and mappings.')); }
    };
    void loadMappingOptions();
    return () => { cancelled = true; };
  }, [reviewLocationId, request, isArabic]);

  const saveCatalogMapping = async (item: PosCatalogRow) => {
    const menuItemId = mappingSelections[item.provider_item_id] || catalogMappings.find(mapping => mapping.provider_item_id === item.provider_item_id)?.menu_item_id || '';
    if (!reviewLocationId || !menuItemId) return;
    setSavingMappingId(item.provider_item_id); setCatalogError('');
    try {
      const saved = await request('catalog/mappings', 'POST', { locationId: reviewLocationId, providerItemId: item.provider_item_id, menuItemId, fieldOverrides: mappingOverrides[item.provider_item_id] || catalogMappings.find(mapping => mapping.provider_item_id === item.provider_item_id)?.field_overrides || {} });
      setCatalogMappings(current => [...current.filter(mapping => mapping.provider_item_id !== item.provider_item_id), saved as PosCatalogMapping]);
      setSelectedApplyFields(current => ({ ...current, [item.provider_item_id]: [] }));
      const history = await request('catalog/mapping-events', 'GET', undefined, reviewLocationId);
      setMappingEvents(Array.isArray(history) ? history : []);
      setMessage(isArabic ? 'تم حفظ ربط المنتج بموافقتك. لم يتم تغيير المنيو أو السعر.' : 'Product mapping approved and saved. The menu and price were not changed.');
      setError(false);
    } catch (err) { setCatalogError(err instanceof Error ? err.message : (isArabic ? 'تعذر حفظ ربط المنتج.' : 'Could not save product mapping.')); }
    finally { setSavingMappingId(''); }
  };

  const applyCatalogChanges = async (item: PosCatalogRow) => {
    const mapping = catalogMappings.find(row => row.provider_item_id === item.provider_item_id);
    const selectedFields = selectedApplyFields[item.provider_item_id] || [];
    if (!mapping || !reviewLocationId || selectedFields.length === 0) return;
    setApplyingProviderId(item.provider_item_id); setCatalogError('');
    try {
      await request('catalog/apply', 'POST', {
        locationId: reviewLocationId, providerItemId: item.provider_item_id,
        menuItemId: mapping.menu_item_id, requestId: crypto.randomUUID(), selectedFields,
      });
      setSelectedApplyFields(current => ({ ...current, [item.provider_item_id]: [] }));
      setMessage(isArabic ? 'تم تطبيق الحقول التي اخترتها وتسجيل القيم قبل وبعد التحديث.' : 'Selected fields applied and before/after values recorded.');
      setError(false);
      const [menuRows, history] = await Promise.all([
        request('menu-items', 'GET'),
        request('catalog/apply-events', 'GET', undefined, reviewLocationId),
      ]);
      setMenuItems(Array.isArray(menuRows) ? menuRows : []);
      setApplyEvents(Array.isArray(history) ? history : []);
    } catch (err) {
      setCatalogError(err instanceof Error ? err.message : (isArabic ? 'تعذر تطبيق تحديثات المنيو.' : 'Could not apply menu changes.'));
    } finally { setApplyingProviderId(''); }
  };

  const saveConnection = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('');
    let credentials: unknown;
    try {
      credentials = JSON.parse(credentialsText);
      if (!credentials || typeof credentials !== 'object' || Array.isArray(credentials)) throw new Error('invalid');
      if (Object.keys(credentials as Record<string, unknown>).length === 0) throw new Error('empty');
    } catch {
      setError(true);
      setMessage(isArabic ? 'أدخل بيانات الاعتماد بصيغة JSON صحيحة تحتوي على حقول.' : 'Enter a valid JSON object containing credential fields.');
      return;
    }
    setSaving(true);
    setError(false);
    try {
      await request('connections', 'POST', { provider, displayName: displayName.trim() || undefined, credentials });
      setCredentialsText('');
      setDisplayName('');
      setShowForm(false);
      setMessage(isArabic ? 'تم حفظ بيانات الربط المشفّرة. الحالة: قيد الإعداد، ولم يتم اختبار الاتصال بعد.' : 'Encrypted credentials saved. Status: pending setup; the provider connection has not been tested.');
      await loadConnections();
      await loadLocations();
    } catch (err) {
      setError(true);
      setMessage(err instanceof Error ? err.message : (isArabic ? 'فشل حفظ الربط.' : 'Could not save connection.'));
    } finally {
      setSaving(false);
    }
  };

  const rotateWebhookSecret = async (connection: PosConnection) => {
    const confirmed = window.confirm(isArabic
      ? 'سيتم إنشاء سر جديد وإبطال السر السابق فورًا. حدّث إعدادات مزوّد الكاشير قبل استقبال الأحداث. هل تريد المتابعة؟'
      : 'A new secret will immediately invalidate the previous one. Update your POS provider before sending more events. Continue?');
    if (!confirmed) return;
    setRotatingWebhookConnectionId(connection.id);
    setWebhookSecret('');
    setError(false);
    setMessage('');
    try {
      const result = await request(`connections/${connection.id}/webhook-secret`, 'POST');
      if (!result || typeof result.secret !== 'string' || result.secret.length < 32) {
        throw new Error(isArabic ? 'لم يتم استلام السر الجديد بشكل صحيح.' : 'The new secret response was invalid.');
      }
      setWebhookSecret(result.secret);
      await loadConnections();
      setMessage(isArabic
        ? 'تم إنشاء السر. انسخه واحفظه الآن؛ لن نعرضه مرة أخرى. السر السابق لم يعد صالحًا.'
        : 'Secret generated. Copy and store it now; it will not be shown again. The previous secret is no longer valid.');
    } catch (err) {
      setError(true);
      setMessage(err instanceof Error ? err.message : (isArabic ? 'تعذر تدوير السر.' : 'Could not rotate webhook secret.'));
    } finally {
      setRotatingWebhookConnectionId('');
    }
  };

  const activateWebhookConnection = async (connection: PosConnection) => {
    const activeBranches = locations.filter(location => location.connection_id === connection.id && location.active).length;
    if (activeBranches === 0) {
      setError(true);
      setMessage(isArabic ? 'أضف فرعًا نشطًا قبل تفعيل Webhook.' : 'Add an active branch before activating webhooks.');
      return;
    }
    const confirmed = window.confirm(isArabic
      ? 'هل أكدت إعداد عنوان Webhook والسر داخل نظام الكاشير أو الوسيط؟ هذا يفعّل استقبال تحديثات المنيو وحالة الطلبات. إرسال الطلبات يتطلب أيضًا إعداد وسيط الإرسال وقواعد توجيه الفروع.'
      : 'Have you configured the webhook URL and secret in your POS or middleware? This enables inbound catalog and order-status updates.');
    if (!confirmed) return;
    setActivatingWebhookConnectionId(connection.id);
    setError(false);
    setMessage('');
    try {
      await request('connections/activate-webhooks', 'POST', { confirmWebhookConfigured: true }, connection.id);
      setMessage(isArabic
        ? 'تم تفعيل استقبال Webhook. لإرسال الطلبات، تأكد من إعداد وسيط الإرسال وربط الأصناف وحفظ الفرع الافتراضي.'
        : 'Inbound webhooks are active for this connection. Catalog and status sync are enabled.');
      await loadConnections();
    } catch (err) {
      setError(true);
      setMessage(err instanceof Error ? err.message : (isArabic ? 'تعذر تفعيل Webhook.' : 'Could not activate webhooks.'));
    } finally {
      setActivatingWebhookConnectionId('');
    }
  };

  const activateOutboundConnection = async (connection: PosConnection) => {
    const activeBranches = locations.filter(location => location.connection_id === connection.id && location.active).length;
    if (!connection.outbound_orders_configured) {
      setError(true);
      setMessage(isArabic ? 'بيانات orderWebhookUrl و orderWebhookSecret غير مكتملة. أضفها مشفرة عند إنشاء الاتصال.' : 'Outbound credentials are missing. Add orderWebhookUrl and orderWebhookSecret to the encrypted connection credentials.');
      return;
    }
    if (activeBranches === 0) {
      setError(true);
      setMessage(isArabic ? 'أضف فرعًا نشطًا قبل تفعيل إرسال الطلبات.' : 'Add an active branch before enabling outbound orders.');
      return;
    }
    if (!window.confirm(isArabic
      ? 'هل تأكدت أن وسيط الكاشير جاهز لاستقبال الطلبات الموقعة؟ لازم تحفظ الفرع الافتراضي وقواعد الطاولات قبل وصول طلبات العملاء.'
      : 'Have you confirmed that your POS middleware is ready to receive signed orders? Save the default branch and table rules before accepting customer orders?')) return;
    setActivatingWebhookConnectionId(connection.id);
    setError(false); setMessage('');
    try {
      const result = await request('connections/activate-webhooks', 'POST', { confirmOutboundConfigured: true }, connection.id);
      if (result.outboundOrderCreation !== true) throw new Error(isArabic ? 'لم يتم تأكيد تفعيل إرسال الطلبات.' : 'Outbound order activation was not confirmed.');
      await loadConnections();
      setMessage(isArabic ? 'تم تفعيل الاتصال لإرسال الطلبات. احفظ الفرع الافتراضي واربط أصناف كل فرع.' : 'Outbound order dispatch is enabled. Save a default branch and map items for each branch.');
    } catch (err) {
      setError(true); setMessage(err instanceof Error ? err.message : (isArabic ? 'تعذر تفعيل إرسال الطلبات.' : 'Could not enable outbound order dispatch.'));
    } finally { setActivatingWebhookConnectionId(''); }
  };

  const saveBranch = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingBranch(true);
    setError(false);
    setMessage('');
    try {
      await request('locations', 'POST', {
        connectionId: branchConnectionId,
        providerLocationId: branchProviderId.trim(),
        name: branchName.trim(),
        timezone: branchTimezone.trim() || undefined,
        currency: branchCurrency.trim() || undefined,
      });
      setBranchProviderId('');
      setBranchName('');
      setMessage(isArabic ? 'تم حفظ ربط الفرع يدويًا. لم يتم اكتشافه تلقائيًا من مزوّد الكاشير.' : 'Branch mapping saved manually. It was not discovered automatically from the POS provider.');
      await loadLocations();
    } catch (err) {
      setError(true);
      setMessage(err instanceof Error ? err.message : (isArabic ? 'تعذر حفظ الفرع.' : 'Could not save branch.'));
    } finally {
      setSavingBranch(false);
    }
  };

  const saveDefaultRoute = async () => {
    const location = locations.find(item => item.id === defaultRouteLocationId && item.active);
    if (!location) return;
    setSavingRoute(true); setError(false); setMessage('');
    try {
      await request('order-routes', 'POST', {
        routeType: 'default', connectionId: location.connection_id, locationId: location.id,
      });
      await loadOrderRoutes();
      setMessage(isArabic ? 'تم حفظ الفرع الافتراضي لاستقبال الطلبات الجديدة.' : 'Default POS branch saved for new orders.');
    } catch (err) {
      setError(true); setMessage(err instanceof Error ? err.message : (isArabic ? 'تعذر حفظ الفرع الافتراضي.' : 'Could not save default branch.'));
    } finally { setSavingRoute(false); }
  };

  const saveTableRoute = async (event: React.FormEvent) => {
    event.preventDefault();
    const location = locations.find(item => item.id === tableRouteLocationId && item.active);
    if (!location || !tableRouteValue.trim()) return;
    setSavingRoute(true); setError(false); setMessage('');
    try {
      await request('order-routes', 'POST', {
        routeType: 'table', routeValue: tableRouteValue.trim().toUpperCase(),
        connectionId: location.connection_id, locationId: location.id,
      });
      setTableRouteValue('');
      await loadOrderRoutes();
      setMessage(isArabic ? 'تم حفظ قاعدة توجيه الطاولة.' : 'Table routing rule saved.');
    } catch (err) {
      setError(true); setMessage(err instanceof Error ? err.message : (isArabic ? 'تعذر حفظ قاعدة الطاولة.' : 'Could not save table route.'));
    } finally { setSavingRoute(false); }
  };

  const deleteOrderRoute = async (route: PosOrderRoute) => {
    const confirmed = window.confirm(isArabic ? 'حذف قاعدة التوجيه دي؟ الطلبات الجديدة هترجع للفرع الافتراضي.' : 'Delete this routing rule? New orders will use the default branch.');
    if (!confirmed) return;
    try {
      await request('order-routes', 'DELETE', undefined, route.id);
      await loadOrderRoutes();
      setMessage(isArabic ? 'تم حذف قاعدة التوجيه.' : 'Routing rule deleted.');
    } catch (err) {
      setError(true); setMessage(err instanceof Error ? err.message : (isArabic ? 'تعذر حذف قاعدة التوجيه.' : 'Could not delete routing rule.'));
    }
  };

  const removeBranch = async (location: PosLocation) => {
    const confirmed = window.confirm(isArabic
      ? `هل تريد إيقاف ربط الفرع «${location.name}»؟ سيظل سجل الطلبات محفوظًا.`
      : `Deactivate the mapping for "${location.name}"? Existing order history will be preserved.`);
    if (!confirmed) return;
    setError(false);
    setMessage('');
    try {
      await request('locations', 'PATCH', { active: false }, location.id);
      setLocations(current => current.map(item => item.id === location.id ? { ...item, active: false } : item));
      await loadOrderRoutes();
      setMessage(isArabic ? 'تم إيقاف ربط الفرع وحذف قواعد توجيهه مع الاحتفاظ بسجل الطلبات.' : 'Branch mapping deactivated; its routing rules were cleared and order history was preserved.');
    } catch (err) {
      setError(true);
      setMessage(err instanceof Error ? err.message : (isArabic ? 'تعذر إزالة ربط الفرع.' : 'Could not remove branch mapping.'));
    }
  };

  const routableLocations = locations.filter(location =>
    location.active && connections.some(connection =>
      connection.id === location.connection_id && connection.outbound_orders_active === true));

  const statusLabel = (status: string) => {
    const labels: Record<string, [string, string]> = {
      pending: ['قيد الإعداد', 'Pending setup'],
      connected: ['متصل', 'Connected'],
      degraded: ['يحتاج مراجعة', 'Degraded'],
      reauthorization_required: ['يحتاج إعادة تفويض', 'Reauthorization required'],
      disconnected: ['غير متصل', 'Disconnected'],
    };
    return labels[status] || [status, status];
  };

  if (!user || user.provider !== 'supabase') {
    return <section className="mb-8 rounded-3xl border border-amber-200 bg-amber-50 p-6">
      <h2 className="font-bold text-slate-900">{isArabic ? 'تكاملات أنظمة الكاشير' : 'POS integrations'}</h2>
      <p className="mt-2 text-sm text-amber-900">{isArabic ? 'سجّل الدخول بحساب Supabase موثّق لإدارة اتصالات الكاشير. حساب العرض المحلي لا يملك صلاحية الربط.' : 'Sign in with a verified Supabase account to manage POS connections. Local demo accounts cannot create connections.'}</p>
    </section>;
  }

  return <section className="mb-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2 className="text-lg font-extrabold text-slate-900">{isArabic ? 'تكاملات أنظمة الكاشير (POS)' : 'Point-of-sale integrations'}</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">{isArabic ? 'إدارة بيانات الربط لكل مزوّد من مكان واحد. بيانات الاعتماد تُشفّر على السيرفر ولا تُعاد إلى المتصفح.' : 'Manage credentials for different POS providers in one place. Credentials are encrypted server-side and never returned to the browser.'}</p>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => void loadConnections()} disabled={loading} className="rounded-xl border border-slate-200 p-3 text-slate-600 hover:bg-slate-50 disabled:opacity-50" aria-label={isArabic ? 'تحديث' : 'Refresh'}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
        <button type="button" onClick={() => { setShowForm(v => !v); setMessage(''); }} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-700"><Plus className="h-4 w-4" />{isArabic ? 'إضافة نظام كاشير' : 'Add POS'}</button>
      </div>
    </div>

    <div className="mt-5 flex items-start gap-3 rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm text-sky-900">
      <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
      <p>{isArabic ? 'يمكن تفعيل استقبال Webhook لمزامنة المنيو وحالة الطلبات. إرسال الطلبات للخارج متاح عبر وسيط HTTPS عام بعد إعداد بياناته وربط الأصناف واختيار الفرع الافتراضي.' : 'Inbound webhooks sync catalog and order status. Outbound orders are supported through the signed universal HTTPS bridge after its credentials, item mappings, and default branch are configured.'}</p>
    </div>

    {showForm && <form onSubmit={saveConnection} className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-xs font-bold text-slate-600">{isArabic ? 'مزود الكاشير' : 'POS provider'}
          <select value={provider} onChange={e => setProvider(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium">
            {PROVIDERS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>
        <label className="block text-xs font-bold text-slate-600">{isArabic ? 'اسم تعريفي (اختياري)' : 'Display name (optional)'}
          <input value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={100} placeholder={isArabic ? 'مثال: فرع الزقازيق' : 'e.g. Main branch'} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm" />
        </label>
      </div>
      <label className="block text-xs font-bold text-slate-600">{isArabic ? 'بيانات الاعتماد بصيغة JSON' : 'Credentials as JSON'}
        <textarea value={credentialsText} onChange={e => setCredentialsText(e.target.value)} required rows={6} autoComplete="off" spellCheck={false} placeholder={'{"apiKey":"YOUR_SECRET","storeId":"YOUR_STORE_ID"}' } className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 font-mono text-xs" />
      </label>
      <p className="text-xs leading-5 text-slate-500">{isArabic ? 'استخدم أسماء الحقول التي يحددها مزوّدك. لا تلصق بيانات حقيقية في بيئة تجريبية غير موثوقة. لن نعرض هذه القيم بعد الحفظ.' : 'Use the field names specified by your provider. Do not paste live secrets into an untrusted test environment. Values will not be displayed after saving.'}</p>
      <p className="text-xs leading-5 text-indigo-700">{isArabic ? 'لإرسال الطلبات عبر وسيط كاشير عام، أضف orderWebhookUrl و orderWebhookSecret (سر بطول 32 حرفًا على الأقل) إلى JSON. بعد الحفظ أنشئ سر Webhook الوارد من زر الاتصال. لازم تربط كل صنف من المنيو بصنف الكاشير وتحدد عملة الفرع.' : 'For outbound orders through a universal POS bridge, include orderWebhookUrl and orderWebhookSecret (at least 32 characters) in this JSON. After saving, generate the inbound webhook secret from the connection action. Every menu item must be mapped to a POS catalog item and the branch currency must be set.'}</p>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={saving || !credentialsText.trim()} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}{isArabic ? 'حفظ مشفّر' : 'Save encrypted'}</button>
        <button type="button" onClick={() => { setShowForm(false); setCredentialsText(''); }} className="rounded-xl px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-200">{isArabic ? 'إلغاء' : 'Cancel'}</button>
      </div>
    </form>}

    {webhookSecret && <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm font-bold text-amber-950">{isArabic ? 'احفظ سر Webhook الآن — يظهر مرة واحدة فقط' : 'Store this webhook secret now — it is shown only once'}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <code dir="ltr" className="min-w-0 flex-1 break-all rounded-lg border border-amber-200 bg-white p-3 text-xs text-slate-800">{webhookSecret}</code>
        <button type="button" onClick={() => { void navigator.clipboard.writeText(webhookSecret).then(() => setMessage(isArabic ? 'تم نسخ السر.' : 'Secret copied.')).catch(() => setMessage(isArabic ? 'تعذر النسخ؛ انسخ السر يدويًا.' : 'Copy failed; copy the secret manually.')); }} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white"><Copy className="h-3.5 w-3.5" />{isArabic ? 'نسخ' : 'Copy'}</button>
      </div>
      <p className="mt-2 text-xs leading-5 text-amber-900">{isArabic ? 'أرسل هذا السر إلى إعدادات الـWebhook لدى مزوّدك. لا تشاركه في رسائل أو سجلات عامة. إذا أغلقت الصفحة أو فقدته، أنشئ سرًا جديدًا.' : 'Configure your POS provider with this secret. Do not share it in public messages or logs. If you close the page or lose it, generate a new secret.'}</p>
      <button type="button" onClick={() => setWebhookSecret('')} className="mt-3 text-xs font-bold text-amber-900 underline">{isArabic ? 'إخفاء السر' : 'Hide secret'}</button>
    </div>}

    {message && <p role="status" className={`mt-4 flex items-start gap-2 text-sm ${error ? 'text-rose-700' : 'text-emerald-700'}`}><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{message}</p>}

    <div className="mt-6 space-y-3">
      {loading && <p className="py-5 text-center text-sm text-slate-500">{isArabic ? 'جارٍ تحميل الاتصالات...' : 'Loading connections...'}</p>}
      {!loading && connections.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 p-7 text-center text-sm text-slate-500">{isArabic ? 'لا توجد أنظمة كاشير مضافة حتى الآن.' : 'No POS connections have been added yet.'}</div>}
      {connections.map(connection => {
        const label = statusLabel(connection.status);
        return <div key={connection.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4">
          <div><p className="font-bold text-slate-800">{connection.display_name || PROVIDERS.find(p => p[0] === connection.provider)?.[1] || connection.provider}</p><p className="mt-1 text-xs text-slate-500">{connection.provider}</p></div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${connection.status === 'connected' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>{isArabic ? label[0] : label[1]}</span>
            <button type="button" onClick={() => void rotateWebhookSecret(connection)} disabled={rotatingWebhookConnectionId === connection.id} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              {rotatingWebhookConnectionId === connection.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
              {isArabic ? 'إنشاء / تجديد سر Webhook' : 'Generate / rotate webhook secret'}
            </button>
            <button type="button" onClick={() => void navigator.clipboard.writeText(`${window.location.origin}/api/pos/webhooks/${connection.id}`).then(() => setMessage(isArabic ? 'تم نسخ عنوان Webhook.' : 'Webhook URL copied.')).catch(() => setMessage(isArabic ? 'تعذر النسخ؛ انسخ العنوان يدويًا.' : 'Copy failed; copy the URL manually.'))} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
              <Copy className="h-3.5 w-3.5" />{isArabic ? 'نسخ عنوان Webhook' : 'Copy webhook URL'}
            </button>
            {connection.inbound_webhooks_configured && !connection.inbound_webhooks_active && <button type="button" onClick={() => void activateWebhookConnection(connection)} disabled={activatingWebhookConnectionId === connection.id || !locations.some(location => location.connection_id === connection.id && location.active)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
              {activatingWebhookConnectionId === connection.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {isArabic ? 'تفعيل استقبال Webhook' : 'Activate inbound webhooks'}
            </button>}
            {connection.outbound_orders_configured && !connection.outbound_orders_active && <button type="button" onClick={() => void activateOutboundConnection(connection)} disabled={activatingWebhookConnectionId === connection.id || !locations.some(location => location.connection_id === connection.id && location.active)} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50">
              {activatingWebhookConnectionId === connection.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {isArabic ? 'تفعيل إرسال الطلبات' : 'Enable outbound orders'}
            </button>}
          </div>
        </div>;
      })}
    </div>

    <div className="mt-8 border-t border-slate-100 pt-6">
      <div className="mb-4">
        <h3 className="font-extrabold text-slate-900">{isArabic ? 'مراجعة منيو الكاشير' : 'POS catalog review'}</h3>
        <p className="mt-1 text-xs leading-5 text-slate-500">{isArabic ? 'راجع المنتجات المحفوظة من الكاشير قبل ربطها بمنيو SooVoice. المعاينة لا تغيّر المنيو.' : 'Review stored POS products before mapping them to SooVoice. Preview does not change your menu.'}</p>
      </div>
      <label className="block max-w-xl text-xs font-bold text-slate-600">{isArabic ? 'اختر الفرع' : 'Select branch'}
        <select value={reviewLocationId} onChange={e => setReviewLocationId(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm">
          <option value="">{isArabic ? 'اختر فرعًا' : 'Choose a branch'}</option>
          {locations.filter(location => location.active).map(location => <option key={location.id} value={location.id}>{location.name}</option>)}
        </select>
      </label>
      {reviewLocationId && <div className="mt-4">
        {catalogLoading && <p className="py-4 text-sm text-slate-500">{isArabic ? 'جارٍ تحميل المنتجات...' : 'Loading products...'}</p>}
        {catalogError && <p role="alert" className="py-3 text-sm text-rose-700">{catalogError}</p>}
        {!catalogLoading && !catalogError && catalogRows.length > 0 && menuItems.length === 0 && <p className="mt-3 text-xs text-amber-700">{isArabic ? 'لا توجد منتجات متاحة في منيو SooVoice للربط.' : 'No eligible SooVoice menu items are available to map.'}</p>}
        {!catalogLoading && !catalogError && catalogRows.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-500">{isArabic ? 'لا توجد لقطة منيو محفوظة. يلزم موصل كاشير فعلي لجلب المنتجات.' : 'No catalog snapshot exists. A real POS adapter is required to fetch products.'}</div>}
        {!catalogLoading && !catalogError && catalogRows.length > 0 && <div className="space-y-2">
          <p className="text-xs text-slate-500">{isArabic ? `عدد المنتجات: ${catalogRows.length} — معاينة فقط، دون تعديل تلقائي` : `Products: ${catalogRows.length} — preview only, no automatic changes`}</p>
          {catalogRows.map(item => { const existingMapping = catalogMappings.find(mapping => mapping.provider_item_id === item.provider_item_id); const mappedMenuItem = menuItems.find(menuItem => menuItem.id === existingMapping?.menu_item_id); const protectedFields = existingMapping?.field_overrides || {}; const locationCurrency = locations.find(location => location.id === reviewLocationId)?.currency?.toUpperCase(); const applyEligible: PosApplyField[] = []; if (mappedMenuItem && !protectedFields.name && item.name !== mappedMenuItem.name) applyEligible.push('name'); if (mappedMenuItem && !protectedFields.description && (item.description ?? '') !== (mappedMenuItem.description ?? '')) applyEligible.push('description'); if (mappedMenuItem && !protectedFields.price && locationCurrency && locationCurrency === item.currency.toUpperCase() && Number(item.unit_price) !== Number(mappedMenuItem.price)) applyEligible.push('price'); const selected = selectedApplyFields[item.provider_item_id] || []; return <article key={item.id} className="rounded-xl border border-slate-200 p-3">
            <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="font-bold text-slate-800">{item.name}</p><p className="mt-1 text-xs text-slate-500">{item.provider_item_id}{item.category_id ? ` · ${item.category_id}` : ''}</p>{item.description && <p className="mt-2 text-xs text-slate-600">{item.description}</p>}</div>
            <div className="text-end"><p className="font-extrabold text-slate-900">{Number(item.unit_price).toFixed(2)} {item.currency}</p><span className={`mt-1 inline-block rounded-full px-2 py-1 text-[11px] font-bold ${item.active && item.available ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{item.active && item.available ? (isArabic ? 'متاح بالكاشير' : 'Available in POS') : (isArabic ? 'غير متاح / متوقف' : 'Unavailable / inactive')}</span></div></div>
            <p className="mt-2 text-[11px] text-slate-400">{isArabic ? 'آخر تحديث: ' : 'Source updated: '}{new Date(item.source_updated_at).toLocaleString(isArabic ? 'ar-EG' : 'en')}</p>
            <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
              <label className="min-w-0 flex-1 text-xs font-semibold text-slate-600">{isArabic ? 'اربطه بمنتج من منيو SooVoice' : 'Link to a SooVoice menu item'}
                <select disabled={!item.active} value={mappingSelections[item.provider_item_id] ?? catalogMappings.find(mapping => mapping.provider_item_id === item.provider_item_id)?.menu_item_id ?? ''} onChange={e => setMappingSelections(current => ({ ...current, [item.provider_item_id]: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-sm">
                  <option value="">{isArabic ? 'اختر منتج المنيو' : 'Select menu item'}</option>
                  {menuItems.map(menuItem => <option key={menuItem.id} value={menuItem.id}>{menuItem.name}{menuItem.isAiOnly ? (isArabic ? ' · صوتي فقط' : ' · voice only') : ''} · {Number(menuItem.price).toFixed(2)}</option>)}
                </select>
              </label>
              <div className="w-full rounded-lg bg-slate-50 p-3">
                <p className="mb-2 text-[11px] font-bold text-slate-600">{isArabic ? 'احمِ حقول المنيو من تحديثات الكاشير' : 'Protect merchant-owned fields from POS updates'}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {([
                    ['name', isArabic ? 'الاسم' : 'Name'],
                    ['description', isArabic ? 'الوصف' : 'Description'],
                    ['price', isArabic ? 'السعر' : 'Price'],
                    ['available', isArabic ? 'التوفر' : 'Availability'],
                    ['categoryId', isArabic ? 'التصنيف' : 'Category'],
                  ] as Array<[PosCatalogField, string]>).map(([field, label]) => (
                    <label key={field} className="flex items-center gap-1.5 text-[11px] text-slate-600">
                      <input type="checkbox" checked={(mappingOverrides[item.provider_item_id] ?? catalogMappings.find(mapping => mapping.provider_item_id === item.provider_item_id)?.field_overrides ?? {})[field] === true} onChange={e => setMappingOverrides(current => ({ ...current, [item.provider_item_id]: { ...(current[item.provider_item_id] ?? catalogMappings.find(mapping => mapping.provider_item_id === item.provider_item_id)?.field_overrides ?? {}), [field]: e.target.checked } }))} />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
              <button type="button" onClick={() => void saveCatalogMapping(item)} disabled={!item.active || savingMappingId === item.provider_item_id || !(mappingSelections[item.provider_item_id] || catalogMappings.find(mapping => mapping.provider_item_id === item.provider_item_id)?.menu_item_id) || !menuItems.length} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
                {savingMappingId === item.provider_item_id ? (isArabic ? 'جارٍ الحفظ...' : 'Saving...') : (catalogMappings.some(mapping => mapping.provider_item_id === item.provider_item_id) ? (isArabic ? 'تحديث الربط' : 'Update mapping') : (isArabic ? 'اعتماد الربط' : 'Approve mapping'))}
              </button>
              {catalogMappings.some(mapping => mapping.provider_item_id === item.provider_item_id) && <span className="text-[11px] font-semibold text-emerald-700">{isArabic ? 'تم الربط بموافقتك' : 'Merchant approved'}</span>}
            </div>
            
             {existingMapping && mappedMenuItem && <div className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50/50 p-3">
               <p className="text-xs font-bold text-slate-700">{isArabic ? 'معاينة التحديث قبل التطبيق' : 'Preview changes before applying'}</p>
               {applyEligible.length === 0 && <p className="mt-2 text-[11px] text-slate-500">{isArabic ? 'لا توجد حقول مؤهلة للتحديث، أو أن الحقول محمية، أو أن عملة الفرع لا تطابق عملة المنتج.' : 'No eligible changes: fields may be protected, unchanged, or the branch currency does not match the POS item.'}</p>}
               {applyEligible.map(field => {
                 const before = field === 'name' ? mappedMenuItem.name : field === 'description' ? (mappedMenuItem.description ?? '') : Number(mappedMenuItem.price).toFixed(2);
                 const after = field === 'name' ? item.name : field === 'description' ? (item.description ?? '') : Number(item.unit_price).toFixed(2);
                 const labels: Record<PosApplyField, [string, string]> = { name: ['الاسم', 'Name'], description: ['الوصف', 'Description'], price: ['السعر', 'Price'] };
                 return <label key={field} className="mt-2 flex items-start gap-2 text-[11px] text-slate-600">
                   <input type="checkbox" checked={selected.includes(field)} onChange={e => setSelectedApplyFields(current => ({ ...current, [item.provider_item_id]: e.target.checked ? [...(current[item.provider_item_id] || []), field] : (current[item.provider_item_id] || []).filter(value => value !== field) }))} />
                   <span><strong>{isArabic ? labels[field][0] : labels[field][1]}:</strong> {isArabic ? 'من' : 'From'} {before} {isArabic ? 'إلى' : 'to'} {after}{field === 'price' ? ` ${item.currency}` : ''}</span>
                 </label>;
               })}
               {mappedMenuItem && !protectedFields.price && (!locationCurrency || locationCurrency !== item.currency.toUpperCase()) && <p className="mt-2 text-[11px] text-amber-700">{isArabic ? 'لن يتم تحديث السعر لاختلاف عملة الفرع عن عملة الكاشير.' : 'Price apply is disabled because the branch and POS currencies differ.'}</p>}
               <button type="button" onClick={() => void applyCatalogChanges(item)} disabled={!item.active || !selected.length || applyingProviderId === item.provider_item_id} className="mt-3 rounded-lg bg-indigo-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
                 {applyingProviderId === item.provider_item_id ? (isArabic ? 'جارٍ تطبيق التحديث...' : 'Applying...') : (isArabic ? 'تطبيق الحقول المحددة' : 'Apply selected fields')}
               </button>
             </div>}
             {applyEvents.some(event => event.provider_item_id === item.provider_item_id) && <div className="mt-3 border-t border-slate-100 pt-2">
               <p className="mb-1 text-[11px] font-bold text-slate-500">{isArabic ? 'سجل تحديثات المنيو' : 'Menu apply history'}</p>
               <ul className="space-y-1">
                 {applyEvents.filter(event => event.provider_item_id === item.provider_item_id).slice(0, 3).map(event => <li key={event.id} className="text-[11px] text-slate-500">
                   <span>{event.selected_fields.map(field => `${field}: ${String(event.before_state[field] ?? '—')} → ${String(event.after_state[field] ?? '—')}`).join(' · ')} · </span><time dateTime={event.created_at}>{new Date(event.created_at).toLocaleString(isArabic ? 'ar-EG' : 'en')}</time>
                 </li>)}
               </ul>
             </div>}

            {mappingEvents.some(event => event.provider_item_id === item.provider_item_id) && <div className="mt-3 border-t border-slate-100 pt-2">
              <p className="mb-1 text-[11px] font-bold text-slate-500">{isArabic ? 'سجل موافقات الربط' : 'Mapping approval history'}</p>
              <ul className="space-y-1">
                {mappingEvents.filter(event => event.provider_item_id === item.provider_item_id).slice(0, 3).map(event => {
                  const labels: Record<PosCatalogMappingEvent['event_type'], [string, string]> = {
                    created: ['اعتماد الربط لأول مرة', 'Mapping approved'],
                    relinked: ['تغيير المنتج المرتبط', 'Menu item relinked'],
                    protection_updated: ['تحديث الحقول المحمية', 'Protected fields updated'],
                    reapproved: ['إعادة اعتماد الربط', 'Mapping re-approved'],
                  };
                  return <li key={event.id} className="flex flex-wrap justify-between gap-2 text-[11px] text-slate-500">
                    <span>{isArabic ? labels[event.event_type][0] : labels[event.event_type][1]}</span>
                    <time dateTime={event.created_at}>{new Date(event.created_at).toLocaleString(isArabic ? 'ar-EG' : 'en')}</time>
                  </li>;
                })}
              </ul>
            </div>}
          </article>; })}
        </div>}
      </div>}
    </div>
    <div className="mt-8 border-t border-slate-100 pt-6">
      <div className="mb-4">
        <h3 className="font-extrabold text-slate-900">{isArabic ? 'الفروع ونقاط البيع' : 'Branches and locations'}</h3>
        <p className="mt-1 text-xs text-slate-500">{isArabic ? 'أضف معرّف الفرع كما يظهر في نظام الكاشير لربطه يدويًا.' : 'Enter the branch identifier exactly as it appears in your POS system to map it manually.'}</p>
      </div>
      {connections.length > 0 && <form onSubmit={saveBranch} className="grid gap-3 rounded-2xl bg-slate-50 p-4 md:grid-cols-2">
        <label className="text-xs font-bold text-slate-600">{isArabic ? 'اتصال الكاشير' : 'POS connection'}
          <select required value={branchConnectionId} onChange={e => setBranchConnectionId(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm">
            <option value="">{isArabic ? 'اختر الاتصال' : 'Select connection'}</option>
            {connections.map(item => <option key={item.id} value={item.id}>{item.display_name || item.provider}</option>)}
          </select>
        </label>
        <label className="text-xs font-bold text-slate-600">{isArabic ? 'اسم الفرع' : 'Branch name'}
          <input required maxLength={120} value={branchName} onChange={e => setBranchName(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm" />
        </label>
        <label className="text-xs font-bold text-slate-600">{isArabic ? 'معرّف الفرع لدى المزوّد' : 'Provider branch ID'}
          <input required maxLength={160} value={branchProviderId} onChange={e => setBranchProviderId(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 font-mono text-sm" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs font-bold text-slate-600">{isArabic ? 'المنطقة الزمنية' : 'Timezone'}
            <input value={branchTimezone} onChange={e => setBranchTimezone(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm" />
          </label>
          <label className="text-xs font-bold text-slate-600">{isArabic ? 'العملة' : 'Currency'}
            <input maxLength={3} value={branchCurrency} onChange={e => setBranchCurrency(e.target.value.toUpperCase())} className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm" />
          </label>
        </div>
        <button type="submit" disabled={savingBranch || !branchConnectionId || !branchName.trim() || !branchProviderId.trim()} className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-50 md:col-span-2">{savingBranch ? (isArabic ? 'جارٍ الحفظ...' : 'Saving...') : (isArabic ? 'حفظ ربط الفرع' : 'Save branch mapping')}</button>
      </form>}
      <div className="mt-3 space-y-2">
        {locations.map(location => <div key={location.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 text-sm"><div><p className="font-bold text-slate-800">{location.name}</p><p className="text-xs text-slate-500">{location.provider_location_id} · {location.timezone || '—'} · {location.currency || '—'}</p></div><div className="flex items-center gap-3"><span className={`text-xs font-bold ${location.active ? 'text-emerald-700' : 'text-slate-500'}`}>{location.active ? (isArabic ? 'مضاف' : 'Mapped') : (isArabic ? 'متوقف' : 'Inactive')}</span>{location.active && <button type="button" onClick={() => void removeBranch(location)} className="rounded-lg px-2 py-1 text-xs font-bold text-rose-700 hover:bg-rose-50">{isArabic ? 'إيقاف الربط' : 'Deactivate'}</button>}</div></div>)}
        {locations.length === 0 && <p className="py-3 text-xs text-slate-500">{isArabic ? 'لم تتم إضافة فروع بعد.' : 'No branches mapped yet.'}</p>}
      </div>
    </div>
    <div className="mt-8 border-t border-slate-100 pt-6">
      <h3 className="font-extrabold text-slate-900">{isArabic ? 'توجيه الطلبات إلى الفروع' : 'Order routing by branch'}</h3>
      <p className="mt-1 text-xs leading-5 text-slate-500">{isArabic ? 'اختار فرع افتراضي لكل الطلبات، وبعدها تقدر تخصص طاولات معينة لفروع مختلفة. لو مفيش قاعدة للطاولة، الطلب يروح للفرع الافتراضي.' : 'Choose a default branch for new orders, then optionally route specific table references to other branches. Tables without an exact rule use the default branch.'}</p>
      <div className="mt-4 grid gap-3 rounded-2xl bg-slate-50 p-4 md:grid-cols-[1fr_auto]">
        <label className="text-xs font-bold text-slate-600">{isArabic ? 'الفرع الافتراضي' : 'Default branch'}
          <select value={defaultRouteLocationId} onChange={e => setDefaultRouteLocationId(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm">
            <option value="">{isArabic ? 'اختر الفرع الافتراضي' : 'Choose default branch'}</option>
            {routableLocations.map(location => <option key={location.id} value={location.id}>{location.name} · {location.currency || '—'}</option>)}
          </select>
        </label>
        <button type="button" onClick={() => void saveDefaultRoute()} disabled={savingRoute || !defaultRouteLocationId} className="self-end rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{savingRoute ? (isArabic ? 'جارٍ الحفظ...' : 'Saving...') : (isArabic ? 'حفظ الفرع الافتراضي' : 'Save default branch')}</button>
      </div>
      <form onSubmit={saveTableRoute} className="mt-3 grid gap-3 rounded-2xl border border-slate-200 p-4 md:grid-cols-[1fr_1fr_auto]">
        <label className="text-xs font-bold text-slate-600">{isArabic ? 'رقم / اسم الطاولة' : 'Table reference'}
          <input required maxLength={40} value={tableRouteValue} onChange={e => setTableRouteValue(e.target.value.toUpperCase())} placeholder="مثال: T12" className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm" />
        </label>
        <label className="text-xs font-bold text-slate-600">{isArabic ? 'وجّه الطاولة إلى' : 'Send this table to'}
          <select required value={tableRouteLocationId} onChange={e => setTableRouteLocationId(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm">
            <option value="">{isArabic ? 'اختر الفرع' : 'Choose branch'}</option>
            {routableLocations.map(location => <option key={location.id} value={location.id}>{location.name}</option>)}
          </select>
        </label>
        <button type="submit" disabled={savingRoute || !tableRouteValue.trim() || !tableRouteLocationId} className="self-end rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{isArabic ? 'إضافة قاعدة' : 'Add rule'}</button>
      </form>
      <div className="mt-3 space-y-2">
        {orderRoutes.map(route => {
          const location = locations.find(item => item.id === route.location_id);
          return <div key={route.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 text-sm">
            <div><p className="font-bold text-slate-800">{route.route_type === 'default' ? (isArabic ? 'الفرع الافتراضي' : 'Default branch') : (isArabic ? `الطاولة ${route.route_value}` : `Table ${route.route_value}`)}</p><p className="text-xs text-slate-500">{location?.name || (isArabic ? 'فرع غير متاح' : 'Unavailable branch')} · {location?.currency || '—'}</p></div>
            <button type="button" onClick={() => void deleteOrderRoute(route)} className="rounded-lg px-2 py-1 text-xs font-bold text-rose-700 hover:bg-rose-50">{isArabic ? 'حذف القاعدة' : 'Delete rule'}</button>
          </div>;
        })}
        {orderRoutes.length === 0 && <p className="py-3 text-xs text-amber-700">{isArabic ? 'لم يتم تحديد فرع افتراضي بعد؛ لن تُرسل الطلبات للكاشير حتى تحفظ قاعدة افتراضية.' : 'No default branch is configured. POS dispatch remains blocked until you save one.'}</p>}
      </div>
    </div>
  </section>;
}
