
import React, { useState, useEffect, useRef } from 'react';
import { ViewState } from '../types';

interface LayoutProps {
  currentView: ViewState;
  onNavigate: (view: ViewState) => void;
  children: React.ReactNode;
  toasts?: {id: string, message: string, type: 'success' | 'error'}[];
}

// --- PARTICLE SYSTEM ---
const GoldParticles = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let width = window.innerWidth;
        let height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;

        const particles: {x: number, y: number, vx: number, vy: number, size: number, alpha: number, t: number}[] = [];
        const particleCount = width < 768 ? 30 : 60; // Fewer on mobile

        for (let i = 0; i < particleCount; i++) {
            particles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                vx: (Math.random() - 0.5) * 0.2,
                vy: (Math.random() - 0.5) * 0.2,
                size: Math.random() * 2,
                alpha: Math.random() * 0.5,
                t: Math.random() * 100
            });
        }

        const animate = () => {
            ctx.clearRect(0, 0, width, height);
            
            particles.forEach(p => {
                p.t += 0.01;
                p.x += p.vx;
                p.y += p.vy;
                
                // Float effect
                p.y -= Math.sin(p.t) * 0.05;

                // Wrap around screen
                if (p.x < 0) p.x = width;
                if (p.x > width) p.x = 0;
                if (p.y < 0) p.y = height;
                if (p.y > height) p.y = 0;

                // Twinkle
                const opacity = p.alpha + Math.sin(p.t * 2) * 0.2;
                
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(212, 175, 55, ${Math.max(0, Math.min(0.8, opacity))})`;
                ctx.fill();
            });

            requestAnimationFrame(animate);
        };

        const animId = requestAnimationFrame(animate);

        const handleResize = () => {
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = width;
            canvas.height = height;
        };

        window.addEventListener('resize', handleResize);
        return () => {
            cancelAnimationFrame(animId);
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-[-1] opacity-60" />;
};

export const Layout: React.FC<LayoutProps> = ({ currentView, onNavigate, children, toasts = [] }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isTelegram, setIsTelegram] = useState(false);

  useEffect(() => {
    // Check for Telegram WebApp
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
        // We consider it "active" if the platform is not unknown or we are inside iframe
        if (tg.platform && tg.platform !== 'unknown') {
            setIsTelegram(true);
            tg.ready();
            tg.expand();
            
            // Set header color to match app
            if (tg.setHeaderColor) {
                tg.setHeaderColor('#000000');
            }
        }
    }
  }, []);

  const NavItem = ({ view, label, icon }: { view: ViewState, label: string, icon: React.ReactNode }) => (
    <button
      onClick={() => {
        onNavigate(view);
        setIsMobileMenuOpen(false);
      }}
      className={`w-full flex items-center gap-4 px-6 py-4 md:py-3 rounded-xl transition-all duration-300 group ${
        currentView === view 
          ? 'bg-gradient-to-r from-luxury-gold/20 to-transparent border-l-4 border-luxury-gold text-white shadow-[0_0_20px_rgba(212,175,55,0.1)]' 
          : 'text-gray-400 hover:text-luxury-gold hover:bg-white/5'
      }`}
    >
      <span className={`transition-transform duration-300 ${currentView === view ? 'scale-110 text-luxury-gold' : 'group-hover:scale-110'}`}>
        {icon}
      </span>
      <span className="font-medium tracking-wide">{label}</span>
    </button>
  );

  return (
    <div className="flex h-[100dvh] overflow-hidden text-gray-200 relative">
      <GoldParticles />
      
      {/* Toast Container - Mobile: Top Center, Desktop: Bottom Right */}
      <div className="fixed top-20 left-1/2 -translate-x-1/2 md:translate-x-0 md:top-auto md:left-auto md:bottom-8 md:right-8 z-[110] flex flex-col gap-3 pointer-events-none w-full max-w-sm px-4 md:px-0">
          {toasts.map(toast => (
              <div 
                key={toast.id} 
                className={`px-5 py-3.5 rounded-lg shadow-2xl backdrop-blur-xl border flex items-center gap-3 animate-slide-up pointer-events-auto ${
                    toast.type === 'success' 
                    ? 'bg-green-950/90 border-green-500/50 text-green-100 shadow-green-900/20' 
                    : 'bg-red-950/90 border-red-500/50 text-red-100 shadow-red-900/20'
                }`}
              >
                  {toast.type === 'success' ? (
                      <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                        <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                      </div>
                  ) : (
                      <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                         <svg className="w-3.5 h-3.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                      </div>
                  )}
                  <span className="font-medium text-sm leading-tight">{toast.message}</span>
              </div>
          ))}
      </div>

      {/* Sidebar for Desktop (Hide in Telegram) */}
      {!isTelegram && (
        <aside className="hidden md:flex flex-col w-72 border-r border-white/5 bg-black/20 backdrop-blur-xl z-10">
            <div className="p-8">
            <h1 className="text-3xl font-serif text-transparent bg-clip-text bg-gradient-to-r from-luxury-gold to-luxury-goldLight tracking-wide">PIN EMPIRE</h1>
            <p className="text-[10px] text-luxury-goldDim mt-2 uppercase tracking-[0.2em] border-t border-luxury-gold/10 pt-2 inline-block">AI Automation Suite</p>
            </div>
            <nav className="flex-1 px-4 space-y-2">
            <NavItem view={ViewState.DASHBOARD} label="Дашборд" icon={<IconDashboard />} />
            <NavItem view={ViewState.GENERATOR} label="Создать Пины" icon={<IconCreate />} />
            <NavItem view={ViewState.CALENDAR} label="Календарь" icon={<IconCalendar />} />
            <NavItem view={ViewState.HISTORY} label="Мои Проекты" icon={<IconHistory />} />
            <NavItem view={ViewState.ADVISOR} label="Советник" icon={<IconAdvisor />} />
            <NavItem view={ViewState.HELP} label="Обучение" icon={<IconHelp />} />
            </nav>
            <div className="p-6 border-t border-white/5">
            <div className="flex items-center gap-3 bg-white/5 rounded-lg p-3 border border-white/5">
                <div className="relative">
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                    <div className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-75"></div>
                </div>
                <span className="text-xs text-gray-400 font-medium tracking-wide">Система Активна</span>
            </div>
            </div>
        </aside>
      )}

      {/* Mobile Header (Hide in Telegram) */}
      {!isTelegram && (
        <div className="md:hidden fixed top-0 w-full z-50 bg-black/80 backdrop-blur-xl border-b border-white/10 flex items-center justify-between p-4 shadow-2xl">
            <h1 className="text-xl font-serif text-luxury-gold">PIN EMPIRE</h1>
            <button 
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
                className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-luxury-gold active:scale-95 transition-transform"
            >
            {isMobileMenuOpen ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg> : <IconMenu />}
            </button>
        </div>
      )}

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && !isTelegram && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/95 backdrop-blur-2xl pt-24 px-6 animate-fade-in">
           <nav className="space-y-4">
            <NavItem view={ViewState.DASHBOARD} label="Дашборд" icon={<IconDashboard />} />
            <NavItem view={ViewState.GENERATOR} label="Создать Пины" icon={<IconCreate />} />
            <NavItem view={ViewState.CALENDAR} label="Календарь" icon={<IconCalendar />} />
            <NavItem view={ViewState.HISTORY} label="Мои Проекты" icon={<IconHistory />} />
            <NavItem view={ViewState.ADVISOR} label="Советник" icon={<IconAdvisor />} />
            <NavItem view={ViewState.HELP} label="Обучение" icon={<IconHelp />} />
          </nav>
          <div className="absolute bottom-10 left-0 w-full px-6 text-center">
              <p className="text-xs text-gray-600 font-serif">DESIGNED FOR SUCCESS</p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className={`flex-1 overflow-y-auto relative ${isTelegram ? 'pt-0' : 'pt-20 md:pt-0'} scroll-smooth`}>
        {isTelegram && currentView !== ViewState.DASHBOARD && (
            // Simple Back Nav for Telegram
            <div className="sticky top-0 z-30 bg-black/80 backdrop-blur-md p-2 border-b border-white/5 flex gap-2">
                 <button onClick={() => onNavigate(ViewState.DASHBOARD)} className="text-xs text-luxury-gold border border-luxury-gold/30 px-3 py-1 rounded-full">← Домой</button>
                 {currentView !== ViewState.GENERATOR && <button onClick={() => onNavigate(ViewState.GENERATOR)} className="text-xs text-gray-300 border border-white/10 px-3 py-1 rounded-full">+ Генератор</button>}
                 {currentView !== ViewState.HISTORY && <button onClick={() => onNavigate(ViewState.HISTORY)} className="text-xs text-gray-300 border border-white/10 px-3 py-1 rounded-full">Проекты</button>}
            </div>
        )}
        <div className="max-w-7xl mx-auto p-4 md:p-8 lg:p-12 pb-24">
          {children}
        </div>
      </main>
    </div>
  );
};

// Icons (Simple SVGs)
const IconDashboard = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>;
const IconCreate = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>;
const IconHistory = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>;
const IconHelp = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>;
const IconMenu = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>;
const IconAdvisor = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>;
const IconCalendar = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
