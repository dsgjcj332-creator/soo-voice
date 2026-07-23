import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Mic,
  X,
  MoreHorizontal,
  Settings,
  Volume2,
  ShoppingBag,
  Send,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { useLanguage } from "../../contexts/LanguageContext";
import { useSettings, Dialect, VoiceTone, BusinessType } from "../../contexts/SettingsContext";
import { useKnowledge } from "../../contexts/KnowledgeContext";
import { GoogleGenAI, Modality, LiveServerMessage, Type } from "@google/genai";
import { useCart } from "../../contexts/CartContext";
import { collection, query, onSnapshot, doc, getDoc, getDocs, where, setDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useSearchParams } from "react-router-dom";
import { getSupabase, getSupabaseConfig } from "../../lib/supabase";

type VoiceState = "idle" | "listening" | "thinking" | "speaking" | "error";

const MENU_ITEMS = [
  { id: '1', name: 'Classic Burger', price: 12.99, description: 'Beef patty, lettuce, tomato, cheese.' },
  { id: '2', name: 'Margherita Pizza', price: 15.99, description: 'Fresh tomatoes, mozzarella, basil.' },
  { id: '3', name: 'Caesar Salad', price: 9.99, description: 'Crisp romaine, croutons, parmesan.' },
  { id: '4', name: 'Fries', price: 4.99, description: 'Golden crispy french fries.' },
  { id: '5', name: 'Cola', price: 2.99, description: 'Refreshing cold soda.' },
];

const SECTOR_PROMPTS_AR = {
  restaurant: [
    { label: "🍔 إضافة برجر للطلب", text: "أريد إضافة برجر لافا بالمشروم إلى طلبي" },
    { label: "🍰 اقترح تحلية لذيذة", text: "ما هي التحلية المميزة التي تنصحني بها اليوم؟" },
    { label: "🥤 إضافة مشروب بارد", text: "أريد إضافة ميلك شيك فستق حلبي وعصير ماتشا مثلج" },
    { label: "🌿 خيارات نباتية؟", text: "هل لديكم سلطات أو وجبات صحية نباتية متوفرة؟" }
  ],
  real_estate: [
    { label: "🏠 شقة 3 غرف نوم؟", text: "هل لديكم شقق ثلاث غرف نوم مميزة معروضة للبيع حالياً؟" },
    { label: "🔑 حجز موعد معاينة", text: "أريد حجز موعد لمعاينة فيلا مستقلة في أقرب وقت" },
    { label: "🏢 عقار إداري ومكتبي", text: "هل تتوفر مكاتب إدارية أو محلات تجارية بمواقع حيوية؟" },
    { label: "🌳 أرض زراعية أو سكنية", text: "ابحث عن أرض زراعية مستصلحة أو أرض سكنية مرخصة للبناء" }
  ],
  automotive: [
    { label: "🚗 سيارات عائلية متوفرة", text: "ما هي السيارات العائلية الدفع الرباعي SUV المتوفرة لديكم؟" },
    { label: "🔧 فرامل وقطع غيار مخفية", text: "أريد شراء قماش فرامل سيراميك لسيارة تويوتا كورولا" },
    { label: "📺 شاشة أندرويد ذكية", text: "هل يتوفر لديكم شاشة أندرويد ذكية للسيارة مع تركيبها؟" },
    { label: "📅 حجز تجربة قيادة", text: "أود حجز تجربة قيادة لسيارة سيدان طراز 2026" }
  ],
  general: [
    { label: "🎧 سماعات عازلة للضوضاء", text: "هل تتوفر سماعات بلوتوث عازلة للضوضاء وما هي مواصفاتها؟" },
    { label: "🪑 كرسي مكتب هيدروليك", text: "أبحث عن كرسي مكتب طبي مريح للظهر ومكتب متحرك" },
    { label: "🛡️ سياسة الضمان والاسترجاع", text: "ما هي سياسات الضمان على الأجهزة الإلكترونية والاسترجاع؟" },
    { label: "💡 ترشيح أفضل العروض", text: "ما هي أفضل العروض والمنتجات الأكثر مبيعاً لديكم اليوم؟" }
  ]
};

