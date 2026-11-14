import React, { useEffect, useMemo, useState } from 'react';
import {
  useLanguage,
} from '../contexts/LanguageContext';
import {
  Plus, Trash2, QrCode, Copy, Download, GripHorizontal, Utensils,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getSupabase, getSupabaseConfig } from '../lib/supabase';
import { generateQrDataUrl } from '../lib/qr';
import { useStoreSettings } from '../lib/storeSettings';

/**
 * Restaurant floor plan.
 *
 * A grid on which the owner drops tables, drags them into place, and
 * generates a printable QR stand for each one. The layout is stored
 * in Supabase `restaurant_floor_plan` (real merchants) or localStorage
 * for demo users.
 *
 * Schema (localStorage key: floor_plan_<ownerId>):
 *   { tables: Array<{ id: string, label: string, x: number, y: number }> }
 *
 * The floor canvas is 600×420 (px coordinates), displayed as a
 * perspective-titled board. Each table is a small rounded chip that
 * can be dragged anywhere within bounds.
 */

interface FloorTable {
  id: string;
  label: string;
  x: number; // px in canvas coords (0..600)
  y: number; // px in canvas coords (0..420)
}

interface FloorPlan {
  tables: FloorTable[];
}

const CANVAS_W = 600;
const CANVAS_H = 420;
const TABLE_W = 92;
const TABLE_H = 60;

const STORAGE_KEY = (ownerId: string) => `floor_plan_${ownerId}`;

function loadLocal(ownerId?: string | null): FloorPlan {
  if (!ownerId) return { tables: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY(ownerId));
    if (!raw) return { tables: [] };
    return JSON.parse(raw) as FloorPlan;
  } catch {
    return { tables: [] };
  }
}

function saveLocal(ownerId: string, plan: FloorPlan) {
  try {
    localStorage.setItem(STORAGE_KEY(ownerId), JSON.stringify(plan));
  } catch (e) {
    console.warn('Could not persist floor plan locally:', e);
  }
}

