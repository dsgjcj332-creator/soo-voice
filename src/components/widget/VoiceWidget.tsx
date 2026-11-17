import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Mic,
  X,
  MoreHorizontal,
  Settings,
  Volume2,
  Send,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { useLanguage } from "../../contexts/LanguageContext";
import { useSettings, Dialect, VoiceTone, BusinessType } from "../../contexts/SettingsContext";
import { useKnowledge } from "../../contexts/KnowledgeContext";
import { GoogleGenAI, Modality, LiveServerMessage } from "@google/genai";
import { useSearchParams } from "react-router-dom";
import { getSupabase, getSupabaseConfig } from "../../lib/supabase";
import { currencyPromptLabel } from "../../lib/currency";
import { brandColor } from "../../lib/theme";
import { useCart } from "../../contexts/CartContext";
import { playChime, haptic } from "../../lib/chime";

type VoiceState = "idle" | "listening" | "thinking" | "speaking" | "error";

const RESTAURANT_PROMPTS_AR = [
  { label: "🍔 إضافة برجر للطلب", text: "أريد إضافة برجر دبل تشيز وبطاطس مقلية إلى طلبي" },
  { label: "🍕 بيتزا تروفل إيطالية", text: "ما هي مكونات بيتزا التروفل الإيطالية وسعرها؟" },
  { label: "🍰 تحلية ومشروب بارد", text: "اقترح لي حلى لذيذ مع مشروب بارد منعش" },
  { label: "🧑‍🍳 طبق الشيف السري", text: "هل يتوفر طبق سري خاص بالشيف غير معروض بالمنيو؟" }
];

const RESTAURANT_PROMPTS_EN = [
  { label: "🍔 Add Burger & Fries", text: "Please add a Double Cheese Burger and fries to my order." },
  { label: "🍕 Truffle Pizza info", text: "What are the ingredients and price of your Truffle Pizza?" },
  { label: "🍰 Suggest Dessert & Drink", text: "What is your best dessert paired with an iced drink?" },
  { label: "🧑‍🍳 Chef's Secret Special", text: "Do you have any secret off-menu specials available today?" }
];

