
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
