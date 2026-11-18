import React, { useState, useEffect } from "react";
import {
  QrCode,
  Plus,
  Trash2,
  Sparkles,
  Eye,
  EyeOff,
  Database,
  Info,
  CheckCircle,
  Upload,
  FileText,
  X,
  AlertCircle,
} from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";
import { useAuth } from "../contexts/AuthContext";
import { useSettings } from "../contexts/SettingsContext";
import { getSupabase, getSupabaseConfig } from "../lib/supabase";
import { CURRENCY_LIST, normalizeCurrency, formatPrice, type CurrencyCode } from "../lib/currency";
import { useStoreSettings } from "../lib/storeSettings";
import { ModifierManager } from "../components/ModifierManager";
import {
  MenuCategory,
  loadLocalCategories,
  saveLocalCategories,
  fetchCategoriesRemote,
  saveCategoriesRemote,
  makeCategoryId,
  DEFAULT_CATEGORIES,
} from "../lib/menuCategories";


// Local-first persistence helpers for demo mode
const getLocalCollection = (collectionName: string, ownerId?: string) => {
  const key = ownerId ? `local_${collectionName}_${ownerId}` : `local_${collectionName}`;
  return JSON.parse(localStorage.getItem(key) || '[]');
};

const setLocalCollection = (collectionName: string, data: any[], ownerId?: string) => {
  const key = ownerId ? `local_${collectionName}_${ownerId}` : `local_${collectionName}`;
  localStorage.setItem(key, JSON.stringify(data));
};

const addLocalDoc = (collectionName: string, doc: any, ownerId?: string) => {
  const items = getLocalCollection(collectionName, ownerId);
  items.push(doc);
  setLocalCollection(collectionName, items, ownerId);
  return doc;
};

const updateLocalDoc = (collectionName: string, docId: string, updates: any, ownerId?: string) => {
  const items = getLocalCollection(collectionName, ownerId);
  const idx = items.findIndex((d: any) => d.id === docId);
  if (idx >= 0) {
    items[idx] = { ...items[idx], ...updates };
    setLocalCollection(collectionName, items, ownerId);
    return items[idx];
  }
  return null;
};