const SECTOR_PROMPTS_EN = {
  restaurant: [
    { label: "🍔 Add Burger", text: "Please add a Truffle Mushroom Burger to my order." },
    { label: "🍰 Suggest Dessert", text: "What is your best dessert recommendation today?" },
    { label: "🥤 Add Iced Matcha", text: "I want to add an Organic Iced Matcha Latte to my cart." },
    { label: "🌿 Vegetarian options?", text: "Do you have any fresh healthy salads or vegan items?" }
  ],
  real_estate: [
    { label: "🏠 3-Bedroom Apartment?", text: "Do you have any 3-bedroom apartments with high-end finishing?" },
    { label: "🔑 Book a Viewing", text: "I would like to book a physical viewing for the Luxury Standalone Villa." },
    { label: "🏢 Commercial Office", text: "What commercial properties or corporate offices are currently available?" },
    { label: "🌳 Lands & Plots", text: "Do you have any agriculture farms or residential plots for sale?" }
  ],
  automotive: [
    { label: "🚗 Family SUVs", text: "Can you recommend a spacious family SUV with AWD?" },
    { label: "🔧 Brake Pads & Parts", text: "I want to purchase premium ceramic brake pads for a Corolla." },
    { label: "📺 Android Smart Console", text: "Do you have a smart Android console screen in stock?" },
    { label: "📅 Book Test Drive", text: "I would like to schedule a test drive for the Sedan 2026." }
  ],
  general: [
    { label: "🎧 Noise-Cancelling Audio", text: "Tell me about your pro noise-cancelling headphones." },
    { label: "🪑 Office Ergonomics", text: "I need an ergonomic office setup with a height-adjustable desk." },
    { label: "🛡️ Warranty & Return", text: "What are your product warranty guidelines and return policies?" },
    { label: "💡 Best Tech Suggestions", text: "Can you suggest some of your best-selling electronics products?" }
  ]
};

