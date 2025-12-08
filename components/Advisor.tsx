
import React, { useState, useRef, useEffect } from 'react';
import { PinData } from '../types';
import { askPinterestGuru } from '../services/genai';

interface AdvisorProps {
  recentPins: PinData[];
}

export const Advisor: React.FC<AdvisorProps> = ({ recentPins }) => {
  const [messages, setMessages] = useState<{role: 'user' | 'ai', text: string}[]>([
      {role: 'ai', text: 'Приветствую. Я ваш стратегический советник по Pinterest. Готов обсудить алгоритмы 2026 года и рост вашей империи. Какой у нас вопрос сегодня?'}
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (textOverride?: string) => {
      const userMsg = textOverride || input;
      if (!userMsg.trim()) return;
      
      setMessages(prev => [...prev, {role: 'user', text: userMsg}]);
      setInput('');
      setIsLoading(true);

      try {
          const answer = await askPinterestGuru(userMsg, recentPins);
          setMessages(prev => [...prev, {role: 'ai', text: answer}]);
      } catch (error) {
          setMessages(prev => [...prev, {role: 'ai', text: 'Связь с сервером стратегии прервана. Попробуйте еще раз.'}]);
      } finally {
          setIsLoading(false);
      }
  };

  const suggestions = [
      "Как набрать первую 1000 подписчиков?",
      "Стоит ли удалять старые пины?",
      "Как часто нужно публиковать?",
      "Тренды на 2026 год в моей нише?"
  ];

  return (
    <div className="max-w-4xl mx-auto h-[calc(100dvh-140px)] flex flex-col animate-fade-in">
        <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-full bg-luxury-gold flex items-center justify-center text-luxury-900 font-bold text-xl shadow-lg shadow-luxury-gold/20">
                AI
            </div>
            <div>
                <h2 className="text-2xl font-serif text-white">Советник Империи</h2>
                <p className="text-sm text-gray-400">Эксперт по алгоритмам и виральности</p>
            </div>
        </div>

        <div className="flex-1 bg-luxury-800/30 border border-gray-800 rounded-2xl p-6 overflow-y-auto space-y-4 mb-4 scrollbar-thin scrollbar-thumb-luxury-gold/20" ref={scrollRef}>
            {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-5 py-3 whitespace-pre-wrap shadow-lg ${
                        msg.role === 'user' 
                            ? 'bg-luxury-gold text-luxury-900 rounded-br-none' 
                            : 'bg-gray-800 text-gray-200 rounded-bl-none border border-gray-700'
                    }`}>
                        {msg.text}
                    </div>
                </div>
            ))}
            {isLoading && (
                 <div className="flex justify-start">
                    <div className="bg-gray-800 rounded-2xl rounded-bl-none px-5 py-3 flex gap-2 items-center border border-gray-700">
                        <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></span>
                        <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-100"></span>
                        <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-200"></span>
                    </div>
                </div>
            )}
        </div>

        {/* Suggestions */}
        {messages.length < 3 && (
            <div className="flex gap-2 overflow-x-auto pb-4 mb-2">
                {suggestions.map(s => (
                    <button 
                        key={s} 
                        onClick={() => handleSend(s)}
                        className="whitespace-nowrap bg-luxury-900 border border-gray-700 px-4 py-2 rounded-lg text-xs text-gray-400 hover:border-luxury-gold hover:text-luxury-gold hover:bg-luxury-800 transition-all duration-200 shadow-md"
                    >
                        {s}
                    </button>
                ))}
            </div>
        )}

        <div className="flex gap-2">
            <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Спросите советника о стратегии..."
                className="flex-1 bg-luxury-900 border border-gray-700 rounded-xl px-4 py-4 focus:border-luxury-gold outline-none text-white transition-colors"
            />
            <button 
                onClick={() => handleSend()}
                disabled={isLoading || !input.trim()}
                className="bg-luxury-gold text-luxury-900 font-bold px-6 rounded-xl hover:bg-white transition-all disabled:opacity-50 shadow-lg shadow-luxury-gold/10"
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
            </button>
        </div>
    </div>
  );
};
