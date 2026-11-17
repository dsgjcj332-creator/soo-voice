import React, { useEffect, useState } from 'react';
import {
  Mic, Play, Loader2, Volume2, Sparkles, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useSettings, VoiceTone } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { getSupabase, getSupabaseConfig } from '../lib/supabase';

/**
 * Voice Studio — preview the assistant's voice before publishing.
 *
 * The owner writes a sentence the assistant is likely to say, picks up
 * to three prebuilt voices, and the page generates a short audio sample
 * of each by calling /api/voice-preview (Gemini TTS via generateContent
 * with AUDIO modality). The owner listens to all three, then confirms
 * the choice as their default voice (saved via SettingsContext).
 *
 * Three sample sentences are provided as defaults — these are the
 * sentences the assistant is most likely to say, not generic "hello"
 * lines. The owner can edit them or use their own.
 */

const VOICES: { id: VoiceTone; genderAr: string; genderEn: string; descAr: string; descEn: string }[] = [
  { id: 'Zephyr', genderAr: 'رجالي', genderEn: 'Male', descAr: 'هادئ ودافئ', descEn: 'Calm & warm' },
  { id: 'Charon', genderAr: 'رجالي', genderEn: 'Male', descAr: 'فخم وعميق', descEn: 'Deep & formal' },
  { id: 'Fenrir', genderAr: 'رجالي', genderEn: 'Male', descAr: 'قوي وواضح', descEn: 'Confident & clear' },
  { id: 'Kore', genderAr: 'نسائي', genderEn: 'Female', descAr: 'لطيف ومحبب', descEn: 'Friendly & kind' },
  { id: 'Puck', genderAr: 'نسائي', genderEn: 'Female', descAr: 'سريع ونشيط', descEn: 'Vibrant & quick' },
  { id: 'Aoede', genderAr: 'نسائي', genderEn: 'Female', descAr: 'احترافي ودافئ', descEn: 'Professional & warm' },
];

const SAMPLE_SENTENCES = [
  {
    labelAr: 'تحية افتتاحية',
    labelEn: 'Opening greeting',
    ar: 'أهلاً بكم. ماذا يمكنني أن أقترح لكم اليوم؟',
    en: 'Welcome. What may I suggest for you today?',
  },
  {
    labelAr: 'اقتراح طبق',
    labelEn: 'Dish suggestion',
    ar: 'أنصح بتجريب طبق الموسم — يستحق الانتظار.',
    en: 'I recommend trying the seasonal dish — it is worth the wait.',
  },
  {
    labelAr: 'سؤال عن مكونات',
    labelEn: 'Ingredient question',
    ar: 'هذا الطبق يحتوي على لحم بقري طازج، وزبدة، وبصل مكرمل.',
    en: 'This dish contains fresh beef, butter, and caramelized onion.',
  },
];

type SampleState = 'idle' | 'loading' | 'ready' | 'error';

interface Sample {
  voice: VoiceTone;
  state: SampleState;
  audioUrl?: string;
  error?: string;
}

