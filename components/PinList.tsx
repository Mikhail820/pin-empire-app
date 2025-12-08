
import React, { useState, useEffect } from 'react';
import { PinData, BoardSuggestion } from '../types';
import { generateBoardSuggestions, rewritePinText, generateAlternativeTitles } from '../services/genai';

// Global declaration for JSZip (loaded via CDN)
declare const JSZip: any;
declare const QRCode: any; // QRCode library

interface PinListProps {
  pins: PinData[];
  topic: string;
  isLoading: boolean;
  onBack: () => void;
  onGenerateImage: (id: string, prompt: string, ratio: string) => Promise<string>;
  onGenerateMore: () => void;
  pinterestToken: string;
  onUpdatePin: (pin: PinData) => void;
  aspectRatio: string;
  savedBoards: string[];
  onSaveBoards: (names: string[]) => void;
  initialBoardSuggestions: BoardSuggestion | null;
}

const transliterate = (text: string): string => {
  const ru: { [key: string]: string } = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 
    'е': 'e', 'ё': 'yo', 'ж': 'zh', 'з': 'z', 'и': 'i', 
    'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 
    'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 
    'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 
    'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 
    'э': 'e', 'ю': 'yu', 'я': 'ya'
  };
  return text.toLowerCase().split('').map(char => ru[char] || char).join('').replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
};

const getSupportedMimeType = () => {
    const types = [
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
        'video/mp4' 
    ];
    for (const type of types) {
        if (MediaRecorder.isTypeSupported(type)) {
            return type;
        }
    }
    return '';
};

// --- AUDIO ENGINE ---
type AudioStyle = 'mute' | 'luxury' | 'focus' | 'pulse' | 'lofi';

const createAudioTrack = (ctx: AudioContext, style: AudioStyle, destination: MediaStreamAudioDestinationNode, duration: number) => {
    if (style === 'mute') return;

    const masterGain = ctx.createGain();
    masterGain.connect(destination);
    masterGain.gain.setValueAtTime(0, ctx.currentTime);
    masterGain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 1);

    if (style === 'luxury') {
        const osc1 = ctx.createOscillator();
        osc1.type = 'sine';
        osc1.frequency.value = 55; 
        const osc2 = ctx.createOscillator();
        osc2.type = 'triangle';
        osc2.frequency.value = 110; 
        const osc3 = ctx.createOscillator();
        osc3.type = 'sine';
        osc3.frequency.value = 110.5; 
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 400; 
        osc1.connect(filter);
        osc2.connect(filter);
        osc3.connect(filter);
        filter.connect(masterGain);
        osc1.start();
        osc2.start();
        osc3.start();
        osc1.stop(ctx.currentTime + duration);
        osc2.stop(ctx.currentTime + duration);
        osc3.stop(ctx.currentTime + duration);
    } 
    else if (style === 'focus') {
        const bufferSize = 2 * ctx.sampleRate;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let lastOut = 0;
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            lastOut = (lastOut + (0.02 * white)) / 1.02;
            data[i] = lastOut * 3.5; 
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 300; 
        noise.connect(filter);
        filter.connect(masterGain);
        noise.start();
        noise.stop(ctx.currentTime + duration);
    }
    else if (style === 'pulse') {
        const bpm = 120;
        const beatTime = 60 / bpm;
        const startTime = ctx.currentTime;
        for (let t = startTime; t < startTime + duration; t += beatTime) {
            const osc = ctx.createOscillator();
            const kickGain = ctx.createGain();
            osc.connect(kickGain);
            kickGain.connect(masterGain);
            osc.frequency.setValueAtTime(150, t);
            osc.frequency.exponentialRampToValueAtTime(0.01, t + 0.5);
            kickGain.gain.setValueAtTime(0.8, t);
            kickGain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
            osc.start(t);
            osc.stop(t + 0.5);
        }
    }
    else if (style === 'lofi') {
        const bufferSize = 2 * ctx.sampleRate;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            data[i] = white * 0.1; 
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true;
        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.value = 1000;
        noise.connect(noiseFilter);
        noiseFilter.connect(masterGain);
        noise.start();
        noise.stop(ctx.currentTime + duration);
        const chord = [261.63, 311.13, 392.00, 466.16]; 
        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 0.5; 
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 15; 
        lfo.connect(lfoGain);
        lfo.start();
        lfo.stop(ctx.currentTime + duration);
        const chordGain = ctx.createGain();
        chordGain.gain.value = 0.15; 
        chordGain.connect(masterGain);
        const chordFilter = ctx.createBiquadFilter();
        chordFilter.type = 'lowpass';
        chordFilter.frequency.value = 800;
        chordFilter.connect(chordGain);
        chord.forEach(freq => {
            const osc = ctx.createOscillator();
            osc.type = 'triangle';
            osc.frequency.value = freq;
            lfoGain.connect(osc.detune);
            osc.connect(chordFilter);
            osc.start();
            osc.stop(ctx.currentTime + duration);
        });
    }
    masterGain.gain.setValueAtTime(0.5, ctx.currentTime + duration - 1);
    masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);
};
// --- END AUDIO ENGINE ---

type VideoFitMode = 'cover' | 'contain';
const zoomSpeed = 0.002;

const createSlideshowVideo = async (imageUrls: string[], width: number, height: number, durationPerSlide: number, enableZoom: boolean, audioStyle: AudioStyle, fitMode: VideoFitMode): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.style.position = 'fixed';
        canvas.style.left = '-9999px';
        canvas.style.top = '0';
        canvas.style.pointerEvents = 'none';
        document.body.appendChild(canvas);

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            document.body.removeChild(canvas);
            reject(new Error("Canvas context not supported"));
            return;
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, height);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const stream = (canvas as any).captureStream ? (canvas as any).captureStream(30) : (canvas as any).mozCaptureStream ? (canvas as any).mozCaptureStream(30) : null;
        if (!stream) {
            document.body.removeChild(canvas);
            reject(new Error("Video capture not supported."));
            return;
        }

        let audioCtx: AudioContext | null = null;
        let audioDest: MediaStreamAudioDestinationNode | null = null;
        if (audioStyle !== 'mute') {
            try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
                if (AudioContextClass) {
                    audioCtx = new AudioContextClass();
                    audioDest = audioCtx.createMediaStreamDestination();
                    const audioTrack = audioDest.stream.getAudioTracks()[0];
                    if (audioTrack) stream.addTrack(audioTrack);
                }
            } catch (e) {
                console.warn("Audio Context failed", e);
            }
        }

        const mimeType = getSupportedMimeType();
        let recorder: MediaRecorder;
        try {
            const options = mimeType ? { mimeType } : undefined;
            recorder = new MediaRecorder(stream, options);
        } catch (e) {
            try {
                recorder = new MediaRecorder(stream);
            } catch (e2) {
                document.body.removeChild(canvas);
                reject(new Error("Failed to initialize video recorder."));
                return;
            }
        }
        
        const chunks: Blob[] = [];
        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunks.push(e.data);
        };

        recorder.onstop = () => {
            document.body.removeChild(canvas);
            if (audioCtx) audioCtx.close();
            if (chunks.length === 0) {
                reject(new Error("Video recording failed."));
                return;
            }
            const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
            resolve(blob);
        };

        try {
            recorder.start();
        } catch (e) {
             document.body.removeChild(canvas);
             reject(new Error("Could not start recording."));
             return;
        }

        const loadImages = imageUrls.map(url => {
            return new Promise<HTMLImageElement>((res, rej) => {
                const img = new Image();
                img.crossOrigin = "anonymous";
                img.onload = () => res(img);
                img.onerror = () => rej(new Error("Image load failed"));
                img.src = url;
            });
        });

        Promise.all(loadImages).then(async (images) => {
            try {
                const fps = 30;
                const displayDuration = Math.round(durationPerSlide * fps);
                const fadeDuration = 20; 
                // Fix glitch: ensure we calculate total frames correctly
                const currentZoomSpeed = enableZoom ? zoomSpeed : 0;

                if (audioCtx && audioDest) {
                    const totalDurationSec = (images.length * (displayDuration + fadeDuration)) / fps;
                    createAudioTrack(audioCtx, audioStyle, audioDest, totalDurationSec + 1);
                }

                const drawFrame = (img: HTMLImageElement, scale: number, globalAlpha: number) => {
                    ctx.globalAlpha = globalAlpha;
                    
                    if (fitMode === 'contain') {
                         ctx.save();
                         const bgScale = Math.max(width / img.width, height / img.height) * 1.1;
                         const bgW = img.width * bgScale;
                         const bgH = img.height * bgScale;
                         const bgX = (width - bgW) / 2;
                         const bgY = (height - bgH) / 2;
                         
                         ctx.filter = 'blur(20px) brightness(0.6)';
                         ctx.drawImage(img, bgX, bgY, bgW, bgH);
                         ctx.restore();

                         const fitScale = Math.min(width / img.width, height / img.height) * 0.9 * scale;
                         const w = img.width * fitScale;
                         const h = img.height * fitScale;
                         const x = (width - w) / 2;
                         const y = (height - h) / 2;

                         ctx.shadowColor = "rgba(0,0,0,0.5)";
                         ctx.shadowBlur = 20;
                         ctx.shadowOffsetY = 10;
                         ctx.drawImage(img, x, y, w, h);
                         ctx.shadowColor = "transparent";
                         ctx.shadowBlur = 0;

                    } else {
                        const w = width * scale;
                        const h = height * scale;
                        const x = (width - w) / 2;
                        const y = (height - h) / 2;
                        if (globalAlpha < 1) {
                             ctx.fillStyle = '#000000';
                             ctx.fillRect(0,0,width,height);
                        }
                        ctx.drawImage(img, x, y, w, h);
                    }
                };

                for (let i = 0; i < images.length; i++) {
                    const img = images[i];
                    const nextImg = i < images.length - 1 ? images[i + 1] : null;
                    const startFrame = i === 0 ? 0 : fadeDuration;
                    const endFrame = (i === images.length - 1) ? displayDuration + fadeDuration : displayDuration;

                    for (let f = startFrame; f < endFrame; f++) {
                        const scale = 1 + (f * currentZoomSpeed);
                        
                        if (fitMode === 'contain') {
                             ctx.fillStyle = '#000000';
                             ctx.fillRect(0, 0, width, height);
                        }
                        
                        drawFrame(img, scale, 1);
                        await new Promise(r => setTimeout(r, 33));
                    }

                    if (nextImg) {
                        for (let f = 0; f <= fadeDuration; f++) {
                            const alpha = f / fadeDuration;
                            
                            if (fitMode === 'contain') {
                                 ctx.fillStyle = '#000000';
                                 ctx.fillRect(0, 0, width, height);
                                 const prevScale = 1 + ((displayDuration + f) * currentZoomSpeed);
                                 drawFrame(img, prevScale, 1); 
                            }
                            
                            const nextScale = 1 + (f * currentZoomSpeed);
                            drawFrame(nextImg, nextScale, alpha);

                            await new Promise(r => setTimeout(r, 33));
                        }
                    }
                }
                recorder.stop();
            } catch (drawError) {
                recorder.stop();
                reject(drawError);
            }
        }).catch(e => {
            recorder.stop();
            reject(e);
        });
    });
};

