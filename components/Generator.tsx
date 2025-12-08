
import React, { useState, useEffect } from 'react';
import { GenerationParams, ImageStyle, Lighting, Composition, HookType, Product, Platform, Preset, BriefData } from '../types';
import { processFile } from '../services/parsers';
import { getPresets, savePreset, deletePreset } from '../services/db';

interface GeneratorProps {
  isLoading: boolean;
  onGenerate: (params: GenerationParams) => void;
  initialState: GenerationParams;
  products: Product[];
  onSaveProduct: (p: Product) => void;
  onDeleteProduct: (id: string) => void;
}

const styleDescriptions: Record<ImageStyle, string> = {
  [ImageStyle.AUTO]: "✨ ИИ сам проанализирует тему и подберет лучший стиль для виральности.",
  [ImageStyle.LUXURY]: "Элитный минимализм, золото, темные матовые тона, дорогой интерьер.",
  [ImageStyle.BOHO]: "Уют, натуральные материалы, бежевые тона, растения, мягкий свет.",
  [ImageStyle.MODERN]: "Чистые линии, воздух, много белого, геометрия, apple-style.",
  [ImageStyle.DARK_ACADEMIA]: "Библиотеки, твид, осень, кофе, винтажная бумага, таинственность.",
  [ImageStyle.CONSTRUCTION]: "Бетон, чертежи, четкие линии, металл, профессионализм.",
  [ImageStyle.BOOKS]: "Эстетика чтения, уютные уголки, развороты страниц, чай/кофе.",
  [ImageStyle.FASHION]: "Глянцевый журнал, подиум, стрит-стайл, акцент на детали.",
  [ImageStyle.TRAVEL]: "Захватывающие пейзажи, отели, самолеты, свобода.",
  [ImageStyle.DIY]: "Процесс создания, руки в кадре, материалы, творческий беспорядок.",
  [ImageStyle.NEON]: "Киберпанк, ночной город, яркое свечение, высокий контраст."
};

const SPLIT_MARKER = "CONTEXT/TOPIC TRIGGER:\n";