export function VoiceStudio() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const { voiceTone, setVoiceTone, dialect, businessType, currency } = useSettings();
  const isAr = language === 'ar';

  const [text, setText] = useState(() =>
    isAr ? SAMPLE_SENTENCES[0].ar : SAMPLE_SENTENCES[0].en
  );
  const [selectedVoices, setSelectedVoices] = useState<VoiceTone[]>(() => {
    // Default: the current voice + the next two
    const cur = voiceTone;
    const idx = VOICES.findIndex((v) => v.id === cur);
    return [
      cur,
      VOICES[(idx + 1) % VOICES.length].id,
      VOICES[(idx + 2) % VOICES.length].id,
    ];
  });
  const [samples, setSamples] = useState<Record<VoiceTone, Sample>>(
    () => ({}) as Record<VoiceTone, Sample>
  );
  const [publishStatus, setPublishStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [publishError, setPublishError] = useState('');

  // Reset samples when text or voices change
  useEffect(() => {
    setSamples({} as Record<VoiceTone, Sample>);
    setPublishStatus('idle');
  }, [text, selectedVoices]);

  const toggleVoice = (v: VoiceTone) => {
    setSelectedVoices((prev) => {
      if (prev.includes(v)) {
        if (prev.length === 1) return prev;
        return prev.filter((x) => x !== v);
      }
      if (prev.length >= 3) {
        return [...prev.slice(1), v];
      }
      return [...prev, v];
    });
  };

  const generateSample = async (voice: VoiceTone) => {
    setSamples((s) => ({ ...s, [voice]: { voice, state: 'loading' } }));
    try {
      const resp = await fetch('/api/voice-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data?.error || 'Failed');
      }
      // Inline base64 audio → blob URL.
      // The Gemini live TTS returns audio/L16 PCM (16kHz, mono, 16-bit). To
      // play it without conversion, we wrap it in a WAV header.
      const bytes = base64ToBytes(data.audio);
      const wavBytes = l16ToWav(bytes, 16000);
      const blob = new Blob([wavBytes], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      setSamples((s) => ({ ...s, [voice]: { voice, state: 'ready', audioUrl: url } }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSamples((s) => ({ ...s, [voice]: { voice, state: 'error', error: msg } }));
    }
  };

  const publishVoice = async (voice: VoiceTone) => {
    if (!user) {
      setPublishStatus('error');
      setPublishError(isAr ? 'سجّل الدخول أولًا لاعتماد الصوت.' : 'Sign in before publishing a voice.');
      return;
    }
    setPublishStatus('saving');
    setPublishError('');
    try {
      if (user.provider !== 'local') {
        const { isConfigured } = getSupabaseConfig();
        const supabase = getSupabase();
        if (!isConfigured || !supabase) throw new Error(isAr ? 'قاعدة البيانات غير متاحة.' : 'Database is not configured.');
        const { error } = await supabase.from('merchant_settings').upsert([{
          ownerId: user.uid,
          dialect,
          voiceTone: voice,
          businessType,
          currency,
          updatedAt: Date.now(),
        }], { onConflict: 'ownerId' });
        if (error) throw error;
      }
      setVoiceTone(voice);
      setPublishStatus('saved');
      window.setTimeout(() => setPublishStatus('idle'), 2500);
    } catch (error) {
      setPublishStatus('error');
      setPublishError(error instanceof Error ? error.message : (isAr ? 'تعذر حفظ الصوت.' : 'Could not save the voice.'));
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto font-sans">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
          <Mic className="w-7 h-7 text-indigo-600" />
          {isAr ? 'استوديو الصوت' : 'Voice studio'}
        </h1>
        <p className="mt-1 text-sm text-slate-500 max-w-2xl leading-relaxed">
          {isAr
            ? 'اختبر نبرات صوتية مختلفة على جمل حقيقية قبل أن تختار صوت مطعمك. اختر حتى ثلاثة، واسمعها جنباً إلى جنب.'
            : 'Test different voice tones on real sentences before choosing your restaurant\u2019s voice. Pick up to three and listen to them side by side.'}
        </p>
      </div>

      {/* Sentence editor */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 mb-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
          {isAr ? 'جملة للاختبار' : 'Test sentence'}
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 280))}
          rows={2}
          className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-2xl px-4 py-3 text-sm text-slate-800 outline-none transition-all font-medium resize-none mb-3"
        />
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-[11px] text-slate-400">
            {isAr ? 'أمثلة جاهزة:' : 'Quick fill:'}
          </span>
          {SAMPLE_SENTENCES.map((s, i) => (
            <button
              key={i}
              onClick={() => setText(isAr ? s.ar : s.en)}
              className="text-xs bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 px-3 py-1.5 rounded-xl font-bold transition-colors cursor-pointer"
            >
              {isAr ? s.labelAr : s.labelEn}
            </button>
          ))}
          <span className="text-[11px] text-slate-400 ms-auto" dir="ltr">
            {text.length}/280
          </span>
        </div>
      </div>

      {/* Voice picker */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 mb-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
          {isAr ? `الأصوات المختارة (${selectedVoices.length}/3)` : `Selected voices (${selectedVoices.length}/3)`}
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {VOICES.map((v) => {
            const isSelected = selectedVoices.includes(v.id);
            return (
              <button
                key={v.id}
                onClick={() => toggleVoice(v.id)}
                className={`text-start p-4 rounded-2xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'border-indigo-600 bg-white shadow-md ring-1 ring-indigo-600'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-800 text-sm">{v.id}</span>
                  {isSelected && <CheckCircle2 className="w-4 h-4 text-indigo-600" />}
                </div>
                <p className="text-xs text-slate-500">
                  {isAr ? v.genderAr : v.genderEn} — {isAr ? v.descAr : v.descEn}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Preview samples */}
      <div className="space-y-4">
        {selectedVoices.map((v) => {
          const sample = samples[v];
          const voiceMeta = VOICES.find((x) => x.id === v)!;
          const isCurrentPublished = voiceTone === v;
          return (
            <div
              key={v}
              className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex flex-col md:flex-row md:items-center gap-4"
            >
              <div className="flex items-center gap-3 md:w-56 shrink-0">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                  isCurrentPublished ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'
                }`}>
                  <Volume2 className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-sm">{v}</p>
                  <p className="text-xs text-slate-500">
                    {isAr ? voiceMeta.genderAr : voiceMeta.genderEn} — {isAr ? voiceMeta.descAr : voiceMeta.descEn}
                  </p>
                </div>
              </div>

              <div className="flex-1">
                {!sample || sample.state === 'idle' ? (
                  <button
                    onClick={() => generateSample(v)}
                    disabled={!text.trim()}
                    className="flex items-center gap-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Play className="w-3.5 h-3.5" />
                    {isAr ? 'اسمع العينة' : 'Generate sample'}
                  </button>
                ) : sample.state === 'loading' ? (
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {isAr ? 'جاري توليد الصوت...' : 'Generating...'}
                  </div>
                ) : sample.state === 'error' ? (
                  <div className="flex items-center gap-2 text-xs text-rose-600">
                    <AlertCircle className="w-4 h-4" />
                    <span className="font-bold">{isAr ? 'تعذّر التوليد' : 'Failed'}:</span>
                    <span className="font-mono text-[11px]">{sample.error}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <audio controls src={sample.audioUrl} className="h-9" />
                    <button
                      onClick={() => generateSample(v)}
                      className="text-xs text-slate-500 hover:text-indigo-600 font-bold"
                    >
                      {isAr ? 'إعادة' : 'Replay'}
                    </button>
                  </div>
                )}
              </div>

              <div className="md:ms-auto">
                {isCurrentPublished ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-2 rounded-xl">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {isAr ? 'صوت مطعمك الحالي' : 'Current voice'}
                  </span>
                ) : (
                  <button
                    onClick={() => void publishVoice(v)}
                    disabled={!sample || sample.state !== 'ready' || publishStatus === 'saving'}
                    className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:cursor-not-allowed"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {isAr ? 'اعتمد هذا الصوت' : 'Publish as voice'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {publishStatus === 'saving' && <div role="status" className="mt-6 rounded-xl border border-indigo-100 bg-indigo-50 p-3 text-sm text-indigo-700">{isAr ? 'جاري حفظ الصوت...' : 'Saving voice...'}</div>}
      {publishStatus === 'error' && <div role="alert" className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{publishError}</div>}

      {/* Publish toast */}
      {publishStatus === 'saved' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2 text-sm font-bold animate-fade-in">
          <CheckCircle2 className="w-4 h-4" />
          {isAr ? 'تم اعتماد الصوت الجديد' : 'Voice updated'}
        </div>
      )}
    </div>
  );
}

/* ---------- helpers ---------- */

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Wrap a 16-bit PCM mono audio buffer in a standard WAV container. */
function l16ToWav(pcm: Uint8Array, sampleRate: number): Uint8Array {
  const blockAlign = 2; // 16-bit mono
  const byteRate = sampleRate * blockAlign;
  const buffer = new ArrayBuffer(44 + pcm.byteLength);
  const view = new DataView(buffer);

  // RIFF chunk
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + pcm.byteLength, true);
  writeString(view, 8, 'WAVE');

  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // bits per sample

  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, pcm.byteLength, true);

  // PCM body
  const out = new Uint8Array(buffer);
  out.set(pcm, 44);
  return out;
}

function writeString(view: DataView, offset: number, s: string) {
  for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
}
