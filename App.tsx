
import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { GenerationParams, ImageStyle, PinData, ViewState, HistoryItem, Lighting, Composition, HookType, Product, BoardSuggestion } from './types';
import { generatePinContent, generateSingleImage } from './services/genai';
import { saveHistory, getHistory, deleteHistoryItem, importHistory, getSavedBoards, saveBoardsToDB, updateProjectPins, getProducts, saveProduct, deleteProduct } from './services/db';

// Components
import { Dashboard } from './components/Dashboard';
import { Generator } from './components/Generator';
import { PinList } from './components/PinList';
import { Help } from './components/Help';
import { HistoryView } from './components/HistoryView';
import { Advisor } from './components/Advisor';
import { CalendarView } from './components/CalendarView';

export default function App() {
  const [hasApiKey, setHasApiKey] = useState(false);
  const [isCheckingKey, setIsCheckingKey] = useState(true);

  const [currentView, setCurrentView] = useState<ViewState>(ViewState.DASHBOARD);
  const [generatedPins, setGeneratedPins] = useState<PinData[]>([]);
  // NEW: State to hold boards generated in the single shot
  const [generatedBoards, setGeneratedBoards] = useState<BoardSuggestion | null>(null);

  const [currentTopic, setCurrentTopic] = useState<string>('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [currentHistoryId, setCurrentHistoryId] = useState<number | null>(null);
  const [savedBoards, setSavedBoards] = useState<string[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [toasts, setToasts] = useState<{id: string, message: string, type: 'success' | 'error'}[]>([]);
  
  const [pinterestToken, setPinterestToken] = useState<string>('');

  const [formState, setFormState] = useState<GenerationParams>({
    input: '',
    inputType: 'text',
    count: 5,
    language: 'Russian',
    imageStyle: ImageStyle.LUXURY,
    imageAspectRatio: '3:4', 
    destinationLink: '',
    productName: '',
    lighting: Lighting.AUTO,
    composition: Composition.AUTO,
    colorPalette: '',
    hookType: HookType.AUTO,
    seoKeyword: '',
    generationMode: 'variations',
    targetPlatform: 'Pinterest' as any
  });

  // API Key Check
  useEffect(() => {
    const checkKey = async () => {
       try {
         if ((window as any).aistudio && (window as any).aistudio.hasSelectedApiKey) {
            const has = await (window as any).aistudio.hasSelectedApiKey();
            setHasApiKey(has);
         } else {
            // If not in AI Studio (e.g. Vercel or Local), we assume process.env.API_KEY is configured
            setHasApiKey(true);
         }
       } catch (e) {
         setHasApiKey(true);
       } finally {
         setIsCheckingKey(false);
       }
    };
    checkKey();
  }, []);

  useEffect(() => {
    refreshHistory();
    loadBoards();
    refreshProducts();
    const savedToken = localStorage.getItem('pinterest_token');
    if (savedToken) setPinterestToken(savedToken);
  }, []);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
      const id = Date.now().toString();
      setToasts(prev => [...prev, { id, message, type }]);
      setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== id));
      }, 3000);
  };

  const handleSetToken = (token: string) => {
      setPinterestToken(token);
      localStorage.setItem('pinterest_token', token);
      showToast("Токен сохранен");
  };

  const refreshHistory = async () => {
    try {
      const h = await getHistory();
      setHistory(h);
    } catch (e) {
      console.error(e);
    }
  };

  const loadBoards = async () => {
      try {
          const b = await getSavedBoards();
          setSavedBoards(b);
      } catch (e) {
          console.error("Could not load boards", e);
      }
  };

  const refreshProducts = async () => {
      try {
          const p = await getProducts();
          setProducts(p);
      } catch (e) {
          console.error("Could not load products", e);
      }
  };

  const handleSaveProduct = async (product: Product) => {
      try {
          await saveProduct(product);
          await refreshProducts();
          showToast("Актив сохранен в библиотеку");
      } catch (e) {
          showToast("Ошибка сохранения актива", "error");
      }
  };

  const handleDeleteProduct = async (id: string) => {
      try {
          await deleteProduct(id);
          await refreshProducts();
          showToast("Актив удален");
      } catch (e) {
          showToast("Ошибка удаления", "error");
      }
  };

  const handleSaveNewBoards = async (newBoards: string[]) => {
      await saveBoardsToDB(newBoards);
      setSavedBoards(prev => [...new Set([...prev, ...newBoards])]);
  };

  const handleGenerate = async (params: GenerationParams) => {
    setIsLoading(true);
    setFormState(params); 
    setGeneratedBoards(null); // Reset boards

    try {
      const result = await generatePinContent(params);
      const pinsWithLink = result.pins.map(p => ({ ...p, link: params.destinationLink }));
      
      setGeneratedPins(pinsWithLink);
      setGeneratedBoards(result.boards); // Store suggestions
      
      // If the input is huge (book context), just save a snippet as the topic name
      const topicName = params.input.length > 50 
        ? (params.productName ? `${params.productName}: ${params.input.slice(0, 30)}...` : params.input.slice(0, 50) + "...")
        : params.input;

      setCurrentTopic(topicName);
      
      // Save immediately and get ID
      const newId = await saveHistory(topicName, pinsWithLink);
      setCurrentHistoryId(newId);
      await refreshHistory();
      
      setCurrentView(ViewState.RESULTS);
      showToast("Пины и стратегия созданы");
    } catch (error: any) {
      // Allow specific errors (like Quota) to bubble up to Generator component
      if (error.message === 'QUOTA_EXCEEDED') throw error;
      
      // Fallback for unexpected errors
      alert("Ошибка создания пинов. Проверьте API Key или повторите попытку.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateMore = async () => {
    setIsLoading(true);
    try {
      const result = await generatePinContent(formState);
      const pinsWithLink = result.pins.map(p => ({ ...p, link: formState.destinationLink }));
      
      const updatedList = [...generatedPins, ...pinsWithLink];
      setGeneratedPins(updatedList);
      
      // We also update boards if we got new ones
      setGeneratedBoards(result.boards);

      if (currentHistoryId) {
          await updateProjectPins(currentHistoryId, updatedList);
          await refreshHistory();
          showToast("Добавлены новые пины");
      } else {
          const newId = await saveHistory(formState.input + " (Extended)", updatedList);
          setCurrentHistoryId(newId);
          await refreshHistory();
      }
    } catch (error: any) {
        if (error.message === 'QUOTA_EXCEEDED') throw error;
        alert("Не удалось сгенерировать дополнительные элементы.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadHistory = (item: HistoryItem) => {
    setGeneratedPins(item.pins);
    setCurrentTopic(item.topic);
    setCurrentHistoryId(item.id);
    setGeneratedBoards(null); // Clear boards on history load as we don't save them in HistoryItem yet (simple version)
    setCurrentView(ViewState.RESULTS);
  };

  const handleDeleteHistory = async (id: number) => {
    await deleteHistoryItem(id);
    if (currentHistoryId === id) {
        setCurrentHistoryId(null);
        setGeneratedPins([]);
    }
    refreshHistory();
    showToast("Проект удален");
  };

  const handleImportHistory = async (file: File) => {
      try {
          const text = await file.text();
          const items = JSON.parse(text);
          
          if (!Array.isArray(items)) {
              alert("Неверный формат файла.");
              return;
          }

          await importHistory(items);
          await refreshHistory();
          showToast(`Восстановлено ${items.length} проектов`);
      } catch (e) {
          console.error(e);
          alert("Ошибка импорта файла.");
      }
  };

  const handleGenerateImage = async (pinId: string, prompt: string, ratio: string) => {
    try {
        const url = await generateSingleImage(prompt, ratio);
        return url;
    } catch (e) {
        throw e;
    }
  };
  
  const handleUpdatePin = async (updatedPin: PinData) => {
      const updatedList = generatedPins.map(p => p.id === updatedPin.id ? updatedPin : p);
      setGeneratedPins(updatedList);
      
      // AUTO-SAVE to DB
      if (currentHistoryId) {
          try {
              await updateProjectPins(currentHistoryId, updatedList);
              const oldPin = generatedPins.find(p => p.id === updatedPin.id);
              if (oldPin && !oldPin.generatedImageUrl && updatedPin.generatedImageUrl) {
                  showToast("Визуал сохранен");
              }
          } catch (e) {
              console.error("Auto-save failed", e);
              showToast("Ошибка автосохранения", "error");
          }
      }
  };

  // API Key Connection Handler
  const handleConnectApiKey = async () => {
    if ((window as any).aistudio && (window as any).aistudio.openSelectKey) {
        await (window as any).aistudio.openSelectKey();
        setHasApiKey(true);
    }
  };

  if (isCheckingKey) {
      return <div className="min-h-screen bg-luxury-900 flex items-center justify-center text-luxury-gold animate-pulse">Загрузка системы...</div>;
  }

  if (!hasApiKey) {
      return (
        <div className="min-h-screen bg-luxury-900 text-white flex flex-col items-center justify-center p-4 relative overflow-hidden">
            <div className="absolute inset-0 bg-luxury-gradient opacity-50 z-0"></div>
            <div className="fixed inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 pointer-events-none"></div>
            
            <div className="z-10 text-center max-w-md space-y-8 animate-fade-in relative">
                <div className="relative inline-block">
                    <h1 className="text-6xl font-serif text-transparent bg-clip-text bg-gradient-to-r from-luxury-gold to-[#fff5d0] mb-2 tracking-wide drop-shadow-2xl">PIN EMPIRE</h1>
                    <div className="absolute -bottom-2 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-luxury-gold to-transparent opacity-50"></div>
                </div>
                <p className="text-gray-400 text-lg tracking-widest uppercase text-[10px]">AI Automation Suite for High-End Creators</p>
                
                <div className="bg-black/40 border border-gray-800 p-8 rounded-2xl backdrop-blur-xl shadow-2xl transform transition-all hover:scale-[1.02] hover:border-luxury-gold/30">
                    <p className="mb-8 text-sm text-gray-300 leading-relaxed">
                        Для доступа к стратегическому ИИ, анализу рынков и генерации визуалов требуется подключение ключа Google API.
                    </p>
                    <button 
                        onClick={handleConnectApiKey}
                        className="w-full bg-gradient-to-r from-luxury-gold to-[#b38728] text-luxury-900 font-bold py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(212,175,55,0.3)] hover:shadow-[0_0_40px_rgba(212,175,55,0.6)] flex items-center justify-center gap-3 group"
                    >
                        <span className="bg-white/20 p-1.5 rounded-full group-hover:rotate-90 transition-transform duration-500">
                             <svg className="w-5 h-5 text-luxury-900" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
                        </span>
                        Connect Google API
                    </button>
                    <div className="mt-6 flex justify-center gap-4 text-[10px] text-gray-500 uppercase tracking-widest">
                        <span>Search Grounding</span>
                        <span>•</span>
                        <span>Vision AI</span>
                        <span>•</span>
                        <span>Secure</span>
                    </div>
                </div>
            </div>
        </div>
      );
  }

  return (
    <Layout currentView={currentView} onNavigate={setCurrentView} toasts={toasts}>
      {currentView === ViewState.DASHBOARD && (
        <Dashboard 
          history={history} 
          onNew={() => {
              setCurrentHistoryId(null);
              setGeneratedPins([]);
              setCurrentView(ViewState.GENERATOR);
          }} 
          onLoadHistory={handleLoadHistory}
          pinterestToken={pinterestToken}
          onSetToken={handleSetToken}
        />
      )}

      {currentView === ViewState.GENERATOR && (
        <Generator 
          isLoading={isLoading} 
          onGenerate={handleGenerate}
          initialState={formState}
          products={products}
          onSaveProduct={handleSaveProduct}
          onDeleteProduct={handleDeleteProduct}
        />
      )}

      {currentView === ViewState.RESULTS && (
        <PinList 
          pins={generatedPins} 
          topic={currentTopic}
          isLoading={isLoading}
          onBack={() => setCurrentView(ViewState.GENERATOR)}
          onGenerateImage={handleGenerateImage}
          onGenerateMore={handleGenerateMore}
          pinterestToken={pinterestToken}
          onUpdatePin={handleUpdatePin}
          aspectRatio={formState.imageAspectRatio}
          savedBoards={savedBoards}
          onSaveBoards={handleSaveNewBoards}
          initialBoardSuggestions={generatedBoards} // Pass the auto-generated boards
        />
      )}

      {currentView === ViewState.HISTORY && (
        <HistoryView 
            history={history} 
            onLoad={handleLoadHistory} 
            onDelete={handleDeleteHistory}
            onImport={handleImportHistory}
        />
      )}

      {currentView === ViewState.CALENDAR && (
        <CalendarView 
            history={history}
            onLoad={handleLoadHistory}
        />
      )}

      {currentView === ViewState.ADVISOR && (
          <Advisor recentPins={generatedPins} />
      )}

      {currentView === ViewState.HELP && <Help />}
    </Layout>
  );
}