export function FloorPlan() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const isAr = language === 'ar';
  const { settings: storeSettings } = useStoreSettings(user?.uid, user?.provider !== 'local');

  const [plan, setPlan] = useState<FloorPlan>(() => loadLocal(user?.uid));
  const [dragging, setDragging] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Load from Supabase for real merchants
  useEffect(() => {
    if (!user) return;
    if (user.provider === 'local') return;

    const supabase = getSupabase();
    const { isConfigured } = getSupabaseConfig();
    if (!isConfigured || !supabase) return;

    supabase
      .from('restaurant_floor_plan')
      .select('*')
      .eq('ownerId', user.uid)
      .maybeSingle()
      .then(({ data }: any) => {
        if (data && Array.isArray(data.tables)) {
          setPlan({ tables: data.tables });
          saveLocal(user.uid, { tables: data.tables });
        }
      });
  }, [user]);

  // Persist on plan change
  useEffect(() => {
    if (!user) return;
    saveLocal(user.uid, plan);

    if (user.provider === 'local') return;
    const supabase = getSupabase();
    const { isConfigured } = getSupabaseConfig();
    if (!isConfigured || !supabase) return;

    const t = setTimeout(() => {
      supabase
        .from('restaurant_floor_plan')
        .upsert([{ ownerId: user.uid, tables: plan.tables, updatedAt: Date.now() }], {
          onConflict: 'ownerId',
        })
        .then(({ error }: any) => {
          if (error) console.warn('floor_plan save unavailable:', error.message);
        });
    }, 600);
    return () => clearTimeout(t);
  }, [plan, user]);

  const addTable = () => {
    const id = 'tbl_' + Math.random().toString(36).substring(2, 9);
    const label = `${isAr ? 'طاولة' : 'Table'} ${plan.tables.length + 1}`;
    const x = Math.max(0, CANVAS_W / 2 - TABLE_W / 2);
    const y = Math.max(0, CANVAS_H / 2 - TABLE_H / 2);
    setPlan((p) => ({ tables: [...p.tables, { id, label, x, y }] }));
  };

  const updateLabel = (id: string, label: string) => {
    setPlan((p) => ({ tables: p.tables.map((t) => (t.id === id ? { ...t, label } : t)) }));
  };

  const removeTable = (id: string) => {
    setPlan((p) => ({ tables: p.tables.filter((t) => t.id !== id) }));
    if (selectedTableId === id) setSelectedTableId(null);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>, t: FloorTable) => {
    e.stopPropagation();
    setSelectedTableId(t.id);
    const rect = e.currentTarget.parentElement?.getBoundingClientRect();
    if (!rect) return;
    const px = ((e.clientX - rect.left) / rect.width) * CANVAS_W;
    const py = ((e.clientY - rect.top) / rect.height) * CANVAS_H;
    setDragging({ id: t.id, dx: px - t.x, dy: py - t.y });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * CANVAS_W;
    const py = ((e.clientY - rect.top) / rect.height) * CANVAS_H;
    const nx = Math.max(0, Math.min(CANVAS_W - TABLE_W, px - dragging.dx));
    const ny = Math.max(0, Math.min(CANVAS_H - TABLE_H, py - dragging.dy));
    setPlan((p) => ({
      tables: p.tables.map((t) => (t.id === dragging.id ? { ...t, x: nx, y: ny } : t)),
    }));
  };

  const onPointerUp = () => setDragging(null);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const ownerId = user?.uid || 'demo_merchant';

  const selectedTable = plan.tables.find((t) => t.id === selectedTableId) || null;
  const tableQrUrl = useMemo(() => {
    if (!selectedTable) return '';
    const u = new URL(`${origin}/store`);
    u.searchParams.set('ownerId', ownerId);
    u.searchParams.set('table', selectedTable.label);
    return u.toString();
  }, [selectedTable, ownerId, origin]);

  const qrDataUrl = useMemo(
    () => (selectedTable ? generateQrDataUrl(tableQrUrl, { scale: 8 }) : ''),
    [selectedTable, tableQrUrl]
  );

  const handleCopyUrl = () => {
    if (!selectedTable) return;
    navigator.clipboard.writeText(tableQrUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQr = () => {
    if (!selectedTable) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `${selectedTable.label.replace(/\s+/g, '_')}_qr.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadPrintable = () => {
    if (!selectedTable) return;
    const restaurantName =
      storeSettings.restaurantName || storeSettings.restaurantNameEn || 'SooVoice';
    // Build a printable A6 portrait HTML (105 × 148 mm), opened in a new window.
    const printable = window.open('', '_blank', 'width=400,height=600');
    if (!printable) return;
    printable.document.write(buildPrintableStandHtml({
      restaurantName,
      tableLabel: selectedTable.label,
      qrDataUrl,
      isAr,
    }));
    printable.document.close();
    printable.focus();
    setTimeout(() => printable.print(), 350);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto font-sans">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
          <Utensils className="w-7 h-7 text-indigo-600" />
          {isAr ? 'مخطط الطاولات' : 'Tables & floor plan'}
        </h1>
        <p className="mt-1 text-sm text-slate-500 max-w-2xl leading-relaxed">
          {isAr
            ? 'ضع طاولاتك على المخطط، اسحبها لمكانها الصحيح، وأنشئ ستاند QR قابل للطباعة لكل طاولة.'
            : 'Drop your tables onto the plan, drag them into place, and generate a printable QR stand for each one.'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* ============ Canvas ============ */}
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {isAr ? 'الصالة' : 'The room'}
            </p>
            <button
              onClick={addTable}
              className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              {isAr ? 'إضافة طاولة' : 'Add table'}
            </button>
          </div>

          <div
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            onClick={() => setSelectedTableId(null)}
            className="relative w-full aspect-[10/7] bg-gradient-to-br from-slate-50 to-slate-100 rounded-3xl border border-slate-200 shadow-inner overflow-hidden select-none"
          >
            {/* Floor grid */}
            <svg className="absolute inset-0 w-full h-full opacity-30" preserveAspectRatio="none">
              <defs>
                <pattern id="floorgrid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#cbd5e1" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#floorgrid)" />
            </svg>

            {/* Tables */}
            {plan.tables.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-center text-slate-400 pointer-events-none">
                <div>
                  <Utensils className="w-12 h-12 mx-auto mb-3 text-slate-200" />
                  <p className="font-bold text-slate-500">
                    {isAr ? 'اضغط "إضافة طاولة" لتبدأ' : 'Click "Add table" to start'}
                  </p>
                </div>
              </div>
            ) : (
              plan.tables.map((t) => {
                const isSelected = selectedTableId === t.id;
                return (
                  <div
                    key={t.id}
                    onPointerDown={(e) => onPointerDown(e, t)}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedTableId(t.id);
                    }}
                    style={{
                      left: `${(t.x / CANVAS_W) * 100}%`,
                      top: `${(t.y / CANVAS_H) * 100}%`,
                      width: `${(TABLE_W / CANVAS_W) * 100}%`,
                      height: `${(TABLE_H / CANVAS_H) * 100}%`,
                    }}
                    className={`absolute rounded-2xl flex flex-col items-center justify-center text-xs font-bold cursor-move transition-all ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-xl ring-2 ring-indigo-400 scale-105'
                        : 'bg-white text-slate-700 shadow-md border border-slate-200 hover:shadow-lg'
                    }`}
                  >
                    <GripHorizontal className={`w-3 h-3 mb-0.5 opacity-50`} />
                    <span>{t.label}</span>
                  </div>
                );
              })
            )}
          </div>

          {plan.tables.length > 0 && (
            <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1.5">
              <GripHorizontal className="w-3 h-3" />
              {isAr ? 'اسحب الطاولة لمكانها. اضغط عليها لتفعيلها.' : 'Drag a table to place it. Click to select.'}
            </p>
          )}
        </div>

        {/* ============ Side panel ============ */}
        <div className="lg:col-span-2 space-y-6">
          {/* Selected table */}
          {selectedTable ? (
            <>
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-indigo-500" />
                  {isAr ? 'الطاولة المختارة' : 'Selected table'}
                </h3>

                <label className="block text-xs font-bold text-slate-600 mb-2">
                  {isAr ? 'اسم الطاولة' : 'Table label'}
                </label>
                <input
                  type="text"
                  value={selectedTable.label}
                  onChange={(e) => updateLabel(selectedTable.id, e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-3 py-2 text-sm text-slate-800 outline-none transition-all font-medium mb-4"
                />

                <div className="flex justify-center py-4 bg-slate-50 rounded-2xl mb-4">
                  {qrDataUrl && (
                    <img src={qrDataUrl} alt={`QR for ${selectedTable.label}`} className="w-32 h-32" />
                  )}
                </div>

                <div className="space-y-2">
                  <button
                    onClick={handleDownloadPrintable}
                    className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-md shadow-indigo-100"
                  >
                    <Download className="w-4 h-4" />
                    {isAr ? 'طباعة ستاند الـ QR' : 'Print QR stand'}
                  </button>
                  <button
                    onClick={handleDownloadQr}
                    className="w-full flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    {isAr ? 'تنزيل QR كصورة' : 'Download QR image'}
                  </button>
                  <button
                    onClick={handleCopyUrl}
                    className="w-full flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    {copied ? <Copy className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    {copied ? (isAr ? 'تم نسخ الرابط' : 'Copied!') : (isAr ? 'نسخ رابط الطاولة' : 'Copy table URL')}
                  </button>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100">
                  <button
                    onClick={() => removeTable(selectedTable.id)}
                    className="w-full flex items-center justify-center gap-2 text-rose-600 hover:bg-rose-50 px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {isAr ? 'حذف الطاولة' : 'Delete table'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white border border-dashed border-slate-200 rounded-3xl p-8 text-center">
              <QrCode className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p className="font-bold text-slate-700 text-sm">
                {isAr ? 'اختر طاولة لإنشاء QR خاص بها' : 'Select a table to generate its QR'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {isAr ? 'اضغط على أي طاولة على المخطط لتفعيلها.' : 'Click any table on the plan to activate it.'}
              </p>
            </div>
          )}

          {/* Table list */}
          {plan.tables.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                {isAr ? 'كل الطاولات' : 'All tables'}
              </p>
              <div className="space-y-1.5">
                {plan.tables.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTableId(t.id)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                      selectedTableId === t.id
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Utensils className="w-3.5 h-3.5" />
                      {t.label}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">{t.id.replace('tbl_', '')}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============ Printable QR stand HTML ============ */

function buildPrintableStandHtml(params: {
  restaurantName: string;
  tableLabel: string;
  qrDataUrl: string;
  isAr: boolean;
}): string {
  const { restaurantName, tableLabel, qrDataUrl, isAr } = params;
  return `<!doctype html>
<html lang="${isAr ? 'ar' : 'en'}" dir="${isAr ? 'rtl' : 'ltr'}">
<head>
  <meta charset="utf-8" />
  <title>${restaurantName} — ${tableLabel}</title>
  <style>
    @page { size: A6 portrait; margin: 0; }
    html, body {
      margin: 0; padding: 0;
      width: 105mm; height: 148mm;
      font-family: ${isAr ? '"Noto Naskh Arabic", "Cairo", sans-serif' : '"Inter", system-ui, sans-serif'};
      color: #1e293b;
      background: white;
    }
    .stand {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      width: 105mm;
      height: 148mm;
      padding: 14mm 10mm;
      box-sizing: border-box;
    }
    .brand {
      font-size: 11pt;
      font-weight: 700;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: #4f46e5;
      margin-bottom: 4mm;
    }
    .name {
      font-size: 18pt;
      font-weight: 700;
      text-align: center;
      line-height: 1.2;
      color: #1e293b;
    }
    .qr {
      width: 70mm;
      height: 70mm;
      object-fit: contain;
      margin: 6mm 0;
    }
    .table-label {
      font-size: 14pt;
      font-weight: 600;
      color: #475569;
      padding: 2mm 8mm;
      border-top: 1px solid #e2e8f0;
      border-bottom: 1px solid #e2e8f0;
      margin: 4mm 0;
    }
    .hint {
      font-size: 8.5pt;
      color: #94a3b8;
      text-align: center;
      margin-top: 3mm;
    }
    .cut-line {
      width: 100%;
      height: 1px;
      border-top: 1px dashed #cbd5e1;
      margin: 6mm 0;
    }
  </style>
</head>
<body>
  <div class="stand">
    <div>
      <p class="brand">SooVoice</p>
      <h1 class="name">${restaurantName}</h1>
    </div>
    <img class="qr" src="${qrDataUrl}" alt="QR for ${tableLabel}" />
    <div>
      <div class="cut-line"></div>
      <p class="table-label">${tableLabel}</p>
      <p class="hint">${isAr ? 'امسح الكود لرؤية المنيو وسؤال المساعد الصوتي' : 'Scan to view the menu and ask the voice assistant'}</p>
    </div>
  </div>
</body>
</html>`;
}
