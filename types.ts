
export interface PinData {
  id: string;
  title: string;
  description: string;
  altText: string;
  imagePrompt: string;
  overlayText: string; // Short, catchy text for image
  tags: string[];
  generatedImageUrl?: string; // The current display version (maybe with text)
  originalImageUrl?: string; // The clean version (no text)
  link?: string; 
  isPublished?: boolean;
}

export enum Platform {
  PINTEREST = 'Pinterest',
  TELEGRAM = 'Telegram',
  INSTAGRAM = 'Instagram',
  VK = 'VK',
  TIKTOK = 'TikTok / Reels',
  YANDEX = 'Yandex Direct',
  AVITO = 'Avito',
  WILDBERRIES = 'Wildberries',
  OZON = 'Ozon',
  DZEN = 'Dzen',
  YOUTUBE = 'YouTube',
  EMAIL = 'Email Newsletter'
}

export interface BriefData {
    brandName: string;
    targetAudience: string;
    toneOfVoice: string;
    keyGoal: string; // Sales, Awareness, etc.
    usp: string; // Unique Selling Proposition
    taboos: string; // What to avoid
    context: string; // The actual topic
}

export interface GenerationParams {
  input: string; // Can be text or extracted text from PDF/DOCX
  inputType: 'text' | 'file';
  
  // New: Client Brief Mode
  briefData?: BriefData;

  // Multimodal support
  base64Image?: string; // For vision capability
  imageMimeType?: string;

  count: number;
  language: string;
  imageStyle: ImageStyle;
  imageAspectRatio: '3:4' | '9:16' | '1:1' | '16:9';
  destinationLink?: string;
  productName?: string; 
  
  // Platform selection
  targetPlatform: Platform;

  // Visual Upgrade
  lighting: Lighting;
  composition: Composition;
  colorPalette: string;
  // Copywriting Upgrade
  hookType: HookType;
  seoKeyword: string;
  // Story Mode
  generationMode: 'variations' | 'story';
}

export interface Preset {
    id: string;
    name: string;
    params: Partial<GenerationParams>;
}

export interface Product {
    id: string;
    name: string;
    content: string; // The full text/book content
    link: string;
    date: string;
}

export enum ImageStyle {
  AUTO = 'Auto (AI Selection)',
  LUXURY = 'Luxury & Minimalist',
  BOHO = 'Boho Chic',
  MODERN = 'Modern Clean',
  DARK_ACADEMIA = 'Dark Academia',
  CONSTRUCTION = 'Architecture & Construction',
  BOOKS = 'Books & Literature',
  FASHION = 'High Fashion',
  TRAVEL = 'Wanderlust',
  DIY = 'DIY & Crafts',
  NEON = 'Cyberpunk Neon'
}

export enum Lighting {
    AUTO = 'Авто (AI)',
    GOLDEN = 'Золотой час (Тепло)',
    STUDIO = 'Студийный (Четкий)',
    MOODY = 'Moody (Драматичный)',
    NATURAL = 'Мягкий Дневной',
    NEON = 'Неоновый / Клубный'
}

export enum Composition {
    AUTO = 'Авто (AI)',
    FLATLAY = 'Flat Lay (Вид сверху)',
    MACRO = 'Макро (Детали)',
    WIDE = 'Широкий угол (Пространство)',
    MINIMAL = 'Минимализм (Много воздуха)',
    SYMMETRY = 'Симметрия'
}

export enum HookType {
    AUTO = 'Авто (AI Mix)',
    FOMO = 'FOMO (Страх упустить)',
    SECRET = 'Секрет / Миф',
    LISTICLE = 'Список (Цифры)',
    STORY = 'Личная История',
    DIRECT = 'Прямая Польза'
}

export interface HistoryItem {
  id: number;
  date: string;
  topic: string;
  pins: PinData[];
}

export enum ViewState {
  DASHBOARD = 'DASHBOARD',
  GENERATOR = 'GENERATOR',
  RESULTS = 'RESULTS',
  HELP = 'HELP',
  HISTORY = 'HISTORY',
  ADVISOR = 'ADVISOR',
  CALENDAR = 'CALENDAR'
}

export interface BoardSuggestion {
    broad: string[];
    niche: string[];
}

// NEW: Combined response type for single-shot generation
export interface CombinedGenerationResult {
    pins: PinData[];
    boards: BoardSuggestion;
}