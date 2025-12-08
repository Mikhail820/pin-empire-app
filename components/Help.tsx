
import React from 'react';

export const Help = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-12 animate-fade-in pb-12">
      <div className="text-center">
        <h2 className="text-4xl font-serif text-luxury-gold mb-4">Руководство Миллиардера по Pinterest</h2>
        <p className="text-xl text-gray-400">Универсальная стратегия доминирования. От Недвижимости до IT.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <Section title="1. Стратегия «Контекстный Мост»">
            <p>
                Ваши пины не живут в вакууме. Мы внедрили систему <strong>Contextual Bridging</strong>, которая работает для любой ниши.
                <br/><br/>
                <em>Пример для Недвижимости:</em><br/>
                Если вы загрузили фото квартиры, ИИ напишет: 
                <em>«Идеальная гостиная для ваших вечеров. Узнайте планировку в ЖК Высота (ссылка в профиле)»</em>.
                <br/><br/>
                <em>Пример для Инфобизнеса:</em><br/>
                Если вы продаете курс, ИИ напишет: 
                <em>«5 ошибок новичка в Python. Полный разбор в модуле 1 (ссылка)»</em>.
            </p>
        </Section>
        
        <Section title="2. Библиотека Активов">
            <p>
                Мы переработали "Библиотеку Книг" в универсальную <strong>Базу Активов</strong>.
                Загружайте сюда:
                <ul className="list-disc list-inside mt-2 text-gray-400">
                    <li>Бренд-буки и гайды.</li>
                    <li>Описания товаров (для Wildberries/Ozon).</li>
                    <li>Презентации услуг.</li>
                    <li>Главы книг или статьи.</li>
                </ul>
                Теперь один актив можно использовать бесконечно для генерации сотен идей.
            </p>
        </Section>

        <Section title="3. Форматы Победителей">
            <p>
                Мы убрали устаревшие форматы. Используйте:
                <ul className="list-disc list-inside mt-2 text-gray-400">
                    <li><strong>Вертикальный (3:4):</strong> Золотой стандарт для ленты.</li>
                    <li><strong>Story (9:16):</strong> Занимает весь экран мобильного. Максимальное внимание.</li>
                </ul>
            </p>
        </Section>
        
         <Section title="4. Видео-Студия (Reels/Shorts)">
            <p>
                Создавайте видео для любых соцсетей (VK, Telegram, YouTube).
                <ul className="list-disc list-inside mt-2 text-gray-400">
                    <li>Сгенерируйте изображения.</li>
                    <li>Выберите аудио-атмосферу (Business Pulse для продаж, Luxury для эстетики).</li>
                    <li>Используйте режим <strong>Smart Resize</strong>, чтобы вписать квадратные фото товаров в вертикальное видео без обрезки.</li>
                </ul>
            </p>
        </Section>

        <Section title="5. Безопасность Данных (Агентство)">
            <p>
                Ваши идеи — это актив. 
                <ul className="list-disc list-inside mt-2 text-gray-400">
                    <li><strong>ZIP Экспорт:</strong> Скачивайте весь проект архивом (картинки + файл стратегии) для отправки клиенту.</li>
                    <li><strong>Watermark:</strong> Включите защиту водяным знаком "DRAFT", пока клиент не оплатил работу.</li>
                    <li><strong>Backup:</strong> Регулярно скачивайте базу в JSON через раздел "Мои Проекты".</li>
                </ul>
            </p>
        </Section>

        <Section title="6. Интеграция с Telegram (Боты)">
            <p>
                Чтобы настроить автопостинг в канал через бота:
                <ol className="list-decimal list-inside mt-2 text-gray-400 space-y-2">
                    <li>В Telegram найдите <strong>@BotFather</strong> и создайте нового бота командой <code>/newbot</code>.</li>
                    <li>Скопируйте полученный <strong>API Token</strong>.</li>
                    <li>Добавьте созданного бота в ваш канал/чат как участника.</li>
                    <li><strong>ВАЖНО:</strong> Зайдите в настройки канала -> Администраторы -> Добавить бота. Дайте ему право <strong>"Post Messages"</strong>. Без прав админа бот не сможет писать.</li>
                    <li>В Дашборде (раздел Advanced) введите Токен и ID канала (например <code>@my_channel_name</code>).</li>
                </ol>
            </p>
        </Section>
      </div>

      <div className="bg-luxury-800 p-8 rounded-xl border border-gray-700">
        <h3 className="text-2xl font-serif text-white mb-4">Мобильная Студия (Mobile Workflow)</h3>
        <p className="text-gray-400 mb-4">Приложение оптимизировано для работы на ходу:</p>
        <ul className="list-disc list-inside space-y-2 text-gray-300">
             <li><strong>Крупные кнопки:</strong> Мы увеличили зоны нажатия для "Редактировать", "Скачать" и выбора галочек.</li>
             <li><strong>Публикация:</strong> Используйте кнопку Share, чтобы отправить готовый пост сразу в Telegram или VK. Текст скопируется автоматически.</li>
             <li><strong>История:</strong> Если вы переключились между вкладками, проект сохраняется автоматически.</li>
        </ul>
      </div>
    </div>
  );
};

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ title, children }) => (
    <div className="space-y-3">
        <h4 className="text-xl font-serif text-luxury-goldDim border-b border-gray-800 pb-2">{title}</h4>
        <div className="text-gray-400 leading-relaxed">{children}</div>
    </div>
);