export const Generator: React.FC<GeneratorProps> = ({ isLoading, onGenerate, initialState, products, onSaveProduct, onDeleteProduct }) => {
  const [activeTab, setActiveTab] = useState<'library' | 'manual' | 'brief'>('library');
  const [cooldown, setCooldown] = useState(0);
  
  // Presets State
  const [presets, setPresets] = useState<Preset[]>([]);
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  
  // Manual State
  const [inputType, setInputType] = useState<'text' | 'file'>(initialState.inputType);
  const [textInput, setTextInput] = useState(initialState.input);
  const [destinationLink, setDestinationLink] = useState(initialState.destinationLink || '');
  const [productName, setProductName] = useState(initialState.productName || '');
  
  // Brief State
  const [brief, setBrief] = useState<BriefData>({
      brandName: '',
      targetAudience: '',
      toneOfVoice: '',
      keyGoal: '',
      usp: '',
      taboos: '',
      context: ''
  });

  // File State
  const [fileInput, setFileInput] = useState<File | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);

  // Library State
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [topicTrigger, setTopicTrigger] = useState('');
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  
  // New Product Form
  const [newProdName, setNewProdName] = useState('');
  const [newProdLink, setNewProdLink] = useState('');
  const [newProdContent, setNewProdContent] = useState('');
  const [newProdFile, setNewProdFile] = useState<File | null>(null);

  // Settings
  const [targetPlatform, setTargetPlatform] = useState<Platform>(initialState.targetPlatform || Platform.PINTEREST);
  const [count, setCount] = useState(initialState.count);
  const [language, setLanguage] = useState(initialState.language);
  const [style, setStyle] = useState<ImageStyle>(initialState.imageStyle);
  const [aspectRatio, setAspectRatio] = useState<'3:4' | '9:16' | '1:1' | '16:9'>(initialState.imageAspectRatio || '3:4');
  
  // Visual Upgrade
  const [lighting, setLighting] = useState<Lighting>(initialState.lighting || Lighting.AUTO);
  const [composition, setComposition] = useState<Composition>(initialState.composition || Composition.AUTO);
  const [colorPalette, setColorPalette] = useState(initialState.colorPalette || '');

  // Copywriting Upgrade
  const [hookType, setHookType] = useState<HookType>(initialState.hookType || HookType.AUTO);
  const [seoKeyword, setSeoKeyword] = useState(initialState.seoKeyword || '');
  
  // Mode
  const [generationMode, setGenerationMode] = useState<'variations' | 'story'>(initialState.generationMode || 'variations');

  useEffect(() => {
    let interval: any;
    if (cooldown > 0) {
        interval = setInterval(() => {
            setCooldown(c => c - 1);
        }, 1000);
    }
    return () => clearInterval(interval);
  }, [cooldown]);

  useEffect(() => {
      loadPresets();
  }, []);

  const loadPresets = async () => {
      try {
          const p = await getPresets();
          setPresets(p);
      } catch (e) {
          console.error("Error loading presets");
      }
  };

  const handleSavePreset = async () => {
      if (!newPresetName.trim()) return;
      const preset: Preset = {
          id: Date.now().toString(),
          name: newPresetName,
          params: {
              targetPlatform,
              imageStyle: style,
              imageAspectRatio: aspectRatio,
              lighting,
              composition,
              colorPalette,
              hookType,
              generationMode,
              language
          }
      };
      await savePreset(preset);
      await loadPresets();
      setNewPresetName('');
      setShowPresetModal(false);
  };

  const handleLoadPreset = (preset: Preset) => {
      if (preset.params.targetPlatform) setTargetPlatform(preset.params.targetPlatform);
      if (preset.params.imageStyle) setStyle(preset.params.imageStyle);
      if (preset.params.imageAspectRatio) setAspectRatio(preset.params.imageAspectRatio);
      if (preset.params.lighting) setLighting(preset.params.lighting);
      if (preset.params.composition) setComposition(preset.params.composition);
      if (preset.params.colorPalette) setColorPalette(preset.params.colorPalette);
      if (preset.params.hookType) setHookType(preset.params.hookType);
      if (preset.params.generationMode) setGenerationMode(preset.params.generationMode);
      if (preset.params.language) setLanguage(preset.params.language);
  };

  const handleDeletePreset = async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if(confirm("Удалить пресет?")) {
          await deletePreset(id);
          await loadPresets();
      }
  }

  useEffect(() => {
    // Determine active tab based on incoming state or defaults
    // Default to Library if products exist, otherwise Manual
    if (initialState.briefData) {
        setActiveTab('brief');
    }
    // Logic for other tabs is handled by user interaction mostly, 
    // keeping simple initialization logic here
  }, []);

  // Platform Auto-Ratio Logic
  useEffect(() => {
    if (targetPlatform === Platform.TELEGRAM || targetPlatform === Platform.INSTAGRAM || targetPlatform === Platform.VK || targetPlatform === Platform.OZON) {
        setAspectRatio('1:1');
    } else if (targetPlatform === Platform.TIKTOK) {
        setAspectRatio('9:16');
    } else if (targetPlatform === Platform.YANDEX) {
        setAspectRatio('16:9'); 
    } else if (targetPlatform === Platform.WILDBERRIES) {
        setAspectRatio('3:4');
    } else {
        setAspectRatio('3:4'); // Pinterest Default
    }
  }, [targetPlatform]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, isNewProduct: boolean = false) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setIsProcessingFile(true);
      
      try {
          const result = await processFile(file);
          
          if (isNewProduct) {
              setNewProdFile(file);
              setNewProdContent(result.text || "(Image Based Asset)");
          } else {
              setFileInput(file);
              if (result.type === 'image' && result.base64) {
                  setUploadedImage(result.base64);
                  setTextInput(result.text); // usually empty for image
              } else {
                  setTextInput(result.text);
                  setUploadedImage(null);
              }
          }
      } catch (err) {
          console.error(err);
          alert("Не удалось прочитать файл. Поддерживаются: .txt, .pdf, .docx, .jpg, .png");
      } finally {
          setIsProcessingFile(false);
      }
    }
  };

  const handleCreateProduct = () => {
      if (!newProdName || !newProdContent) {
          alert("Заполните название и контент (текст или файл).");
          return;
      }
      const newProduct: Product = {
          id: Date.now().toString(),
          name: newProdName,
          content: newProdContent,
          link: newProdLink,
          date: new Date().toISOString()
      };
      onSaveProduct(newProduct);
      setIsCreatingProduct(false);
      setNewProdName('');
      setNewProdLink('');
      setNewProdContent('');
      setNewProdFile(null);
      setSelectedProductId(newProduct.id); 
      setActiveTab('library');
  };

  const handleClear = () => {
      setTextInput('');
      setFileInput(null);
      setUploadedImage(null);
      const fileInputEl = document.getElementById('fileUpload') as HTMLInputElement;
      if (fileInputEl) fileInputEl.value = '';
  };

  const handleSubmit = async () => {
    if (cooldown > 0) return;

    let finalInput = '';
    let finalProductName = '';
    let finalLink = '';
    let imagePayload: { base64?: string, mime?: string } = {};
    let finalBriefData = undefined;

    if (activeTab === 'brief') {
        if (!brief.context || !brief.brandName) {
            alert("Пожалуйста, заполните поле 'Тема' и 'Бренд'.");
            return;
        }
        finalInput = brief.context; // Main topic comes from brief context
        finalProductName = brief.brandName;
        finalLink = destinationLink; // User can still set link in sidebar or we could add to brief form
        finalBriefData = brief;
    } 
    else if (activeTab === 'library') {
        const product = products.find(p => p.id === selectedProductId);
        if (!product) {
            alert("Выберите актив из списка.");
            return;
        }
        
        let triggerToSend = topicTrigger.trim();
        if (!triggerToSend) triggerToSend = "<<AUTO_THEME>>";
        
        finalInput = `ASSET CONTEXT:\n${product.content}\n\n${SPLIT_MARKER}${triggerToSend}`;
        finalProductName = product.name;
        finalLink = product.link;
    } else {
        if (!textInput.trim() && !uploadedImage) {
            alert("Пожалуйста, введите текст или загрузите файл/фото.");
            return;
        }
        finalInput = textInput;
        finalProductName = productName;
        finalLink = destinationLink;
        
        if (inputType === 'file' && uploadedImage && fileInput) {
            imagePayload = {
                base64: uploadedImage,
                mime: fileInput.type
            };
        }
    }
    
    try {
        await onGenerate({
          input: finalInput,
          inputType: 'text', 
          base64Image: imagePayload.base64,
          imageMimeType: imagePayload.mime,
          targetPlatform,
          count: generationMode === 'story' ? 5 : count, 
          language,
          imageStyle: style,
          imageAspectRatio: aspectRatio,
          destinationLink: finalLink,
          productName: finalProductName,
          lighting,
          composition,
          colorPalette,
          hookType,
          seoKeyword,
          generationMode,
          briefData: finalBriefData // Pass brief if exists
        });
    } catch (e: any) {
        if (e.message === 'QUOTA_EXCEEDED' || e.message?.includes('429')) {
             setCooldown(120); 
        } else {
            // Error handled by parent
        }
    }
  };

  const fillExampleBrief = () => {
      setBrief({
          brandName: "EcoHome Decor",
          targetAudience: "Женщины 25-45, ценят уют и экологию, живут в мегаполисах.",
          toneOfVoice: "Теплый, заботливый, экспертный, без пафоса.",
          keyGoal: "Продажа свечей ручной работы.",
          usp: "100% соевый воск, деревянный фитиль, аромат леса.",
          taboos: "Не использовать слова 'дешево', 'скидки'.",
          context: "Осенняя коллекция свечей"
      });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in-up pb-12">
      {/* COOLDOWN OVERLAY */}
      {cooldown > 0 && (
          <div className="fixed bottom-0 left-0 w-full bg-luxury-900/95 border-t border-luxury-gold p-6 z-[100] backdrop-blur-xl flex flex-col items-center justify-center animate-slide-up shadow-[0_-10px_40px_rgba(0,0,0,0.8)]">
            <p className="text-luxury-gold font-bold uppercase tracking-widest text-xs mb-1">Лимит API (Quota)</p>
            <div className="text-4xl font-serif text-white font-bold tabular-nums">
              {cooldown}<span className="text-lg text-gray-500">с</span>
            </div>
            <p className="text-gray-400 text-xs mt-2 text-center max-w-xs">Система охлаждается перед следующим запуском</p>
          </div>
      )}

      {/* HEADER WITH PRESETS */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="text-center md:text-left">
             <h2 className="text-3xl font-serif text-white drop-shadow-lg">
                Студия <span className="text-luxury-gold">Контента</span>
            </h2>
            <p className="text-gray-400 text-sm">Word, PDF, Images. Мультимодальный анализ.</p>
        </div>
        
        <div className="flex gap-2 relative">
             <div className="group relative">
                <button className="bg-luxury-800 border border-gray-700 hover:border-luxury-gold px-4 py-2 rounded-lg text-xs font-bold text-gray-300 flex items-center gap-2">
                    🎭 Бренд-Пресеты
                </button>
                <div className="absolute right-0 top-full mt-2 w-48 bg-black/90 backdrop-blur-xl border border-gray-700 rounded-xl p-2 hidden group-hover:block z-50 shadow-xl">
                    <button 
                        onClick={() => setShowPresetModal(true)}
                        className="w-full text-left px-3 py-2 text-luxury-gold hover:bg-white/5 rounded text-xs font-bold mb-2 border-b border-white/10"
                    >
                        + Сохранить текущий
                    </button>
                    {presets.length === 0 && <p className="text-[10px] text-gray-500 px-3 pb-2">Нет сохраненных</p>}
                    {presets.map(p => (
                        <div key={p.id} className="flex justify-between items-center hover:bg-white/5 rounded px-2">
                             <button onClick={() => handleLoadPreset(p)} className="flex-1 text-left py-2 text-xs text-gray-300 truncate">{p.name}</button>
                             <button onClick={(e) => handleDeletePreset(p.id, e)} className="text-gray-600 hover:text-red-400 p-1">×</button>
                        </div>
                    ))}
                </div>
             </div>
        </div>
      </div>

      {/* Tabs - Optimized for Mobile */}
      <div className="flex justify-start md:justify-center border-b border-white/10 pb-1 overflow-x-auto no-scrollbar">
          <button 
            onClick={() => setActiveTab('library')}
            className={`flex-shrink-0 pb-3 px-4 md:px-6 font-serif text-sm md:text-lg whitespace-nowrap transition-all relative ${activeTab === 'library' ? 'text-luxury-gold' : 'text-gray-500 hover:text-gray-300'}`}
          >
              🗄️ Активы
              {activeTab === 'library' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-luxury-gold shadow-[0_0_10px_#d4af37]"></div>}
          </button>
          <button 
            onClick={() => setActiveTab('brief')}
            className={`flex-shrink-0 pb-3 px-4 md:px-6 font-serif text-sm md:text-lg whitespace-nowrap transition-all relative ${activeTab === 'brief' ? 'text-luxury-gold' : 'text-gray-500 hover:text-gray-300'}`}
          >
              📋 Бриф
              {activeTab === 'brief' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-luxury-gold shadow-[0_0_10px_#d4af37]"></div>}
          </button>
          <button 
            onClick={() => setActiveTab('manual')}
            className={`flex-shrink-0 pb-3 px-4 md:px-6 font-serif text-sm md:text-lg whitespace-nowrap transition-all relative ${activeTab === 'manual' ? 'text-luxury-gold' : 'text-gray-500 hover:text-gray-300'}`}
          >
              ✍️ Ручной Ввод
              {activeTab === 'manual' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-luxury-gold shadow-[0_0_10px_#d4af37]"></div>}
          </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
          
          {/* LEFT COLUMN: MAIN INPUT */}
          <div className="lg:col-span-2 space-y-6">
             <div className="bg-black/20 backdrop-blur-sm p-6 rounded-2xl border border-white/5 space-y-6 relative h-full flex flex-col hover:border-white/10 transition-colors">
                
                {activeTab === 'library' ? (
                    <div className="space-y-6 flex-1">
                        <div className="flex justify-between items-center">
                            <label className="text-sm text-gray-400 font-bold uppercase tracking-wider">База Активов</label>
                            <button onClick={() => setIsCreatingProduct(true)} className="text-xs font-bold text-luxury-gold hover:text-white px-3 py-1.5 border border-luxury-gold/30 rounded-lg hover:bg-luxury-gold/10 transition-colors">+ Новый Актив</button>
                        </div>
                        
                        {products.length === 0 ? (
                            <div className="text-center py-12 border-2 border-dashed border-gray-700 rounded-xl bg-luxury-900/50">
                                <p className="text-gray-400 mb-4">Библиотека пуста.</p>
                                <button 
                                    onClick={() => setIsCreatingProduct(true)}
                                    className="bg-luxury-gold text-luxury-900 font-bold py-3 px-8 rounded-lg hover:bg-white transition-colors"
                                >
                                    Загрузить Проект / Товар
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <select 
                                    value={selectedProductId}
                                    onChange={(e) => setSelectedProductId(e.target.value)}
                                    className="w-full bg-black/40 border border-gray-700 rounded-xl p-4 text-white focus:border-luxury-gold outline-none text-lg appearance-none"
                                >
                                    <option value="" disabled>-- Выберите проект --</option>
                                    {products.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>

                                {selectedProductId && (
                                    <div className="animate-fade-in space-y-4">
                                        <div className="bg-green-900/20 border border-green-900/50 p-3 rounded-lg flex justify-between items-center">
                                            <span className="text-green-400 text-sm flex items-center gap-2">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                                Контекст загружен
                                            </span>
                                            <button 
                                                onClick={() => {
                                                    if (confirm("Удалить этот актив навсегда?")) {
                                                        onDeleteProduct(selectedProductId);
                                                        setSelectedProductId('');
                                                    }
                                                }}
                                                className="text-red-400 text-xs hover:text-white px-2 py-1"
                                            >
                                                Удалить
                                            </button>
                                        </div>
                                        
                                        <div className="space-y-2 pt-4 border-t border-gray-800">
                                            <label className="text-sm text-luxury-gold font-bold uppercase flex items-center gap-2 tracking-wider">
                                                Тема / Угол Подачи
                                                <span className="text-[10px] text-gray-500 font-normal normal-case border border-gray-700 rounded px-1.5">Optional</span>
                                            </label>
                                            <input
                                                type="text"
                                                className="w-full bg-black/40 border border-gray-700 rounded-xl p-4 text-base text-gray-200 focus:border-luxury-gold focus:ring-1 focus:ring-luxury-gold outline-none transition-all placeholder-gray-600"
                                                placeholder="Напр: Распродажа, Новый Дизайн, Отзывы..."
                                                value={topicTrigger}
                                                onChange={(e) => setTopicTrigger(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ) : activeTab === 'brief' ? (
                    // BRIEF MODE
                    <div className="space-y-5 animate-fade-in">
                        <div className="flex justify-between items-center">
                            <h3 className="text-luxury-gold font-serif text-lg">Бриф Проекта</h3>
                            <button onClick={fillExampleBrief} className="text-xs text-gray-500 hover:text-white underline">Заполнить пример</button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div className="space-y-1">
                                 <label className="text-xs text-gray-400 font-bold uppercase">Бренд / Компания</label>
                                 <input type="text" className="w-full bg-black/40 border border-gray-700 rounded-lg p-3 text-white focus:border-luxury-gold outline-none" 
                                    placeholder="Название..." value={brief.brandName} onChange={e => setBrief({...brief, brandName: e.target.value})} />
                             </div>
                             <div className="space-y-1">
                                 <label className="text-xs text-gray-400 font-bold uppercase">Цель Контента</label>
                                 <input type="text" className="w-full bg-black/40 border border-gray-700 rounded-lg p-3 text-white focus:border-luxury-gold outline-none" 
                                    placeholder="Продажи, Подписки, Охват..." value={brief.keyGoal} onChange={e => setBrief({...brief, keyGoal: e.target.value})} />
                             </div>
                        </div>

                        <div className="space-y-1">
                             <label className="text-xs text-gray-400 font-bold uppercase">Целевая Аудитория (Кто?)</label>
                             <textarea rows={2} className="w-full bg-black/40 border border-gray-700 rounded-lg p-3 text-white focus:border-luxury-gold outline-none text-sm resize-none" 
                                placeholder="Напр: Мамы в декрете, владельцы бизнеса, 25-35 лет..." value={brief.targetAudience} onChange={e => setBrief({...brief, targetAudience: e.target.value})} />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div className="space-y-1">
                                 <label className="text-xs text-gray-400 font-bold uppercase">Tone of Voice</label>
                                 <input type="text" className="w-full bg-black/40 border border-gray-700 rounded-lg p-3 text-white focus:border-luxury-gold outline-none" 
                                    placeholder="Дерзкий, Экспертный..." value={brief.toneOfVoice} onChange={e => setBrief({...brief, toneOfVoice: e.target.value})} />
                             </div>
                             <div className="space-y-1">
                                 <label className="text-xs text-gray-400 font-bold uppercase">Табу (Чего нельзя)</label>
                                 <input type="text" className="w-full bg-black/40 border border-gray-700 rounded-lg p-3 text-white focus:border-luxury-gold outline-none" 
                                    placeholder="Без эмодзи, без сленга..." value={brief.taboos} onChange={e => setBrief({...brief, taboos: e.target.value})} />
                             </div>
                        </div>

                        <div className="space-y-1">
                             <label className="text-xs text-gray-400 font-bold uppercase">USP (Уникальное Преимущество)</label>
                             <input type="text" className="w-full bg-black/40 border border-gray-700 rounded-lg p-3 text-white focus:border-luxury-gold outline-none" 
                                placeholder="Доставка за 1 час, ручная работа..." value={brief.usp} onChange={e => setBrief({...brief, usp: e.target.value})} />
                        </div>

                        <div className="space-y-1 pt-2 border-t border-gray-800">
                             <label className="text-sm text-luxury-gold font-bold uppercase tracking-wider">О чем этот пост? (Тема)</label>
                             <input type="text" className="w-full bg-black/40 border border-gray-700 rounded-xl p-4 text-white focus:border-luxury-gold outline-none text-lg" 
                                placeholder="Тема конкретного поста..." value={brief.context} onChange={e => setBrief({...brief, context: e.target.value})} />
                        </div>
                    </div>
                ) : (
                    // MANUAL MODE
                    <>
                        <div className="flex justify-between items-center border-b border-gray-800 pb-4">
                            <div className="flex gap-2">
                            <button 
                                onClick={() => setInputType('text')}
                                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${inputType === 'text' ? 'bg-luxury-gold text-luxury-900' : 'bg-gray-800 text-gray-400'}`}
                            >
                                Текст
                            </button>
                            <button 
                                onClick={() => setInputType('file')}
                                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${inputType === 'file' ? 'bg-luxury-gold text-luxury-900' : 'bg-gray-800 text-gray-400'}`}
                            >
                                Мультимедиа
                            </button>
                            </div>
                            {(textInput.length > 0 || fileInput) && (
                                <button 
                                    onClick={handleClear}
                                    className="text-gray-500 hover:text-red-400 text-xs font-bold uppercase tracking-wider transition-colors px-2 py-1"
                                >
                                    Очистить
                                </button>
                            )}
                        </div>

                        <div className="min-h-[200px] relative group">
                        {inputType === 'text' ? (
                            <>
                                <textarea
                                className="w-full h-48 bg-black/40 border border-gray-700 rounded-xl p-4 text-base text-gray-200 focus:border-luxury-gold focus:ring-1 focus:ring-luxury-gold outline-none resize-none transition-all placeholder-gray-600"
                                placeholder="Опишите ваш продукт, услугу, новость или вставьте текст поста..."
                                value={textInput}
                                onChange={(e) => setTextInput(e.target.value)}
                                />
                            </>
                        ) : (
                            <div className={`h-48 border-2 border-dashed rounded-xl flex flex-col items-center justify-center bg-black/20 hover:bg-black/40 transition-colors relative ${fileInput ? 'border-luxury-gold/50 bg-luxury-gold/5' : 'border-gray-700'}`}>
                            <input 
                                type="file" id="fileUpload" className="hidden" 
                                accept=".txt,.md,.json,.pdf,.docx,.jpg,.jpeg,.png,.webp" 
                                onChange={(e) => handleFileChange(e)} 
                            />
                            
                            {isProcessingFile ? (
                                <div className="text-center">
                                    <div className="animate-spin text-2xl mb-2">⚙️</div>
                                    <p className="text-luxury-gold text-sm animate-pulse">Анализ файла...</p>
                                </div>
                            ) : !fileInput ? (
                                <label htmlFor="fileUpload" className="cursor-pointer text-center p-4 w-full h-full flex flex-col items-center justify-center">
                                    <div className="text-4xl mb-3 grayscale opacity-60">📁 📸</div>
                                    <span className="text-white font-medium mb-1">Нажмите или перетащите</span>
                                    <p className="text-[10px] text-gray-500 uppercase tracking-widest border border-gray-700 px-2 py-1 rounded">
                                        PDF • DOCX • JPG • PNG
                                    </p>
                                </label>
                            ) : (
                                <div className="text-center p-4 w-full">
                                    {uploadedImage ? (
                                        <div className="relative w-24 h-24 mx-auto mb-3 rounded-lg overflow-hidden border border-luxury-gold shadow-lg">
                                            <img src={uploadedImage} className="w-full h-full object-cover" alt="Preview" />
                                        </div>
                                    ) : (
                                        <div className="text-4xl mb-2">📄</div>
                                    )}
                                    <p className="text-white font-bold truncate max-w-xs mx-auto">{fileInput.name}</p>
                                    <p className="text-xs text-gray-500 mt-1 mb-3">{(fileInput.size / 1024).toFixed(1)} KB</p>
                                    <button onClick={handleClear} className="text-xs text-red-400 hover:text-red-300 underline">Заменить</button>
                                </div>
                            )}
                            </div>
                        )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm text-gray-400 font-medium">Название Проекта / Товара</label>
                                <input 
                                    type="text"
                                    placeholder="Напр: ЖК 'Высота', Курс Python"
                                    value={productName}
                                    onChange={(e) => setProductName(e.target.value)}
                                    className="w-full bg-black/40 border border-gray-700 rounded-lg p-3 text-base text-gray-200 focus:border-luxury-gold outline-none transition-all"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm text-gray-400 font-medium">Целевая Ссылка</label>
                                <input 
                                    type="url"
                                    placeholder="https://..."
                                    value={destinationLink}
                                    onChange={(e) => setDestinationLink(e.target.value)}
                                    className="w-full bg-black/40 border border-gray-700 rounded-lg p-3 text-base text-gray-200 focus:border-luxury-gold outline-none transition-all"
                                />
                            </div>
                        </div>
                    </>
                )}
             </div>
          </div>

          {/* RIGHT COLUMN: SETTINGS */}
          <div className="space-y-6">
              {/* PLATFORM SELECTOR */}
              <div className="bg-gradient-to-br from-luxury-800 to-black/80 backdrop-blur-sm p-6 rounded-2xl border border-luxury-gold/20 shadow-xl space-y-4">
                  <h3 className="text-luxury-gold font-serif border-b border-white/10 pb-2 mb-2 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
                      Social Chameleon
                  </h3>
                  <div className="space-y-2">
                    <label className="text-xs text-gray-400 font-bold uppercase tracking-wider">Целевая Платформа</label>
                    <select 
                        value={targetPlatform} 
                        onChange={(e) => setTargetPlatform(e.target.value as Platform)}
                        className="w-full bg-black/50 border border-luxury-gold/30 rounded-lg p-3 text-sm text-white outline-none focus:border-luxury-gold focus:ring-1 focus:ring-luxury-gold appearance-none transition-all"
                    >
                        {Object.values(Platform).map((p) => (
                        <option key={p} value={p}>{p}</option>
                        ))}
                    </select>
                    <p className="text-[10px] text-gray-500 leading-tight">
                        {targetPlatform === Platform.PINTEREST && "Оптимизация: SEO, Ключи, Вечнозеленый контент."}
                        {targetPlatform === Platform.TELEGRAM && "Оптимизация: Форматирование, Жирные заголовки, Стиль блога."}
                        {targetPlatform === Platform.YANDEX && "Оптимизация: Жесткие лимиты (Заголовок 35, Текст 81)."}
                        {targetPlatform === Platform.TIKTOK && "Оптимизация: Сценарий видео, Хуки, Тайминг."}
                        {targetPlatform === Platform.WILDBERRIES && "Оптимизация: SEO-ключи, Характеристики, Вертикаль (3:4)."}
                        {targetPlatform === Platform.OZON && "Оптимизация: Rich-контент, Продающие буллиты."}
                    </p>
                  </div>
              </div>

              {/* Basic Settings */}
              <div className="bg-black/20 backdrop-blur-sm p-6 rounded-2xl border border-white/5 space-y-4">
                  <h3 className="text-luxury-gold font-serif border-b border-white/10 pb-2 mb-2">Общие Настройки</h3>
                  
                  {/* GENERATION MODE TOGGLE */}
                   <div className="bg-black/40 p-1 rounded-lg flex border border-gray-700">
                      <button 
                        onClick={() => setGenerationMode('variations')}
                        className={`flex-1 py-2 text-xs font-bold rounded uppercase transition-all ${generationMode === 'variations' ? 'bg-luxury-gold text-luxury-900 shadow-lg' : 'text-gray-400 hover:text-white'}`}
                      >
                          🎲 Вариации
                      </button>
                      <button 
                        onClick={() => setGenerationMode('story')}
                        className={`flex-1 py-2 text-xs font-bold rounded uppercase transition-all ${generationMode === 'story' ? 'bg-luxury-gold text-luxury-900 shadow-lg' : 'text-gray-400 hover:text-white'}`}
                      >
                          📖 История
                      </button>
                  </div>

                  <div className="space-y-2 opacity-90">
                    <label className="text-xs text-gray-400 font-bold uppercase tracking-wider">Размер</label>
                    <select 
                    value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value as any)}
                    className="w-full bg-black/40 border border-gray-700 rounded-lg p-3 text-sm text-gray-200 outline-none focus:border-luxury-gold appearance-none"
                    >
                    <option value="3:4">Вертикальный (3:4)</option>
                    <option value="9:16">Story (9:16)</option>
                    <option value="1:1">Квадрат (1:1)</option>
                    <option value="16:9">Горизонтальный (16:9)</option>
                    </select>
                  </div>

                   {generationMode === 'variations' && (
                       <div className="space-y-2 opacity-90">
                            <label className="text-xs text-gray-400 font-bold uppercase tracking-wider flex justify-between">
                                <span>Количество</span>
                                <span className="text-luxury-gold">{count}</span>
                            </label>
                            <input 
                            type="range" min="1" max="15" value={count} onChange={(e) => setCount(Number(e.target.value))}
                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-luxury-gold"
                            />
                       </div>
                   )}
              </div>

              {/* Visual Upgrade */}
              <div className="bg-black/20 backdrop-blur-sm p-6 rounded-2xl border border-white/5 space-y-4">
                  <h3 className="text-luxury-gold font-serif border-b border-white/10 pb-2 mb-2">Визуальная Студия</h3>
                   <div className="space-y-2">
                    <label className="text-xs text-gray-400 font-bold uppercase tracking-wider">Стиль</label>
                    <select 
                        value={style} onChange={(e) => setStyle(e.target.value as ImageStyle)}
                        className="w-full bg-black/40 border border-gray-700 rounded-lg p-3 text-sm text-gray-200 outline-none focus:border-luxury-gold appearance-none"
                    >
                        <option value={ImageStyle.AUTO}>✨ Авто (AI)</option>
                        {Object.values(ImageStyle).filter(s => s !== ImageStyle.AUTO).map((s) => (
                        <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] text-gray-400 font-bold uppercase">Свет</label>
                        <select 
                            value={lighting} onChange={(e) => setLighting(e.target.value as Lighting)}
                            className="w-full bg-black/40 border border-gray-700 rounded-lg p-2 text-xs text-gray-200 outline-none focus:border-luxury-gold appearance-none"
                        >
                            {Object.values(Lighting).map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-gray-400 font-bold uppercase">Ракурс</label>
                        <select 
                            value={composition} onChange={(e) => setComposition(e.target.value as Composition)}
                            className="w-full bg-black/40 border border-gray-700 rounded-lg p-2 text-xs text-gray-200 outline-none focus:border-luxury-gold appearance-none"
                        >
                            {Object.values(Composition).map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                  </div>
              </div>
          </div>
      </div>

      {/* Action */}
      <div className="pt-8 flex justify-end">
        <button
            onClick={handleSubmit}
            disabled={isLoading || (activeTab === 'library' && !selectedProductId) || isProcessingFile || cooldown > 0}
            className={`w-full group relative overflow-hidden font-bold py-5 px-12 rounded-xl transition-all shadow-[0_0_30px_rgba(212,175,55,0.3)] hover:shadow-[0_0_50px_rgba(212,175,55,0.5)] disabled:shadow-none flex items-center justify-center gap-3 text-lg tracking-wide ${
                cooldown > 0 
                ? 'bg-red-900/40 text-red-300 cursor-not-allowed border border-red-900' 
                : 'bg-gradient-to-br from-luxury-gold to-[#b38728] text-luxury-900 disabled:opacity-50 disabled:cursor-not-allowed'
            }`}
        >
            {cooldown <= 0 && <div className="absolute inset-0 bg-white/30 skew-x-12 translate-x-[-150%] group-hover:animate-shimmer" />}
            
            {isLoading ? (
                <>
                    <svg className="animate-spin h-6 w-6 text-luxury-900" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>СТРАТЕГИЯ ЗАГРУЖАЕТСЯ...</span>
                </>
            ) : cooldown > 0 ? (
                <>
                   <span className="animate-pulse">ОЖИДАНИЕ...</span>
                </>
            ) : (
                <>
                    <span className="relative z-10">ЗАПУСТИТЬ ГЕНЕРАТОР</span>
                </>
            )}
        </button>
      </div>

      {/* CREATE ASSET MODAL */}
      {isCreatingProduct && (
          <div className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-md flex items-end md:items-center justify-center p-0 md:p-4">
              <div className="bg-[#121212] border-t md:border border-luxury-gold/30 md:rounded-3xl rounded-t-3xl p-6 w-full max-w-lg space-y-6 animate-slide-up shadow-2xl">
                  <div className="flex justify-between items-center">
                    <h3 className="text-2xl font-serif text-white">Новый Актив</h3>
                    <button onClick={() => setIsCreatingProduct(false)} className="text-gray-400 hover:text-white p-2">✕</button>
                  </div>
                  
                  <div className="space-y-4">
                      <div className="space-y-2">
                          <label className="text-sm text-gray-400 font-bold uppercase">Название Проекта / Товара</label>
                          <input 
                             type="text"
                             className="w-full bg-black/50 border border-gray-700 rounded-xl p-4 text-white outline-none focus:border-luxury-gold"
                             placeholder="Напр: Жилой Комплекс, Магазин Сумок"
                             value={newProdName}
                             onChange={(e) => setNewProdName(e.target.value)}
                          />
                      </div>
                      
                      <div className="space-y-2">
                          <label className="text-sm text-gray-400 font-bold uppercase">Целевая Ссылка</label>
                          <input 
                             type="url"
                             className="w-full bg-black/50 border border-gray-700 rounded-xl p-4 text-white outline-none focus:border-luxury-gold"
                             placeholder="https://..."
                             value={newProdLink}
                             onChange={(e) => setNewProdLink(e.target.value)}
                          />
                      </div>

                      <div className="space-y-2">
                          <label className="text-sm text-gray-400 font-bold uppercase">Контекст / Описание</label>
                          <div className="flex gap-2">
                                <label className="flex-1 cursor-pointer bg-black/50 border border-gray-700 rounded-xl p-4 text-center hover:bg-gray-900 transition-colors">
                                    <input type="file" className="hidden" accept=".txt,.pdf,.docx" onChange={(e) => handleFileChange(e, true)} />
                                    <span className="text-sm text-luxury-gold font-bold">📂 Загрузить (PDF/DOCX)</span>
                                </label>
                          </div>
                          {newProdFile ? (
                              <div className="text-xs text-green-400 bg-green-900/20 p-2 rounded border border-green-900">
                                  Файл обработан: {newProdFile.name}
                              </div>
                          ) : (
                              <textarea 
                                className="w-full h-32 bg-black/50 border border-gray-700 rounded-xl p-4 text-white outline-none focus:border-luxury-gold text-sm"
                                placeholder="Опишите актив, преимущества, ЦА или вставьте текст..."
                                value={newProdContent}
                                onChange={(e) => setNewProdContent(e.target.value)}
                              />
                          )}
                      </div>
                  </div>

                  <div className="pt-4 flex gap-4">
                      <button 
                        onClick={handleCreateProduct}
                        className="w-full bg-luxury-gold text-luxury-900 font-bold py-4 rounded-xl hover:bg-white shadow-lg transition-colors"
                      >
                          Сохранить
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* SAVE PRESET MODAL */}
      {showPresetModal && (
           <div className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
              <div className="bg-[#121212] border border-luxury-gold/30 rounded-2xl p-6 w-full max-w-sm space-y-4 animate-slide-up">
                  <h3 className="text-xl font-serif text-white">Сохранить Бренд-Пресет</h3>
                  <input 
                     type="text"
                     placeholder="Название (напр. Клиент: Стройка)"
                     value={newPresetName}
                     onChange={(e) => setNewPresetName(e.target.value)}
                     className="w-full bg-black/50 border border-gray-700 rounded-xl p-3 text-white focus:border-luxury-gold outline-none"
                  />
                  <div className="flex gap-2">
                      <button onClick={() => setShowPresetModal(false)} className="flex-1 py-2 text-gray-400 border border-gray-700 rounded-lg">Отмена</button>
                      <button onClick={handleSavePreset} className="flex-1 py-2 bg-luxury-gold text-black font-bold rounded-lg">Сохранить</button>
                  </div>
              </div>
           </div>
      )}
    </div>
  );
};
