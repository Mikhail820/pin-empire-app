
import React, { useState, useEffect } from 'react';
import { HistoryItem } from '../types';

interface DashboardProps {
  history: HistoryItem[];
  onNew: () => void;
  onLoadHistory: (item: HistoryItem) => void;
  pinterestToken: string;
  onSetToken: (t: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ history, onNew, onLoadHistory, pinterestToken, onSetToken }) => {
  const [showTokenInput, setShowTokenInput] = useState(false);
  
  // Telegram State
  const [tgToken, setTgToken] = useState('');
  const [tgChatId, setTgChatId] = useState('');

  useEffect(() => {
      setTgToken(localStorage.getItem('telegram_token') || '');
      setTgChatId(localStorage.getItem('telegram_chat_id') || '');
  }, []);

  const handleSaveTelegram = () => {
      localStorage.setItem('telegram_token', tgToken);
      localStorage.setItem('telegram_chat_id', tgChatId);
      alert("Настройки Telegram сохранены");
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-800 pb-8">
        <div>
          <h2 className="text-3xl md:text-4xl font-serif text-luxury-gold mb-2">Империя Контента</h2>
          <p className="text-gray-400">Добро пожаловать. Готовы захватить тренды?</p>
        </div>
        <div className="flex gap-4">
            <button 
              onClick={onNew}
              className="bg-luxury-gold hover:bg-white text-luxury-900 font-bold py-3 px-8 rounded-lg transition-all shadow-lg shadow-luxury-gold/20 transform hover:-translate-y-0.5"
            >
              + Новый Проект
            </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Всего Проектов" value={history.length.toString()} />
        <StatCard title="Потенциальный Охват" value={`${history.length * 15}k`} suffix="Польз." />
        <StatCard title="Создано Пинов" value={history.reduce((acc, curr) => acc + curr.pins.length, 0).toString()} />
      </div>

      <section>
        <h3 className="text-xl font-serif text-gray-200 mb-4 flex items-center gap-2">
          <span className="w-2 h-8 bg-luxury-accent rounded-sm"></span>
          Последние Стратегические Сессии
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {history.length === 0 ? (
            <div className="col-span-full p-12 text-center border border-dashed border-gray-800 rounded-xl bg-luxury-800/30">
              <p className="text-gray-500">Пока нет проектов. Начните строить свою империю.</p>
            </div>
          ) : (
            history.slice(0, 6).map((item) => (
              <div 
                key={item.id} 
                onClick={() => onLoadHistory(item)}
                className="group cursor-pointer bg-luxury-800/50 hover:bg-luxury-800 border border-gray-800 hover:border-luxury-gold/50 p-6 rounded-xl transition-all duration-300 transform hover:-translate-y-1"
              >
                <div className="flex justify-between items-start mb-4">
                    <span className="text-xs font-mono text-luxury-goldDim px-2 py-1 bg-luxury-900 rounded border border-luxury-gold/20">
                        {new Date(item.date).toLocaleDateString()}
                    </span>
                    <span className="text-xs text-gray-500">{item.pins.length} Пинов</span>
                </div>
                <h4 className="font-semibold text-gray-200 group-hover:text-white line-clamp-2 mb-2">
                  {item.topic}
                </h4>
                <p className="text-sm text-gray-500 flex items-center gap-1 group-hover:text-luxury-gold transition-colors">
                    Открыть проект →
                </p>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Advanced Settings Footer - MADE PROMINENT */}
      <div className="mt-12 pt-8 border-t border-white/5">
          <button 
            onClick={() => setShowTokenInput(!showTokenInput)}
            className={`flex items-center gap-3 text-sm font-bold transition-all px-6 py-4 rounded-xl border w-full md:w-auto justify-center md:justify-start ${
                showTokenInput 
                ? 'bg-luxury-gold text-luxury-900 border-luxury-gold shadow-lg shadow-luxury-gold/20' 
                : 'text-luxury-gold border-luxury-gold/30 bg-black/40 hover:bg-luxury-gold/10'
            }`}
          >
             <span>🔑</span>
             <span>API Ключи & Интеграции (Pinterest / Telegram)</span>
             <svg className={`w-4 h-4 transition-transform duration-300 ${showTokenInput ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>

          {showTokenInput && (
            <div className="mt-6 grid md:grid-cols-2 lg:grid-cols-2 gap-6 animate-fade-in">
                
                {/* Pinterest Section */}
                <div className="bg-black/40 border border-gray-800 p-6 rounded-xl shadow-lg">
                    <h3 className="text-base font-bold text-white mb-3 flex items-center gap-2">
                        <span className="text-red-500">●</span> Pinterest API
                    </h3>
                    <p className="text-sm text-gray-400 mb-4 leading-relaxed">
                        Опционально. Требуется для авто-постинга. Если не введен, используйте "Share Gallery".
                    </p>
                    <div className="flex gap-2">
                        <input 
                            type="password" 
                            placeholder="pina_..."
                            value={pinterestToken}
                            onChange={(e) => onSetToken(e.target.value)}
                            className="flex-1 bg-luxury-900 border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-luxury-gold outline-none"
                        />
                        <button className="bg-white/10 text-white text-sm px-4 rounded-lg opacity-50 cursor-default">Saved</button>
                    </div>
                </div>

                {/* Telegram Section */}
                <div className="bg-black/40 border border-gray-800 p-6 rounded-xl shadow-lg">
                    <h3 className="text-base font-bold text-white mb-3 flex items-center gap-2">
                        <span className="text-blue-400">●</span> Telegram Bot
                    </h3>
                    <p className="text-sm text-gray-400 mb-4 leading-relaxed">
                        Бот должен быть администратором канала. ID канала начинается с @ или -100.
                    </p>
                    <div className="space-y-3">
                        <input 
                            type="password" 
                            placeholder="Bot Token (12345:AAF...)"
                            value={tgToken}
                            onChange={(e) => setTgToken(e.target.value)}
                            className="w-full bg-luxury-900 border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-blue-500 outline-none"
                        />
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                placeholder="Chat ID (@channel)"
                                value={tgChatId}
                                onChange={(e) => setTgChatId(e.target.value)}
                                className="flex-1 bg-luxury-900 border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-blue-500 outline-none"
                            />
                            <button 
                                onClick={handleSaveTelegram} 
                                className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold px-4 rounded-lg transition-colors"
                            >
                                OK
                            </button>
                        </div>
                    </div>
                </div>

            </div>
          )}
      </div>
    </div>
  );
};

const StatCard = ({ title, value, suffix }: { title: string, value: string, suffix?: string }) => (
  <div className="bg-gradient-to-br from-luxury-800 to-luxury-900 p-6 rounded-xl border border-gray-800 hover:border-luxury-gold/30 transition-colors">
    <p className="text-gray-400 text-sm uppercase tracking-wider mb-2">{title}</p>
    <div className="flex items-baseline gap-1">
      <span className="text-3xl font-serif text-white">{value}</span>
      {suffix && <span className="text-sm text-luxury-gold">{suffix}</span>}
    </div>
  </div>
);