const deleteLocalDoc = (collectionName: string, docId: string, ownerId?: string) => {
  const items = getLocalCollection(collectionName, ownerId);
  const filtered = items.filter((d: any) => d.id !== docId);
  setLocalCollection(collectionName, filtered, ownerId);
};



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
  const { businessType, currency, setCurrency } = useSettings();
  const { settings: storeSettings } = useStoreSettings(user?.uid, user?.provider !== 'local');
  const isSupabaseMode = user?.provider !== 'local' && getSupabaseConfig().isConfigured;
  
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

  // Default category for restaurants
  useEffect(() => {
    setCategory("Main Course");
  }, []);

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
      else itemCat = itemCat.trim();
      
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
        else cat = String(cat).trim();

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

  // Import the complete validated batch into the same source used by normal menu edits.
  const handleImportSubmit = async () => {
    if (!user || parsedItems.length === 0 || importing) return;
    setImporting(true);
    setImportProgress(0);
    setImportError("");

    try {
      const importedCategoryMap = new Map<string, string>();
      const newCategories: MenuCategory[] = [];
      for (const item of parsedItems) {
        const raw = String(item.category || categories[0]?.id || "Main Course").trim();
        const key = raw.toLowerCase();
        if (importedCategoryMap.has(key)) continue;
        const match = categories.find((c) =>
          c.id.toLowerCase() === key ||
          c.labelAr.trim().toLowerCase() === key ||
          c.labelEn.trim().toLowerCase() === key
        );
        if (match) {
          importedCategoryMap.set(key, match.id);
        } else {
          const id = makeCategoryId(raw, raw);
          importedCategoryMap.set(key, id);
          if (!categories.some((c) => c.id === id) && !newCategories.some((c) => c.id === id)) {
            newCategories.push({ id, labelAr: raw, labelEn: raw, emoji: "", order: categories.length + newCategories.length });
          }
        }
      }

      const importedItems: MenuItem[] = parsedItems.map((item, index) => ({
        id: "item_imported_" + crypto.randomUUID(),
        ownerId: user.uid,
        name: String(item.name).trim(),
        price: Number(item.price),
        description: String(item.description || ""),
        category: importedCategoryMap.get(String(item.category || categories[0]?.id || "Main Course").trim().toLowerCase()) || categories[0]?.id || "Main Course",
        isAiOnly: Boolean(item.isAiOnly),
        createdAt: Date.now() - (index * 1000),
      }));

      if (importedItems.some((item) => !item.name || !Number.isFinite(item.price) || item.price <= 0)) {
        throw new Error(language === "ar" ? "يوجد منتج باسم أو سعر غير صالح." : "The import contains an invalid product name or price.");
      }

      if (user.provider === "local") {
        const existing = getLocalCollection("menu_items", user.uid);
        setLocalCollection("menu_items", [...existing, ...importedItems], user.uid);
      } else {
        const supabase = getSupabase();
        if (!isSupabaseMode || !supabase) {
          throw new Error(language === "ar" ? "قاعدة البيانات غير متاحة؛ لم يتم حفظ أي منتج." : "Database is unavailable; no products were saved.");
        }
        const { error } = await supabase.from("menu_items").insert(importedItems);
        if (error) throw error;
      }

      if (newCategories.length) {
        setCategories((current) => [...current, ...newCategories].map((cat, index) => ({ ...cat, order: index })));
      }
      setItems((current) => [...importedItems, ...current].sort((a, b) => b.createdAt - a.createdAt));
      setImportProgress(100);
      setShowImportModal(false);
      setParsedItems([]);
      triggerNotification(
        language === "ar"
          ? `تم حفظ واستيراد ${importedItems.length} منتج بنجاح إلى المنيو!`
          : `Successfully saved ${importedItems.length} products to your catalog!`
      );
    } catch (err) {
      console.error("Error importing menu items:", err);
      setImportError(err instanceof Error ? err.message : (language === "ar" ? "فشل استيراد المنتجات. لم يتم تأكيد الحفظ." : "Import failed. Product persistence was not confirmed."));
    } finally {
      setImporting(false);
    }
  };

  // Template generators
  const downloadCSVTemplate = () => {
    const csvContent = "name,price,category,description,isAiOnly\n" +
      "Double Angus Cheeseburger,14.50,Main Course,Flame-grilled prime beef patty with cheddar cheese and brioche bun,false\n" +
      "San Sebastian Cheesecake,6.50,Desserts,Rich molten Basque cheesecake with warm chocolate ganache,false\n" +
      "Iced Spanish Latte,5.00,Drinks,Specialty double espresso pulled over sweet milk and crushed ice,false\n" +
      "Chef Secret Wagyu Truffle Sliders,18.00,Secret Menu,Off-menu special sliders with black truffle butter (Voice AI Exclusive),true";
      
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "restaurant_menu_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadJSONTemplate = () => {
    const jsonContent = JSON.stringify([
      {
        name: "Double Angus Cheeseburger",
        price: 14.50,
        category: "Main Course",
        description: "Flame-grilled prime beef patty with cheddar cheese and brioche bun",
        isAiOnly: false
      },
      {
        name: "Chef Secret Wagyu Truffle Sliders",
        price: 18.00,
        category: "Secret Menu",
        description: "Off-menu special sliders with black truffle butter (Voice AI Exclusive)",
        isAiOnly: true
      }
    ], null, 2);

    const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "restaurant_menu_template.json");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Categories dedicated for Restaurant & Cafes
  // ============ Categories (dynamic, per-merchant) ============
  const [categories, setCategories] = useState<MenuCategory[]>(() =>
    loadLocalCategories(user?.uid)
  );

  // Keep the add-product form aligned with the merchant's first real category.
  useEffect(() => {
    if (!categories.some((c) => c.id === category)) {
      setCategory(categories[0]?.id || "Main Course");
    }
  }, [categories, category]);

  // Load on mount + when user changes
  useEffect(() => {
    if (!user) return;
    // 1. Instant local paint
    const local = loadLocalCategories(user.uid);
    setCategories(local);
    // 2. Cloud copy wins when reachable
    if (user.provider !== 'local') {
      fetchCategoriesRemote(user.uid).then((remote) => {
        if (remote && remote.length > 0) {
          setCategories(remote);
          saveLocalCategories(user.uid, remote);
        }
      });
    }
  }, [user]);

  // Persist on change (debounced for remote)
  useEffect(() => {
    if (!user) return;
    saveLocalCategories(user.uid, categories);
    if (user.provider === 'local') return;
    const t = setTimeout(() => {
      void saveCategoriesRemote(user.uid, categories);
    }, 600);
    return () => clearTimeout(t);
  }, [categories, user]);

  // Add a new category
  const addCategory = (labelAr: string, labelEn: string, emoji?: string) => {
    const id = makeCategoryId(labelAr, labelEn);
    // Avoid duplicate ids
    if (categories.some((c) => c.id === id)) return;
    const newCat: MenuCategory = {
      id,
      labelAr: labelAr.trim() || labelEn.trim(),
      labelEn: labelEn.trim() || labelAr.trim(),
      emoji: (emoji || '').trim(),
      order: categories.length,
    };
    setCategories((prev) => [...prev, newCat]);
  };

  // Update an existing category (id is stable; only labels/emoji change)
  const updateCategory = (id: string, patch: Partial<Omit<MenuCategory, 'id'>>) => {
    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...patch } : c))
    );
  };

  // Reassign products before deleting a category so no item is left with an orphan category id.
  const deleteCategory = async (id: string) => {
    if (categories.length <= 1) {
      triggerNotification(language === "ar" ? "يجب الاحتفاظ بقسم واحد على الأقل." : "Keep at least one category.");
      return;
    }
    const remaining = categories.filter((c) => c.id !== id);
    const replacement = remaining[0];
    const affected = items.filter((item) => item.category === id);
    try {
      if (affected.length && user?.provider === "local") {
        const nextItems = items.map((item) => item.category === id ? { ...item, category: replacement.id } : item);
        setLocalCollection("menu_items", nextItems, user.uid);
        setItems(nextItems);
      } else if (affected.length) {
        const supabase = getSupabase();
        if (!isSupabaseMode || !supabase || !user) throw new Error(language === "ar" ? "قاعدة البيانات غير متاحة؛ لم يتم حذف القسم." : "Database unavailable; category was not deleted.");
        const { error } = await supabase.from("menu_items")
          .update({ category: replacement.id })
          .eq("ownerId", user.uid)
          .eq("category", id);
        if (error) throw error;
        setItems((current) => current.map((item) => item.category === id ? { ...item, category: replacement.id } : item));
      }
      setCategories(remaining.map((cat, index) => ({ ...cat, order: index })));
      if (category === id) setCategory(replacement.id);
    } catch (error) {
      triggerNotification(error instanceof Error ? error.message : (language === "ar" ? "تعذر حذف القسم." : "Could not delete category."));
    }
  };

  // Move a category up or down in the display order
  const moveCategory = (id: string, direction: -1 | 1) => {
    setCategories((prev) => {
      const idx = prev.findIndex((c) => c.id === id);
      if (idx === -1) return prev;
      const newIdx = idx + direction;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(idx, 1);
      next.splice(newIdx, 0, item);
      // Re-number the order field to match the new sequence
      return next.map((c, i) => ({ ...c, order: i }));
    });
  };

  // Reset to the default list (offered as a one-click button)
  const resetCategories = () => {
    if (!confirm(language === 'ar' ? 'استعادة الفئات الافتراضية؟ سيتم فقد أي تعديلات.' : 'Reset to default categories? Any edits will be lost.')) return;
    setCategories([...DEFAULT_CATEGORIES]);
  };

  useEffect(() => {
    if (!user) return;
    if (user.provider === 'local') {
      const localItems = getLocalCollection('menu_items', user.uid);
      setItems(localItems);
      setLoading(false);
      return;
    }

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
          setItems([]);
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
    }
  }, [user]);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedPrice = Number.parseFloat(price);
    if (!user || !name.trim() || !Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setNotification(language === "ar" ? "أدخل اسم المنتج وسعراً صحيحاً أكبر من صفر." : "Enter a product name and a valid price greater than zero.");
      return;
    }

    const defaultCat = categories[0]?.id || "Main Course";
    const itemId = "item_" + Math.random().toString(36).substring(2, 11);
    
    const newItem: MenuItem = {
      id: itemId,
      ownerId: user.uid,
      name,
      price: parsedPrice,
      description,
      category: category || defaultCat,
      isAiOnly,
      createdAt: Date.now()
    };

    try {
      if (user.provider === 'local') {
        addLocalDoc('menu_items', newItem, user.uid);
        setItems((prev: MenuItem[]) => [newItem, ...prev].sort((a, b) => b.createdAt - a.createdAt));
      } else {
        const { isConfigured } = getSupabaseConfig();
        const supabase = getSupabase();
        
        if (!isConfigured || !supabase) {
          throw new Error("Supabase is not configured");
        }

        const { error } = await supabase
          .from('menu_items')
          .insert([newItem]);

        if (error) throw error;

        setItems((prev: MenuItem[]) => [newItem, ...prev].sort((a, b) => b.createdAt - a.createdAt));
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
      console.error("[v0] Error adding menu item:", err);
      setNotification(
        language === "ar"
          ? "لم يتم حفظ المنتج. تأكد من اتصال Supabase وصلاحية الحساب ثم حاول مرة أخرى."
          : "The product was not saved. Check the Supabase connection and account permissions, then try again."
      );
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!user || !window.confirm(language === "ar" ? "هل أنت متأكد من حذف المنتج؟" : "Are you sure you want to delete this item?")) return;

    try {
      if (user.provider === "local") {
        deleteLocalDoc("menu_items", itemId, user.uid);
      } else {
        const supabase = getSupabase();
        if (!isSupabaseMode || !supabase) {
          throw new Error(language === "ar" ? "قاعدة البيانات غير متاحة؛ لم يتم حذف المنتج." : "Database unavailable; the item was not deleted.");
        }
        const { data, error } = await supabase
          .from("menu_items")
          .delete()
          .eq("id", itemId)
          .eq("ownerId", user.uid)
          .select("id")
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error(language === "ar" ? "المنتج غير موجود أو لا تملك صلاحية حذفه." : "Item not found or you are not allowed to delete it.");
      }

      setItems((current) => current.filter((item) => item.id !== itemId));
      triggerNotification(language === "ar" ? "تم حذف المنتج بنجاح!" : "Product deleted successfully!");
    } catch (err) {
      console.error("Error deleting menu item:", err);
      setNotification(err instanceof Error ? err.message : (language === "ar" ? "فشل حذف المنتج." : "Could not delete the item."));
    }
  };

  // Starter AI-only catalog seeder (adds a small honest demo set for testing)
  const handleBulkAISeeding = async () => {
    if (!user) return;
    if (!window.confirm(
      language === "ar"
        ? "سيتم إضافة 15 منتجًا تجريبيًا مخفيًا للذكاء الاصطناعي. يمكنك حذفها لاحقًا. هل تريد المتابعة؟"
        : "Add 15 sample AI-only products to this menu? You can delete them later."
    )) return;

    setLoading(true);
    try {
      const samplePrefixes = ["Signature Gourmet", "Artisan Chef", "La Piazza", "Smoky Kitchen", "Organic Blend"];
      const parts = [
        { name: "Truffle Mushroom Angus Burger / برجر المشروم والترافل الفاخر", price: 16, category: "Main Course", desc: "Prime Black Angus beef, melted Swiss cheese, caramelized onions & authentic black truffle sauce." },
        { name: "Buffalo Crispy Wings / أجنحة دجاج بافلو مقرمشة", price: 11, category: "Appetizers", desc: "Crispy wings glazed in spicy buffalo sauce, served with cool ranch dip." },
        { name: "Double Chocolate Fudge Lava Cake / كيكة شوكولاتة دبل فدج لافا", price: 8, category: "Desserts", desc: "Indulgent warm chocolate cake with a rich molten center, topped with vanilla ice cream." },
        { name: "Pistachio Milkshake / ميلك شيك فستق حلبي فاخر", price: 7, category: "Drinks", desc: "Rich ice cream milkshake blended with organic Greek pistachios." },
        { name: "Avocado Mozzarella Salad / سلطة أفوكادو بالموزاريلا", price: 12, category: "Appetizers", desc: "Fresh organic avocado slices with buffalo mozzarella and cherry tomatoes." },
        { name: "Wood-Fired Pepperoni Pizza / بيتزا بيبيروني حطب", price: 18, category: "Main Course", desc: "Authentic Neapolitan sourdough topped with spicy pepperoni and hot honey drizzle." },
        { name: "Organic Iced Matcha Latte / ماتشا لاتيه مثلج عضوي", price: 6, category: "Drinks", desc: "Ceremonial grade matcha whisked with organic oat milk over ice." },
        { name: "Chef Wagyu Secret Truffle Slider / سلايدر واغيو الشيف السري", price: 21, category: "Secret Menu", desc: "Off-menu gourmet slider with black truffle cream and caramelized glaze (AI exclusive)." }
      ];

      const seededItems: MenuItem[] = Array.from({ length: 15 }, (_, index) => {
        const prefix = samplePrefixes[index % samplePrefixes.length];
        const part = parts[index % parts.length];
        return {
          id: `bulk_item_${crypto.randomUUID()}`,
          ownerId: user.uid,
          name: `${prefix} ${part.name}`,
          price: part.price + (index * 2),
          description: `Special listing from ${prefix}. ${part.desc}`,
          category: part.category,
          isAiOnly: true,
          createdAt: Date.now() - (index * 60000),
        };
      });

      if (user.provider === "local") {
        const existing = getLocalCollection("menu_items", user.uid);
        setLocalCollection("menu_items", [...seededItems, ...existing], user.uid);
      } else {
        const supabase = getSupabase();
        if (!isSupabaseMode || !supabase) {
          throw new Error(language === "ar" ? "قاعدة البيانات غير متاحة؛ لم تتم إضافة المنتجات." : "Database unavailable; no sample products were added.");
        }
        const { error } = await supabase.from("menu_items").insert(seededItems);
        if (error) throw error;
      }

      setItems((current) => [...seededItems, ...current].sort((a, b) => b.createdAt - a.createdAt));
      triggerNotification(language === "ar" ? "تم حفظ 15 منتجًا تجريبيًا بنجاح!" : "15 sample products saved successfully!");
    } catch (err) {
      console.error("Bulk seeding error:", err);
      setNotification(err instanceof Error ? err.message : (language === "ar" ? "فشل حفظ المنتجات التجريبية." : "Could not save sample products."));
    } finally {
      setLoading(false);
    }
  };

  const triggerNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(""), 3500);
  };


  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto font-sans">
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
              ? "أنشئ قائمتك الرقمية، صمّم مظهرها، وأنشئ أكواد QR لكل طاولة."
              : "Build your digital menu, design its look, and generate QR codes for each table."}
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {user?.provider === 'local' && (
            <button
              onClick={handleBulkAISeeding}
              className="flex items-center gap-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors px-4 py-2.5 rounded-xl font-bold text-sm"
            >
              <Sparkles className="w-4 h-4" />
              {language === "ar" ? "إضافة منتجات تجريبية (15 منتج)" : "Add sample catalog (15 items)"}
            </button>
          )}

          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors px-4 py-2.5 rounded-xl font-bold text-sm shadow-sm hover:-translate-y-0.5 transform"
          >
            <Upload className="w-4 h-4" />
            {language === "ar" ? "استيراد ملف (CSV/JSON)" : "Import file (CSV/JSON)"}
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

      {/* ============ Categories manager ============ */}
      <div className="mb-8 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Database className="w-4 h-4 text-indigo-500" />
              {language === "ar" ? "فئات المنيو" : "Menu categories"}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {language === "ar"
                ? "أضِف أو عدّل أو احذف فئاتك. تظهر هذه الفئات في المنيو وفي فلتر الضيف."
                : "Add, edit, or delete your categories. They appear in the menu and the guest filter."}
            </p>
          </div>
          <button
            onClick={resetCategories}
            className="text-xs font-bold text-slate-400 hover:text-slate-700 transition-colors"
          >
            {language === "ar" ? "استعادة الافتراضي" : "Reset to default"}
          </button>
        </div>

        {/* Existing categories list */}
        <ul className="space-y-2">
          {categories.map((cat, idx) => (
            <li
              key={cat.id}
              className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-xl border border-slate-100 bg-slate-50/40"
            >
              {/* Reorder arrows */}
              <div className="flex flex-row sm:flex-col gap-1">
                <button
                  onClick={() => moveCategory(cat.id, -1)}
                  disabled={idx === 0}
                  className="min-h-9 min-w-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title={language === "ar" ? "أعلى" : "Move up"}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="18 15 12 9 6 15" />
                  </svg>
                </button>
                <button
                  onClick={() => moveCategory(cat.id, 1)}
                  disabled={idx === categories.length - 1}
                  className="min-h-9 min-w-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title={language === "ar" ? "أسفل" : "Move down"}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
              </div>

              {/* Emoji */}
              <input
                type="text"
                value={cat.emoji || ''}
                onChange={(e) => updateCategory(cat.id, { emoji: e.target.value.slice(0, 3) })}
                placeholder="🍽️"
                className="w-12 text-center text-base font-bold bg-white border border-slate-200 rounded-lg px-1 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />

              {/* Arabic label */}
              <input
                type="text"
                value={cat.labelAr}
                onChange={(e) => updateCategory(cat.id, { labelAr: e.target.value })}
                placeholder={language === "ar" ? "الاسم بالعربي" : "Arabic label"}
                className="w-full sm:flex-1 min-w-0 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />

              {/* English label */}
              <input
                type="text"
                value={cat.labelEn}
                onChange={(e) => updateCategory(cat.id, { labelEn: e.target.value })}
                placeholder={language === "ar" ? "الاسم بالإنجليزي" : "English label"}
                dir="ltr"
                className="w-full sm:flex-1 min-w-0 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />

              {/* ID (read-only, shows what items store) */}
              <span className="text-[10px] text-slate-400 font-mono px-2 hidden sm:inline">
                {cat.id}
              </span>

              {/* Delete */}
              <button
                onClick={() => deleteCategory(cat.id)}
                className="text-slate-400 hover:text-rose-600 transition-colors p-1.5"
                title={language === "ar" ? "حذف" : "Delete"}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>

        {/* Add new category */}
        <div className="mt-4 pt-4 border-t border-slate-100">
          <AddCategoryForm
            onAdd={addCategory}
            isAr={language === "ar"}
          />
        </div>
      </div>

      {/* (the catalog tab is now the only sub-tab; nav removed) */}

      {/* 1. CATALOG MANAGER TAB (Spacious Full Width Layout) */}
      <div className="space-y-6" id="catalog-manager-view">
          {/* Informative Banner */}
          <div className="bg-indigo-50 border border-indigo-100/50 rounded-3xl p-6 flex items-start gap-4">
            <div className="bg-indigo-100 p-2.5 rounded-2xl text-indigo-600 shrink-0">
              <Info className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-indigo-900 text-sm md:text-base">
                {language === "ar" ? "الأصناف المخفية للضيف (Off-Menu)" : "Hidden items (Off-Menu)"}
              </h3>
              <p className="text-xs md:text-sm text-indigo-800/80 mt-1.5 leading-relaxed">
                {language === "ar"
                  ? "حافظ على منيو الطاولة أنيقاً بضبط خيار 'للمساعد فقط' على الأصناف السرية أو الإضافات. يستطيع المساعد الصوتي رؤيتها واقتراحها للضيف، لكنها لا تظهر في المنيو المباشر."
                  : "Keep the table menu elegant by marking secret chef items or extras as 'assistant-only'. The voice assistant can see and recommend them, but they don't appear in the live menu."}
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
                {/* Storage status: honest per mode */}
                <div className={`text-xs font-semibold flex items-center gap-1.5 ${isSupabaseMode ? "text-emerald-500" : "text-amber-500"}`}>
                  <span className={`h-2 w-2 rounded-full ${isSupabaseMode ? "bg-emerald-500 animate-ping" : "bg-amber-400"}`}></span>
                  {isSupabaseMode
                    ? (language === "ar" ? "قاعدة البيانات متصلة وجاهزة" : "Database synced live")
                    : (language === "ar" ? "وضع تجريبي محلي — البيانات محفوظة على هذا الجهاز" : "Local demo mode — data saved on this device")}
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
                    ? "ابدأ بإضافة أول طبق، أو استورد قائمتك من ملف CSV/JSON."
                    : "Add your first dish, or import your list from a CSV/JSON file."}
                </p>
                <div className="mt-6 flex justify-center gap-3">
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-700"
                  >
                    {language === "ar" ? "إضافة طبق" : "Add dish"}
                  </button>
                  <button
                    onClick={() => setShowImportModal(true)}
                    className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl text-xs font-bold hover:bg-emerald-100"
                  >
                    {language === "ar" ? "استيراد ملف" : "Import file"}
                  </button>
                </div>
              </div>
            ) : (
              <>
              <div className="md:hidden divide-y divide-slate-100">
                {items.map((item) => (
                  <article key={item.id} className="p-4 flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-800 text-sm break-words">{item.name}</p>
                      {item.description && <p className="mt-1 text-xs text-slate-400 line-clamp-2">{item.description}</p>}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                          {categories.find((c) => c.id === item.category)?.[language === "ar" ? "labelAr" : "labelEn"] || item.category}
                        </span>
                        <span className="font-bold text-indigo-600 text-xs" dir="ltr">{formatPrice(item.price, currency)}</span>
                        {item.isAiOnly
                          ? <span className="rounded-full bg-purple-50 px-2 py-1 text-[10px] font-bold text-purple-600">{language === "ar" ? "للذكاء فقط" : "AI only"}</span>
                          : <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-600">{language === "ar" ? "ظاهر بالمنيو" : "Visible"}</span>}
                      </div>
                      <ModifierManager itemId={item.id} ownerId={user?.uid || ""} language={language} localMode={user?.provider === "local"} />
                    </div>
                    <button onClick={() => handleDeleteItem(item.id)} aria-label={language === "ar" ? "حذف المنتج" : "Delete product"} className="min-h-11 min-w-11 shrink-0 rounded-xl text-rose-500 hover:bg-rose-50 flex items-center justify-center">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </article>
                ))}
              </div>
              <div className="hidden md:block overflow-x-auto">
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
                            categories.find(c => c.id === item.category)?.labelAr || item.category
                          ) : (
                            categories.find(c => c.id === item.category)?.labelEn || item.category
                          )}
                        </td>
                        <td className="py-4 px-6 font-bold text-indigo-600" dir="ltr">
                          {formatPrice(item.price, currency)}
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
                              {language === "ar" ? "عام با��منيو" : "Public Menu"}
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="min-w-[220px]">
                            <ModifierManager itemId={item.id} ownerId={user?.uid || ""} language={language} localMode={user?.provider === "local"} />
                          </div>
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
              </>
            )}
          </div>
        </div>


      {/* Add Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full max-h-[94dvh] shadow-2xl overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-800">
                {language === "ar" ? "إضافة وجبة أو صنف جديد للمنيو" : "Add New Dish or Drink to Menu"}
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
                  {language === "ar" ? "اسم الوجبة / المشروب" : "Dish / Drink Name"} *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={language === "ar" ? "مثال: برجر دبل بيف تشيز مع بطاطس" : "e.g. Double Beef Cheeseburger with Fries"}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              {/* Price & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">
                    {language === "ar" ? "السعر" : "Price"} *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="12.50"
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
                      <option key={cat.id} value={cat.id}>
                        {cat.emoji ? `${cat.emoji} ` : ''}{language === "ar" ? cat.labelAr : cat.labelEn}
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
                            <td className="py-2.5 px-4 font-bold text-indigo-600" dir="ltr">{formatPrice(item.price, currency)}</td>
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

/* ============ Add Category Form ============ */

function AddCategoryForm({
  onAdd,
  isAr,
}: {
  onAdd: (labelAr: string, labelEn: string, emoji?: string) => void;
  isAr: boolean;
}) {
  const [emoji, setEmoji] = useState('');
  const [labelAr, setLabelAr] = useState('');
  const [labelEn, setLabelEn] = useState('');

  const canAdd = labelAr.trim().length > 0 || labelEn.trim().length > 0;

  const handleSubmit = () => {
    if (!canAdd) return;
    onAdd(labelAr, labelEn, emoji);
    setEmoji('');
    setLabelAr('');
    setLabelEn('');
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr_1fr_auto] items-stretch sm:items-end gap-2">
      <input
        type="text"
        value={emoji}
        onChange={(e) => setEmoji(e.target.value.slice(0, 3))}
        placeholder="🍽️"
        className="w-12 text-center text-base font-bold bg-white border border-slate-200 rounded-lg px-1 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        title={isAr ? "إيموجي (اختياري)" : "Emoji (optional)"}
      />
      <input
        type="text"
        value={labelAr}
        onChange={(e) => setLabelAr(e.target.value)}
        placeholder={isAr ? "الاسم بالعربي" : "Arabic label"}
        className="w-full min-w-0 bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
      />
      <input
        type="text"
        value={labelEn}
        onChange={(e) => setLabelEn(e.target.value)}
        placeholder={isAr ? "الاسم بالإنجليزي" : "English label"}
        dir="ltr"
        className="w-full min-w-0 bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
      />
      <button
        onClick={handleSubmit}
        disabled={!canAdd}
        className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:cursor-not-allowed"
      >
        <Plus className="w-3.5 h-3.5" />
        {isAr ? "إضافة فئة" : "Add category"}
      </button>
    </div>
  );
}