export function VoiceWidget() {
  const { t, language } = useLanguage();
  const [searchParams] = useSearchParams();
  const urlOwnerId = searchParams.get("ownerId") || searchParams.get("storeId") || undefined;

  const contextSettings = useSettings();
  const contextKnowledge = useKnowledge();
  const { items, addToCart, total, clearCart } = useCart();
  const tableParam = searchParams.get('table') || searchParams.get('tableNumber') || '';
  
  const [activeDialect, setActiveDialect] = useState<Dialect>("standard");
  const [activeVoiceTone, setActiveVoiceTone] = useState<VoiceTone>("Zephyr");
  const [activeBusinessType, setActiveBusinessType] = useState<BusinessType>("restaurant");
  const [activeDocuments, setActiveDocuments] = useState<any[]>([]);

  const [isOpen, setIsOpen] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [dbMenuItems, setDbMenuItems] = useState<any[]>([]);
  const [typedMessage, setTypedMessage] = useState("");

  // Sync / load Dialect, VoiceTone, BusinessType dynamically
  useEffect(() => {
    if (!urlOwnerId) {
      setActiveDialect(contextSettings.dialect);
      setActiveVoiceTone(contextSettings.voiceTone);
      setActiveBusinessType(contextSettings.businessType);
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
          }
        } catch (err) {
          console.error("Error loading external settings from Supabase:", err);
        }
      } else {
        try {
          const docRef = doc(db, "merchant_settings", urlOwnerId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.dialect) setActiveDialect(data.dialect as Dialect);
            if (data.voiceTone) setActiveVoiceTone(data.voiceTone as VoiceTone);
            if (data.businessType) setActiveBusinessType(data.businessType as BusinessType);
          }
        } catch (err) {
          console.error("Error loading external settings from Firestore:", err);
        }
      }
    };

    loadExternalSettings();
  }, [urlOwnerId, contextSettings.dialect, contextSettings.voiceTone, contextSettings.businessType]);

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
          console.error("Error loading external knowledge from Supabase:", err);
        }
      } else {
        try {
          const q = query(
            collection(db, 'knowledge_documents'), 
            where('ownerId', '==', urlOwnerId)
          );
          const snap = await getDocs(q);
          const docs = snap.docs.map(d => ({
            id: d.id,
            ...d.data()
          }));
          setActiveDocuments(docs);
        } catch (err) {
          console.error("Error loading external knowledge from Firestore:", err);
        }
      }
    };

    loadExternalKnowledge();
  }, [urlOwnerId, contextKnowledge.documents]);

  // Real-time synchronization of menu items from Firestore/Supabase
  useEffect(() => {
    const { isConfigured } = getSupabaseConfig();
    const supabase = getSupabase();

    if (isConfigured && supabase) {
      const fetchSupabaseItems = async () => {
        try {
          const queryBuilder = supabase
            .from('menu_items')
            .select('*');
          
          if (urlOwnerId) {
            queryBuilder.eq('ownerId', urlOwnerId);
          }
          
          const { data, error } = await queryBuilder.order('createdAt', { ascending: false });
          if (!error && data) {
            setDbMenuItems(data);
          }
        } catch (err) {
          console.error("Failed to fetch menu items from Supabase:", err);
        }
      };
      
      fetchSupabaseItems();
    } else {
      let q = query(collection(db, "menu_items"));
      if (urlOwnerId) {
        q = query(collection(db, "menu_items"), where("ownerId", "==", urlOwnerId));
      }
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const docs = snapshot.docs.map(d => ({
          id: d.id,
          name: d.data().name,
          price: d.data().price,
          description: d.data().description || "",
          category: d.data().category || "",
          isAiOnly: d.data().isAiOnly || false,
        }));
        setDbMenuItems(docs);
      }, (err) => {
        console.error("Error fetching widget items from firestore:", err);
      });
      return () => unsubscribe();
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
      setTranscript("Connecting to Gemini Live...");

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        setVoiceState("error");
        setTranscript("Missing GEMINI_API_KEY environment variable.");
        return;
      }

      const ai = new GoogleGenAI({ apiKey });

      // Merge database items with fallback menu
      const allMenuItems = dbMenuItems.length > 0 ? dbMenuItems : MENU_ITEMS;

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

      let baseInstructionAr = "";
      let baseInstructionEn = "";

      if (activeBusinessType === "real_estate") {
        baseInstructionAr = `أنت سمسار عقارات ذكي، محترف ومساعد ممتاز لشركتنا العقارية. هذه قائمة العقارات، الشقق، الفلل والأراضي المتاحة للبيع أو المعاينة:\n${JSON.stringify(allMenuItems)}\n${structuredProfilePromptAr}\n${structuredFaqsPromptAr}\n${standardDocsPromptAr}\n${strictGuardrailsAr}\nأجب بوضوح وإيجاز بناءً على المعلومات المتاحة لك فقط. العميل هنا يبحث عن السكن أو الاستثمار أو حجز موعد معاينة. ${dialectInstruction} يرجى الانتباه: قد تحتوي القائمة على عقارات أو عروض مميزة مخفية (isAiOnly = true)، إذا سألك العميل عنها، أكد له توفرها فوراً وأخبره بتفاصيلها وقيمتها ويمكنك إضافتها لقائمة المعاينة! إذا طلب العميل إضافة عقار للمعاينة أو الحجز، استخدم أداة add_to_cart باستخدام ID الخاص بالعنصر.`;
        baseInstructionEn = `You are an expert AI real estate broker for our property firm. Here is our properties catalog including apartments, villas, and lands:\n${JSON.stringify(allMenuItems)}\n${structuredProfilePromptEn}\n${structuredFaqsPromptEn}\n${standardDocsPromptEn}\n${strictGuardrailsEn}\nAnswer briefly and clearly based ONLY on the provided information. Keep it highly professional and premium. Note: Some high-value properties in this catalog are marked 'isAiOnly = true' (exclusive unlisted properties). If the client asks about exclusive or unlisted properties, confirm we have them, explain their specs and value, and offer to add them to their viewing portfolio! If the client wants to schedule a viewing or add a property, use the add_to_cart tool with the item's ID.`;
      } else if (activeBusinessType === "automotive") {
        baseInstructionAr = `أنت مهندس ومستشار مبيعات سيارات وقطع غيار ذكي ومحترف. هذه قائمة السيارات، قطع الغيار، باقات الصيانة والإكسسوارات المتاحة للبيع:\n${JSON.stringify(allMenuItems)}\n${structuredProfilePromptAr}\n${structuredFaqsPromptAr}\n${standardDocsPromptAr}\n${strictGuardrailsAr}\nأجب بوضوح وإيجاز بناءً على المعلومات المتاحة لك فقط. ${dialectInstruction} يرجى الانتباه: قد تحتوي القائمة على قطع غيار أو إكسسوارات مخفية بداخل المخزن (isAiOnly = true)، إذا سألك العميل عن قطع معينة أو توافر قطعة غيار، أكد له توفرها فوراً وأخبره بسعرها ومواصفاتها ويمكنك إضافتها لطلب الحجز الخاص به! إذا طلب العميل إضافة شيء، استخدم أداة add_to_cart باستخدام ID الخاص بالعنصر.`;
        baseInstructionEn = `You are an expert automotive sales consultant and parts advisor. Here is the catalog of vehicles, parts, and maintenance packages:\n${JSON.stringify(allMenuItems)}\n${structuredProfilePromptEn}\n${structuredFaqsPromptEn}\n${standardDocsPromptEn}\n${strictGuardrailsEn}\nAnswer briefly and clearly based ONLY on the provided information. Note: Some rare parts are marked 'isAiOnly = true' (hidden warehouse items). If the customer asks for a part or check availability, confirm we have it, state the price, and offer to add it to their order! If the customer asks to order or add to cart, use the add_to_cart tool with the item's ID.`;
      } else if (activeBusinessType === "general") {
        baseInstructionAr = `أنت مستشار مبيعات ذكي ومساعد متميز لمتجرنا التجاري. هذه قائمة المنتجات والخدمات المتاحة للبيع:\n${JSON.stringify(allMenuItems)}\n${structuredProfilePromptAr}\n${structuredFaqsPromptAr}\n${standardDocsPromptAr}\n${strictGuardrailsAr}\nأجب بوضوح وإيجاز بناءً على المعلومات المتاحة لك فقط. ${dialectInstruction} يرجى الانتباه: قد تحتوي القائمة على عروض خاصة أو منتجات مخفية بالمستودع (isAiOnly = true)، إذا سألك العميل عن توفرها، أكد له توفرها فوراً وأخبره بسعرها ومواصفاتها ويمكنك إضافتها لسلة تسوقه! إذا طلب العميل إضافة شيء، استخدم أداة add_to_cart باستخدام ID الخاص بالعنصر.`;
        baseInstructionEn = `You are a professional retail and services sales advisor for our shop. Here is our product and services catalog:\n${JSON.stringify(allMenuItems)}\n${structuredProfilePromptEn}\n${structuredFaqsPromptEn}\n${standardDocsPromptEn}\n${strictGuardrailsEn}\nAnswer briefly and clearly based ONLY on the provided information. Note: Some products in this catalog are marked 'isAiOnly = true' (exclusive backend inventory). If the customer asks for them, confirm we have them, state the price, and offer to add them to their cart! If the customer asks to order or add to cart, use the add_to_cart tool with the item's ID.`;
      } else {
        // Restaurant
        baseInstructionAr = `أنت مساعد ذكي ومضياف لمطعم وكافيه. هذه قائمة الأطعمة والمشروبات والحلويات المتاحة للطلب:\n${JSON.stringify(allMenuItems)}\n${structuredProfilePromptAr}\n${structuredFaqsPromptAr}\n${standardDocsPromptAr}\n${strictGuardrailsAr}\nأجب بوضوح وإيجاز بناءً على المعلومات المتاحة لك فقط. وجّه العميل للأطباق المميزة واجعل تجربته ممتعة وجذابة. ${dialectInstruction} يرجى الانتباه: قد تحتوي القائمة على أطباق سرية أو وجبات خاصة مخفية (isAiOnly = true)، إذا سألك العميل عن وجبات خاصة أو عروض حصرية، أكد له توفرها فوراً وأخبره بسعرها ومكوناتها ويمكنك إضافتها لطلب الطعام الخاص به! إذا طلب العميل إضافة شيء، استخدم أداة add_to_cart باستخدام ID الخاص بالعنصر.`;
        baseInstructionEn = `You are a friendly and smart restaurant host and order assistant. Here is our menu catalog including main courses, drinks, and desserts:\n${JSON.stringify(allMenuItems)}\n${structuredProfilePromptEn}\n${structuredFaqsPromptEn}\n${standardDocsPromptEn}\n${strictGuardrailsEn}\nAnswer briefly and clearly based ONLY on the provided information. Guide the user to popular meals and provide dynamic mouth-watering recommendations. Note: Some dishes are marked 'isAiOnly = true' (secret menu items). If the customer asks for a special dish, confirm we have it, state the price, and offer to add it to their order! If the customer asks to order or add to cart, use the add_to_cart tool with the item's ID.`;
      }

      // Append checkout instruction
      baseInstructionAr += " إذا قال العميل أنه انتهى من الاختيار أو يريد تأكيد الطلب أو إرساله للمطبخ أو الدفع، استخدم أداة place_order لإرسال وتأكيد الطلب بالكامل.";
      baseInstructionEn += " If the customer says they are ready to finalize their selection, confirm their order, or checkout, use the place_order tool to submit their entire order directly to the kitchen/POS.";

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
          tools: [{
            functionDeclarations: [
              {
                name: "add_to_cart",
                description: "Add a menu item to the user's shopping cart.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    itemId: { type: Type.STRING, description: "The ID of the item to add" },
                    quantity: { type: Type.INTEGER, description: "How many to add" }
                  },
                  required: ["itemId", "quantity"]
                }
              },
              {
                name: "place_order",
                description: "Submit or finalize the user's order to the kitchen / original system. Call this when the user says they want to complete the order, checkout, or confirm their selection.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {},
                  required: []
                }
              }
            ]
          }],
          systemInstruction: language === 'ar' 
            ? baseInstructionAr
            : baseInstructionEn,
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
          onmessage: (message: LiveServerMessage) => {
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
                
                // Handle Function Call
                if (part.functionCall) {
                  const { name, args, id } = part.functionCall;
                  if (name === "add_to_cart") {
                    const itemArgs = args as { itemId: string, quantity: number };
                    const item = allMenuItems.find(i => String(i.id) === String(itemArgs.itemId));
                    if (item) {
                      addToCart(item, itemArgs.quantity || 1);
                      setTranscript(`Added ${itemArgs.quantity || 1}x ${item.name} to cart.`);
                      
                      // Notify model of success
                      sessionPromise.then(session => {
                        session.sendToolResponse({
                          functionResponses: [{
                            name,
                            id,
                            response: { result: "Success, item added to cart" }
                          }]
                        });
                      });
                    }
                  } else if (name === "place_order") {
                    if (items.length === 0) {
                      sessionPromise.then(session => {
                        session.sendToolResponse({
                          functionResponses: [{
                            name,
                            id,
                            response: { status: "error", message: language === "ar" ? "السلة فارغة حالياً. لا يوجد منتجات لإرسالها." : "Your cart is currently empty." }
                          }]
                        });
                      });
                    } else {
                      const orderId = 'order_' + Math.floor(100000 + Math.random() * 900000);
                      const finalOwnerId = urlOwnerId || 'demo_merchant';
                      const newOrder = {
                        id: orderId,
                        ownerId: finalOwnerId,
                        tableNumber: tableParam || 'Walk-in',
                        items: items.map(i => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity })),
                        total: total,
                        status: 'pending',
                        createdAt: Date.now()
                      };

                      // 1. Save in Firestore
                      setDoc(doc(db, "orders", orderId), newOrder).then(async () => {
                        // 2. Load webhook and dispatch
                        try {
                          const whSnap = await getDoc(doc(db, "webhook_settings", finalOwnerId));
                          if (whSnap.exists()) {
                            const { webhookUrl, webhookSecret } = whSnap.data();
                            if (webhookUrl) {
                              fetch(webhookUrl, {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                  'X-VoiceAI-Signature': 'sha256_mock_sig_value_for_verification'
                                },
                                body: JSON.stringify({
                                  event: 'order.created',
                                  timestamp: Date.now(),
                                  webhook_secret: webhookSecret,
                                  data: newOrder
                                })
                              }).catch(e => console.warn("Widget background webhook dispatch failed:", e));
                            }
                          }
                        } catch (err) {
                          console.warn(err);
                        }

                        clearCart();
                        setTranscript(language === "ar" ? `تم إرسال طلبك بنجاح من طاولة رقم ${tableParam || "سفري"}` : `Order confirmed successfully for Table ${tableParam || "Walk-in"}`);

                        sessionPromise.then(session => {
                          session.sendToolResponse({
                            functionResponses: [{
                              name,
                              id,
                              response: { status: "success", message: language === "ar" ? `تم تسجيل طلبك بنجاح للمطبخ. رقم طلبك هو: ${orderId}` : `Order sent successfully to the kitchen. Your order ID is: ${orderId}` }
                            }]
                          });
                        });
                      }).catch(err => {
                        console.error("Firestore voice checkout error:", err);
                        clearCart();
                        sessionPromise.then(session => {
                          session.sendToolResponse({
                            functionResponses: [{
                              name,
                              id,
                              response: { status: "success", message: language === "ar" ? "تم تسجيل طلبك بنجاح!" : "Order placed successfully!" }
                            }]
                          });
                        });
                      });
                    }
                  }
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

  return (
    <div className="fixed bottom-6 end-6 z-50 flex flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="mb-4 w-80 overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-200 flex flex-col"
          >
            {/* Header */}
            <div className="bg-indigo-600 px-4 py-3 flex items-center justify-between text-white drop-shadow-md z-10">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                <span className="font-medium text-sm">{t('widget.agent')}</span>
              </div>
              <div className="flex gap-2">
                <button
                  className="text-indigo-200 hover:text-white transition-colors"
                  title="Settings"
                >
                  <Settings className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setIsOpen(false);
                    stopLiveConversation();
                  }}
                  className="text-indigo-200 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Conversation History */}
            <div className="bg-slate-50 flex-1 p-4 h-64 overflow-y-auto flex flex-col gap-3 relative">
              {history.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-1 space-y-4">
                  <div className="bg-indigo-50 text-indigo-600 p-2.5 rounded-full animate-bounce">
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
                    {(language === "ar" 
                      ? (SECTOR_PROMPTS_AR[activeBusinessType as keyof typeof SECTOR_PROMPTS_AR] || SECTOR_PROMPTS_AR.restaurant) 
                      : (SECTOR_PROMPTS_EN[activeBusinessType as keyof typeof SECTOR_PROMPTS_EN] || SECTOR_PROMPTS_EN.restaurant)
                    ).map((p, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSuggestionClick(p.text)}
                        className="text-[9px] font-bold bg-white hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 border border-slate-200 hover:border-indigo-200 px-2 py-1.5 rounded-xl text-center shadow-xs transition-all duration-150 line-clamp-2"
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
                          ? "bg-indigo-600 text-white self-end rounded-ee-none"
                          : "bg-white border border-slate-100 text-slate-700 self-start rounded-es-none",
                      )}
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
                      className="absolute w-20 h-20 bg-indigo-400 rounded-full"
                    />
                    <motion.div
                      animate={{ scale: [1, 1.2, 1], opacity: [0.8, 0.2, 0.8] }}
                      transition={{
                        duration: 0.8,
                        repeat: Infinity,
                        delay: 0.1,
                      }}
                      className="absolute w-16 h-16 bg-indigo-500 rounded-full"
                    />
                  </>
                )}

                {/* Central Button */}
                <button
                  className={cn(
                    "relative z-10 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-colors focus:outline-none focus:ring-4",
                    voiceState === "idle"
                      ? "bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-200"
                      : voiceState === "listening"
                        ? "bg-green-600 focus:ring-green-200"
                        : voiceState === "thinking"
                          ? "bg-amber-500 focus:ring-amber-200"
                          : voiceState === "speaking"
                            ? "bg-indigo-600 focus:ring-indigo-200"
                            : "bg-red-500",
                  )}
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
                  className="bg-indigo-600 disabled:bg-slate-300 hover:bg-indigo-700 text-white p-1.5 rounded-lg transition-colors shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>

            {/* Branding */}
            <div className="bg-slate-50 py-1.5 text-center border-t border-slate-200">
              <span className="text-[10px] text-slate-400 font-bold tracking-wider">
                ✨ Powered by VoiceAI
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
          className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-2xl shadow-indigo-500/50 hover:shadow-indigo-500/70 hover:scale-105 transition-all focus:outline-none focus:ring-4 focus:ring-indigo-200 border-2 border-white/20 relative group"
        >
          {/* Subtle pulse effect underneath the button when closed to attract attention */}
          <div className="absolute inset-0 rounded-full border-4 border-indigo-400 opacity-20 group-hover:animate-ping animate-[pulse_2s_ease-in-out_infinite]" />
          <Mic className="h-7 w-7" />
        </motion.button>
      )}
    </div>
  );
}
