
import React, { useMemo } from 'react';
import { HistoryItem } from '../types';

interface CalendarViewProps {
  history: HistoryItem[];
  onLoad: (item: HistoryItem) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ history, onLoad }) => {
  const today = new Date();
  
  // Group history by date string (YYYY-MM-DD)
  const eventsByDate = useMemo(() => {
    const map = new Map<string, HistoryItem[]>();
    history.forEach(item => {
        const dateStr = new Date(item.date).toLocaleDateString('en-CA'); // YYYY-MM-DD
        if (!map.has(dateStr)) map.set(dateStr, []);
        map.get(dateStr)?.push(item);
    });
    return map;
  }, [history]);

  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).getDay(); // 0 is Sunday
  
  // Adjust for Monday start (Russian standard)
  const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

  const days = [];
  for (let i = 0; i < startOffset; i++) {
      days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(today.getFullYear(), today.getMonth(), i));
  }

  const monthName = today.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6 animate-fade-in">
        <div className="flex justify-between items-center border-b border-gray-800 pb-4">
            <h2 className="text-3xl font-serif text-luxury-gold">Контент-Календарь</h2>
            <p className="text-gray-400 capitalize">{monthName}</p>
        </div>

        <div className="bg-luxury-800/30 border border-gray-700 rounded-2xl p-6 overflow-hidden">
             <div className="grid grid-cols-7 mb-4">
                 {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(d => (
                     <div key={d} className="text-center text-xs text-gray-500 font-bold uppercase">{d}</div>
                 ))}
             </div>
             <div className="grid grid-cols-7 gap-2">
                 {days.map((date, idx) => {
                     if (!date) return <div key={idx} className="aspect-square bg-transparent"></div>;
                     
                     const dateKey = date.toLocaleDateString('en-CA');
                     const items = eventsByDate.get(dateKey) || [];
                     const isToday = date.getDate() === today.getDate() && date.getMonth() === today.getMonth();

                     return (
                         <div key={idx} className={`aspect-square border border-white/5 rounded-xl p-2 relative group hover:border-luxury-gold/30 transition-all ${isToday ? 'bg-luxury-gold/5 ring-1 ring-luxury-gold/50' : 'bg-black/20'}`}>
                             <span className={`text-xs font-bold ${isToday ? 'text-luxury-gold' : 'text-gray-500'}`}>{date.getDate()}</span>
                             
                             <div className="mt-1 space-y-1 max-h-[80px] overflow-y-auto no-scrollbar">
                                 {items.map(item => (
                                     <button 
                                        key={item.id} 
                                        onClick={() => onLoad(item)}
                                        className="w-full text-left text-[9px] bg-luxury-900/80 hover:bg-luxury-gold hover:text-luxury-900 border border-white/10 p-1 rounded truncate transition-colors"
                                        title={item.topic}
                                     >
                                         {item.topic}
                                     </button>
                                 ))}
                             </div>
                         </div>
                     );
                 })}
             </div>
        </div>

        <div className="bg-black/20 p-6 rounded-xl border border-white/5">
             <h3 className="text-lg font-serif text-white mb-2">Совет Стратега</h3>
             <p className="text-sm text-gray-400">
                 Регулярность — ключ к алгоритмам. Старайтесь заполнять хотя бы 3 дня в неделю. 
                 Используйте функцию <strong>"ZIP Экспорт"</strong> в пятницу, чтобы подготовить контент на все выходные.
             </p>
        </div>
    </div>
  );
};
