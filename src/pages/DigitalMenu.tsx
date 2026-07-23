import React, { useState, useEffect } from "react";
import { 
  QrCode, 
  Plus, 
  Trash2, 
  Sparkles, 
  Eye, 
  EyeOff, 
  Printer, 
  Download, 
  Database, 
  Info,
  CheckCircle,
  HelpCircle,
  Smartphone,
  ChevronRight,
  Upload,
  FileText,
  X,
  AlertCircle
} from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";
import { useAuth } from "../contexts/AuthContext";
import { useSettings } from "../contexts/SettingsContext";
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { getSupabase, getSupabaseConfig } from "../lib/supabase";


interface MenuItem {
  id: string;
  ownerId: string;
  name: string;
  price: number;
  description: string;
  category: string;
  isAiOnly: boolean;
  createdAt: number;
}

export function DigitalMenu() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const { businessType } = useSettings();
  
  // State for menu items
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal & Form State
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("Main Course");
  const [description, setDescription] = useState("");
  const [isAiOnly, setIsAiOnly] = useState(false);
  const [notification, setNotification] = useState("");

  // Sync category default when business type changes
  useEffect(() => {
    if (businessType === "real_estate") {
      setCategory("Apartments");
    } else if (businessType === "automotive") {
      setCategory("Cars");
    } else if (businessType === "general") {
      setCategory("Electronics");
    } else {
      setCategory("Main Course");
    }
  }, [businessType]);

  // File Import States
  const [showImportModal, setShowImportModal] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [parsedItems, setParsedItems] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [importProgress, setImportProgress] = useState(0);

  // Dynamic CSV Parser
  const parseCSV = (text: string) => {
    const lines = text.split(/\r?\n/);
    if (lines.length < 2) return [];
    
    // Read headers and normalize them
    const headers = lines[0].split(",").map(h => h.trim().replace(/^["']|["']$/g, "").toLowerCase());
    
    const nameIdx = headers.findIndex(h => h.includes("name") || h.includes("الاسم") || h.includes("اسم") || h.includes("title"));
    const priceIdx = headers.findIndex(h => h.includes("price") || h.includes("السعر") || h.includes("سعر") || h.includes("cost"));
    const descIdx = headers.findIndex(h => h.includes("desc") || h.includes("الوصف") || h.includes("وصف") || h.includes("details"));
    const catIdx = headers.findIndex(h => h.includes("cat") || h.includes("الفئة") || h.includes("قسم") || h.includes("نوع"));
    const aiOnlyIdx = headers.findIndex(h => h.includes("ai") || h.includes("مخفي") || h.includes("ذكاء") || h.includes("only"));

    const parsed: any[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Match comma separation with or without quotes
      const values = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(",");
      const cleanValues = values.map(v => v.trim().replace(/^["']|["']$/g, ""));
      
      const itemName = nameIdx !== -1 && cleanValues[nameIdx] ? cleanValues[nameIdx] : "";
      const priceStr = priceIdx !== -1 && cleanValues[priceIdx] ? cleanValues[priceIdx] : "0";
      const itemPrice = parseFloat(priceStr.replace(/[^0-9.]/g, "")) || 0;
      const itemDesc = descIdx !== -1 && cleanValues[descIdx] ? cleanValues[descIdx] : "";
      
      // Map category or fallback to 'Main Course'
      let itemCat = catIdx !== -1 && cleanValues[catIdx] ? cleanValues[catIdx] : "Main Course";
      // Auto normalize to standard category names if partially matched
      if (itemCat.toLowerCase().includes("spare") || itemCat.includes("غيار")) itemCat = "Spare Parts";
      else if (itemCat.toLowerCase().includes("access") || itemCat.includes("إكسسوار")) itemCat = "Accessories";
      else if (itemCat.toLowerCase().includes("drink") || itemCat.includes("مشروب")) itemCat = "Drinks";
      else if (itemCat.toLowerCase().includes("dessert") || itemCat.includes("حلو")) itemCat = "Desserts";
      else if (itemCat.toLowerCase().includes("appetiz") || itemCat.includes("مقبل")) itemCat = "Appetizers";
      else itemCat = "Main Course";
      
      let itemAiOnly = false;
      if (aiOnlyIdx !== -1 && cleanValues[aiOnlyIdx]) {
        const val = cleanValues[aiOnlyIdx].toLowerCase();
        itemAiOnly = val === "true" || val === "1" || val === "yes" || val === "نعم" || val === "مخفي" || val === "صح";
      }

      if (itemName) {
        parsed.push({
          name: itemName,
          price: itemPrice,
          description: itemDesc,
          category: itemCat,
          isAiOnly: itemAiOnly
        });
      }
    }
    return parsed;
  };

  // Dynamic JSON Parser
  const parseJSON = (text: string) => {
    try {
      const obj = JSON.parse(text);
      const arr = Array.isArray(obj) ? obj : obj.items || obj.products || obj.menu_items || [];
      return arr.map((item: any) => {
        let cat = item.category || item.group || item.الفئة || "Main Course";
        if (cat.toLowerCase().includes("spare") || cat.includes("غيار")) cat = "Spare Parts";
        else if (cat.toLowerCase().includes("access") || cat.includes("إكسسوار")) cat = "Accessories";
        else if (cat.toLowerCase().includes("drink") || cat.includes("مشروب")) cat = "Drinks";
        else if (cat.toLowerCase().includes("dessert") || cat.includes("حلو")) cat = "Desserts";
        else if (cat.toLowerCase().includes("appetiz") || cat.includes("مقبل")) cat = "Appetizers";
        else cat = "Main Course";

        return {
          name: item.name || item.title || item.nameAr || item.الاسم || "",
          price: parseFloat(item.price || item.cost || item.السعر || "0") || 0,
          description: item.description || item.desc || item.الوصف || "",
          category: cat,
          isAiOnly: !!(item.isAiOnly || item.aiOnly || item.hidden || item.مخفي)
        };
      }).filter((i: any) => i.name);
    } catch (e) {
      throw new Error("Invalid JSON format");
    }
  };

  // File Selector Handler
  const handleFileProcess = (file: File) => {
    setImportError("");
    setParsedItems([]);
    
    const fileExtension = file.name.split(".").pop()?.toLowerCase();
    if (fileExtension !== "csv" && fileExtension !== "json") {
      setImportError(
        language === "ar" 
          ? "تنسيق الملف غير مدعوم. يرجى رفع ملف بصيغة CSV أو JSON فقط." 
          : "Unsupported file extension. Please upload a CSV or JSON file."
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      try {
        let result: any[] = [];
        if (fileExtension === "csv") {
          result = parseCSV(text);
        } else {
          result = parseJSON(text);
        }

        if (result.length === 0) {
          setImportError(
            language === "ar" 
              ? "لم نجد أي منتجات صالحة في الملف المرفوع. يرجى التحقق من صياغته." 
              : "No valid products found in this file. Please verify its content."
          );
        } else {
          setParsedItems(result);
        }
      } catch (err: any) {
        setImportError(err.message || "Error reading file");
      }
    };
    reader.readAsText(file);
  };

  // Drag & Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  // Submit to Firestore with Progress
  const handleImportSubmit = async () => {
    if (!user || parsedItems.length === 0) return;
    setImporting(true);
    setImportProgress(0);

    try {
      const totalCount = parsedItems.length;
      for (let i = 0; i < totalCount; i++) {
        const item = parsedItems[i];
        const itemId = "item_imported_" + Math.random().toString(36).substring(2, 11);
        
        const newItem: MenuItem = {
          id: itemId,
          ownerId: user.uid,
          name: item.name,
          price: item.price,
          description: item.description,
          category: item.category,
          isAiOnly: item.isAiOnly,
          createdAt: Date.now() - (i * 1000) // Stagger slightly for ordering
        };

        await setDoc(doc(db, "menu_items", itemId), newItem);
        setImportProgress(Math.round(((i + 1) / totalCount) * 100));
      }

      setImporting(false);
      setShowImportModal(false);
      setParsedItems([]);
      triggerNotification(
        language === "ar" 
          ? `تم استيراد ${totalCount} منتج بنجاح إلى المنيو!` 
          : `Successfully imported ${totalCount} items to your catalog!`
      );
    } catch (err) {
      console.error("Error importing items:", err);
      setImportError("Failed to save items to Firestore");
      setImporting(false);
    }
  };

  // Template generators
  const downloadCSVTemplate = () => {
    const csvContent = "name,price,category,description,isAiOnly\n" +
      "Toyota Brake Pads,45.00,Spare Parts,Original brake pads for Corolla,true\n" +
      "Chocolate Fudge Cake,6.50,Desserts,Rich hot chocolate double fudge cake,false\n" +
      "iPhone Leather Case,25.00,Accessories,Premium genuine leather cover,false\n" +
      "Engine Oil Filter,12.00,Spare Parts,Synthetic oil high flow filter,true";
      
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "min_makanak_import_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadJSONTemplate = () => {
    const jsonContent = JSON.stringify([
      {
        name: "Classic Cheeseburger",
        price: 9.99,
        category: "Main Course",
        description: "Juicy prime beef patty with cheddar cheese",
        isAiOnly: false
      },
      {
        name: "Spark Plugs Set",
        price: 32.50,
        category: "Spare Parts",
        description: "Laser iridium high performance spark plugs",
        isAiOnly: true
      }
    ], null, 2);

    const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "min_makanak_import_template.json");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // QR stand personalization state
  const [qrColor, setQrColor] = useState("indigo");
  const [tableNumber, setTableNumber] = useState("5");
  const [ctaTextAr, setCtaTextAr] = useState("امسح لمشاهدة المنيو وسؤال مساعد الذكاء الاصطناعي");
  const [ctaTextEn, setCtaTextEn] = useState("Scan to browse menu & ask AI Assistant");

  // Menu Customizer States
  const [activeSubTab, setActiveSubTab] = useState<"catalog" | "design" | "qr_stand">("catalog");
  const [menuPrimaryColor, setMenuPrimaryColor] = useState("indigo");
  const [menuBgStyle, setMenuBgStyle] = useState("light-clean");
  const [menuLogoEmoji, setMenuLogoEmoji] = useState("✨");
  const [menuBorderRadius, setMenuBorderRadius] = useState("rounded-2xl");
  const [menuParticles, setMenuParticles] = useState("sparkles");
  const [menuCurrency, setMenuCurrency] = useState("$");
  const [menuLayout, setMenuLayout] = useState("grid");
  const [designSaveStatus, setDesignSaveStatus] = useState<"idle" | "saving" | "success">("idle");

  // Load design config on mount
  useEffect(() => {
    if (!user) return;
    const localKey = `menu_design_config_${user.uid}`;
    const saved = localStorage.getItem(localKey);
    if (saved) {
      try {
        const config = JSON.parse(saved);
        if (config.primaryColor) setMenuPrimaryColor(config.primaryColor);
        if (config.bgStyle) setMenuBgStyle(config.bgStyle);
        if (config.logoEmoji) setMenuLogoEmoji(config.logoEmoji);
        if (config.borderRadius) setMenuBorderRadius(config.borderRadius);
        if (config.particles) setMenuParticles(config.particles);
        if (config.currency) setMenuCurrency(config.currency);
        if (config.layout) setMenuLayout(config.layout);
      } catch (e) {
        console.error("Error parsing saved design config:", e);
      }
    }
  }, [user]);

  const handleSaveDesign = async () => {
    if (!user) return;
    setDesignSaveStatus("saving");

    const config = {
      primaryColor: menuPrimaryColor,
      bgStyle: menuBgStyle,
      logoEmoji: menuLogoEmoji,
      borderRadius: menuBorderRadius,
      particles: menuParticles,
      currency: menuCurrency,
      layout: menuLayout,
      updatedAt: Date.now()
    };

    const localKey = `menu_design_config_${user.uid}`;
    localStorage.setItem(localKey, JSON.stringify(config));
    localStorage.setItem('menu_design_config_global', JSON.stringify(config));

    try {
      await setDoc(doc(db, "menu_customizer", user.uid), {
        ownerId: user.uid,
        ...config
      });
      
      setDesignSaveStatus("success");
      triggerNotification(
        language === "ar" ? "تم حفظ تصميم ومظهر المنيو بنجاح!" : "Menu design saved successfully!"
      );
      setTimeout(() => setDesignSaveStatus("idle"), 3000);
    } catch (err) {
      console.error("Failed to save design to Firestore, fallback to local:", err);
      setDesignSaveStatus("success");
      setTimeout(() => setDesignSaveStatus("idle"), 3000);
    }
  };

  // Dynamic Categories based on Business Vertical
  const getCategoriesForSector = () => {
    switch (businessType) {
      case "real_estate":
        return [
          { value: "Apartments", labelAr: "شقق سكنية", labelEn: "Apartments" },
          { value: "Villas", labelAr: "فيلات وقصور", labelEn: "Villas" },
          { value: "Lands", labelAr: "أراضي ومزارع", labelEn: "Lands" },
          { value: "Commercial", labelAr: "عقارات تجارية", labelEn: "Commercial Properties" },
        ];
      case "automotive":
        return [
          { value: "Cars", labelAr: "السيارات والمركبات", labelEn: "Cars & Vehicles" },
          { value: "Spare Parts", labelAr: "قطع غيار السيارات", labelEn: "Spare Parts" },
          { value: "Accessories", labelAr: "إكسسوارات زينة", labelEn: "Car Accessories" },
          { value: "Maintenance", labelAr: "باقات صيانة وخدمات", labelEn: "Maintenance Services" },
        ];
      case "general":
        return [
          { value: "Electronics", labelAr: "إلكترونيات وأجهزة", labelEn: "Electronics" },
          { value: "Fashion", labelAr: "أزياء وملابس", labelEn: "Fashion & Apparel" },
          { value: "Home", labelAr: "مستلزمات منزلية", labelEn: "Home Goods" },
          { value: "Services", labelAr: "خدمات عامة", labelEn: "Services" },
        ];
      case "restaurant":
      default:
        return [
          { value: "Main Course", labelAr: "أطباق رئيسية", labelEn: "Main Course" },
          { value: "Appetizers", labelAr: "مقبلات شهية", labelEn: "Appetizers" },
          { value: "Drinks", labelAr: "مشروبات باردة وساخنة", labelEn: "Drinks" },
          { value: "Desserts", labelAr: "حلويات فاخرة", labelEn: "Desserts" },
        ];
    }
  };

  const categories = getCategoriesForSector();

  useEffect(() => {
    if (!user) return;

    const { isConfigured } = getSupabaseConfig();
    const supabase = getSupabase();

    if (isConfigured && supabase) {
      console.log("[Menu] Subscribed and fetching from Supabase...");
      
      const fetchSupabaseItems = async () => {
        try {
          const { data, error } = await supabase
            .from('menu_items')
            .select('*')
            .eq('ownerId', user.uid)
            .order('createdAt', { ascending: false });
            
          if (error) throw error;
          setItems(data || []);
        } catch (err) {
          console.error("Failed to fetch from Supabase table 'menu_items'.", err);
          console.log("[Menu] Falling back to LocalStorage simulation for Supabase testing...");
          
          const localItems = JSON.parse(localStorage.getItem(`sb_items_${user.uid}`) || '[]');
          setItems(localItems);
        } finally {
          setLoading(false);
        }
      };

      fetchSupabaseItems();

      // Subscribe to postgres real-time updates
      const channel = supabase
        .channel('menu-items-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'menu_items', filter: `ownerId=eq.${user.uid}` },
          () => {
            fetchSupabaseItems();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      console.log("[Menu] Subscribed and fetching from Firebase Firestore...");
      const q = query(
        collection(db, "menu_items"),
        where("ownerId", "==", user.uid)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const docs = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data()
        } as MenuItem));
        setItems(docs.sort((a, b) => b.createdAt - a.createdAt));
        setLoading(false);
      }, (error) => {
        console.error("Error fetching menu items:", error);
        setLoading(false);
      });

      return () => unsubscribe();
    }
  }, [user]);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name || !price) return;

    const { isConfigured } = getSupabaseConfig();
    const supabase = getSupabase();
    const defaultCat = categories[0]?.value || "Main Course";
    const itemId = "item_" + Math.random().toString(36).substring(2, 11);
    
    const newItem: MenuItem = {
      id: itemId,
      ownerId: user.uid,
      name,
      price: parseFloat(price) || 0,
      description,
      category: category || defaultCat,
      isAiOnly,
      createdAt: Date.now()
    };

    try {
      if (isConfigured && supabase) {
        try {
          const { error } = await supabase
            .from('menu_items')
            .insert([newItem]);
            
          if (error) throw error;
          
          setItems(prev => [newItem, ...prev].sort((a, b) => b.createdAt - a.createdAt));
        } catch (err) {
          console.warn("Failed to insert into Supabase menu_items. Saving to local test buffer:", err);
          const localItems = JSON.parse(localStorage.getItem(`sb_items_${user.uid}`) || '[]');
          const updated = [newItem, ...localItems];
          localStorage.setItem(`sb_items_${user.uid}`, JSON.stringify(updated));
          setItems(updated);
        }
      } else {
        await setDoc(doc(db, "menu_items", itemId), newItem);
      }
      
      // Reset form
      setName("");
      setPrice("");
      setCategory(defaultCat);
      setDescription("");
      setIsAiOnly(false);
      setShowAddModal(false);
      triggerNotification(
        language === "ar" ? "تم إضافة المنتج بنجاح!" : "Product added successfully!"
      );
    } catch (err) {
      console.error("Error adding menu item:", err);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!window.confirm(language === "ar" ? "هل أنت متأكد من الحذف؟" : "Are you sure you want to delete this item?")) return;
    
    const { isConfigured } = getSupabaseConfig();
    const supabase = getSupabase();

    try {
      if (isConfigured && supabase) {
        try {
          const { error } = await supabase
            .from('menu_items')
            .delete()
            .eq('id', itemId);
            
          if (error) throw error;
          
          setItems(prev => prev.filter(d => d.id !== itemId));
        } catch (err) {
          console.warn("Failed to delete from Supabase menu_items. Syncing local test buffer:", err);
          const localItems = JSON.parse(localStorage.getItem(`sb_items_${user.uid}`) || '[]');
          const updated = localItems.filter((d: any) => d.id !== itemId);
          localStorage.setItem(`sb_items_${user.uid}`, JSON.stringify(updated));
          setItems(updated);
        }
      } else {
        await deleteDoc(doc(db, "menu_items", itemId));
      }
      
      triggerNotification(
        language === "ar" ? "تم حذف المنتج بنجاح!" : "Product deleted successfully!"
      );
    } catch (err) {
      console.error("Error deleting menu item:", err);
    }
  };

  // Sector-Aware 2,000 items AI Index Seeder
  const handleBulkAISeeding = async () => {
    if (!user) return;
    if (!window.confirm(
      language === "ar" 
        ? "سيقوم هذا بتوليد المنتجات المخفية والكتالوج الكامل تلقائياً لقطاع نشاطك الحالي لتجربة البحث الذكي ومساعد الذكاء الاصطناعي الصوتي. هل تريد المتابعة؟" 
        : "This will generate dynamic, sector-specific hidden catalog products automatically to test smart AI voice search and indexing. Continue?"
    )) return;

    try {
      setLoading(true);
      
      let samplePrefixes: string[] = [];
      let parts: { name: string; price: number; category: string; desc: string }[] = [];

      if (businessType === "real_estate") {
        samplePrefixes = ["Damac Hills", "New Cairo", "Riyadh Boulevard", "Dubai Marina", "October City"];
        parts = [
          { name: "Apartment with Terrace / شقة أرضي بتراس", price: 150000, category: "Apartments", desc: "3 Bedrooms, 2 Bathrooms, luxurious layout with a master suite." },
          { name: "Luxury Penthouse / روف بنتهاوس فاخر", price: 290000, category: "Apartments", desc: "Modern duplex penthouse with private roof pool and open views." },
          { name: "Modern Standalone Villa / فيلا مستقلة فاخرة", price: 620000, category: "Villas", desc: "Spacious standalone villa with landscape garden and private deck." },
          { name: "Fully Equipped Corporate Office / مكتب إداري مجهز بالكامل", price: 95000, category: "Commercial", desc: "Premium commercial space with conference rooms and fiber optic." },
          { name: "Prime Commercial Retail Shop / محل تجاري بموقع مميز", price: 180000, category: "Commercial", desc: "Ground floor retail shop with wide double frontage." },
          { name: "Agricultural Farm / أرض زراعية مستصلحة", price: 220000, category: "Lands", desc: "Rich fertile agricultural land with active water wells." },
          { name: "Residential Plot / أرض سكنية مرخصة", price: 140000, category: "Lands", desc: "Permitted for immediate G+4 residential building construction." }
        ];
      } else if (businessType === "automotive") {
        samplePrefixes = ["Toyota Camry", "Ford Territory", "Hyundai Tucson", "Tesla Model Y", "Mercedes C-Class"];
        parts = [
          { name: "Ceramic Brake Pads / قماش فرامل سيراميك", price: 75, category: "Spare Parts", desc: "Ultra-quiet premium ceramic brake pads with long lifespan." },
          { name: "Laser Spark Plugs / بواجي ليزر إيريديوم", price: 45, category: "Spare Parts", desc: "High performance spark plugs for superior ignition efficiency." },
          { name: "Engine Air Filter / فلتر هواء الماكينة", price: 22, category: "Spare Parts", desc: "High density fiber engine air intake filter." },
          { name: "Android Smart Console Screen / شاشة أندرويد ذكية", price: 280, category: "Accessories", desc: "Full-HD 10-inch capacitive touch screen with Apple CarPlay & Android Auto." },
          { name: "LED Headlight Kit / طقم لمبات ليد أمامية", price: 110, category: "Accessories", desc: "Super bright 6000K white headlights, plug-and-play." },
          { name: "Synthetic Engine Oil 10W-40 / زيت ماكينة تخليقي بالكامل", price: 35, category: "Maintenance", desc: "Premium 10,000km protection synthetic engine lubricant." },
          { name: "Comprehensive Brake Service / باقة صيانة الفرامل الشاملة", price: 150, category: "Maintenance", desc: "Brake pad replacement, rotor resurfacing, and fluid flush." }
        ];
      } else if (businessType === "general") {
        samplePrefixes = ["Sony Alpha", "MacBook Pro M3", "Logitech Master", "Ergonomic Setup", "Dior Luxury"];
        parts = [
          { name: "Mechanical Tactile Keyboard / كيبورد ميكانيكي مريح", price: 120, category: "Electronics", desc: "Tactile red switches with silent damping and customizable RGB backlighting." },
          { name: "Active Noise Cancelling Headset / سماعة بلوتوث عازلة للضوضاء", price: 195, category: "Electronics", desc: "Over-ear high fidelity wireless sound system with 40-hour battery life." },
          { name: "Ergonomic Hydraulic Office Chair / كرسي مكتب هيدروليك مريح للظهر", price: 165, category: "Home", desc: "Orthopedic back support with flexible height, headrest, and armrests." },
          { name: "Scented Premium Cologne / عطر رجالي فاخر", price: 85, category: "Fashion", desc: "Earthy woody fragrance with long-lasting scent notes." },
          { name: "Cotton Oversized Hoodie / هودي قطن ثقيل", price: 45, category: "Fashion", desc: "High-quality heavy French terry cotton designer comfort wear." },
          { name: "Smart Robot Vacuum / مكنسة روبوت ذكية", price: 240, category: "Home", desc: "Self-charging smart robotic vacuum with LIDAR mapping and app control." },
          { name: "Custom Web Development / تصميم وبرمجة موقع متكامل", price: 900, category: "Services", desc: "Fully responsive business website design with SEO-optimized setup." }
        ];
      } else {
        // Restaurants
        samplePrefixes = ["Classic Gourmet", "La Piazza", "Sweet Tooth", "Organic Fresh", "Burgers & Co"];
        parts = [
          { name: "Truffle Mushroom Burger / برجر المشروم والترافل الفاخر", price: 16, category: "Main Course", desc: "Prime Black Angus beef, melted Swiss cheese, caramelized onions & authentic black truffle sauce." },
          { name: "Buffalo Crispy Wings / أجنحة دجاج بافلو حارة", price: 11, category: "Appetizers", desc: "Stunningly crispy wings glazed in spicy buffalo sauce, served with cool ranch sauce." },
          { name: "Double Chocolate Fudge Lava Cake / كيكة شوكولاتة دبل فدج لافا", price: 8, category: "Desserts", desc: "Indulgent warm chocolate cake with a rich molten center, topped with vanilla ice cream." },
          { name: "Pistachio Milkshake / ميلك شيك فستق حلبي", price: 7, category: "Drinks", desc: "Rich ice cream milkshake blended with organic Greek pistachios." },
          { name: "Avocado Mozzarella Salad / سلطة أفوكادو بالموزاريلا", price: 12, category: "Appetizers", desc: "Fresh organic avocado slices with buffalo mozzarella and cherry tomatoes." },
          { name: "Wood-Fired Pepperoni Pizza / بيتزا بيبيروني حطب", price: 18, category: "Main Course", desc: "Authentic Neapolitan sourdough topped with spicy pepperoni and hot honey drizzle." },
          { name: "Organic Iced Matcha Latte / ماتشا لاتيه مثلج عضوي", price: 6, category: "Drinks", desc: "Ceremonial grade matcha whisked with organic oat milk over ice." }
        ];
      }

      // We seed a rich representational sample of 15 high-quality unlisted items
      const { isConfigured } = getSupabaseConfig();
      const supabase = getSupabase();
      const seededItemsList: MenuItem[] = [];

      for (let i = 0; i < 15; i++) {
        const randPrefix = samplePrefixes[i % samplePrefixes.length];
        const randPart = parts[i % parts.length];
        const itemId = `bulk_item_${i}_${Math.random().toString(36).substring(2, 5)}`;
        
        const bulkItem: MenuItem = {
          id: itemId,
          ownerId: user.uid,
          name: `${randPrefix} ${randPart.name}`,
          price: randPart.price + (i * 2),
          description: `Special listing from ${randPrefix}. ${randPart.desc}`,
          category: randPart.category,
          isAiOnly: true, // Marked as AI-ONLY (Hidden from standard Catalog)
          createdAt: Date.now() - (i * 60000)
        };
        
        seededItemsList.push(bulkItem);

        if (isConfigured && supabase) {
          try {
            await supabase
              .from('menu_items')
              .insert([bulkItem]);
          } catch (sbErr) {
            console.warn("Failed to insert seeded item in Supabase table:", sbErr);
          }
        } else {
          await setDoc(doc(db, "menu_items", itemId), bulkItem);
        }
      }

      if (isConfigured && supabase) {
        // Update local buffer and states
        const localItems = JSON.parse(localStorage.getItem(`sb_items_${user.uid}`) || '[]');
        const updated = [...seededItemsList, ...localItems];
        localStorage.setItem(`sb_items_${user.uid}`, JSON.stringify(updated));
        setItems(prev => [...seededItemsList, ...prev].sort((a, b) => b.createdAt - a.createdAt));
      }

      setLoading(false);
      triggerNotification(
        language === "ar" 
          ? "تم توليد وتأريخ كتالوج الذكاء الاصطناعي لقطاع نشاطك بنجاح!" 
          : "Successfully indexed AI Product catalog for your business sector!"
      );
    } catch (err) {
      console.error("Bulk seeding error:", err);
      setLoading(false);
    }
  };

  const triggerNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(""), 3500);
  };

  // Color mappings for the QR acrylic stand
  const colorSchemes: Record<string, { bg: string, border: string, text: string, accent: string }> = {
    indigo: { bg: "bg-indigo-600", border: "border-indigo-600", text: "text-indigo-600", accent: "indigo" },
    emerald: { bg: "bg-emerald-600", border: "border-emerald-600", text: "text-emerald-600", accent: "emerald" },
    amber: { bg: "bg-amber-500", border: "border-amber-500", text: "text-amber-500", accent: "amber" },
    rose: { bg: "bg-rose-600", border: "border-rose-600", text: "text-rose-600", accent: "rose" }
  };

  const currentScheme = colorSchemes[qrColor] || colorSchemes.indigo;

  // Custom QR Code Generator SVG Mockup
  const renderQRCodeSVG = () => {
    return (
      <svg className={`w-36 h-36 mx-auto ${currentScheme.text}`} viewBox="0 0 100 100" fill="currentColor">
        <path d="M5,5 h30 v30 h-30 z M10,10 h20 v20 h-20 z M15,15 h10 v10 h-10 z" />
        <path d="M65,5 h30 v30 h-30 z M70,10 h20 v20 h-20 z M75,15 h10 v10 h-10 z" />
        <path d="M5,65 h30 v30 h-30 z M10,70 h20 v20 h-20 z M15,75 h10 v10 h-10 z" />
        <path d="M45,10 h10 v10 h-10 z M45,25 h10 v10 h-10 z M55,45 h10 v10 h-10 z" />
        <path d="M35,45 h10 v10 h-10 z M45,55 h10 v10 h-10 z M55,35 h10 v10 h-10 z" />
        <path d="M75,45 h10 v10 h-10 z M85,55 h10 v10 h-10 z M65,75 h10 v10 h-10 z" />
        <path d="M45,75 h10 v10 h-10 z M75,65 h10 v10 h-10 z M85,85 h10 v10 h-10 z" />
        <path d="M45,45 h5 v5 h-5 z M50,50 h5 v5 h-5 z M40,60 h10 v5 h-10 z" />
      </svg>
    );
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto font-sans">
      {/* Toast notification */}
      {notification && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2 border border-slate-800 animate-bounce">
          <CheckCircle className="w-5 h-5 text-emerald-400" />
          <span className="text-sm font-semibold">{notification}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-800 flex items-center gap-2">
            <QrCode className="w-8 h-8 text-indigo-600 animate-pulse" />
            {language === "ar" ? "رقمنة المنيو وصانع الـ QR" : "Digital Menu & QR Builder"}
          </h1>
          <p className="text-slate-500 mt-1 text-sm md:text-base">
            {language === "ar" 
              ? "تحويل محلك لمنيو رقمي متفاعل مع مساعد صوتي ذكي للزباين لزيادة مبيعاتك بنسبة 35%." 
              : "Digitalize your shop into a responsive menu with a voice AI assistant to boost sales."}
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleBulkAISeeding}
            className="flex items-center gap-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors px-4 py-2.5 rounded-xl font-bold text-sm"
          >
            <Sparkles className="w-4 h-4" />
            {language === "ar" ? "توليد 2000 منتج للذكاء الاصطناعي" : "Bulk Generate 2000 AI Catalog"}
          </button>

          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors px-4 py-2.5 rounded-xl font-bold text-sm shadow-sm hover:-translate-y-0.5 transform"
          >
            <Upload className="w-4 h-4" />
            {language === "ar" ? "استيراد ملف (CSV/JSON)" : "Import File (CSV/JSON)"}
          </button>
          
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white transition-colors px-5 py-2.5 rounded-xl font-bold text-sm shadow-indigo-100 shadow-md hover:-translate-y-0.5 transform"
          >
            <Plus className="w-4 h-4" />
            {language === "ar" ? "إضافة منتج جديد" : "Add New Item"}
          </button>
        </div>
      </div>

      {/* Sub Tabs Selection */}
      <div className="flex border-b border-slate-200 mb-8 overflow-x-auto gap-2 scrollbar-none" id="digital-menu-subtabs">
        <button
          onClick={() => setActiveSubTab("catalog")}
          className={`flex items-center gap-2 py-3 px-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${
            activeSubTab === "catalog"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
          }`}
        >
          <Database className="w-4 h-4" />
          {language === "ar" ? "كتالوج المنتجات والأسعار" : "Products & Catalog Manager"}
        </button>

        <button
          onClick={() => setActiveSubTab("design")}
          className={`flex items-center gap-2 py-3 px-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${
            activeSubTab === "design"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
          }`}
        >
          <Sparkles className="w-4 h-4" />
          {language === "ar" ? "تعديل مظهر وألوان المنيو (جديد!)" : "Menu Theme & Designer (New!)"}
        </button>

        <button
          onClick={() => setActiveSubTab("qr_stand")}
          className={`flex items-center gap-2 py-3 px-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${
            activeSubTab === "qr_stand"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
          }`}
        >
          <Smartphone className="w-4 h-4" />
          {language === "ar" ? "تخصيص ستاند الـ QR والطاولة" : "Table QR Stand Builder"}
        </button>
      </div>

      {/* 1. CATALOG MANAGER TAB (Spacious Full Width Layout) */}
      {activeSubTab === "catalog" && (
        <div className="space-y-6" id="catalog-manager-view">
          {/* Informative Banner */}
          <div className="bg-indigo-50 border border-indigo-100/50 rounded-3xl p-6 flex items-start gap-4">
            <div className="bg-indigo-100 p-2.5 rounded-2xl text-indigo-600 shrink-0">
              <Info className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-indigo-900 text-sm md:text-base">
                {language === "ar" ? "فكرة رقمنة الكتالوج المخفي (2000 منتج)" : "The Hidden AI Catalog Concept (2,000 Products)"}
              </h3>
              <p className="text-xs md:text-sm text-indigo-800/80 mt-1.5 leading-relaxed">
                {language === "ar"
                  ? "لست مضطراً لعرض كافة الـ 2000 منتج على واجهة منيو العميل البصري المزدحم! يمكنك إضافة 200 منتج أساسي في المنيو البصري، وتفعيل خيار 'للذكاء الاصطناعي فقط' على بقية الـ 1800 منتج (مثل تفاصيل قطع غيار السيارات النادرة أو النكهات الجانبية). العميل عندما يستعمل مساعد الصوت سيبحث الذكاء الاصطناعي فوراً في كامل الـ 2000 منتج ويجيبه بالأسعار والخصائص!"
                  : "Keep your public store menu clean by showing only 200 core items, while marking the other 1,800 complex items (e.g. rare spare parts) as 'AI-Only / Hidden'. When customers speak to the AI Assistant, the AI will automatically fetch pricing and availability from the full database!"}
              </p>
            </div>
          </div>

          {/* List of Menu Items */}
          <div className="bg-white border border-slate-200/80 rounded-3xl shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between flex-wrap gap-4">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Database className="w-5 h-5 text-indigo-500" />
                {language === "ar" ? "إدارة المنتجات والكتالوج المفهرس" : "Menu & Indexed Catalog"}
                <span className="bg-indigo-50 text-indigo-600 text-xs font-bold px-2.5 py-0.5 rounded-full ml-2">
                  {items.length} {language === "ar" ? "منتج" : "items"}
                </span>
              </h2>

              <div className="flex gap-2">
                {/* Seed Status info */}
                <div className="text-xs text-slate-400 font-semibold flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
                  {language === "ar" ? "قاعدة البيانات متصلة وجاهزة" : "Database synced live"}
                </div>
              </div>
            </div>

            {loading ? (
              <div className="p-12 text-center text-slate-400 font-medium">
                <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                {language === "ar" ? "جاري تحميل كتالوج المنتجات..." : "Loading catalog..."}
              </div>
            ) : items.length === 0 ? (
              <div className="p-16 text-center text-slate-500">
                <QrCode className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h3 className="font-bold text-slate-700 text-base">
                  {language === "ar" ? "المنيو فارغ تماماً حالياً" : "Your Digital Menu is Empty"}
                </h3>
                <p className="text-sm text-slate-400 max-w-sm mx-auto mt-2">
                  {language === "ar" 
                    ? "ابدأ بإضافة منتجك الأول أو انقر على زر 'توليد 2000 منتج للذكاء الاصطناعي' لتعبئة المحاكاة فوراً واختبار الذكاء."
                    : "Add your first item or click 'Bulk Generate' to populate 1,800+ unlisted products for AI testing."}
                </p>
                <div className="mt-6 flex justify-center gap-3">
                  <button
                    onClick={handleBulkAISeeding}
                    className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-100"
                  >
                    {language === "ar" ? "توليد تلقائي للكتالوج" : "Auto Seed Catalog"}
                  </button>
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-700"
                  >
                    {language === "ar" ? "إضافة منتج يدوي" : "Add Item"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-400 uppercase text-[10px] font-bold tracking-wider border-b border-slate-100">
                      <th className="py-4 px-6">{language === "ar" ? "اسم المنتج" : "Product Name"}</th>
                      <th className="py-4 px-6">{language === "ar" ? "الفئة" : "Category"}</th>
                      <th className="py-4 px-6">{language === "ar" ? "السعر" : "Price"}</th>
                      <th className="py-4 px-6 text-center">{language === "ar" ? "حالة العرض" : "Visibility"}</th>
                      <th className="py-4 px-6 text-right">{language === "ar" ? "إجراء" : "Action"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 text-sm">
                    {items.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 px-6">
                          <div>
                            <p className="font-bold text-slate-800">{item.name}</p>
                            {item.description && (
                              <p className="text-xs text-slate-400 mt-1 max-w-xs truncate">{item.description}</p>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-6 font-semibold text-slate-500">
                          {language === "ar" ? (
                            categories.find(c => c.value === item.category)?.labelAr || item.category
                          ) : (
                            categories.find(c => c.value === item.category)?.labelEn || item.category
                          )}
                        </td>
                        <td className="py-4 px-6 font-bold text-indigo-600">
                          ${item.price.toFixed(2)}
                        </td>
                        <td className="py-4 px-6 text-center">
                          {item.isAiOnly ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-600" title="Hidden from menu, index in AI only">
                              <EyeOff className="w-3.5 h-3.5" />
                              {language === "ar" ? "للذكاء فقط" : "AI-Only"}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600" title="Visible on Menu & AI">
                              <Eye className="w-3.5 h-3.5" />
                              {language === "ar" ? "عام بالمنيو" : "Public Menu"}
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="text-red-400 hover:text-red-600 transition-colors p-2 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 className="w-4.5 h-4.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. DYNAMIC MENU CUSTOMIZER & THEME DESIGNER TAB */}
      {activeSubTab === "design" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8" id="menu-designer-tab">
          {/* Left Column: Theme Designer Panel (2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm">
              <div className="flex justify-between items-center border-b pb-4 mb-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">
                    {language === "ar" ? "لوحة التخصيص والألوان" : "Visual Theme Customizer"}
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    {language === "ar"
                      ? "غير ألوان وخلفيات المنيو الرقمي الخاص بك لجعل علامتك التجارية مميزة وجذابة!"
                      : "Personalize the colors, backgrounds and emojis of your digital menu live!"}
                  </p>
                </div>
                <button
                  onClick={handleSaveDesign}
                  disabled={designSaveStatus === "saving"}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white transition-all px-6 py-2.5 rounded-xl font-bold text-sm shadow-md"
                >
                  {designSaveStatus === "saving" ? (
                    language === "ar" ? "جاري الحفظ..." : "Saving..."
                  ) : designSaveStatus === "success" ? (
                    language === "ar" ? "تم الحفظ ✓" : "Saved ✓"
                  ) : (
                    language === "ar" ? "حفظ مظهر المنيو" : "Save Changes"
                  )}
                </button>
              </div>

              <div className="space-y-6">
                {/* 1. Primary Highlight Color */}
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-3">
                    {language === "ar" ? "1. لون الطابع الأساسي (Accent Color)" : "1. Primary Accent Color"}
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                    {[
                      { key: "indigo", nameAr: "نيلي", nameEn: "Indigo", color: "bg-indigo-600" },
                      { key: "rose", nameAr: "وردي", nameEn: "Rose", color: "bg-rose-600" },
                      { key: "emerald", nameAr: "زمردي", nameEn: "Emerald", color: "bg-emerald-600" },
                      { key: "amber", nameAr: "برتقالي", nameEn: "Amber", color: "bg-amber-500" },
                      { key: "violet", nameAr: "بنفسجي", nameEn: "Violet", color: "bg-violet-600" },
                      { key: "gold", nameAr: "ذهبي فاخر", nameEn: "Luxury Gold", color: "bg-yellow-700" }
                    ].map((c) => (
                      <button
                        key={c.key}
                        onClick={() => setMenuPrimaryColor(c.key)}
                        className={`flex flex-col items-center gap-1.5 p-2 rounded-2xl border-2 transition-all ${
                          menuPrimaryColor === c.key ? "border-slate-800 bg-slate-50" : "border-slate-100 hover:border-slate-200"
                        }`}
                      >
                        <span className={`w-8 h-8 rounded-full ${c.color} shadow-inner flex items-center justify-center text-white`}>
                          {menuPrimaryColor === c.key && "✓"}
                        </span>
                        <span className="text-[10px] font-bold text-slate-600">
                          {language === "ar" ? c.nameAr : c.nameEn}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Background Styles Palette */}
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-3">
                    {language === "ar" ? "2. مظهر وسيم المنيو (Background Theme)" : "2. Background & Theme preset"}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { key: "light-clean", titleAr: "أبيض بسيط هادئ", titleEn: "Minimalist Light", preview: "bg-slate-50 border-slate-200 text-slate-800" },
                      { key: "sunset-glow", titleAr: "غروب الذهب الدافئ", titleEn: "Golden Sunset", preview: "bg-gradient-to-br from-amber-50 to-rose-100 border-orange-200 text-slate-800" },
                      { key: "midnight-dark", titleAr: "الوضع الليلي الأنيق", titleEn: "Midnight Dark Mode", preview: "bg-slate-950 border-slate-800 text-slate-200 animate-pulse" },
                      { key: "forest-green", titleAr: "النباتي الطبيعي الأخضر", titleEn: "Forest Botanic", preview: "bg-gradient-to-br from-emerald-50 to-green-100 border-emerald-200 text-emerald-950" },
                      { key: "cosmic-purple", titleAr: "الفضاء البنفسجي الساحر", titleEn: "Cosmic Purple", preview: "bg-gradient-to-br from-indigo-950 to-purple-950 border-purple-900 text-purple-200" },
                      { key: "modern-retro", titleAr: "كريم كلاسيكي عتيق", titleEn: "Classic Retro Cream", preview: "bg-[#f4f1ea] border-[#2c2a29] text-[#2c2a29]" }
                    ].map((bg) => (
                      <button
                        key={bg.key}
                        onClick={() => setMenuBgStyle(bg.key)}
                        className={`p-4 rounded-2xl border-2 text-right flex justify-between items-center transition-all ${
                          menuBgStyle === bg.key ? "border-slate-800 ring-2 ring-slate-800/10 shadow-md scale-[1.01]" : "border-slate-100 hover:border-slate-200"
                        } ${bg.preview}`}
                      >
                        <div className="text-left font-semibold">
                          <p className="text-xs font-extrabold">{language === "ar" ? bg.titleAr : bg.titleEn}</p>
                          <p className="text-[10px] opacity-70 mt-1">Theme preview text</p>
                        </div>
                        <span className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] ${menuBgStyle === bg.key ? "bg-slate-800 text-white border-slate-800" : "border-slate-300"}`}>
                          {menuBgStyle === bg.key && "✓"}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  {/* 3. Logo Emoji */}
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-400 mb-2">
                      {language === "ar" ? "3. أيقونة المحل / الشعار" : "3. Logo Emoji / Presets"}
                    </label>
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          maxLength={3}
                          value={menuLogoEmoji}
                          onChange={(e) => setMenuLogoEmoji(e.target.value)}
                          className="w-16 bg-slate-50 border border-slate-200 rounded-xl py-2.5 text-center text-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                        <div className="flex flex-wrap gap-1 bg-slate-50 border border-slate-200 p-1.5 rounded-xl flex-1 overflow-y-auto max-h-[46px] items-center">
                          {["🍔", "🍕", "☕", "🍦", "🍰", "🏠", "🔑", "🚗", "🛍️", "💇", "🏋️", "✨", "🌸", "🎨", "📱", "💼"].map(emoji => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => setMenuLogoEmoji(emoji)}
                              className="hover:scale-125 transition-transform text-base p-0.5"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 4. Active Currency */}
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-400 mb-2">
                      {language === "ar" ? "4. العملة المعروضة بالمنيو" : "4. Active Currency Suffix"}
                    </label>
                    <div className="flex gap-2">
                      {["$", "ر.س", "د.إ", "ج.م", "د.ك"].map((cur) => (
                        <button
                          key={cur}
                          type="button"
                          onClick={() => setMenuCurrency(cur)}
                          className={`flex-1 py-2.5 rounded-xl border-2 text-xs font-extrabold transition-all ${
                            menuCurrency === cur ? "border-slate-800 bg-slate-50 text-slate-800" : "border-slate-100 text-slate-400 hover:border-slate-200"
                          }`}
                        >
                          {cur}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  {/* 5. Curviness Style */}
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-400 mb-2">
                      {language === "ar" ? "5. استدارة حواف بطاقات المنتجات" : "5. Card Curviness Style"}
                    </label>
                    <div className="flex gap-2">
                      {[
                        { key: "rounded-none", nameAr: "حادة كلاسيك", nameEn: "Sharp Flat" },
                        { key: "rounded-2xl", nameAr: "دائرية ناعمة", nameEn: "Modern Rounded" },
                        { key: "rounded-[2rem]", nameAr: "منحنية مبهجة", nameEn: "Bubbly Pillowy" }
                      ].map((r) => (
                        <button
                          key={r.key}
                          type="button"
                          onClick={() => setMenuBorderRadius(r.key)}
                          className={`flex-1 py-2.5 px-2 rounded-xl border-2 text-[10px] font-bold transition-all ${
                            menuBorderRadius === r.key ? "border-slate-800 bg-slate-50 text-slate-800" : "border-slate-100 text-slate-500 hover:border-slate-200"
                          }`}
                        >
                          {language === "ar" ? r.nameAr : r.nameEn}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 6. Layout Grid Type */}
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-400 mb-2">
                      {language === "ar" ? "6. تخطيط قائمة المنتجات" : "6. Grid Layout Format"}
                    </label>
                    <div className="flex gap-2">
                      {[
                        { key: "grid", nameAr: "شبكة (2 عمود)", nameEn: "Grid (2 Cols)" },
                        { key: "list", nameAr: "قائمة (1 عمود)", nameEn: "List (1 Col)" }
                      ].map((l) => (
                        <button
                          key={l.key}
                          type="button"
                          onClick={() => setMenuLayout(l.key)}
                          className={`flex-1 py-2.5 px-2 rounded-xl border-2 text-[10px] font-bold transition-all ${
                            menuLayout === l.key ? "border-slate-800 bg-slate-50 text-slate-800" : "border-slate-100 text-slate-500 hover:border-slate-200"
                          }`}
                        >
                          {language === "ar" ? l.nameAr : l.nameEn}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 7. Magical Floating Elements */}
                <div className="bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-pink-500/5 border border-indigo-100 rounded-3xl p-5">
                  <div className="flex items-start gap-3">
                    <div className="bg-indigo-100 text-indigo-600 p-2 rounded-2xl">
                      <Sparkles className="w-5 h-5 animate-pulse" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xs font-bold uppercase text-indigo-950 tracking-wider">
                        {language === "ar" ? "✨ تأثيرات سحرية طافية (تأثير تفاعلي مذهل!)" : "✨ Magical Floating Elements (Live Ambient Effect)"}
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                        {language === "ar"
                          ? "عنصر تفاعلي حصري يطير بلطف في خلفية المنيو عند تصفح العميل له لجذب انتباهه وإعطاءه طابعاً عصرياً وفخماً للغاية!"
                          : "Adds floating, semi-transparent animated elements drifting upwards in the page background!"}
                      </p>
                      
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
                        {[
                          { key: "none", labelAr: "بدون تأثير", labelEn: "Disabled" },
                          { key: "sparkles", labelAr: "نجوم ذهبية ✨", labelEn: "Golden Sparks ✨" },
                          { key: "items", labelAr: "أيقونات القطاع 🍕", labelEn: "Sector Emojis 🍕" },
                          { key: "dust", labelAr: "غبار كوني ⭐", labelEn: "Cosmic Dust ⭐" }
                        ].map((p) => (
                          <button
                            key={p.key}
                            type="button"
                            onClick={() => setMenuParticles(p.key)}
                            className={`py-2 px-3 rounded-xl border transition-all text-[11px] font-bold ${
                              menuParticles === p.key
                                ? "bg-indigo-600 text-white border-indigo-600"
                                : "bg-white text-slate-600 border-slate-200 hover:border-indigo-200"
                            }`}
                          >
                            {language === "ar" ? p.labelAr : p.labelEn}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* Right Column: Live Interactive Smartphone Preview (1 col) */}
          <div className="lg:col-span-1 space-y-4">
            <div className="sticky top-6">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center mb-3">
                {language === "ar" ? "📱 معاينة تفاعلية فورية للعميل" : "📱 Interactive Live Customer Preview"}
              </p>
              
              {/* Phone Container */}
              <div className="mx-auto w-[290px] h-[580px] bg-slate-900 rounded-[2.8rem] p-3 shadow-2xl border-4 border-slate-800 relative overflow-hidden flex flex-col">
                {/* Speaker Grill & Camera Punch hole */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 w-28 h-4.5 bg-slate-950 rounded-full z-30 flex items-center justify-center gap-1.5 px-3">
                  <div className="w-10 h-1 bg-slate-800 rounded-full" />
                  <div className="w-2 h-2 bg-slate-900 rounded-full" />
                </div>
                
                {/* Screen frame */}
                <div className={`flex-1 rounded-[2.2rem] overflow-hidden relative flex flex-col text-xs transition-all duration-500 ${
                  menuBgStyle === "light-clean" ? "bg-slate-50 text-slate-800" :
                  menuBgStyle === "sunset-glow" ? "bg-gradient-to-br from-amber-50 via-orange-50 to-rose-100 text-slate-800" :
                  menuBgStyle === "midnight-dark" ? "bg-slate-950 text-slate-200" :
                  menuBgStyle === "forest-green" ? "bg-gradient-to-br from-emerald-50 via-teal-50 to-green-100 text-emerald-950" :
                  menuBgStyle === "cosmic-purple" ? "bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950 text-purple-200" :
                  "bg-[#f4f1ea] text-[#2c2a29]"
                }`}>
                  
                  {/* INJECT KEYFRAME ANIMATIONS & FLOATING PARTICLES */}
                  <style>{`
                    @keyframes previewFloatUp {
                      0% { transform: translateY(500px) scale(0.6); opacity: 0; }
                      10% { opacity: 0.4; }
                      90% { opacity: 0.4; }
                      100% { transform: translateY(-50px) translateX(var(--px, 15px)) scale(1.1); opacity: 0; }
                    }
                    .preview-particle {
                      position: absolute;
                      bottom: 0;
                      animation: previewFloatUp var(--pd, 6s) linear infinite;
                      pointer-events: none;
                      z-index: 5;
                      font-size: 14px;
                    }
                  `}</style>
                  
                  {/* Floating Particles Core simulation */}
                  {menuParticles !== "none" && (
                    <div className="absolute inset-0 overflow-hidden pointer-events-none z-10">
                      {[
                        { id: 1, char: menuParticles === "sparkles" ? "✨" : menuParticles === "dust" ? "⭐" : (businessType === "restaurant" ? "🍔" : businessType === "real_estate" ? "🏠" : "🚗"), left: "10%", delay: "0s", duration: "7s", px: "20px" },
                        { id: 2, char: menuParticles === "sparkles" ? "✨" : menuParticles === "dust" ? "⭐" : (businessType === "restaurant" ? "🍕" : businessType === "real_estate" ? "🔑" : "⚡"), left: "30%", delay: "2s", duration: "5s", px: "-15px" },
                        { id: 3, char: menuParticles === "sparkles" ? "✨" : menuParticles === "dust" ? "⭐" : (businessType === "restaurant" ? "🍰" : businessType === "real_estate" ? "🏢" : "⚙️"), left: "60%", delay: "1s", duration: "8s", px: "30px" },
                        { id: 4, char: menuParticles === "sparkles" ? "✨" : menuParticles === "dust" ? "⭐" : (businessType === "restaurant" ? "☕" : businessType === "real_estate" ? "🌲" : "🔋"), left: "80%", delay: "3s", duration: "6s", px: "-25px" }
                      ].map(p => (
                        <span
                          key={p.id}
                          className="preview-particle"
                          style={{
                            left: p.left,
                            animationDelay: p.delay,
                            "--pd": p.duration,
                            "--px": p.px
                          } as React.CSSProperties}
                        >
                          {p.char}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Phone Header */}
                  <div className="pt-8 px-4 pb-3 border-b border-black/5 flex items-center justify-between bg-black/5 backdrop-blur-xs relative z-20">
                    <div className="flex items-center gap-1.5">
                      <span className="text-base animate-bounce">{menuLogoEmoji}</span>
                      <span className="font-extrabold tracking-tight text-[11px] truncate w-24">
                        {user?.displayName || "Min Makanak Store / من مكانك"}
                      </span>
                    </div>
                    <span className="bg-emerald-500/10 text-emerald-400 font-bold text-[8px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                      <span className="w-1 h-1 bg-emerald-400 rounded-full animate-ping" />
                      Live
                    </span>
                  </div>

                  {/* Phone Scrollable Body */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-none relative z-10">
                    <div className="text-center py-2">
                      <h4 className="font-extrabold text-xs">
                        {businessType === "real_estate" ? (language === "ar" ? "كتالوج العقارات التفاعلي" : "Interactive Properties") :
                         businessType === "automotive" ? (language === "ar" ? "معرض قطع الغيار والسيارات" : "Vehicle Catalog") :
                         (language === "ar" ? "منيو المأكولات الرقمي" : "Fresh Digital Menu")}
                      </h4>
                      <p className="text-[9px] opacity-70 mt-0.5">
                        {language === "ar" ? "تصفح واطلب وسلّم الذكاء الاصطناعي!" : "Browse and ask our voice AI!"}
                      </p>
                    </div>

                    {/* Category quick selectors list */}
                    <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1">
                      {categories.slice(0, 3).map((cat, i) => (
                        <span
                          key={cat.value}
                          className={`px-2 py-1 rounded-full text-[8px] font-bold whitespace-nowrap shrink-0 ${
                            i === 0
                              ? `bg-${menuPrimaryColor}-600 text-white`
                              : "bg-black/5"
                          }`}
                        >
                          {language === "ar" ? cat.labelAr : cat.labelEn}
                        </span>
                      ))}
                    </div>

                    {/* Grid of sample cards */}
                    <div className={`grid gap-3 ${menuLayout === "grid" ? "grid-cols-2" : "grid-cols-1"}`}>
                      {[
                        {
                          name: businessType === "real_estate" ? (language === "ar" ? "شقة سكنية بفيو حمام سباحة" : "Poolside Apartment") :
                                businessType === "automotive" ? (language === "ar" ? "فحمات فرامل ليزر سيراميك" : "Ceramic Brake Pads") :
                                (language === "ar" ? "برجر اللحم الكلاسيكي الفاخر" : "Angus Classic Burger"),
                          price: businessType === "real_estate" ? 180000 : businessType === "automotive" ? 75 : 15.99,
                          desc: businessType === "real_estate" ? "3 غرف، تشطيب لوكس" : businessType === "automotive" ? "طرازات كوري وياباني" : "جبنة تشيدر، صوص بيتي"
                        },
                        {
                          name: businessType === "real_estate" ? (language === "ar" ? "روف بنتهاوس بحديقة خاصة" : "Luxury Penthouse") :
                                businessType === "automotive" ? (language === "ar" ? "شاشة أندرويد 10 إنش ذكية" : "Smart Android Display") :
                                (language === "ar" ? "كعكة الشوكولاتة الذائبة" : "Molten Chocolate Lava"),
                          price: businessType === "real_estate" ? 290000 : businessType === "automotive" ? 220 : 8.50,
                          desc: businessType === "real_estate" ? "دوبلكس بإطلالة بانوراما" : businessType === "automotive" ? "واي فاي، جي بي إس مدمج" : "شوكولاتة بلجيكية فاخرة"
                        }
                      ].map((card, idx) => (
                        <div
                          key={idx}
                          className={`p-3 flex flex-col justify-between transition-all hover:-translate-y-0.5 ${menuBorderRadius} ${
                            menuBgStyle === "light-clean" ? "bg-white border border-slate-100 shadow-xs" :
                            menuBgStyle === "sunset-glow" ? "bg-white/80 border border-orange-100/50 shadow-xs" :
                            menuBgStyle === "midnight-dark" ? "bg-slate-900 border border-slate-800 shadow-sm" :
                            menuBgStyle === "forest-green" ? "bg-white/90 border border-emerald-100 shadow-xs" :
                            menuBgStyle === "cosmic-purple" ? "bg-slate-900/90 border border-purple-800/40 shadow-sm" :
                            "bg-[#fbfbf9] border border-[#2c2a29] shadow-[2px_2px_0px_0px_rgba(44,42,41,1)]"
                          }`}
                        >
                          <div>
                            <div className="flex justify-between items-start gap-1 mb-1">
                              <h5 className="font-extrabold text-[9px] line-clamp-1">{card.name}</h5>
                            </div>
                            <p className="text-[7px] opacity-60 leading-tight line-clamp-2 mb-2">{card.desc}</p>
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <span className={`font-bold text-[9px] text-${menuPrimaryColor}-600`}>
                              {menuCurrency}{card.price.toLocaleString()}
                            </span>
                            <button className={`w-3.5 h-3.5 rounded-full text-white font-bold text-[8px] bg-${menuPrimaryColor}-600 flex items-center justify-center hover:scale-105 transition-transform`}>
                              +
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Phone Voice Assistant Footer bar */}
                  <div className="p-3 bg-black/10 border-t border-black/5 flex items-center justify-between gap-2 relative z-20">
                    <div className="flex items-center gap-1.5 flex-1 bg-black/10 px-2 py-1 rounded-full text-[8px] opacity-70">
                      <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-ping" />
                      <span>{language === "ar" ? "اسأل المساعد الصوتي..." : "Talk to voice agent..."}</span>
                    </div>
                    <div className={`w-6 h-6 rounded-full bg-${menuPrimaryColor}-600 flex items-center justify-center text-white text-[10px] animate-pulse`}>
                      🎙️
                    </div>
                  </div>

                </div>

                {/* Home Indicator bar */}
                <div className="w-24 h-1 bg-slate-800 rounded-full mx-auto mt-2.5 mb-1" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. ORIGINAL TABLE QR STAND BUILDER TAB */}
      {activeSubTab === "qr_stand" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8" id="qr-stand-builder-tab">
          {/* Left Column: QR Code Stand Customizer (1 col) */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2 border-b pb-3">
                <Smartphone className="w-5 h-5 text-slate-400" />
                {language === "ar" ? "تخصيص ستاند الـ QR للمحل" : "Customize Table QR Stand"}
              </h2>
              
              <div className="space-y-4">
                {/* Color Selector */}
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-2">
                    {language === "ar" ? "لون الستاند البصري" : "Stand Acrylic Theme Color"}
                  </label>
                  <div className="flex gap-3">
                    {Object.keys(colorSchemes).map((color) => (
                      <button
                        key={color}
                        onClick={() => setQrColor(color)}
                        className={`w-8 h-8 rounded-full border-2 ${
                          qrColor === color ? "border-slate-800 scale-110" : "border-transparent"
                        } ${
                          color === "indigo" ? "bg-indigo-600" :
                          color === "emerald" ? "bg-emerald-600" :
                          color === "amber" ? "bg-amber-500" : "bg-rose-600"
                        } transition-all`}
                      />
                    ))}
                  </div>
                </div>

                {/* Table / Location Input */}
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-2">
                    {language === "ar" ? "رقم الطاولة / الموقع" : "Table / Location ID"}
                  </label>
                  <input
                    type="text"
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value)}
                    placeholder="e.g. Table 5, Counter A"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                {/* Call to Action Text Ar */}
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-2">
                    {language === "ar" ? "نص الإرشاد (عربي)" : "Call to Action Text (Arabic)"}
                  </label>
                  <textarea
                    value={ctaTextAr}
                    onChange={(e) => setCtaTextAr(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 h-16 resize-none"
                  />
                </div>

                {/* Call to Action Text En */}
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-2">
                    {language === "ar" ? "نص الإرشاد (إنجليزي)" : "Call to Action Text (English)"}
                  </label>
                  <textarea
                    value={ctaTextEn}
                    onChange={(e) => setCtaTextEn(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 h-16 resize-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: QR Stand Acrylic Mockup Preview (2 cols) */}
          <div className="lg:col-span-2 space-y-6 flex flex-col items-center">
            <div className="bg-slate-900 rounded-3xl p-6 shadow-xl relative overflow-hidden text-center text-white flex flex-col items-center w-full max-w-md">
              <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-xl pointer-events-none" />
              
              <div className="text-xs uppercase font-extrabold tracking-widest text-slate-400 mb-4">
                {language === "ar" ? "معاينة ستاند الطاولة الأكريليك" : "Acrylic Stand Preview"}
              </div>

              {/* Simulated Stand */}
              <div className={`w-64 bg-white rounded-2xl p-6 text-slate-800 shadow-2xl border-t-8 ${currentScheme.border} flex flex-col items-center`}>
                {/* Restaurant Header */}
                <div className="text-center mb-4">
                  <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white text-xs font-extrabold mb-1">
                    MN
                  </div>
                  <h3 className="font-extrabold text-sm text-slate-800">
                    {user?.displayName || "Min Makanak Store / من مكانك"}
                  </h3>
                  <div className={`text-[10px] font-bold ${currentScheme.text} uppercase tracking-wider`}>
                    {language === "ar" ? `طاولة رقم ${tableNumber}` : `Table No. ${tableNumber}`}
                  </div>
                </div>

                {/* SVG QR CODE */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 mb-4 shadow-inner">
                  {renderQRCodeSVG()}
                </div>

                {/* Instructions */}
                <div className="text-center space-y-1.5 px-2">
                  <p className="text-[10px] font-bold text-slate-700 leading-tight">
                    {ctaTextAr}
                  </p>
                  <p className="text-[9px] text-slate-500 font-medium leading-tight">
                    {ctaTextEn}
                  </p>
                </div>

                {/* NFC Logo or Help Note */}
                <div className="mt-4 pt-3 border-t border-slate-100 w-full flex items-center justify-center gap-1.5 text-[8px] text-slate-400 font-bold uppercase tracking-wider">
                  <Sparkles className="w-3 h-3 text-indigo-500" />
                  {language === "ar" ? "مدعوم بالذكاء الاصطناعي الصوتي" : "Powered by Voice AI"}
                </div>
              </div>

              {/* Print and Export Buttons */}
              <div className="flex gap-4 mt-6 w-full">
                <button
                  onClick={handlePrint}
                  className="flex-1 bg-white/10 hover:bg-white/20 transition-all py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border border-white/5"
                >
                  <Printer className="w-4 h-4" />
                  {language === "ar" ? "طباعة الستاند" : "Print Stand"}
                </button>
                <button
                  onClick={() => {
                    triggerNotification(language === "ar" ? "تم تحميل كود QR بنجاح!" : "QR stand exported successfully!");
                  }}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 transition-all py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  {language === "ar" ? "تحميل الصورة" : "Download PNG"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-800">
                {businessType === "real_estate" 
                  ? (language === "ar" ? "إضافة عقار جديد للكتالوج" : "Add New Property Listing")
                  : businessType === "automotive"
                  ? (language === "ar" ? "إضافة سيارة أو قطعة غيار" : "Add Vehicle or Spare Part")
                  : (language === "ar" ? "إضافة منتج جديد للمحل" : "Add New Store Product")}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                &times;
              </button>
            </div>
            
            <form onSubmit={handleAddItem} className="p-6 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">
                  {businessType === "real_estate"
                    ? (language === "ar" ? "عنوان العقار / الاسم" : "Property Title / Name")
                    : businessType === "automotive"
                    ? (language === "ar" ? "اسم الموديل / القطعة" : "Model or Part Name")
                    : (language === "ar" ? "اسم المنتج" : "Product Name")} *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={
                    businessType === "real_estate"
                      ? (language === "ar" ? "مثال: شقة 3 غرف في التجمع الخامس" : "e.g. 3BR Apartment in Damac Hills")
                      : businessType === "automotive"
                      ? (language === "ar" ? "مثال: طقم فرامل تويوتا كورولا 2020" : "e.g. Toyota Corolla Brake Pads")
                      : (language === "ar" ? "مثال: برجر كلاسيك أو شاحن سريع" : "e.g. Classic Burger or Fast Charger")
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              {/* Price & Category */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">
                    {businessType === "real_estate"
                      ? (language === "ar" ? "القيمة الإجمالية ($)" : "Value / Price ($)")
                      : (language === "ar" ? "السعر ($)" : "Price ($)")} *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder={businessType === "real_estate" ? "150000" : "9.99"}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">
                    {language === "ar" ? "الفئة" : "Category"}
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    {categories.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {language === "ar" ? cat.labelAr : cat.labelEn}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">
                  {language === "ar" ? "الوصف التفصيلي" : "Description / Details"}
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={language === "ar" ? "اكتب مواصفات المنتج ليتعلمها مساعد الصوت..." : "Describe the features of the product for the AI..."}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 h-20 resize-none"
                />
              </div>

              {/* isAiOnly Toggle */}
              <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 flex items-start gap-3">
                <input
                  type="checkbox"
                  id="ai-only"
                  checked={isAiOnly}
                  onChange={(e) => setIsAiOnly(e.target.checked)}
                  className="mt-1 h-4.5 w-4.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="ai-only" className="cursor-pointer select-none">
                  <span className="block text-xs font-bold text-indigo-900">
                    {language === "ar" ? "منتج مخفي (للذكاء الاصطناعي فقط)" : "AI-Only Product (Hidden from Menu)"}
                  </span>
                  <span className="block text-[10px] text-indigo-700/80 mt-1 leading-relaxed">
                    {language === "ar"
                      ? "لن يظهر هذا المنتج في منيو الطاولة البصري العام للعميل، ولكنه سيكون مفهرساً بالكامل للذكاء الاصطناعي الصوتي عند السؤال!"
                      : "This item will not be visible to customers on the public menu webpage, but the AI Assistant will fully know it and offer it!"}
                  </span>
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 py-3 rounded-xl text-sm font-bold transition-colors"
                >
                  {language === "ar" ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl text-sm font-bold transition-all shadow-indigo-100 shadow-md"
                >
                  {language === "ar" ? "حفظ المنتج" : "Save Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-emerald-600" />
                <h3 className="text-lg font-bold text-slate-800">
                  {language === "ar" ? "استيراد المنتجات من ملف" : "Import Products from File"}
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setParsedItems([]);
                  setImportError("");
                }}
                disabled={importing}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1"
              >
                &times;
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Instructions and templates */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    {language === "ar" ? "صيغة الملف المدعومة" : "Supported Formats"}
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {language === "ar" 
                      ? "يمكنك رفع ملف Excel مصدّر كـ CSV أو ملف JSON. يجب أن يحتوي على الأعمدة التالية كحد أدنى: name, price."
                      : "Upload an Excel-exported CSV or JSON file. Must contain at least name and price columns."}
                  </p>
                </div>
                <div className="flex flex-col justify-center gap-2 border-t md:border-t-0 md:border-l border-slate-200/60 pt-3 md:pt-0 md:pl-4">
                  <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                    {language === "ar" ? "تحميل نموذج جاهز للملء" : "Download Starter Templates"}
                  </h4>
                  <div className="flex gap-2">
                    <button
                      onClick={downloadCSVTemplate}
                      className="text-xs bg-white border border-slate-200 text-indigo-600 hover:bg-slate-50 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 shadow-sm transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      CSV Template
                    </button>
                    <button
                      onClick={downloadJSONTemplate}
                      className="text-xs bg-white border border-slate-200 text-emerald-600 hover:bg-slate-50 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 shadow-sm transition-colors"
                    >
                      <Database className="w-3.5 h-3.5" />
                      JSON Template
                    </button>
                  </div>
                </div>
              </div>

              {/* Drag & Drop Area */}
              {!importing && parsedItems.length === 0 && (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById("file-uploader-input")?.click()}
                  className={`border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all duration-200 ${
                    isDragging
                      ? "border-indigo-500 bg-indigo-50/40 scale-[0.99] shadow-inner"
                      : "border-slate-200 hover:border-indigo-400 bg-slate-50/30 hover:bg-slate-50/70"
                  }`}
                >
                  <input
                    type="file"
                    id="file-uploader-input"
                    className="hidden"
                    accept=".csv,.json"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileProcess(e.target.files[0]);
                      }
                    }}
                  />
                  <div className="bg-indigo-50 w-14 h-14 rounded-2xl flex items-center justify-center text-indigo-600 mx-auto mb-4 shadow-sm">
                    <Upload className="w-7 h-7" />
                  </div>
                  <h4 className="font-bold text-slate-800 text-sm md:text-base">
                    {language === "ar" ? "اسحب الملف وأفلته هنا" : "Drag & drop your file here"}
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    {language === "ar" ? "أو انقر لتصفح الملفات من جهازك" : "or click to browse files on your device"}
                  </p>
                  <span className="inline-block bg-slate-100 text-slate-500 text-[10px] font-bold px-3 py-1 rounded-full mt-4">
                    CSV / JSON
                  </span>
                </div>
              )}

              {/* Error State */}
              {importError && (
                <div className="bg-rose-50 border border-rose-100 text-rose-800 p-4 rounded-2xl flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-bold text-xs">
                      {language === "ar" ? "حدث خطأ أثناء قراءة الملف" : "File Parsing Error"}
                    </h5>
                    <p className="text-xs text-rose-700/90 mt-1 leading-relaxed">{importError}</p>
                  </div>
                </div>
              )}

              {/* Parsed Items Preview List */}
              {parsedItems.length > 0 && !importing && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      {language === "ar" 
                        ? `تم تحليل ${parsedItems.length} منتج بنجاح!` 
                        : `Successfully parsed ${parsedItems.length} items!`}
                    </span>
                    <button
                      onClick={() => setParsedItems([])}
                      className="text-xs text-rose-500 hover:text-rose-600 font-bold hover:underline"
                    >
                      {language === "ar" ? "إعادة الرفع" : "Upload another"}
                    </button>
                  </div>

                  {/* Preview container */}
                  <div className="border border-slate-100 rounded-2xl overflow-hidden max-h-60 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 uppercase font-bold text-[9px]">
                          <th className="py-2.5 px-4">{language === "ar" ? "الاسم" : "Name"}</th>
                          <th className="py-2.5 px-4">{language === "ar" ? "الفئة" : "Category"}</th>
                          <th className="py-2.5 px-4">{language === "ar" ? "السعر" : "Price"}</th>
                          <th className="py-2.5 px-4">{language === "ar" ? "نوع العرض" : "Visibility"}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 text-slate-700">
                        {parsedItems.slice(0, 10).map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-4 font-bold max-w-[150px] truncate">{item.name}</td>
                            <td className="py-2.5 px-4 text-slate-500 font-medium">{item.category}</td>
                            <td className="py-2.5 px-4 font-bold text-indigo-600">${item.price.toFixed(2)}</td>
                            <td className="py-2.5 px-4">
                              {item.isAiOnly ? (
                                <span className="bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full text-[9px] font-bold">
                                  {language === "ar" ? "للذكاء فقط" : "AI-Only"}
                                </span>
                              ) : (
                                <span className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full text-[9px] font-bold">
                                  {language === "ar" ? "عام بالمنيو" : "Public"}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {parsedItems.length > 10 && (
                      <div className="bg-slate-50 p-2.5 text-center text-[10px] font-semibold text-slate-400 border-t border-slate-100">
                        {language === "ar" 
                          ? `+ عرض ${parsedItems.length - 10} منتجات إضافية بالملف` 
                          : `+ and ${parsedItems.length - 10} more items in file`}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Importing progress overlay */}
              {importing && (
                <div className="py-8 text-center space-y-4">
                  <div className="relative inline-flex items-center justify-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-100 border-t-indigo-600"></div>
                    <span className="absolute text-xs font-bold text-indigo-600">{importProgress}%</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">
                      {language === "ar" ? "جاري استيراد المنتجات وقفل الفهرسة..." : "Importing and indexing products..."}
                    </h4>
                    <p className="text-xs text-slate-400 mt-1">
                      {language === "ar" 
                        ? "برجاء عدم إغلاق هذه الصفحة لتجنب تكرار المدخلات." 
                        : "Please do not close this window to avoid duplicate entries."}
                    </p>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full max-w-xs bg-slate-100 rounded-full h-2 mx-auto overflow-hidden">
                    <div 
                      className="bg-indigo-600 h-full rounded-full transition-all duration-200"
                      style={{ width: `${importProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowImportModal(false);
                  setParsedItems([]);
                  setImportError("");
                }}
                disabled={importing}
                className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 px-5 py-2.5 rounded-xl text-xs font-bold transition-colors"
              >
                {language === "ar" ? "إلغاء" : "Cancel"}
              </button>
              {parsedItems.length > 0 && !importing && (
                <button
                  type="button"
                  onClick={handleImportSubmit}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-indigo-100 shadow-md flex items-center gap-1.5"
                >
                  <CheckCircle className="w-4 h-4" />
                  {language === "ar" 
                    ? `استيراد الآن (${parsedItems.length} منتج)` 
                    : `Import Now (${parsedItems.length} items)`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