export function VoiceWidget() {
  const { t, language } = useLanguage();
  const [searchParams] = useSearchParams();
  const urlOwnerId = searchParams.get("ownerId") || searchParams.get("storeId") || undefined;

  const contextSettings = useSettings();
  const contextKnowledge = useKnowledge();
  const tableParam = searchParams.get('table') || searchParams.get('tableNumber') || '';

  // Cart — the voice assistant can now add items directly. Wrap in
  // try/catch because VoiceWidget is also mounted in the standalone
  // /widget-standalone page, which is OUTSIDE the CartProvider. We
  // only want add-to-cart from the dine-in /store page.
  let cartApi: { addToCart: (item: { id: string; name: string; price: number }, qty?: number) => void; count: number } | null = null;
  try {
    cartApi = useCart();
  } catch {
    // No CartProvider in scope (e.g. widget-standalone). Cart actions
    // simply won't be available; the assistant falls back to its
    // original "tell the guest to call a waiter" behavior.
    cartApi = null;
  }

  // Ref mirror of the cart api + current menu, so the Live API
  // tool-call handler (which lives inside an onmessage callback that
  // captures the initial closure) always reads fresh values.
  const cartApiRef = useRef(cartApi);
  cartApiRef.current = cartApi;
  const menuItemsRef = useRef<any[]>([]);
  // menuItemsRef.current is updated below, after dbMenuItems is declared.
  
  const [activeDialect, setActiveDialect] = useState<Dialect>("standard");
  const [activeVoiceTone, setActiveVoiceTone] = useState<VoiceTone>("Zephyr");
  const [activeBusinessType, setActiveBusinessType] = useState<BusinessType>("restaurant");
  const [activeDocuments, setActiveDocuments] = useState<any[]>([]);
  const [activeCurrency, setActiveCurrency] = useState<string>("EGP");
  const [brandAccent, setBrandAccent] = useState<string>("indigo");

  const [isOpen, setIsOpen] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [dbMenuItems, setDbMenuItems] = useState<any[]>([]);
  // Keep the ref mirror in sync so the Live API tool-call handler
  // (which fires from inside the onmessage closure) always sees the
  // freshest menu, even after realtime menu updates.
  menuItemsRef.current = dbMenuItems;
  const [typedMessage, setTypedMessage] = useState("");

  // Sync / load Dialect, VoiceTone, BusinessType, Currency + brand color dynamically
  useEffect(() => {
    if (!urlOwnerId) {
      setActiveDialect(contextSettings.dialect);
      setActiveVoiceTone(contextSettings.voiceTone);
      setActiveBusinessType(contextSettings.businessType);
      setActiveCurrency(contextSettings.currency);
      return;
    }

    const loadExternalSettings = async () => {
      const { isConfigured } = getSupabaseConfig();
      const supabase = getSupabase();

      if (isConfigured && supabase) {
        try {
          const { data, error } = await supabase
            .from('merchant_settings')
            .select('*')
            .eq('ownerId', urlOwnerId)
            .single();

          if (!error && data) {
            if (data.dialect) setActiveDialect(data.dialect as Dialect);
            if (data.voiceTone) setActiveVoiceTone(data.voiceTone as VoiceTone);
            if (data.businessType) setActiveBusinessType(data.businessType as BusinessType);
            if (data.currency) setActiveCurrency(String(data.currency));
          }
        } catch (err) {
          console.error("Error loading external settings:", err);
        }

        // Brand accent color chosen by the merchant in the Menu Designer
        try {
          const { data: design } = await supabase
            .from('menu_customizer')
            .select('primaryColor')
            .eq('ownerId', urlOwnerId)
            .single();
          if (design?.primaryColor) setBrandAccent(String(design.primaryColor));
        } catch (err) {
          console.warn("No menu_customizer brand color for owner:", err);
        }
      }
    };

    loadExternalSettings();
  }, [urlOwnerId, contextSettings.dialect, contextSettings.voiceTone, contextSettings.businessType, contextSettings.currency]);

  // Sync / load Knowledge Documents dynamically
  useEffect(() => {
    if (!urlOwnerId) {
      setActiveDocuments(contextKnowledge.documents);
      return;
    }

    const loadExternalKnowledge = async () => {
      const { isConfigured } = getSupabaseConfig();
      const supabase = getSupabase();

      if (isConfigured && supabase) {
        try {
          const { data, error } = await supabase
            .from('knowledge_documents')
            .select('*')
            .eq('ownerId', urlOwnerId);

          if (!error && data) {
            setActiveDocuments(data);
          }
        } catch (err) {
          console.error("Error loading external knowledge:", err);
        }
      }
    };

    loadExternalKnowledge();
  }, [urlOwnerId, contextKnowledge.documents]);

  // Real-time synchronization of menu items from Supabase
  useEffect(() => {
    const { isConfigured } = getSupabaseConfig();
    const supabase = getSupabase();

    // Fail closed: a public widget must always be bound to one merchant.
    // Never issue an unscoped menu query when ownerId/storeId is missing.
    if (!urlOwnerId) {
      setDbMenuItems([]);
      return;
    }

    if (isConfigured && supabase) {
      let cancelled = false;
      setDbMenuItems([]);
      const fetchSupabaseItems = async () => {
        try {
          const { data, error } = await supabase
            .from('menu_items')
            .select('*')
            .eq('ownerId', urlOwnerId)
            .order('createdAt', { ascending: false });
          if (cancelled) return;
          if (error) {
            console.error("Failed to fetch merchant menu:", error);
            setDbMenuItems([]);
            return;
          }
          setDbMenuItems(data || []);
        } catch (err) {
          if (!cancelled) {
            console.error("Failed to fetch merchant menu:", err);
            setDbMenuItems([]);
          }
        }
      };

      fetchSupabaseItems();
      return () => { cancelled = true; };
    } else {
      setDbMenuItems([]);
    }
  }, [urlOwnerId]);

  // Post message to parent window for resizing if iframe embed
  useEffect(() => {
    try {
      if (isOpen) {
        window.parent.postMessage("open_voice_widget", "*");
      } else {
        window.parent.postMessage("close_voice_widget", "*");
      }
    } catch (e) {
      console.warn("Could not post message to parent window:", e);
    }
  }, [isOpen]);

  const [transcript, setTranscript] = useState("How can I help you today?");
  const [history, setHistory] = useState<
    { role: "user" | "ai"; text: string }[]
  >([]);

  const sessionRef = useRef<Promise<any> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);

  // Update idle transcript when language changes
  useEffect(() => {
    if (voiceState === "idle") {
      setTranscript(t('widget.idle'));
    }
  }, [t, voiceState]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopLiveConversation();
    };
  }, []);

  const startAudioCapture = async (sessionPromise: Promise<any>) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { sampleRate: 16000 } });
      streamRef.current = stream;

      const audioCtx = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          pcm16[i] = Math.max(-1, Math.min(1, inputData[i])) * 32767;
        }

        const buffer = new ArrayBuffer(pcm16.length * 2);
        const view = new DataView(buffer);
        for (let i = 0; i < pcm16.length; i++) {
          view.setInt16(i * 2, pcm16[i], true); // little endian
        }

        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64Data = btoa(binary);

        sessionPromise.then(session => {
          session.sendRealtimeInput({
            audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
          });
        }).catch(() => {});
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);
    } catch (err) {
      console.error("Mic access denied:", err);
      setVoiceState("error");
      setTranscript("Microphone access denied.");
    }
  };

  const playAudioChunk = (base64Data: string) => {
    if (!playbackContextRef.current) {
      playbackContextRef.current = new AudioContext({ sampleRate: 24000 });
      nextStartTimeRef.current = playbackContextRef.current.currentTime;
    }
    const playbackContext = playbackContextRef.current;

    const binary = atob(base64Data);
    const len = binary.length / 2;
    const audioBuffer = playbackContext.createBuffer(1, len, 24000);
    const channelData = audioBuffer.getChannelData(0);

    for (let i = 0; i < len; i++) {
      const low = binary.charCodeAt(i * 2);
      const high = binary.charCodeAt(i * 2 + 1);
      const int16 = (high << 8) | low;
      // Convert to [-1, 1] float
      channelData[i] = (int16 >= 0x8000 ? int16 - 0x10000 : int16) / 32768;
    }

    const source = playbackContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(playbackContext.destination);

    if (nextStartTimeRef.current < playbackContext.currentTime) {
      nextStartTimeRef.current = playbackContext.currentTime + 0.1;
    }

    source.start(nextStartTimeRef.current);
    nextStartTimeRef.current += audioBuffer.duration;
  };

  const startLiveConversation = async (initialText?: string) => {
    try {
      setVoiceState("thinking");
      setTranscript(language === "ar" ? "جاري الاتصال بالمساعد الصوتي..." : "Connecting to your voice assistant...");

      // The real Gemini API key must never be exposed to the browser.
      // The server mints a short-lived ephemeral token for the Live API.
      let apiKey: string;
      try {
        const tokenRes = await fetch("/api/gemini-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        const tokenData = await tokenRes.json().catch(() => ({} as any));
        if (!tokenRes.ok || !tokenData?.token) {
          throw new Error(
            tokenData?.error || `Secure voice session unavailable (${tokenRes.status})`,
          );
        }
        apiKey = tokenData.token;
      } catch (tokenErr) {
        console.error("Ephemeral token error:", tokenErr);
        setVoiceState("error");
        setTranscript(
          tokenErr instanceof Error
            ? tokenErr.message
            : "Could not start a secure voice session."
        );
        return;
      }

      // Ephemeral tokens require the v1alpha API version.
      const ai = new GoogleGenAI({ apiKey, httpOptions: { apiVersion: "v1alpha" } });

      // Real catalog from the merchant's database. No fake fallback: if the
      // merchant hasn't added products yet, the agent honestly says so instead
      // of inventing items.
      const allMenuItems = dbMenuItems;
      const emptyMenuNoticeAr = allMenuItems.length === 0
        ? "\nتنبيه: قائمة المنتجات فارغة حالياً (لم يقم صاحب المتجر بإضافة المنتجات بعد). إذا طلب العميل أي منتج أو طعام، اعتذر بلطف وأخبره أن المنيو غير متاح حالياً، ولا تختلق أي منتجات أو أسعار."
        : "";
      const emptyMenuNoticeEn = allMenuItems.length === 0
        ? "\nIMPORTANT: The product catalog is currently EMPTY (the merchant has not added products yet). If the customer asks for any product, politely apologize and tell them the menu is not available yet. Never invent products or prices."
        : "";

      // 1. Separate structured docs from unstructured ones
      const profileDoc = activeDocuments.find(d => d.id === "business_profile");
      const faqsDoc = activeDocuments.find(d => d.id === "strict_faqs");
      const otherDocs = activeDocuments.filter(d => d.id !== "business_profile" && d.id !== "strict_faqs");

      let structuredProfilePromptAr = "";
      let structuredProfilePromptEn = "";
      if (profileDoc && profileDoc.content) {
        try {
          const p = JSON.parse(profileDoc.content);
          structuredProfilePromptAr = `
=== ملف تعريف الشركة الرسمي والسياسات المعتمدة (المرجعية المطلقة) ===
اسم النشاط/البراند: ${p.companyName || "غير محدد"}
نبذة ورسالة الشركة: ${p.companyOverview || "غير محدد"}
رقم التواصل والدعم: ${p.companyPhone || "غير محدد"}
العناوين والفروع: ${p.companyAddress || "غير محدد"}
مواعيد وأوقات العمل: ${p.companyHours || "غير محدد"}
طرق الدفع المقبولة: ${p.paymentMethods || "غير محدد"}
سياسة التوصيل والشحن: ${p.deliveryPolicy || "غير محدد"}
سياسة الاسترجاع والتبديل: ${p.refundPolicy || "غير محدد"}
=========================================================
`;
          structuredProfilePromptEn = `
=== OFFICIAL BRAND PROFILE & POLICIES (ABSOLUTE TRUTH SOURCE) ===
Brand Name: ${p.companyName || "N/A"}
Overview & Mission: ${p.companyOverview || "N/A"}
Support Phone/WhatsApp: ${p.companyPhone || "N/A"}
Branches & Addresses: ${p.companyAddress || "N/A"}
Operational Hours: ${p.companyHours || "N/A"}
Accepted Payment Methods: ${p.paymentMethods || "N/A"}
Delivery & Shipping Details: ${p.deliveryPolicy || "N/A"}
Refund & Return Policy: ${p.refundPolicy || "N/A"}
=========================================================
`;
        } catch (e) {
          console.error("Error formatting profile prompt:", e);
        }
      }

      let structuredFaqsPromptAr = "";
      let structuredFaqsPromptEn = "";
      if (faqsDoc && faqsDoc.content) {
        try {
          const fList = JSON.parse(faqsDoc.content);
          if (Array.isArray(fList) && fList.length > 0) {
            structuredFaqsPromptAr = `
=== الأسئلة الشائعة والأجوبة الإلزامية الدقيقة (يجب الإجابة بهذه الصيغة تماماً) ===
${fList.map((f, i) => `سؤال ${i+1}: ${f.question}\nجواب ${i+1}: ${f.answer}`).join('\n---\n')}
=========================================================
`;
            structuredFaqsPromptEn = `
=== STRICT MANDATORY FAQ QUESTIONS & ANSWERS (MUST ANSWER PRECISELY LIKE THIS) ===
${fList.map((f, i) => `Q ${i+1}: ${f.question}\nA ${i+1}: ${f.answer}`).join('\n---\n')}
=========================================================
`;
          }
        } catch (e) {
          console.error("Error formatting FAQ prompt:", e);
        }
      }

      const standardDocsPromptAr = otherDocs.length > 0
        ? `\nمعلومات إضافية مساندة (Knowledge Base):\n` + otherDocs.map(d => `--- وثيقة: ${d.name} ---\n${d.content}`).join('\n\n')
        : '';
        
      const standardDocsPromptEn = otherDocs.length > 0
        ? `\nAdditional Context Documents:\n` + otherDocs.map(d => `--- Document: ${d.name} ---\n${d.content}`).join('\n\n')
        : '';

      const strictGuardrailsAr = `
تنبيه وإرشادات صارمة جداً:
1. يجب عليك الالتزام التام والحصري بالمعلومات المذكورة في "ملف تعريف الشركة الرسمي والسياسات المعتمدة" و "الأسئلة الشائعة والأجوبة الإلزامية".
2. يُمنع منعاً باتاً اختراع أو افتراض أي معلومات أو مواعيد عمل أو فروع أو أسعار شحن أو أكواد خصم أو تفاصيل تشغيلية غير مذكورة هنا.
3. إذا سألك العميل عن شيء غير متوفر في هذه البيانات أو في قائمة المنتجات، أجب بكل لطف واعتذر بلباقة موضحاً أنك لا تملك هذه المعلومة أو الخدمة حالياً، ولا تقدم أي افتراضات أو وعود وهمية خارج نطاق البيانات المكتوبة نهائياً!
`;

      const strictGuardrailsEn = `
STRICT SYSTEM GUARDRAILS:
1. You must adhere strictly and exclusively to the "OFFICIAL BRAND PROFILE & POLICIES" and "STRICT MANDATORY FAQ QUESTIONS & ANSWERS".
2. You are strictly forbidden from making up, assuming, or hallucinating any business details, working hours, branches, promo codes, delivery fees, or contact details not explicitly written here.
3. If a customer asks about details that are missing from these documents or the products list, politely apologize and state that you don't have this information right now. Never make assumptions or promises outside what is written!
`;

      const dialectInstruction = 
        activeDialect === 'egyptian' ? 'أنت تتحدث باللهجة المصرية العامية الخفيفة والودودة.' :
        activeDialect === 'gulf' ? 'أنت تتحدث باللهجة الخليجية بأسلوب لبق ومحترم.' :
        activeDialect === 'levantine' ? 'أنت تتحدث باللهجة الشامية اللطيفة.' :
        'أنت تتحدث باللغة العربية الفصحى المبسطة.';

      const currencyLineAr = `\nعملة الأسعار المعتمدة: ${currencyPromptLabel(activeCurrency, 'ar')}. كل الأسعار في القائمة أعلاه بهذه العملة — اذكرها دائماً عند ذكر أي سعر ولا تستخدم أي عملة أخرى.`;
      const currencyLineEn = `\nOfficial currency: ${currencyPromptLabel(activeCurrency, 'en')}. All prices in the catalog above are in this currency — always state prices in this currency and never use any other.`;

      const baseInstructionAr = `أنت مضيف ومساعد ضيافة لمطعمنا. هذه قائمة الأطعمة والمشروبات والحلويات المتاحة:
${JSON.stringify(allMenuItems)}
${currencyLineAr}${emptyMenuNoticeAr}
${structuredProfilePromptAr}
${structuredFaqsPromptAr}
${standardDocsPromptAr}
${strictGuardrailsAr}
أجب بوضوح وإيجاز ولباقة بناءً على المعلومات المتاحة لك فقط. وجّه العميل للأطباق المميزة واقترح ما يناسب ذوقه. ${dialectInstruction} يرجى الانتباه: قد تحتوي القائمة على أطباق سرية أو وجبات خاصة للشيف (isAiOnly = true)، فإذا سألك العميل عنها، أكد له توفرها وأخبره بسعرها ومكوناتها.

=== أداة الطلب (مهم جدًا) ===
أنت تملك دالة تُدعى add_to_cart يمكنك من خلالها إضافة أي طبق من القائمة إلى طلب الطاولة مباشرة. كل طبق في القائمة بالأعلى له حقل "id" — استخدمه لتحديد الطبق بدقة.

قواعد إلزامية لاستخدام الدالة:
1. عندما يقول العميل: "أضف" أو "أريد" أو "عاوز" أو "ضيف" أو "اطلب" أو "اطبخ لي" أو أي عبارة تعني الرغبة في الطلب — استدعِ add_to_cart فورًا بالـ id الصحيح للطبق. لا تكتفي بالوصف أو الاقتراح فقط.
2. لو قال أكثر من طبق في نفس الجملة (مثال: "أريد برجر ودانت")، استدعِ add_to_cart مرة لكل طبق على حدة.
3. لو حدد كمية (مثال: "ضيف ٢ بيتزا")، مرّر quantity=2.
4. لا تخترع id غير موجود في القائمة. لو لم تجد ما يطلبه، اعتذر بلباقة وأخبره أن هذا الطبق غير متوفر حاليًا.
5. بعد كل استدعاء ناجح للدالة، أخبر العميل بصوت واضح: "أضفت [اسم الطبق] لطلبك" أو ما يشابه — حتى يطمئن أنه وصل.

مثال للاستدعاء:
العميل: "أريد برجر دبل تشيز"
أنت: تستدعي add_to_cart({dish_id: "<id البرجر>"}), ثم تقول: "تمام! أضفت برجر دبل تشيز لطلبك. تحب حاجة معاه؟"
`;

      const baseInstructionEn = `You are a host and hospitality assistant for our restaurant. Here is our menu including main courses, drinks, and desserts:
${JSON.stringify(allMenuItems)}
${currencyLineEn}${emptyMenuNoticeEn}
${structuredProfilePromptEn}
${structuredFaqsPromptEn}
${standardDocsPromptEn}
${strictGuardrailsEn}
Answer briefly, courteously and clearly based ONLY on the provided information. Guide the guest to notable dishes and suggest what suits their taste. Note: Some dishes are marked 'isAiOnly = true' (secret chef menu items). If the guest asks about them, confirm we have them and state the price and ingredients.

=== ORDERING TOOL (VERY IMPORTANT) ===
You have a function called add_to_cart that lets you add any dish from the menu directly to the table's order. Every dish in the menu above has an "id" field — use it to specify the dish precisely.

Mandatory rules for using the function:
1. When the guest says "add", "I want", "I'll have", "give me", "I'd like", "order", or any phrase expressing an intent to order — call add_to_cart immediately with the correct dish id. Do not stop at description or recommendation alone.
2. If the guest mentions multiple dishes in one sentence (e.g. "I want a burger and a donut"), call add_to_cart once per dish.
3. If they specify a quantity (e.g. "add 2 pizzas"), pass quantity=2.
4. Never invent an id that is not in the menu. If you cannot find what they asked for, politely apologize and tell them the dish is not available right now.
5. After every successful call, tell the guest out loud: "Added [dish name] to your order" or similar — so they are reassured it landed.

Example:
Guest: "I want a double cheese burger"
You: call add_to_cart({dish_id: "<burger id>"}), then say: "Sure! Added double cheese burger to your order. Anything else with it?"
`;

      const sessionPromise = ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: activeVoiceTone } },
          },
          // Enable transcription
          outputAudioTranscription: {},
          inputAudioTranscription: {},
          systemInstruction: language === 'ar'
            ? baseInstructionAr
            : baseInstructionEn,
          // Tool: add_to_cart — the assistant can add a dish to the
          // table order by calling this function with the dish's id.
          // The function is only declared when a CartProvider is in
          // scope (i.e. on the /store page); on the standalone widget
          // page we omit it and the assistant falls back to its
          // original "tell the guest to call a waiter" behavior.
          tools: cartApiRef.current
            ? [{
                functionDeclarations: [{
                  name: "add_to_cart",
                  description: "Add a dish from the menu to the guest's table order. Call this when the guest asks to order, add, or have a specific dish. Pass the dish's id exactly as it appears in the menu; the kitchen will receive it.",
                  parameters: {
                    type: "object",
                    properties: {
                      dish_id: {
                        type: "string",
                        description: "The id of the dish to add, exactly as it appears in the menu list (e.g. 'item_42'). Do not pass the dish name."
                      },
                      quantity: {
                        type: "number",
                        description: "How many of this dish to add. Defaults to 1. Only use a value > 1 when the guest explicitly asks for more than one.",
                      },
                    },
                    required: ["dish_id"],
                  },
                }],
              }]
            : undefined,
        },
        callbacks: {
          onopen: () => {
            setVoiceState("listening");
            setTranscript(t('widget.listening'));
            startAudioCapture(sessionPromise);
            
            // If there's an initial text query, send it directly
            if (initialText) {
              sessionPromise.then(session => {
                session.sendRealtimeInput({
                  text: initialText
                });
              }).catch(err => console.error("Error sending initial text query:", err));
            }
          },
          onmessage: async (message: LiveServerMessage) => {
            // Debug log for tool-call diagnostics. Without this we
            // can't see whether the model is firing function calls and
            // we're missing them, or never firing them at all. The
            // browser console shows the full server message shape so
            // any future Live API breaking change is visible at a
            // glance instead of "the AI can't control the cart".
            if ((message as any).toolCall) {
              console.log('[VoiceWidget] toolCall received:', JSON.stringify((message as any).toolCall));
            }
            const serverContent = message.serverContent as any;
            if (serverContent?.interrupted) {
              if (playbackContextRef.current) {
                nextStartTimeRef.current = playbackContextRef.current.currentTime;
              }
            }

            // Capture User Spoken Transcription in real time
            if (serverContent?.userTurn?.parts) {
              const userSpokenText = serverContent.userTurn.parts
                .map((p: any) => p.text || "")
                .join("")
                .trim();
              if (userSpokenText) {
                setHistory(prev => {
                  const last = prev[prev.length - 1];
                  if (last && last.role === "user" && last.text === userSpokenText) {
                    return prev;
                  }
                  return [...prev, { role: "user", text: userSpokenText }];
                });
              }
            }

            const parts = message.serverContent?.modelTurn?.parts;
            if (parts) {
              let modelTransferredText = "";
              for (const part of parts) {
                // Handle Audio
                if (part.inlineData?.data) {
                  setVoiceState("speaking");
                  setTranscript(t('widget.speaking') || "Speaking...");
                  playAudioChunk(part.inlineData.data);
                }

                // Append any text transcription from the AI
                if (part.text) {
                  modelTransferredText += part.text;
                }
              }

              // Update history with compiled model text
              if (modelTransferredText) {
                setHistory(prev => {
                  const last = prev[prev.length - 1];
                  if (last && last.role === "ai") {
                    return [...prev.slice(0, -1), { role: "ai", text: last.text + modelTransferredText }];
                  } else {
                    return [...prev, { role: "ai", text: modelTransferredText }];
                  }
                });
              }
            }

            if (message.serverContent?.turnComplete) {
              // The model finished its turn
              setVoiceState("listening");
              setTranscript(t('widget.listening'));
            }

            // ---- Tool call: add_to_cart ----
            // The Live API sends toolCall as a top-level field on the
            // server message (NOT inside serverContent). The exact
            // shape from the official Live API docs is:
            //   message.toolCall = { functionCalls: [{ id, name, args }] }
            // (NOT an array — the previous version treated it as an
            // array and missed every call silently, which is why "the
            // AI can't control the cart" even though the tool was
            // declared). For each functionCall we look the dish up by
            // id, call addToCart, send a functionResponse back, and
            // fire the cart chime + haptic so the guest hears/feels
            // the add even while the assistant is still speaking.
            const tc = (message as any).toolCall;
            const functionCalls: any[] = Array.isArray(tc?.functionCalls)
              ? tc.functionCalls
              : Array.isArray(tc) ? tc : [];
            for (const fc of functionCalls) {
              if (!fc || fc.name !== 'add_to_cart') continue;
              const args = fc.args || {};
              const dishId = String(args.dish_id ?? '').trim();
              const qty = Math.max(1, Math.round(Number(args.quantity ?? 1) || 1));
              const cart = cartApiRef.current;
              const menu = menuItemsRef.current;
              if (!cart) {
                console.warn('[VoiceWidget] add_to_cart called but no cart context.');
                continue;
              }
              const dish = menu.find((m: any) => String(m.id) === dishId);
              if (!dish) {
                try {
                  const s = await sessionPromise;
                  s.sendToolResponse({
                    functionResponses: [{
                      id: fc.id,
                      name: 'add_to_cart',
                      response: {
                        ok: false,
                        error: 'dish_not_found',
                        message: `No dish with id "${dishId}" was found in the menu. Apologize to the guest and tell them this dish is not available.`,
                      },
                    }],
                  });
                } catch (e) {
                  console.error('[VoiceWidget] sendToolResponse error (not found):', e);
                }
                continue;
              }
              cart.addToCart({
                id: String(dish.id),
                name: String(dish.name ?? ''),
                price: Number(dish.price) || 0,
              }, qty);
              playChime('cart');
              haptic(15);
              try {
                const s = await sessionPromise;
                s.sendToolResponse({
                  functionResponses: [{
                    id: fc.id,
                    name: 'add_to_cart',
                    response: {
                      ok: true,
                      dish_name: String(dish.name ?? ''),
                      quantity: qty,
                      price: Number(dish.price) || 0,
                      currency: activeCurrency,
                    },
                  }],
                });
              } catch (e) {
                console.error('[VoiceWidget] sendToolResponse error (ok):', e);
              }
            }
          },
          onclose: () => {
            stopLiveConversation();
          },
          onerror: (err) => {
            console.error("Live API Error:", err);
            setVoiceState("error");
            setTranscript("An error occurred during communication.");
            stopLiveConversation();
          }
        }
      });
      sessionRef.current = sessionPromise;
    } catch (error) {
      console.error("Connection failed:", error);
      setVoiceState("error");
      setTranscript("Connection failed.");
    }
  };

  const stopLiveConversation = () => {
    if (sessionRef.current) {
      sessionRef.current.then((s: any) => s.close()).catch(() => {});
      sessionRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (playbackContextRef.current) {
      playbackContextRef.current.close().catch(() => {});
      playbackContextRef.current = null;
      nextStartTimeRef.current = 0;
    }
    setVoiceState("idle");
    setTranscript(t('widget.idle'));
  };

  const handleSuggestionClick = (text: string) => {
    // Add to history right away
    setHistory(prev => [...prev, { role: "user", text }]);
    
    // Check if session is already active
    if (sessionRef.current && (voiceState === "listening" || voiceState === "speaking" || voiceState === "thinking")) {
      sessionRef.current.then(session => {
        session.sendRealtimeInput({
          text: text
        });
      }).catch(err => console.error("Error sending query to Live API session:", err));
    } else {
      // Start session with this initial text query
      startLiveConversation(text);
    }
  };

  const handleMicClick = () => {
    if (voiceState === "idle" || voiceState === "error") {
      startLiveConversation();
    } else {
      stopLiveConversation();
    }
  };

  const brand = brandColor(brandAccent);

  return (
    <div className="fixed bottom-6 end-6 mb-safe z-50 flex flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="mb-4 w-80 overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-200 flex flex-col"
          >
            {/* Header */}
            <div
              className="px-4 py-3 flex items-center justify-between text-white drop-shadow-md z-10"
              style={{ backgroundColor: brand.hex }}
            >
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                <span className="font-medium text-sm">{t('widget.agent')}</span>
              </div>
              <div className="flex gap-2">
                <button
                  className="text-white/70 hover:text-white transition-colors"
                  title="Settings"
                >
                  <Settings className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setIsOpen(false);
                    stopLiveConversation();
                  }}
                  className="text-white/70 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Conversation History */}
            <div className="bg-slate-50 flex-1 p-4 h-64 overflow-y-auto flex flex-col gap-3 relative">
              {history.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-1 space-y-4">
                  <div
                    className="p-2.5 rounded-full animate-bounce"
                    style={{ backgroundColor: brand.bgLight, color: brand.hex }}
                  >
                    <Volume2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-slate-700">
                      {language === "ar" ? "أهلاً بك! أنا مساعدك الصوتي الذكي" : "Welcome! I'm your AI Voice Assistant"}
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                      {language === "ar" 
                        ? "اضغط على المايك وتحدث مباشرة، أو جرب أحد الأسئلة الجاهزة بالأسفل!"
                        : "Tap the mic to talk, or tap any of the smart suggestions below to try!"}
                    </p>
                  </div>
                  
                  {/* Suggestions Grid */}
                  <div className="grid grid-cols-2 gap-1.5 w-full pt-1 z-10">
                    {(language === "ar" ? RESTAURANT_PROMPTS_AR : RESTAURANT_PROMPTS_EN).map((p, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSuggestionClick(p.text)}
                        className="text-[9px] font-bold bg-white text-slate-600 border border-slate-200 px-2 py-1.5 rounded-xl text-center shadow-xs transition-all duration-150 line-clamp-2 hover:bg-slate-50"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {history.map((msg, i) => (
                    <div
                      key={i}
                      className={cn(
                        "px-3 py-2 rounded-2xl text-xs max-w-[85%] leading-relaxed shadow-xs transition-all duration-200",
                        msg.role === "user"
                          ? "text-white self-end rounded-ee-none"
                          : "bg-white border border-slate-100 text-slate-700 self-start rounded-es-none",
                      )}
                      style={msg.role === "user" ? { backgroundColor: brand.hex } : undefined}
                    >
                      {msg.text}
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* Bottom Interaction Area */}
            <div className="bg-white px-4 py-6 flex flex-col items-center justify-center border-t border-slate-100 relative shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
              {/* Status text */}
              <div className="absolute top-2 start-0 end-0 text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {voiceState !== 'idle' ? t(`widget.${voiceState}`) : voiceState}
                </p>
              </div>

              {/* The big orb */}
              <div
                className="relative flex items-center justify-center mt-2 group cursor-pointer"
                onClick={handleMicClick}
              >
                {/* Listening state rings */}
                {voiceState === "listening" && (
                  <>
                    <motion.div
                      animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0, 0.3] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="absolute w-20 h-20 bg-green-400 rounded-full"
                    />
                    <motion.div
                      animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                      transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        delay: 0.2,
                      }}
                      className="absolute w-16 h-16 bg-green-500 rounded-full"
                    />
                  </>
                )}

                {/* Speaking state rings */}
                {voiceState === "speaking" && (
                  <>
                    <motion.div
                      animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0.1, 0.5] }}
                      transition={{ duration: 1.2, repeat: Infinity }}
                      className="absolute w-20 h-20 rounded-full"
                      style={{ backgroundColor: `${brand.hex}66` }}
                    />
                    <motion.div
                      animate={{ scale: [1, 1.2, 1], opacity: [0.8, 0.2, 0.8] }}
                      transition={{
                        duration: 0.8,
                        repeat: Infinity,
                        delay: 0.1,
                      }}
                      className="absolute w-16 h-16 rounded-full"
                      style={{ backgroundColor: `${brand.hex}99` }}
                    />
                  </>
                )}

                {/* Central Button */}
                <button
                  className={cn(
                    "relative z-10 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-colors focus:outline-none focus:ring-4",
                    voiceState === "listening"
                      ? "bg-green-600 focus:ring-green-200"
                      : voiceState === "thinking"
                        ? "bg-amber-500 focus:ring-amber-200"
                        : "",
                  )}
                  style={
                    voiceState === "idle" || voiceState === "speaking"
                      ? { backgroundColor: brand.hex }
                      : undefined
                  }
                >
                  {voiceState === "idle" && (
                    <Mic className="h-6 w-6 text-white" />
                  )}
                  {voiceState === "listening" && (
                    <div className="h-4 w-4 bg-white rounded-sm" />
                  )}
                  {voiceState === "thinking" && (
                    <MoreHorizontal className="h-6 w-6 text-white animate-pulse" />
                  )}
                  {voiceState === "speaking" && (
                    <Volume2 className="h-6 w-6 text-white animate-pulse" />
                  )}
                </button>
              </div>

              {/* Dynamic Transcript text below button */}
              <motion.p
                key={transcript}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "mt-3 text-xs text-center min-h-[32px] max-w-[90%]",
                  voiceState === "error" ? "text-red-500" : "text-slate-600",
                )}
              >
                {transcript}
              </motion.p>

              {/* Hybrid Text Input Form */}
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  if (typedMessage.trim()) {
                    handleSuggestionClick(typedMessage);
                    setTypedMessage("");
                  }
                }}
                className="mt-3 w-full flex items-center gap-1.5 border border-slate-200 focus-within:border-indigo-400 rounded-xl px-2 py-1 bg-slate-50/50 transition-all"
              >
                <input
                  type="text"
                  placeholder={language === "ar" ? "أو اكتب سؤالك هنا..." : "Or type your question..."}
                  value={typedMessage}
                  onChange={(e) => setTypedMessage(e.target.value)}
                  className="flex-1 bg-transparent border-0 focus:ring-0 text-xs px-1 text-slate-700 outline-none placeholder:text-slate-400"
                />
                <button
                  type="submit"
                  disabled={!typedMessage.trim()}
                  className="disabled:bg-slate-300 text-white p-1.5 rounded-lg transition-colors shadow-sm"
                  style={{ backgroundColor: brand.hex }}
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>

            {/* Branding */}
            <div className="bg-slate-50 py-1.5 text-center border-t border-slate-200">
              <span className="text-[10px] text-slate-400 font-bold tracking-wider">
                Powered by SooVoice
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!isOpen && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          onClick={() => {
            setIsOpen(true);
            if (voiceState === "idle" || voiceState === "error") {
              startLiveConversation();
            }
          }}
          className="flex h-16 w-16 items-center justify-center rounded-full text-white shadow-2xl hover:scale-105 transition-all focus:outline-none focus:ring-4 border-2 border-white/20 relative group"
          style={{
            background: `linear-gradient(135deg, ${brand.hex} 0%, ${brand.dark} 100%)`,
            boxShadow: `0 20px 25px -5px ${brand.hex}55`,
          }}
        >
          {/* Subtle pulse effect underneath the button when closed to attract attention */}
          <div
            className="absolute inset-0 rounded-full border-4 opacity-20 group-hover:animate-ping animate-[pulse_2s_ease-in-out_infinite]"
            style={{ borderColor: brand.hex }}
          />
          <Mic className="h-7 w-7" />
        </motion.button>
      )}
    </div>
  );
}