// --- AGENCY MODE UTILS ---
const applyWatermark = (imageUrl: string, text: string = "DRAFT • PIN EMPIRE"): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if(!ctx) return resolve(imageUrl);
            
            ctx.drawImage(img, 0, 0);
            
            const fontSize = img.width * 0.06;
            ctx.font = `900 ${fontSize}px sans-serif`;
            ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.shadowColor = "rgba(0,0,0,0.5)";
            ctx.shadowBlur = 10;
            
            ctx.save();
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate(-Math.PI / 4);
            ctx.fillText(text, 0, 0);
            ctx.restore();
            
            ctx.font = `bold ${fontSize * 0.5}px sans-serif`;
            ctx.fillText(text, canvas.width / 2, canvas.height - (fontSize));

            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => resolve(imageUrl);
        img.src = imageUrl;
    });
};

const QRGenerator = ({url, onClose}: {url: string, onClose: () => void}) => {
    const [qrDataUrl, setQrDataUrl] = useState<string>('');
    const [error, setError] = useState('');

    useEffect(() => {
        try {
            if (typeof QRCode === 'undefined') {
                setError("Библиотека QR не загружена. Проверьте интернет.");
                return;
            }
            const div = document.createElement('div');
            // @ts-ignore
            new QRCode(div, {
                text: url,
                width: 512,
                height: 512,
                colorDark : "#d4af37", // Gold
                colorLight : "#000000", // Black
                correctLevel : 3 // High error correction
            });
            const canvas = div.querySelector('canvas');
            if (canvas) setQrDataUrl(canvas.toDataURL('image/png'));
        } catch (e) {
            console.error(e);
            setError("Ошибка генерации кода");
        }
    }, [url]);

    return (
        <div className="fixed inset-0 z-[150] bg-black/95 flex items-center justify-center p-6 backdrop-blur-md animate-fade-in">
             <div className="bg-[#121212] border border-luxury-gold rounded-2xl p-8 max-w-sm w-full text-center relative shadow-[0_0_50px_rgba(212,175,55,0.2)]">
                 <button onClick={onClose} className="absolute top-2 right-2 text-gray-500 hover:text-white p-2">✕</button>
                 <h3 className="text-2xl font-serif text-white mb-2">Lux Link</h3>
                 <p className="text-gray-400 text-xs mb-6 break-all">{url}</p>
                 
                 {error ? (
                    <div className="w-64 h-64 mx-auto bg-red-900/20 border border-red-500/30 rounded-lg flex items-center justify-center text-red-400 text-sm mb-6">
                        {error}
                    </div>
                 ) : qrDataUrl ? (
                     <div className="relative mx-auto w-64 h-64 mb-6 group">
                         <img src={qrDataUrl} alt="QR" className="w-full h-full rounded-lg shadow-lg border-2 border-luxury-gold/20" />
                         <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 rounded-lg">
                             <a href={qrDataUrl} download="lux_qr.png" className="bg-luxury-gold text-black font-bold px-4 py-2 rounded-full transform scale-110">Скачать PNG</a>
                         </div>
                     </div>
                 ) : (
                     <div className="w-64 h-64 mx-auto bg-black/50 animate-pulse rounded-lg mb-6 flex items-center justify-center">
                        <span className="text-luxury-gold text-xs">Генерация QR...</span>
                     </div>
                 )}
                 <p className="text-[10px] text-gray-600 uppercase tracking-widest">Scan to access project</p>
             </div>
        </div>
    );
};

