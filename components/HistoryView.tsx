
import React, { useRef } from 'react';
import { HistoryItem } from '../types';

interface HistoryViewProps {
  history: HistoryItem[];
  onLoad: (item: HistoryItem) => void;
  onDelete: (id: number) => void;
  onImport: (file: File) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ history, onLoad, onDelete, onImport }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const data = JSON.stringify(history, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pinempire_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          onImport(e.target.files[0]);
          e.target.value = ''; // Reset input
      }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-800 pb-4 gap-4">
          <h2 className="text-3xl font-serif text-luxury-gold">База Данных Контента</h2>
          <div className="flex gap-3">
              <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".json"
                  className="hidden"
              />
              <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="text-sm font-bold text-gray-300 border border-luxury-gold/30 px-4 py-2 rounded-lg hover:border-luxury-gold hover:text-luxury-gold hover:bg-luxury-800 transition-all flex items-center gap-2"
              >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                  Импорт (JSON)
              </button>
              <button 
                  onClick={handleExport}
                  className="text-sm font-bold text-luxury-900 bg-luxury-gold px-4 py-2 rounded-lg hover:bg-white transition-all flex items-center gap-2 shadow-lg shadow-luxury-gold/10"
              >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Экспорт (Backup)
              </button>
          </div>
      </div>
      
      {history.length === 0 && (
        <div className="text-center py-20 text-gray-500 border border-dashed border-gray-800 rounded-xl">
            <p className="mb-2">База пуста.</p>
            <p className="text-sm">Начните генерировать активы или загрузите резервную копию.</p>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
            <thead>
                <tr className="text-gray-500 text-sm border-b border-gray-800">
                    <th className="py-4 font-medium uppercase tracking-wider pl-4">Дата</th>
                    <th className="py-4 font-medium uppercase tracking-wider">Тема</th>
                    <th className="py-4 font-medium uppercase tracking-wider">Кол-во</th>
                    <th className="py-4 font-medium uppercase tracking-wider text-right pr-4">Действия</th>
                </tr>
            </thead>
            <tbody>
                {history.map((item) => (
                    <tr key={item.id} className="border-b border-gray-800/50 hover:bg-luxury-800/30 transition-colors group">
                        <td className="py-4 pl-4 text-sm text-gray-400">{new Date(item.date).toLocaleDateString()}</td>
                        <td className="py-4 text-white font-medium">{item.topic}</td>
                        <td className="py-4 text-gray-400">{item.pins.length}</td>
                        <td className="py-4 pr-4 text-right space-x-2">
                            <button 
                                onClick={() => onLoad(item)}
                                className="text-luxury-gold hover:text-luxury-900 hover:bg-luxury-gold text-sm font-bold px-3 py-1.5 border border-luxury-gold rounded-lg transition-all"
                            >
                                Открыть
                            </button>
                            <button 
                                onClick={() => onDelete(item.id)}
                                className="text-gray-600 hover:text-red-400 border border-transparent hover:border-red-900/50 text-sm px-3 py-1.5 rounded-lg transition-all hover:bg-red-900/10"
                                title="Удалить"
                            >
                                Удалить
                            </button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>
    </div>
  );
};