// ... export const PinList ...
export const PinList: React.FC<PinListProps> = ({ 
    pins, topic, isLoading, onBack, onGenerateImage, onGenerateMore, pinterestToken, onUpdatePin, aspectRatio, savedBoards, onSaveBoards, initialBoardSuggestions
}) => {
  // ... existing PinList state and methods ...
  const [isBatchLoading, setIsBatchLoading] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [boards, setBoards] = useState<BoardSuggestion | null>(initialBoardSuggestions);
  const [loadingBoards, setLoadingBoards] = useState(false);
  const [copiedBoard, setCopiedBoard] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  
  const [videoQuality, setVideoQuality] = useState<'720p' | '1080p'>('720p');
  const [videoSpeed, setVideoSpeed] = useState<number>(2.5);
  const [audioStyle, setAudioStyle] = useState<AudioStyle>('mute');
  const [videoFit, setVideoFit] = useState<VideoFitMode>('cover'); 
  const [downloadBatchStatus, setDownloadBatchStatus] = useState<string>('📥 Save All');

  const [useWatermark, setUseWatermark] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const [selectedPins, setSelectedPins] = useState<Set<string>>(new Set());
  const [isSlideshowGenerating, setIsSlideshowGenerating] = useState(false);

  // ... useEffects ...
  useEffect(() => { if (initialBoardSuggestions) setBoards(initialBoardSuggestions); }, [initialBoardSuggestions]);
  useEffect(() => { let interval: any; if (cooldown > 0) interval = setInterval(() => setCooldown(c => c - 1), 1000); return () => clearInterval(interval); }, [cooldown]);

  const handleGenerateBoards = () => { if (cooldown > 0) return; setLoadingBoards(true); generateBoardSuggestions(pins, topic, savedBoards).then(newBoards => { setBoards(newBoards); onSaveBoards([...newBoards.broad, ...newBoards.niche]); }).catch(e => { if (e.message?.includes('QUOTA') || e.message?.includes('429')) triggerCooldown(); }).finally(() => setLoadingBoards(false)); };
  const triggerCooldown = () => setCooldown(120);
  const toggleSelection = (id: string) => { const newSet = new Set(selectedPins); if (newSet.has(id)) newSet.delete(id); else newSet.add(id); setSelectedPins(newSet); };

  const handleCreateSlideshow = async () => {
      // ... same logic as before ...
      const selected = pins.filter(p => selectedPins.has(p.id) && p.generatedImageUrl);
      if (selected.length < 1) { alert("Выберите хотя бы 1 пин."); return; }
      setIsSlideshowGenerating(true);
      try {
          const isFullHD = videoQuality === '1080p';
          let w = 720; let h = 1280; 
          if (isFullHD) {
              if (aspectRatio === '1:1') { w = 1080; h = 1080; } else if (aspectRatio === '3:4') { w = 1080; h = 1440; } else if (aspectRatio === '16:9') { w = 1920; h = 1080; } else { w = 1080; h = 1920; }
          } else {
              if (aspectRatio === '1:1') { w = 720; h = 720; } else if (aspectRatio === '3:4') { w = 720; h = 960; } else if (aspectRatio === '16:9') { w = 1280; h = 720; } else { w = 720; h = 1280; }
          }
          if (videoFit === 'contain' && aspectRatio === '1:1') { w = isFullHD ? 1080 : 720; h = isFullHD ? 1920 : 1280; }

          const imageUrls = selected.map(p => p.generatedImageUrl!);
          const isStatic = videoSpeed === 0;
          const duration = isStatic ? 2.5 : videoSpeed;
          const enableZoom = !isStatic;

          const blob = await createSlideshowVideo(imageUrls, w, h, duration, enableZoom, audioStyle, videoFit);
          
          const slug = transliterate(topic).slice(0, 60);
          const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
          const filename = slug ? `${slug}_video` : `pinempire_video_${Date.now()}`;
          const fullFilename = `${filename}.${ext}`;
          const file = new File([blob], fullFilename, { type: blob.type });

          if (navigator.canShare && navigator.canShare({ files: [file] })) {
              try { await navigator.share({ files: [file], title: topic, text: `${topic} #pinempire` }); } 
              catch (shareError) { const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = fullFilename; document.body.appendChild(link); link.click(); document.body.removeChild(link); }
          } else {
              const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = fullFilename; document.body.appendChild(link); link.click(); document.body.removeChild(link);
          }
      } catch (e: any) { console.error(e); alert(`Ошибка: ${e.message || "Сбой памяти"}.`); } finally { setIsSlideshowGenerating(false); }
  };

  const handleDownloadBatch = async () => {
    // ... same logic as before ...
    const selected = pins.filter(p => selectedPins.has(p.id) && p.generatedImageUrl);
    if (selected.length === 0) { alert("Выберите пины с готовыми картинками."); return; }
    const commonTags = selected[0].tags.map(t => '#' + t.replace(/#/g, '')).join(' ');
    const textToCopy = `${topic}\n\n${commonTags}`;
    try { await navigator.clipboard.writeText(textToCopy); setDownloadBatchStatus("📋 Copied!"); } catch (e) { setDownloadBatchStatus("Saving..."); }
    for (const pin of selected) { if (pin.generatedImageUrl) { const link = document.createElement('a'); link.href = pin.generatedImageUrl; link.download = `${transliterate(pin.title).slice(0,30)}_${Date.now()}.png`; document.body.appendChild(link); link.click(); document.body.removeChild(link); await new Promise(r => setTimeout(r, 500)); } }
    setTimeout(() => { setDownloadBatchStatus("✅ Done"); setTimeout(() => setDownloadBatchStatus("📥 Save All"), 2000); }, 1000);
  };

  const handleZipExport = async () => {
      // ... same logic as before ...
      const selected = pins.filter(p => selectedPins.has(p.id) && p.generatedImageUrl);
      if (selected.length === 0) { alert("Выберите пины с готовыми картинками для архива."); return; }
      setIsZipping(true);
      try {
          if (!JSZip) throw new Error("ZIP Library not loaded");
          const zip = new JSZip(); const imgFolder = zip.folder("images");
          let strategyText = `# PROJECT STRATEGY: ${topic.toUpperCase()}\n\n`; strategyText += `Generated by PinEmpire AI\nDate: ${new Date().toLocaleDateString()}\n\n`; strategyText += `------------------------------------------------\n\n`;
          for (let i = 0; i < selected.length; i++) {
              const pin = selected[i]; const safeName = transliterate(pin.title).slice(0, 40) + `_${i+1}`;
              let imgDataUrl = pin.generatedImageUrl!; if (useWatermark) { imgDataUrl = await applyWatermark(imgDataUrl); }
              const base64Data = imgDataUrl.split(',')[1]; imgFolder?.file(`${safeName}.png`, base64Data, {base64: true});
              strategyText += `[ASSET ${i+1}]: ${pin.title}\nFILE: ${safeName}.png\nDESCRIPTION:\n${pin.description}\nTAGS: ${pin.tags.map(t => '#' + t.replace(/#/g,'')).join(' ')}\nLINK: ${pin.link || 'N/A'}\n\n------------------------------------------------\n\n`;
          }
          zip.file("strategy_plan.txt", strategyText);
          const content = await zip.generateAsync({type: "blob"}); const link = document.createElement('a'); link.href = URL.createObjectURL(content); link.download = `${transliterate(topic)}_PROJECT_PACK.zip`; document.body.appendChild(link); link.click(); document.body.removeChild(link);
      } catch (e: any) { console.error(e); alert("Ошибка создания ZIP архива."); } finally { setIsZipping(false); }
  };

  const handleExportCSV = () => { const headers = ["Title", "Description", "Link", "Tags"]; const csvContent = [headers.join(","), ...pins.map(p => `"${p.title}","${p.description}","${p.link}","${p.tags}"`)].join("\n"); const blob = new Blob([csvContent], { type: 'text/csv' }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "pins.csv"; link.click(); };

  const handleBatchGenerate = async () => { if (cooldown > 0) return; setIsBatchLoading(true); setBatchProgress(0); const pinsToGen = pins.filter(p => !p.generatedImageUrl); let count = 0; for (const pin of pinsToGen) { try { if (count > 0) await new Promise(r => setTimeout(r, 4000)); const url = await onGenerateImage(pin.id, pin.imagePrompt, aspectRatio); onUpdatePin({...pin, generatedImageUrl: url, originalImageUrl: url}); } catch (e: any) { if (e.message === 'QUOTA_EXCEEDED' || e.message?.toLowerCase().includes('quota')) { triggerCooldown(); break; } } count++; setBatchProgress(Math.round((count / pinsToGen.length) * 100)); } setIsBatchLoading(false); };
  const copyBoard = (name: string) => { navigator.clipboard.writeText(name); setCopiedBoard(name); setTimeout(() => setCopiedBoard(null), 1500); };

  return (
    <div className="space-y-8 pb-32">
      {/* ... Cooldown, QR, TopBar, Boards ... (same as before) */}
      {cooldown > 0 && <div className="fixed bottom-0 left-0 w-full bg-luxury-900/95 border-t border-luxury-gold p-6 z-[100] backdrop-blur-xl flex flex-col items-center justify-center animate-slide-up shadow-[0_-10px_40px_rgba(0,0,0,0.8)]"><p className="text-luxury-gold font-bold uppercase tracking-widest text-xs mb-1">Лимит API (Quota)</p><div className="text-4xl font-serif text-white font-bold tabular-nums">{cooldown}<span className="text-lg text-gray-500">с</span></div><p className="text-gray-400 text-xs mt-2 text-center max-w-xs">Система охлаждается</p></div>}
      {showQR && <QRGenerator url={pins[0]?.link || "https://pinempire.ai"} onClose={() => setShowQR(false)} />}
      
      {/* TopBar */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center bg-black/40 p-6 rounded-2xl border border-white/5 backdrop-blur-md sticky top-0 z-30 shadow-2xl gap-4">
        <div className="flex flex-col gap-1 w-full xl:w-auto">
          <button onClick={onBack} className="self-start text-gray-400 hover:text-white flex items-center gap-2 mb-1 text-sm bg-white/5 px-3 py-1.5 rounded-lg border border-transparent hover:border-gray-600 transition-all">← Назад</button>
          <h2 className="text-xl font-serif text-white flex items-center gap-2 w-full"><span className="text-gray-500">Тема:</span> <span className="text-luxury-gold truncate max-w-[200px] md:max-w-md">{topic}</span></h2>
        </div>
        
        {selectedPins.size > 0 ? (
             <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 bg-luxury-gold/10 border border-luxury-gold px-4 py-3 rounded-xl animate-fade-in w-full xl:w-auto flex-wrap">
                 <div className="flex justify-between w-full md:w-auto items-center gap-3">
                     <span className="text-luxury-gold text-sm font-bold whitespace-nowrap self-center">Выбрано: {selectedPins.size}</span>
                     <div className="flex md:hidden gap-2">
                         <button onClick={() => setSelectedPins(new Set())} className="text-gray-400 hover:text-white text-xs px-2 self-center">Отмена</button>
                     </div>
                 </div>
                 
                 <div className="grid grid-cols-2 md:flex gap-2 w-full md:w-auto">
                     <select value={videoQuality} onChange={(e) => setVideoQuality(e.target.value as any)} className="bg-black/50 border border-luxury-gold/30 text-white text-xs rounded-lg px-2 py-2 outline-none focus:border-luxury-gold w-full md:w-auto"><option value="720p">⚡ HD</option><option value="1080p">💎 FullHD</option></select>
                     <select value={videoSpeed} onChange={(e) => setVideoSpeed(Number(e.target.value))} className="bg-black/50 border border-luxury-gold/30 text-white text-xs rounded-lg px-2 py-2 outline-none focus:border-luxury-gold w-full md:w-auto"><option value="1.5">🚀 1.5с</option><option value="2.5">✨ 2.5с</option><option value="4.0">🐢 4.0с</option><option value="0">🗿 Без зума</option></select>
                     <select value={audioStyle} onChange={(e) => setAudioStyle(e.target.value as AudioStyle)} className="bg-black/50 border border-luxury-gold/30 text-white text-xs rounded-lg px-2 py-2 outline-none focus:border-luxury-gold w-full md:w-auto col-span-2 md:col-span-1"><option value="mute">🔇 Без звука</option><option value="luxury">🌊 Luxury</option><option value="focus">🧠 Focus</option><option value="pulse">🚀 Pulse</option><option value="lofi">☕ Lo-Fi</option></select>
                     <button onClick={() => setVideoFit(f => f === 'cover' ? 'contain' : 'cover')} className="bg-black/50 border border-luxury-gold/30 text-white text-xs rounded-lg px-2 py-2 outline-none focus:border-luxury-gold whitespace-nowrap col-span-2 md:col-span-1" title="Fit Mode">{videoFit === 'cover' ? '🔍 Zoom' : '🖼️ Fit (Blur)'}</button>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-2 w-full md:w-auto">
                    <button onClick={handleCreateSlideshow} disabled={isSlideshowGenerating} className="whitespace-nowrap bg-luxury-gold text-luxury-900 font-bold px-4 py-2 rounded-lg shadow-lg hover:bg-white transition-all text-xs flex items-center justify-center gap-2">{isSlideshowGenerating ? <span className="animate-spin">⚙️</span> : '🎬'} Video</button>
                    <button onClick={handleZipExport} disabled={isZipping} className={`whitespace-nowrap bg-black/40 border border-luxury-gold/30 font-bold px-3 py-2 rounded-lg hover:text-white hover:border-luxury-gold transition-all text-xs flex items-center justify-center gap-2 ${isZipping ? 'opacity-50' : ''}`} title="Download Project ZIP">{isZipping ? <span className="animate-spin">⚙️</span> : '📦 ZIP'}</button>
                 </div>
                 
                 <div className="flex gap-2 w-full md:w-auto justify-between">
                     <button onClick={() => setUseWatermark(!useWatermark)} className={`flex-1 md:flex-none text-xs px-3 py-1.5 rounded-lg border transition-all ${useWatermark ? 'bg-luxury-gold text-black border-luxury-gold' : 'bg-black/20 text-gray-400 border-gray-600'}`}>{useWatermark ? '🛡️ Mark ON' : '🛡️ Mark OFF'}</button>
                     <button onClick={() => setShowQR(true)} className="flex-none px-4 py-2 bg-white/5 text-gray-300 border border-white/10 rounded-xl hover:bg-white/10 transition-all font-bold text-xs" title="QR Code">🏁 QR</button>
                     <button onClick={handleDownloadBatch} className="flex-1 md:flex-none text-xs font-bold px-3 py-2 rounded-lg border border-luxury-gold/30 bg-black/40 text-luxury-gold whitespace-nowrap overflow-hidden text-ellipsis">{downloadBatchStatus}</button>
                 </div>
                 
                 <button onClick={() => setSelectedPins(new Set())} className="hidden md:block text-gray-400 hover:text-white text-xs px-2 self-center">✕</button>
             </div>
        ) : (
            <div className="grid grid-cols-2 md:flex gap-3 items-center w-full xl:w-auto">
                <button onClick={onGenerateMore} disabled={isLoading || cooldown > 0} className={`col-span-2 md:col-span-1 whitespace-nowrap px-4 py-3 border rounded-xl transition-all flex items-center justify-center gap-2 text-sm font-bold shadow-lg ${cooldown > 0 ? 'border-red-900 text-red-400 bg-red-900/10 cursor-not-allowed' : 'border-luxury-gold text-luxury-gold hover:bg-luxury-gold hover:text-luxury-900 shadow-luxury-gold/5'}`}>{isLoading ? <span className="animate-spin">↻</span> : cooldown > 0 ? `Остываем ${cooldown}с` : '+ Ещё 5'}</button>
                {pins.some(p => !p.generatedImageUrl) && <button onClick={handleBatchGenerate} disabled={isBatchLoading || cooldown > 0} className={`col-span-2 md:col-span-1 whitespace-nowrap px-4 py-3 border border-white/10 rounded-xl transition-all flex items-center justify-center gap-2 text-sm font-bold ${cooldown > 0 ? 'bg-red-900/10 text-red-500 cursor-not-allowed' : 'bg-[#1a1a1a] text-white hover:border-luxury-gold hover:bg-black'}`}>{isBatchLoading ? `${batchProgress}%` : cooldown > 0 ? `Ждите ${cooldown}с` : '⚡ Рендер Всех'}</button>}
                <button onClick={() => setShowQR(true)} className="px-4 py-3 bg-white/5 text-gray-300 border border-white/10 rounded-xl hover:bg-white/10 transition-all font-bold text-xs" title="QR Code">🏁 QR</button>
                <button onClick={handleExportCSV} className="px-4 py-3 bg-white/5 text-gray-300 border border-white/10 rounded-xl hover:bg-white/10 transition-all" title="CSV Export">📥</button>
            </div>
        )}
      </div>

      <div className="bg-gradient-to-br from-black/40 to-luxury-900/40 border border-white/5 rounded-2xl p-6 backdrop-blur-sm">
          <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-serif text-white flex items-center gap-2"><span className="text-luxury-gold">✦</span> Smart Boards</h3></div>
          {loadingBoards ? <div className="text-sm text-gray-500 animate-pulse">Анализ ниш...</div> : boards ? (
              <div className="space-y-4 animate-fade-in">
                  <div><h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Широкие Темы</h4><div className="flex flex-wrap gap-2">{boards.broad.map((b, i) => <button key={i} onClick={() => copyBoard(b)} className={`px-3 py-1.5 border rounded-lg text-sm transition-all ${copiedBoard === b ? 'bg-green-900/40 border-green-500 text-green-300' : 'bg-black/40 border-white/10 text-gray-300 hover:border-luxury-gold'}`}>{b}</button>)}</div></div>
                  <div><h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Узкие Ниши</h4><div className="flex flex-wrap gap-2">{boards.niche.map((b, i) => <button key={i} onClick={() => copyBoard(b)} className={`px-3 py-1.5 border rounded-lg text-sm transition-all ${copiedBoard === b ? 'bg-green-900/40 border-green-500 text-green-300' : 'bg-black/40 border-white/10 text-gray-300 hover:border-luxury-gold'}`}>{b}</button>)}</div></div>
              </div>
          ) : (<div className="text-center py-4"><button onClick={handleGenerateBoards} disabled={cooldown > 0} className={`text-sm text-luxury-gold border border-luxury-gold/30 px-6 py-2 rounded-lg hover:bg-luxury-gold hover:text-luxury-900 transition-all ${cooldown > 0 ? 'opacity-50 cursor-not-allowed' : ''}`}>{cooldown > 0 ? 'API Остывает...' : '🔎 Обновить Ниши (1 Запрос)'}</button></div>)}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {pins.map((pin) => (
          <PinCard key={pin.id} pin={pin} onGenerateImage={onGenerateImage} pinterestToken={pinterestToken} onUpdatePin={onUpdatePin} aspectRatio={aspectRatio} isSelected={selectedPins.has(pin.id)} onToggleSelect={() => toggleSelection(pin.id)} cooldown={cooldown} triggerCooldown={triggerCooldown} />
        ))}
      </div>
    </div>
  );
};

// ... PinCard Props, types ...
interface PinCardProps {
  pin: PinData;
  onGenerateImage: (id: string, p: string, r: string) => Promise<string>;
  pinterestToken: string;
  onUpdatePin: (pin: PinData) => void;
  aspectRatio: string;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  cooldown: number;
  triggerCooldown: () => void;
}

type OverlayStyle = 'modern' | 'luxury' | 'neon' | 'magazine' | 'minimal';
type FilterPreset = 'none' | 'noir' | 'vivid' | 'gold' | 'cinema';
type MockupType = 'none' | 'phone' | 'polaroid' | 'browser';
type StickerType = 'none' | 'sale' | 'new' | 'hit' | 'best';

const PinCard: React.FC<PinCardProps> = ({ pin, onGenerateImage, onUpdatePin, aspectRatio, isSelected, onToggleSelect, cooldown, triggerCooldown }) => {
  // ... existing state ...
  const [isImgLoading, setIsImgLoading] = useState(false);
  const [isEditingOverlay, setIsEditingOverlay] = useState(false);
  const [overlayText, setOverlayText] = useState(pin.overlayText || pin.title);
  const [subText, setSubText] = useState(''); 
  const [fontSize, setFontSize] = useState(8); 
  const [textPos, setTextPos] = useState<'top' | 'mid' | 'bot'>('bot');
  const [overlayStyle, setOverlayStyle] = useState<OverlayStyle>('luxury');
  const [dimValue, setDimValue] = useState(0.2);
  const [filter, setFilter] = useState<FilterPreset>('none');
  const [mockup, setMockup] = useState<MockupType>('none');
  const [sticker, setSticker] = useState<StickerType>('none');
  const [editorTab, setEditorTab] = useState<'text' | 'visual' | 'sticker'>('text');
  
  const [textHistory, setTextHistory] = useState<string[]>([pin.description]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const [showRemix, setShowRemix] = useState(false);
  const [isRemixing, setIsRemixing] = useState(false);
  const [showBattle, setShowBattle] = useState(false);
  const [battleTitles, setBattleTitles] = useState<string[]>([]);
  const [isBattling, setIsBattling] = useState(false);
  const [showCopyFeedback, setShowCopyFeedback] = useState(false);
  const [shareBtnText, setShareBtnText] = useState<string>("Share / Поделиться");

  useEffect(() => { if (pin.overlayText) setOverlayText(pin.overlayText); }, [pin.overlayText]);
  let aspectRatioClass = 'aspect-[3/4]'; 
  if (aspectRatio === '1:1') aspectRatioClass = 'aspect-square';
  if (aspectRatio === '16:9') aspectRatioClass = 'aspect-video';
  if (aspectRatio === '9:16') aspectRatioClass = 'aspect-[9/16]';

  const pushHistory = (newText: string) => { const newHistory = textHistory.slice(0, historyIndex + 1); newHistory.push(newText); setTextHistory(newHistory); setHistoryIndex(newHistory.length - 1); onUpdatePin({ ...pin, description: newText }); };
  const handleUndo = (e: React.MouseEvent) => { e.stopPropagation(); if (historyIndex > 0) { const newIndex = historyIndex - 1; setHistoryIndex(newIndex); onUpdatePin({ ...pin, description: textHistory[newIndex] }); } };
  const handleRedo = (e: React.MouseEvent) => { e.stopPropagation(); if (historyIndex < textHistory.length - 1) { const newIndex = historyIndex + 1; setHistoryIndex(newIndex); onUpdatePin({ ...pin, description: textHistory[newIndex] }); } };

  const handleGenImage = async (e: React.MouseEvent) => { e.stopPropagation(); if (cooldown > 0) return; setIsImgLoading(true); try { const url = await onGenerateImage(pin.id, pin.imagePrompt, aspectRatio); onUpdatePin({ ...pin, generatedImageUrl: url, originalImageUrl: url }); } catch (e: any) { const msg = e.message?.toLowerCase() || ""; if (msg.includes('quota') || msg.includes('429')) triggerCooldown(); else alert(e.message || "Ошибка генерации"); } finally { setIsImgLoading(false); } };
  const handleDownloadImage = (e: React.MouseEvent) => { e.stopPropagation(); if (!pin.generatedImageUrl) return; const slug = transliterate(pin.title); const link = document.createElement('a'); link.href = pin.generatedImageUrl; link.download = `${slug || 'pin'}.png`; document.body.appendChild(link); link.click(); document.body.removeChild(link); };
  const handleEditClick = (e: React.MouseEvent) => { e.stopPropagation(); setIsEditingOverlay(true); };

  const handleShare = async (e: React.MouseEvent) => {
      // ... same logic ...
      e.stopPropagation();
      if (!pin.generatedImageUrl) return;
      const textData = `${pin.title}\n\n${pin.description}\n\n${pin.tags.map(t => '#' + t.replace(/#/g, '')).join(' ')}`;
      try { await navigator.clipboard.writeText(textData); setShareBtnText("📋 Copied!"); } catch (err) { console.error("Clipboard copy failed", err); }
      try {
          const blob = await (await fetch(pin.generatedImageUrl)).blob(); const file = new File([blob], 'pin_empire_asset.png', { type: 'image/png' });
          const shareData = { title: pin.title, text: textData, files: [file] };
          if (navigator.share && navigator.canShare(shareData)) { await navigator.share(shareData); setTimeout(() => setShareBtnText("Share / Поделиться"), 2000); } 
          else { const link = document.createElement('a'); link.href = pin.generatedImageUrl; link.download = `pin_empire_post.png`; document.body.appendChild(link); link.click(); document.body.removeChild(link); setShareBtnText("💾 Скачано"); setShowCopyFeedback(true); setTimeout(() => { setShareBtnText("Share / Поделиться"); setShowCopyFeedback(false); }, 4000); }
      } catch (err) { console.error("Share failed", err); }
  };

  const handleRemix = async (tone: 'shorter' | 'sales' | 'humor', e: React.MouseEvent) => { e.stopPropagation(); if (cooldown > 0) return; setIsRemixing(true); setShowRemix(false); try { const newDesc = await rewritePinText(pin.description, tone, "Social Media"); pushHistory(newDesc); } catch (e: any) { if (e.message === 'QUOTA_EXCEEDED') triggerCooldown(); else alert("Ошибка рерайта."); } finally { setIsRemixing(false); } };
  const handleBattle = async (e: React.MouseEvent) => { e.stopPropagation(); if (cooldown > 0) return; setIsBattling(true); setShowBattle(true); try { const newTitles = await generateAlternativeTitles(pin.title); setBattleTitles(newTitles); } catch (e: any) { if (e.message === 'QUOTA_EXCEEDED') triggerCooldown(); setShowBattle(false); } finally { setIsBattling(false); } };
  const selectBattleWinner = (newTitle: string, e: React.MouseEvent) => { e.stopPropagation(); onUpdatePin({...pin, title: newTitle}); setShowBattle(false); };

  const applyEdits = async () => {
    // ... same canvas logic ...
    const sourceUrl = pin.originalImageUrl || pin.generatedImageUrl;
    if (!sourceUrl) return;
    const contentCanvas = document.createElement('canvas'); const ctx = contentCanvas.getContext('2d'); const img = new Image(); img.crossOrigin = "anonymous";
    img.onload = () => {
        contentCanvas.width = img.width; contentCanvas.height = img.height; if (!ctx) return;
        if (filter === 'noir') ctx.filter = 'grayscale(100%) contrast(120%)'; else if (filter === 'vivid') ctx.filter = 'saturate(150%) contrast(110%)'; else if (filter === 'gold') ctx.filter = 'sepia(30%) saturate(140%) brightness(110%)'; else if (filter === 'cinema') ctx.filter = 'contrast(120%) brightness(90%) saturate(110%)'; else ctx.filter = 'none';
        ctx.drawImage(img, 0, 0); ctx.filter = 'none'; 
        if (dimValue > 0) { ctx.fillStyle = `rgba(0,0,0,${dimValue})`; ctx.fillRect(0, 0, contentCanvas.width, contentCanvas.height); }

        if (sticker !== 'none') {
            const sizeS = contentCanvas.width * 0.25; let sx = contentCanvas.width * 0.1; let sy = contentCanvas.height * 0.1;
            ctx.save(); ctx.translate(sx + sizeS/2, sy + sizeS/2); ctx.rotate(-Math.PI / 10);
            if (sticker === 'sale') { ctx.fillStyle = "#e53e3e"; ctx.beginPath(); ctx.arc(0,0, sizeS/2, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = "white"; ctx.font = `bold ${sizeS*0.4}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("SALE", 0, 0); } 
            else if (sticker === 'new') { ctx.fillStyle = "#48bb78"; ctx.roundRect(-sizeS/2, -sizeS/4, sizeS, sizeS/2, 10); ctx.fill(); ctx.fillStyle = "white"; ctx.font = `bold ${sizeS*0.35}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("NEW", 0, 0); } 
            else if (sticker === 'hit') { ctx.fillStyle = "#d69e2e"; ctx.beginPath(); const spikes = 5; const outerRadius = sizeS/2; const innerRadius = sizeS/4; let rot = Math.PI/2 * 3; let x = 0; let y = 0; const step = Math.PI / spikes; ctx.moveTo(0,0 - outerRadius); for(let i=0; i<spikes; i++){ x = Math.cos(rot) * outerRadius; y = Math.sin(rot) * outerRadius; ctx.lineTo(x,y); rot += step; x = Math.cos(rot) * innerRadius; y = Math.sin(rot) * innerRadius; ctx.lineTo(x,y); rot += step; } ctx.lineTo(0, 0 - outerRadius); ctx.closePath(); ctx.fill(); ctx.fillStyle = "black"; ctx.font = `bold ${sizeS*0.3}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("HIT", 0, 0); } 
            else if (sticker === 'best') { ctx.fillStyle = "#000"; ctx.roundRect(-sizeS/2, -sizeS/2, sizeS, sizeS, 100); ctx.fill(); ctx.strokeStyle = "#d4af37"; ctx.lineWidth = 5; ctx.stroke(); ctx.fillStyle = "#d4af37"; ctx.font = `bold ${sizeS*0.3}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("BEST", 0, 0); }
            ctx.restore();
        }

        const sizePx = contentCanvas.width * (fontSize / 100); let yPos = contentCanvas.height * 0.5; if (textPos === 'top') yPos = contentCanvas.height * 0.15; if (textPos === 'bot') yPos = contentCanvas.height * 0.85;
        let fontFace = 'Inter, sans-serif'; let fontWeight = 'bold';
        if (overlayStyle === 'luxury') fontFace = 'Georgia, serif'; if (overlayStyle === 'magazine') { fontFace = '"Times New Roman", serif'; fontWeight = '900'; } if (overlayStyle === 'neon' || overlayStyle === 'minimal') { fontFace = '"Inter", sans-serif'; fontWeight = '800'; }

        const drawMultiText = (txt: string, y: number, size: number, sub: boolean = false) => {
            if (overlayStyle === 'luxury') { ctx.font = `${fontWeight} ${size}px ${fontFace}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.shadowColor = "rgba(0,0,0,0.9)"; ctx.shadowBlur = size * 0.4; const textGradient = ctx.createLinearGradient(0, y - size, 0, y + size); textGradient.addColorStop(0, "#fcf6ba"); textGradient.addColorStop(0.5, "#bf953f"); textGradient.addColorStop(1, "#fcf6ba"); ctx.fillStyle = textGradient; } 
            else if (overlayStyle === 'neon') { ctx.font = `${fontWeight} ${size}px ${fontFace}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.shadowColor = "#00ffff"; ctx.shadowBlur = size * 0.8; ctx.fillStyle = "#ffffff"; } 
            else if (overlayStyle === 'magazine') { ctx.font = `${fontWeight} ${size}px ${fontFace}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.fillStyle = "white"; } 
            else { ctx.font = `${fontWeight} ${size}px ${fontFace}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.shadowColor = "rgba(0,0,0,0.8)"; ctx.shadowBlur = size * 0.5; ctx.fillStyle = "white"; }
            
            const words = txt.split(' '); let line = ''; const lines = [];
            for(let n = 0; n < words.length; n++) { const testLine = line + words[n] + ' '; const metrics = ctx.measureText(testLine); if (metrics.width > contentCanvas.width * 0.9 && n > 0) { lines.push(line); line = words[n] + ' '; } else { line = testLine; } } lines.push(line);
            const lineHeight = size * 1.2; const totalHeight = lines.length * lineHeight; let startY = y - (totalHeight / 2) + (lineHeight / 2);

            if (overlayStyle === 'magazine') { const padding = size * 0.5; ctx.fillStyle = sub ? "#333" : "#000000"; const boxTop = startY - lineHeight/2 - padding/2; const boxHeight = totalHeight + padding; ctx.fillRect(0, boxTop, contentCanvas.width, boxHeight); ctx.fillStyle = "white"; }

            lines.forEach(l => { ctx.fillText(l.trim(), contentCanvas.width/2, startY); startY += lineHeight; });
            return startY;
        };

        let nextY = yPos; if (overlayText) { nextY = drawMultiText(overlayText, yPos, sizePx); }
        if (subText) { const subSize = sizePx * 0.6; drawMultiText(subText, yPos + sizePx * 1.5, subSize, true); }
        
        const finalCanvas = document.createElement('canvas'); const fCtx = finalCanvas.getContext('2d'); if (!fCtx) return;
        if (mockup === 'none') { finalCanvas.width = contentCanvas.width; finalCanvas.height = contentCanvas.height; fCtx.drawImage(contentCanvas, 0, 0); } 
        else if (mockup === 'polaroid') {
             const paddingX = contentCanvas.width * 0.1; const paddingY = contentCanvas.width * 0.1; const paddingBottom = contentCanvas.width * 0.3;
             finalCanvas.width = contentCanvas.width + (paddingX * 2); finalCanvas.height = contentCanvas.height + paddingY + paddingBottom;
             fCtx.fillStyle = "#fdfdfd"; fCtx.shadowColor = "rgba(0,0,0,0.4)"; fCtx.shadowBlur = 30; fCtx.fillRect(0, 0, finalCanvas.width, finalCanvas.height); fCtx.shadowColor = "transparent"; fCtx.fillStyle = "rgba(0,0,0,0.02)"; for(let i=0;i<100;i++) fCtx.fillRect(Math.random()*finalCanvas.width, Math.random()*finalCanvas.height, 2, 2);
             fCtx.drawImage(contentCanvas, paddingX, paddingY, contentCanvas.width, contentCanvas.height);
             fCtx.fillStyle = "#333"; fCtx.font = `${finalCanvas.width * 0.05}px "Courier New", monospace`; fCtx.textAlign = "center"; fCtx.fillText("pin empire collection", finalCanvas.width/2, finalCanvas.height - (paddingBottom/2));
        } else if (mockup === 'phone') {
             const borderW = contentCanvas.width * 0.05; finalCanvas.width = contentCanvas.width + (borderW * 2); finalCanvas.height = contentCanvas.height + (borderW * 2); const r = borderW * 2.5;
             fCtx.beginPath(); fCtx.roundRect(0, 0, finalCanvas.width, finalCanvas.height, r); fCtx.fillStyle = "#1a1a1a"; fCtx.shadowColor = "rgba(0,0,0,0.5)"; fCtx.shadowBlur = 40; fCtx.fill(); fCtx.shadowColor = "transparent";
             fCtx.beginPath(); fCtx.roundRect(borderW, borderW, contentCanvas.width, contentCanvas.height, r * 0.8); fCtx.save(); fCtx.clip(); fCtx.drawImage(contentCanvas, borderW, borderW); fCtx.restore();
             const notchW = finalCanvas.width * 0.3; const notchH = borderW * 1.5; fCtx.beginPath(); fCtx.roundRect((finalCanvas.width - notchW)/2, borderW, notchW, notchH, 20); fCtx.fillStyle = "black"; fCtx.fill();
             fCtx.beginPath(); fCtx.roundRect(0, 0, finalCanvas.width, finalCanvas.height, r); const grad = fCtx.createLinearGradient(0,0,finalCanvas.width, finalCanvas.height); grad.addColorStop(0, "rgba(255,255,255,0.1)"); grad.addColorStop(0.5, "transparent"); grad.addColorStop(1, "rgba(255,255,255,0.05)"); fCtx.fillStyle = grad; fCtx.fill();
        } else if (mockup === 'browser') {
             const headerH = contentCanvas.width * 0.08; finalCanvas.width = contentCanvas.width; finalCanvas.height = contentCanvas.height + headerH;
             fCtx.fillStyle = "#e5e5e5"; fCtx.fillRect(0, 0, finalCanvas.width, headerH);
             const dotR = headerH * 0.25; const dotY = headerH / 2; const startX = headerH * 0.5;
             fCtx.beginPath(); fCtx.arc(startX, dotY, dotR, 0, Math.PI*2); fCtx.fillStyle = "#ff5f56"; fCtx.fill(); fCtx.beginPath(); fCtx.arc(startX + dotR*3, dotY, dotR, 0, Math.PI*2); fCtx.fillStyle = "#ffbd2e"; fCtx.fill(); fCtx.beginPath(); fCtx.arc(startX + dotR*6, dotY, dotR, 0, Math.PI*2); fCtx.fillStyle = "#27c93f"; fCtx.fill();
             fCtx.fillStyle = "white"; fCtx.roundRect(startX + dotR*9, headerH*0.2, finalCanvas.width * 0.6, headerH*0.6, 5); fCtx.fill();
             fCtx.drawImage(contentCanvas, 0, headerH);
        }
        const newUrl = finalCanvas.toDataURL('image/png'); onUpdatePin({ ...pin, generatedImageUrl: newUrl, overlayText: overlayText }); setIsEditingOverlay(false);
    };
    img.src = sourceUrl;
  };

  const copyToClipboard = (text: string) => navigator.clipboard.writeText(text);

  const StyleBtn = ({s, label}: {s: OverlayStyle, label: string}) => (<button onClick={() => setOverlayStyle(s)} className={`px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all whitespace-nowrap ${overlayStyle === s ? 'bg-luxury-gold text-black border-luxury-gold' : 'bg-black border-gray-600 text-gray-400'}`}>{label}</button>);
  const FilterBtn = ({f, label}: {f: FilterPreset, label: string}) => (<button onClick={() => setFilter(f)} className={`px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all whitespace-nowrap ${filter === f ? 'bg-luxury-gold text-black border-luxury-gold' : 'bg-black border-gray-600 text-gray-400'}`}>{label}</button>);
  const MockupBtn = ({m, label}: {m: MockupType, label: string}) => (<button onClick={() => setMockup(m)} className={`px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all whitespace-nowrap ${mockup === m ? 'bg-luxury-gold text-black border-luxury-gold' : 'bg-black border-gray-600 text-gray-400'}`}>{label}</button>);
  const StickerBtn = ({s, label}: {s: StickerType, label: string}) => (<button onClick={() => setSticker(s)} className={`px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all whitespace-nowrap ${sticker === s ? 'bg-luxury-gold text-black border-luxury-gold' : 'bg-black border-gray-600 text-gray-400'}`}>{label}</button>);

  // LIVE PREVIEW CSS STYLES
  const getPreviewTextStyle = (): React.CSSProperties => {
      const base: React.CSSProperties = {
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%) translateY(-50%)',
          width: '90%',
          textAlign: 'center',
          pointerEvents: 'none',
          zIndex: 40,
          lineHeight: 1.2
      };

      // Position
      if (textPos === 'top') base.top = '15%';
      else if (textPos === 'mid') base.top = '50%';
      else base.top = '85%';

      // Size
      base.fontSize = `${fontSize * 2.5}px`; // Approx scaling for screen

      // Styles
      if (overlayStyle === 'luxury') {
          base.fontFamily = 'Georgia, serif';
          base.fontWeight = 'bold';
          base.background = 'linear-gradient(to bottom, #fcf6ba, #bf953f, #fcf6ba)';
          base.WebkitBackgroundClip = 'text';
          base.WebkitTextFillColor = 'transparent';
          base.textShadow = '0px 4px 10px rgba(0,0,0,0.8)';
      } else if (overlayStyle === 'neon') {
          base.fontFamily = 'Inter, sans-serif';
          base.fontWeight = '800';
          base.color = 'white';
          base.textShadow = '0 0 10px #00ffff, 0 0 20px #00ffff';
      } else if (overlayStyle === 'magazine') {
          base.fontFamily = 'Times New Roman, serif';
          base.fontWeight = '900';
          base.color = 'white';
          base.backgroundColor = 'black';
          base.padding = '5px 10px';
      } else {
          base.fontFamily = 'Inter, sans-serif';
          base.fontWeight = '800';
          base.color = 'white';
          base.textShadow = '0 2px 10px rgba(0,0,0,0.8)';
      }

      return base;
  };
  
  const getStickerStyle = (): React.CSSProperties => {
      // Approximate placement for top-left
      return {
          position: 'absolute',
          top: '10%',
          left: '10%',
          zIndex: 35,
          fontSize: '12px',
          fontWeight: 'bold',
          transform: 'rotate(-10deg)',
          pointerEvents: 'none'
      };
  }

  return (
    <div className={`bg-[#121212] rounded-2xl overflow-hidden flex flex-col h-full relative transition-all duration-300 ${isSelected ? 'ring-2 ring-luxury-gold shadow-2xl' : 'border border-white/5 shadow-lg hover:border-white/10'}`}>
      <button onClick={onToggleSelect} className="absolute top-0 left-0 p-4 z-20 focus:outline-none active:scale-95 transition-transform">
          <div className={`w-8 h-8 md:w-6 md:h-6 rounded-full border-2 flex items-center justify-center transition-all shadow-lg ${isSelected ? 'bg-luxury-gold border-luxury-gold' : 'bg-black/40 border-white/50 backdrop-blur-md'}`}>
              {isSelected && <svg className="w-5 h-5 md:w-3.5 md:h-3.5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>}
          </div>
      </button>

      <div className={`relative bg-black w-full ${aspectRatioClass} group overflow-hidden`}>
        {pin.generatedImageUrl ? (
            <>
                <img src={pin.generatedImageUrl} alt="Generated" className={`w-full h-full object-cover transition-all duration-500`} style={{
                    filter: filter === 'noir' ? 'grayscale(100%) contrast(120%)' 
                          : filter === 'vivid' ? 'saturate(150%) contrast(110%)'
                          : filter === 'gold' ? 'sepia(30%) saturate(140%) brightness(110%)'
                          : filter === 'cinema' ? 'contrast(120%) brightness(90%) saturate(110%)'
                          : 'none',
                    opacity: isEditingOverlay && dimValue > 0 ? 1 - dimValue : 1
                }}/>
                
                {/* LIVE PREVIEW LAYER */}
                {isEditingOverlay && (
                    <>
                        {/* Text Preview */}
                        <div style={getPreviewTextStyle()}>
                            {overlayText}
                            {subText && <div style={{ fontSize: '0.6em', marginTop: '0.2em' }}>{subText}</div>}
                        </div>
                        {/* Sticker Preview */}
                        {sticker !== 'none' && (
                             <div style={getStickerStyle()}>
                                 {sticker === 'sale' && <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center text-white border-2 border-white shadow-lg">SALE</div>}
                                 {sticker === 'new' && <div className="px-3 py-1 bg-green-500 text-white rounded shadow-lg border border-white">NEW</div>}
                                 {sticker === 'hit' && <div className="w-16 h-16 bg-luxury-gold rounded-full flex items-center justify-center text-black font-black border-2 border-black shadow-lg">HIT</div>}
                                 {sticker === 'best' && <div className="w-16 h-16 bg-black border-2 border-luxury-gold rounded-full flex items-center justify-center text-luxury-gold font-bold shadow-lg">BEST</div>}
                             </div>
                        )}
                        {/* Dimmer Overlay for Preview if not using CSS opacity on image */}
                        {dimValue > 0 && <div className="absolute inset-0 pointer-events-none" style={{ backgroundColor: `rgba(0,0,0,${dimValue})`}}></div>}
                    </>
                )}

                {/* BOTTOM SHEET EDITOR */}
                {isEditingOverlay ? (
                    <div className="absolute bottom-0 left-0 w-full z-50 bg-black/80 backdrop-blur-xl border-t border-luxury-gold/30 rounded-t-2xl animate-slide-up flex flex-col max-h-[60%]">
                        <div className="flex gap-2 border-b border-gray-700 px-4 pt-2">
                             <button onClick={() => setEditorTab('text')} className={`flex-1 text-[10px] font-bold uppercase py-3 ${editorTab === 'text' ? 'text-luxury-gold border-b-2 border-luxury-gold' : 'text-gray-500'}`}>Текст</button>
                             <button onClick={() => setEditorTab('visual')} className={`flex-1 text-[10px] font-bold uppercase py-3 ${editorTab === 'visual' ? 'text-luxury-gold border-b-2 border-luxury-gold' : 'text-gray-500'}`}>Visual</button>
                             <button onClick={() => setEditorTab('sticker')} className={`flex-1 text-[10px] font-bold uppercase py-3 ${editorTab === 'sticker' ? 'text-luxury-gold border-b-2 border-luxury-gold' : 'text-gray-500'}`}>Stickers</button>
                        </div>
                        
                        <div className="overflow-y-auto p-4 space-y-4">
                             {editorTab === 'text' && (
                                 <>
                                    <div className="flex gap-2">
                                        <button onClick={() => setTextPos('top')} className={`flex-1 py-2 text-[10px] font-bold rounded border ${textPos === 'top' ? 'bg-white text-black border-white' : 'border-gray-600 text-gray-400'}`}>TOP</button>
                                        <button onClick={() => setTextPos('mid')} className={`flex-1 py-2 text-[10px] font-bold rounded border ${textPos === 'mid' ? 'bg-white text-black border-white' : 'border-gray-600 text-gray-400'}`}>MID</button>
                                        <button onClick={() => setTextPos('bot')} className={`flex-1 py-2 text-[10px] font-bold rounded border ${textPos === 'bot' ? 'bg-white text-black border-white' : 'border-gray-600 text-gray-400'}`}>BOT</button>
                                    </div>
                                    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                                        <StyleBtn s="luxury" label="👑 Gold" />
                                        <StyleBtn s="magazine" label="📰 Vogue" />
                                        <StyleBtn s="neon" label="⚡ Neon" />
                                        <StyleBtn s="minimal" label="☁️ Clean" />
                                    </div>
                                    <div className="space-y-1">
                                        <input type="text" value={overlayText} onChange={(e) => setOverlayText(e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded-lg p-2 text-white outline-none focus:border-luxury-gold text-xs" placeholder="Заголовок..."/>
                                        <input type="text" value={subText} onChange={(e) => setSubText(e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded-lg p-2 text-white outline-none focus:border-luxury-gold text-xs" placeholder="Подзаголовок (опц)..."/>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1"><label className="text-[9px] text-gray-400 uppercase">Размер</label><input type="range" min="4" max="15" step="0.5" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} className="w-full accent-luxury-gold h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"/></div>
                                        <div className="space-y-1"><label className="text-[9px] text-gray-400 uppercase">Затемнение</label><input type="range" min="0" max="0.8" step="0.1" value={dimValue} onChange={(e) => setDimValue(Number(e.target.value))} className="w-full accent-luxury-gold h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"/></div>
                                    </div>
                                 </>
                             )}
                             
                             {editorTab === 'visual' && (
                                 <div className="space-y-4">
                                     <div>
                                         <p className="text-[10px] text-gray-400 uppercase mb-2">Фильтры</p>
                                         <div className="grid grid-cols-3 gap-2">
                                             <FilterBtn f="none" label="Original" />
                                             <FilterBtn f="noir" label="Noir" />
                                             <FilterBtn f="vivid" label="Vivid" />
                                             <FilterBtn f="gold" label="Gold" />
                                             <FilterBtn f="cinema" label="Cinema" />
                                         </div>
                                     </div>
                                     <div>
                                         <p className="text-[10px] text-gray-400 uppercase mb-2">Mockups (3D)</p>
                                         <div className="grid grid-cols-2 gap-2">
                                             <MockupBtn m="none" label="🚫 Нет" />
                                             <MockupBtn m="phone" label="📱 Phone" />
                                             <MockupBtn m="polaroid" label="📸 Polaroid" />
                                             <MockupBtn m="browser" label="💻 Browser" />
                                         </div>
                                     </div>
                                 </div>
                             )}

                             {editorTab === 'sticker' && (
                                 <div className="grid grid-cols-3 gap-2">
                                     <StickerBtn s="none" label="🚫 Нет" />
                                     <StickerBtn s="sale" label="🔴 Sale" />
                                     <StickerBtn s="new" label="🟢 New" />
                                     <StickerBtn s="hit" label="⭐ Hit" />
                                     <StickerBtn s="best" label="🏆 Best" />
                                 </div>
                             )}
                        </div>

                         <div className="flex gap-2 p-4 bg-black/60 border-t border-white/5 mt-auto">
                            <button onClick={(e) => { e.stopPropagation(); setIsEditingOverlay(false); }} className="flex-1 py-3 bg-gray-800 text-white rounded-xl font-bold text-xs">Отмена</button>
                            <button onClick={(e) => { e.stopPropagation(); applyEdits(); }} className="flex-1 py-3 bg-luxury-gold text-black rounded-xl font-bold shadow-[0_0_15px_rgba(212,175,55,0.4)] text-xs">Применить</button>
                         </div>
                    </div>
                ) : (
                    <div className="absolute top-3 right-3 flex flex-col gap-3">
                         <button onClick={handleEditClick} className="w-12 h-12 md:w-10 md:h-10 rounded-full bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white shadow-lg active:scale-90 transition-transform"><span className="font-bold text-xs">EDIT</span></button>
                         <button onClick={handleDownloadImage} className="w-12 h-12 md:w-10 md:h-10 rounded-full bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white shadow-lg active:scale-90 transition-transform"><svg className="w-5 h-5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg></button>
                         <button onClick={handleGenImage} className={`w-12 h-12 md:w-10 md:h-10 rounded-full backdrop-blur-md border border-white/10 flex items-center justify-center shadow-lg active:scale-90 transition-transform ${cooldown > 0 ? 'bg-red-900/40 text-red-400 cursor-not-allowed' : 'bg-black/60 text-white'}`}>{cooldown > 0 ? <span className="text-[10px] font-bold">{cooldown}</span> : <svg className="w-5 h-5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>}</button>
                    </div>
                )}
            </>
        ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-[#1a1a1a]">
                <p className="text-xs text-gray-500 mb-6 line-clamp-4 italic px-4 opacity-50">"{pin.imagePrompt}"</p>
                <button onClick={handleGenImage} disabled={isImgLoading || cooldown > 0} className={`px-6 py-3 rounded-xl text-sm font-bold shadow-lg transition-transform flex items-center gap-2 ${cooldown > 0 ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700' : 'bg-luxury-gold text-luxury-900 hover:scale-105'}`}>{isImgLoading ? <span className="animate-spin">⚙️</span> : cooldown > 0 ? `Остываем ${cooldown}с` : "✨ Создать"}</button>
            </div>
        )}
      </div>
      
      {/* ... Description and Controls ... */}
      <div className="p-5 flex-1 flex flex-col relative">
        <h3 className="font-serif text-lg text-white leading-tight mb-3 pr-8 cursor-pointer active:text-luxury-gold transition-colors" onClick={() => copyToClipboard(pin.title)}>
            {pin.title} 
            <button onClick={handleBattle} className="inline-block ml-2 text-[10px] font-bold text-red-500 border border-red-500/50 px-1.5 rounded hover:bg-red-900/20" title="A/B Test Headlines">VS</button>
        </h3>
        
        {showBattle && (
            <div className="absolute top-10 left-0 right-0 bg-black/95 z-40 p-3 rounded-xl border border-luxury-gold/30 animate-fade-in shadow-2xl">
                <h4 className="text-xs text-luxury-gold font-bold mb-2 flex justify-between">
                    <span>A/B BATTLE</span>
                    <button onClick={(e) => {e.stopPropagation(); setShowBattle(false)}} className="text-gray-500">✕</button>
                </h4>
                {isBattling ? (
                    <div className="text-center py-2 text-xs text-gray-400 animate-pulse">Генерация заголовков...</div>
                ) : (
                    <div className="space-y-1">
                        {battleTitles.map((t, idx) => (
                            <button key={idx} onClick={(e) => selectBattleWinner(t, e)} className="w-full text-left text-xs p-2 rounded hover:bg-white/10 text-gray-300 hover:text-white border-b border-white/5 last:border-0">{t}</button>
                        ))}
                    </div>
                )}
            </div>
        )}

        <div className="flex-1 mb-4 relative group">
            {isRemixing ? (
                <div className="text-xs text-luxury-gold animate-pulse">🪄 Переписываю текст...</div>
            ) : (
                <p className="text-sm text-gray-400 line-clamp-4 leading-relaxed">{pin.description}</p>
            )}
        </div>
        <div className="mt-3 flex flex-wrap gap-1 mb-4">{pin.tags.slice(0, 4).map(t => <span key={t} className="text-[10px] text-luxury-goldDim bg-luxury-gold/5 px-1.5 py-0.5 rounded border border-luxury-gold/10">#{t.replace('#','')}</span>)}</div>
        
        {/* TEXT CONTROLS: HISTORY AND REMIX */}
        <div className="flex flex-wrap items-center gap-1 mb-4 bg-white/5 p-1 rounded-lg border border-white/5">
            <button 
                onClick={handleUndo} 
                disabled={historyIndex === 0}
                className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${historyIndex === 0 ? 'text-gray-600 cursor-not-allowed' : 'text-gray-300 hover:bg-white/10 hover:text-white'}`}
                title="Undo (Назад)"
            >
                ←
            </button>
            
            <div className="flex-1 text-center text-[10px] text-gray-500 font-mono min-w-[50px]">
                v.{historyIndex + 1}/{textHistory.length}
            </div>

            <button 
                onClick={handleRedo} 
                disabled={historyIndex === textHistory.length - 1}
                className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${historyIndex === textHistory.length - 1 ? 'text-gray-600 cursor-not-allowed' : 'text-gray-300 hover:bg-white/10 hover:text-white'}`}
                title="Redo (Вперед)"
            >
                →
            </button>

            <div className="w-[1px] h-4 bg-gray-700 mx-1 hidden sm:block"></div>

            <div className="relative w-full sm:w-auto mt-1 sm:mt-0">
                <button 
                    onClick={(e) => { e.stopPropagation(); setShowRemix(!showRemix); }}
                    className="w-full sm:w-auto text-xs font-bold px-3 py-1.5 rounded bg-black/40 border border-gray-700 text-gray-300 hover:text-luxury-gold hover:border-luxury-gold transition-all flex items-center justify-center gap-1"
                    title="Remix Text"
                >
                    <span>🪄</span> Remix
                </button>
                {showRemix && (
                    <div className="absolute bottom-full right-0 mb-2 w-32 bg-black/95 backdrop-blur-xl border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
                        <button onClick={(e) => handleRemix('shorter', e)} className="w-full text-left px-3 py-2 text-[10px] text-gray-300 hover:bg-white/10 hover:text-luxury-gold">🔪 Короче</button>
                        <button onClick={(e) => handleRemix('sales', e)} className="w-full text-left px-3 py-2 text-[10px] text-gray-300 hover:bg-white/10 hover:text-luxury-gold">💰 Продающее</button>
                        <button onClick={(e) => handleRemix('humor', e)} className="w-full text-left px-3 py-2 text-[10px] text-gray-300 hover:bg-white/10 hover:text-luxury-gold">🤡 С юмором</button>
                    </div>
                )}
            </div>
        </div>

        <div className="flex justify-between items-center pt-2 border-t border-white/5 gap-2">
            <button 
                onClick={handleShare} 
                className={`flex-1 text-xs font-bold px-3 py-3 md:py-2 rounded-lg transition-all border flex items-center justify-center gap-2 overflow-hidden
                    ${showCopyFeedback 
                        ? 'bg-green-900/40 border-green-500 text-green-400' 
                        : 'bg-luxury-gold/10 border-luxury-gold/30 text-luxury-gold hover:bg-luxury-gold hover:text-black'}`
                }
            >
                {showCopyFeedback ? (
                    <>
                       <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                       <span className="truncate">{shareBtnText}</span>
                    </>
                ) : (
                    <>
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                        <span className="truncate">{shareBtnText}</span>
                    </>
                )}
            </button>
        </div>
      </div>
    </div>
  );
};
