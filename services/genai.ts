
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { GenerationParams, PinData, BoardSuggestion, Lighting, Composition, HookType, CombinedGenerationResult, Platform } from "../types";

const getClient = () => {
    // API Key must be obtained exclusively from the environment variable
    const apiKey = process.env.API_KEY;
    
    if (!apiKey) {
        throw new Error("API Key missing. Please configure 'API_KEY' in your Environment Variables.");
    }
    
    return new GoogleGenAI({ apiKey });
}

// Helper: Wait function
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper: Smart Retry Wrapper
async function callWithRetry<T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
    try {
        return await fn();
    } catch (error: any) {
        const msg = error.message?.toLowerCase() || "";
        
        // Check specifically for Quota (429)
        const isQuota = msg.includes('429') || msg.includes('quota') || msg.includes('exhausted') || error.status === 429;
        
        // CRITICAL FIX: If it is a Quota error, DO NOT RETRY. 
        // Retrying immediately escalates the ban duration. Fail fast.
        if (isQuota) {
            throw new Error("QUOTA_EXCEEDED"); 
        }

        const isServer = msg.includes('503') || error.status === 503;

        if (isServer && retries > 0) {
            console.warn(`⚠️ Server Busy (503). Waiting ${delay}ms... (Attempts left: ${retries})`);
            await wait(delay);
            // Exponential backoff: increase delay x2
            return callWithRetry(fn, retries - 1, delay * 2); 
        }
        
        throw error;
    }
}

// Helper to clean generic AI responses and extract JSON
const cleanAndParseJSON = (text: string | undefined): any => {
    if (!text) throw new Error("Empty response from AI");
    
    // 1. Remove Markdown code blocks
    let clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    // 2. Find the JSON object
    const firstCurly = clean.indexOf('{');
    const lastCurly = clean.lastIndexOf('}');

    if (firstCurly !== -1 && lastCurly !== -1 && lastCurly > firstCurly) {
        clean = clean.substring(firstCurly, lastCurly + 1);
    }

    try {
        return JSON.parse(clean);
    } catch (e) {
        console.error("JSON Parse Error. Raw text:", text);
        console.error("Cleaned text:", clean);
        throw new Error("Failed to parse AI response. Try again.");
    }
};

export const generatePinContent = async (params: GenerationParams): Promise<CombinedGenerationResult> => {
  const ai = getClient();
  
  // Construct Visual Instructions
  const visualContext = `
    VISUAL STYLE GUIDE:
    Style: ${params.imageStyle === 'Auto (AI Selection)' ? 'Analyze text/image and choose best style (e.g. Luxury, Boho)' : params.imageStyle}
    Lighting: ${params.lighting === Lighting.AUTO ? 'Choose best lighting for the subject' : params.lighting}
    Composition: ${params.composition === Composition.AUTO ? 'Choose best angle for CTR' : params.composition}
    Dominant Colors: ${params.colorPalette ? params.colorPalette : 'Harmonious palette fitting the style'}
    
    IMPORTANT: Image prompts MUST specify "Photorealistic", "8k resolution", "High Detail". Avoid cartoonish descriptions unless the style explicitly demands it.
  `;

  // --- SOCIAL CHAMELEON LOGIC ---
  let platformRules = "";
  
  if (params.targetPlatform === Platform.YANDEX) {
      platformRules = `
        PLATFORM: YANDEX DIRECT (Contextual Ads).
        STRICT RULES:
        1. "title": MUST be "Headline 1". MAX 35 CHARACTERS. Catchy, benefit-driven.
        2. "overlayText": MUST be "Headline 2". MAX 30 CHARACTERS. Call to action or Supplement.
        3. "description": MUST be the Ad Text. MAX 81 CHARACTERS. USP, Facts, no water.
        4. "tags": List of high-frequency keywords for Contextual Targeting (RSYA).
        
        TONE: Commercial, Direct, Concise, Trustworthy.
      `;
  } else if (params.targetPlatform === Platform.TELEGRAM) {
      platformRules = `
        PLATFORM: TELEGRAM CHANNEL.
        FORMATTING: Use HTML tags or Markdown. Make the "title" a BOLD header.
        STRUCTURE:
        - Catchy Headline (Title)
        - Body (Description): Short paragraphs, use bullet points, conversational but expert tone.
        - Call to Action at the end.
        - Max 1-2 Hashtags in "tags".
        TONE: Personal, Expert, "Behind the scenes".
      `;
  } else if (params.targetPlatform === Platform.INSTAGRAM) {
      platformRules = `
        PLATFORM: INSTAGRAM POST.
        STRUCTURE:
        - Visual Hook (Title)
        - Engagement Body (Description): Use line breaks, emojis, storytelling.
        - "Link in Bio" CTA.
        - 15-20 Hashtags in "tags".
        TONE: Visual, Emotional, Inspiring.
      `;
  } else if (params.targetPlatform === Platform.TIKTOK) {
      platformRules = `
        PLATFORM: TIKTOK / REELS SCRIPT.
        OUTPUT FORMAT:
        - "title": Video Hook (Text on screen for first 3 seconds).
        - "description": The Script/Voiceover text.
        - "imagePrompt": Visual description of the video scene.
        TONE: Viral, Fast-paced, Entertaining.
      `;
  } else if (params.targetPlatform === Platform.AVITO) {
      platformRules = `
        PLATFORM: AVITO / CLASSIFIEDS.
        STRUCTURE:
        - Title: Exact product name + key feature (e.g. "iPhone 15 Pro Max 256GB New").
        - Description:
          1. USP (Why buy from us?)
          2. Tech Specs (Bullet points)
          3. Condition / Guarantee
          4. Call to Action (Call/Write now).
        TONE: Trustworthy, Sales-driven, Polite.
      `;
  } else if (params.targetPlatform === Platform.WILDBERRIES) {
      platformRules = `
        PLATFORM: WILDBERRIES (MARKETPLACE).
        GOAL: SEO Spam & Conversion.
        STRUCTURE:
        - Title: Brand + Product Name + Keywords (Max 100 chars).
        - Description: Long text rich with keywords. Use bullet points for features.
        - Tags: List of all relevant search queries for this product.
        - Overlay Text: "HIT", "-50%", "PREMIUM" (Short badges).
        TONE: Commercial, Informative, Keyword-rich.
      `;
  } else if (params.targetPlatform === Platform.OZON) {
      platformRules = `
        PLATFORM: OZON (MARKETPLACE).
        GOAL: Rich Content & Trust.
        STRUCTURE:
        - Title: Category + Brand + Model + Key Spec.
        - Description: "Selling Points" format. Focus on benefits and tech specs.
        - Overlay Text: Key benefit (e.g. "Cotton 100%", "Fast Delivery").
        TONE: Professional, Clean, structured.
      `;
  } else if (params.targetPlatform === Platform.DZEN) {
      platformRules = `
        PLATFORM: DZEN (ARTICLES/POSTS).
        STRUCTURE:
        - Title: Clickbait but honest (Intrigue/Question).
        - Description: A short narrative intro (The Lead) that makes user click "Read more".
        TONE: Storytelling, Opinionated, Engaging.
      `;
  } else if (params.targetPlatform === Platform.YOUTUBE) {
      platformRules = `
        PLATFORM: YOUTUBE VIDEO DESCRIPTION.
        STRUCTURE:
        - Title: SEO-optimized video title.
        - Description: 
          1. 2-3 sentences summary (keywords).
          2. Timestamps placeholder (0:00 Intro...)
          3. Relevant Links.
        - Tags: Comma-separated high-volume tags.
      `;
  } else if (params.targetPlatform === Platform.EMAIL) {
      platformRules = `
        PLATFORM: EMAIL NEWSLETTER.
        STRUCTURE:
        - Title: Subject Line (High Open Rate).
        - Description: The Email Body. Personal greeting -> Value -> Offer -> Button CTA.
        TONE: Personal, One-to-one conversation.
      `;
  } else {
      // Default Pinterest
      platformRules = `
        PLATFORM: PINTEREST.
        SEO MANDATE: ${params.seoKeyword ? `You MUST include the exact keyword "${params.seoKeyword}" within the first 50 characters of the description.` : 'Focus on relevant high-volume keywords.'}
        Hook Type: ${params.hookType === HookType.AUTO ? 'Mix of FOMO, Story, and Contrarian' : params.hookType}
        TONE: Inspiring, Helpful, Evergreen.
      `;
  }

  // Bridge Strategy Definition (GENERALIZED)
  let bridgeStrategy = "";
  
  if (params.briefData) {
      // CLIENT BRIEF MODE
      bridgeStrategy = `
        CLIENT BRIEF MODE ACTIVE (HIGH PRIORITY).
        IGNORE GENERIC INSTRUCTIONS. FOLLOW THIS BRIEF STRICTLY:
        
        BRAND: ${params.briefData.brandName}
        TARGET AUDIENCE: ${params.briefData.targetAudience}
        GOAL: ${params.briefData.keyGoal}
        TONE OF VOICE: ${params.briefData.toneOfVoice}
        USP: ${params.briefData.usp}
        TABOOS (DO NOT USE): ${params.briefData.taboos}
        
        STRATEGY:
        Write content specifically appealing to the Target Audience defined above.
        Ensure the Tone of Voice matches perfectly.
        Highlight the USP in every description.
      `;
  } else {
      // STANDARD MODE
      bridgeStrategy = params.productName 
        ? `SPECIFIC ASSET BRIDGE: 
           You are promoting the TARGET ASSET (Product/Service/Project) titled: "${params.productName}".
           
           INPUT ANALYSIS:
           1. Analyze the user's input (Text or Image). 
           2. Identify the genre, mood, key themes, or visual cues.
           3. Identify the potential visual topic.
           
           EXECUTION:
           Link the visual topic to the TARGET ASSET ("${params.productName}") using the identified themes.
           
           Every single item description MUST explicitly mention "${params.productName}" as the solution, context, or item.`
        : `CONTEXTUAL BRIDGE: The user has not specified a specific asset name. Infer the goal from the context (e.g., selling a house, promoting a course, sharing a vibe).`;
  }

  const storyModeInstruction = params.generationMode === 'story' 
    ? `
       STORY MODE ACTIVE:
       You must generate exactly 5 items that form a COHERENT NARRATIVE ARC (Story Sequence) or a STEP-BY-STEP Guide.
      ` 
    : `
       VARIATION MODE ACTIVE:
       Generate ${params.count} distinct, independent concepts. Each should try a different angle to test what works best.
      `;

  const systemInstruction = `
    You are a World-Class Content Marketing Strategist & Growth Hacker. 
    Your goal is to drive traffic to the user's Asset, Service, or Product using the "CONTEXTUAL BRIDGING" strategy.
    
    You are capable of working with ANY niche: Real Estate, E-commerce, Coaching, Crypto, Fashion, Literature, or Tech.
    
    ${platformRules}

    STRATEGY: THE CONTEXTUAL BRIDGE
    ${bridgeStrategy}
    
    ${visualContext}
    ${storyModeInstruction}
    
    STEP 1: INPUT ANALYSIS
    If an IMAGE is provided, analyze its aesthetic, objects, and mood to generate matching Pins/Ads.
    If TEXT is provided, analyze the content.
    
    STEP 2: GENERATION (SINGLE SHOT)
    You must output a SINGLE JSON OBJECT containing two parts:
    1. "pins": An array of ${params.generationMode === 'story' ? 5 : params.count} items.
    2. "boards": An object with "broad" (5 general categories) and "niche" (5 specific categories) suggestions based on the content.
    
    For each item, provide:
    - Title: Catchy, high-CTR (Follow Platform Rules!).
    - Description: Natural sentences (Follow Platform Rules!).
    - Alt Text: Deeply descriptive.
    - Overlay Text: Short text for image overlay (Follow Platform Rules!).
    - Image Prompt: Detailed description for AI image generator.
    - Tags: Keywords or hashtags.
    
    The output must be strictly JSON.
  `;

  // Construct Part-based Content for Multimodal
  const parts: any[] = [];
  
  if (params.base64Image && params.imageMimeType) {
      // Remove data url prefix if present (e.g. data:image/png;base64,...)
      const rawBase64 = params.base64Image.includes(',') 
        ? params.base64Image.split(',')[1] 
        : params.base64Image;

      parts.push({
          inlineData: {
              mimeType: params.imageMimeType,
              data: rawBase64
          }
      });
      parts.push({ text: "Analyze this image and generate concepts based on its style and the following text context:" });
  }

  const textPrompt = `
    Analyze the following content.
    Generate ${params.generationMode === 'story' ? 5 : params.count} content concepts AND suggested categories.
    Language: ${params.language}.
    Target Platform: ${params.targetPlatform}.
    
    Content to process:
    "${params.input.slice(0, 500000)}" 
  `;
  
  parts.push({ text: textPrompt });

  try {
    const response = await callWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts },
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            pins: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        description: { type: Type.STRING },
                        altText: { type: Type.STRING },
                        overlayText: { type: Type.STRING, description: "Text for image overlay" },
                        imagePrompt: { type: Type.STRING },
                        tags: { 
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                        }
                    },
                    required: ["title", "description", "altText", "overlayText", "imagePrompt", "tags"]
                }
            },
            boards: {
                type: Type.OBJECT,
                properties: {
                    broad: { type: Type.ARRAY, items: { type: Type.STRING } },
                    niche: { type: Type.ARRAY, items: { type: Type.STRING } }
                }
            }
          },
          required: ["pins", "boards"]
        }
      }
    }));

    const parsedData = cleanAndParseJSON(response.text);
    
    // Validation
    if (!parsedData || !parsedData.pins || !Array.isArray(parsedData.pins)) {
        console.error("Invalid response format", parsedData);
        throw new Error("AI did not return a valid list.");
    }

    const pinsWithIds = parsedData.pins.map((item: any, index: number) => ({
      ...item,
      id: `pin-${Date.now()}-${index}`
    }));

    return {
        pins: pinsWithIds,
        boards: parsedData.boards || { broad: [], niche: [] }
    };

  } catch (error: any) {
    console.error("GenAI Error:", error);
    // Re-throw if it is our standardized quota error
    if (error.message === 'QUOTA_EXCEEDED') throw error;
    
    // Check message text just in case
    const msg = error.message?.toLowerCase() || "";
    if (msg.includes('429') || msg.includes('quota') || msg.includes('exhausted')) {
        throw new Error("QUOTA_EXCEEDED");
    }
    throw new Error("Failed to generate content. Please try again.");
  }
};

export const generateSingleImage = async (prompt: string, aspectRatio: string): Promise<string> => {
  const ai = getClient();
  
  let apiRatio = "1:1";
  if (aspectRatio === '3:4') apiRatio = '3:4';
  else if (aspectRatio === '9:16') apiRatio = '9:16';
  else if (aspectRatio === '16:9') apiRatio = '16:9';
  else if (aspectRatio === '1:1') apiRatio = '1:1';
  else if (aspectRatio === '2:3') apiRatio = '3:4'; 

  const enhancedPrompt = `Photorealistic, 8k, highly detailed, professional photography. ${prompt}`;

  try {
    const response = await callWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: enhancedPrompt,
      config: {
        imageConfig: {
            aspectRatio: apiRatio as any
        }
      }
    }), 2, 2000); // Reduced retries for images to fail fast

    const candidates = response.candidates;
    if (!candidates || candidates.length === 0) throw new Error("No image generated");
    
    for (const candidate of candidates) {
        if (candidate.content && candidate.content.parts) {
            for (const part of candidate.content.parts) {
                if (part.inlineData) {
                    return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                }
            }
        }
    }
    throw new Error("No image data found");
  } catch (e: any) {
    console.error(e);
    if (e.message === 'QUOTA_EXCEEDED') throw e;
    const msg = e.message?.toLowerCase() || "";
    if (msg.includes('quota') || msg.includes('429')) throw new Error("QUOTA_EXCEEDED");
    throw new Error("Image generation failed");
  }
};

export const generateBoardSuggestions = async (pins: PinData[], topic: string, excludeNames: string[] = []): Promise<BoardSuggestion> => {
    // Fallback if user manually requests MORE boards later
    const ai = getClient();
    
    const pinTitles = pins.map(p => p.title).join("\n");
    const excludes = excludeNames.slice(0, 50).join(", "); 

    const prompt = `
        Based on the user's topic "${topic}" and these generated concepts:
        ${pinTitles}
        
        Suggest 10 Categories/Boards.
        - 5 Broad, high-volume search terms.
        - 5 Niche, long-tail specific terms.
        
        IMPORTANT: DO NOT suggest any names from this list: [${excludes}].
        If a name is on the list, find a variation.
        
        Language: Russian (or same as content).
    `;

    try {
        const response = await callWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        broad: { type: Type.ARRAY, items: { type: Type.STRING } },
                        niche: { type: Type.ARRAY, items: { type: Type.STRING } }
                    }
                }
            }
        }));

        return cleanAndParseJSON(response.text);
    } catch (e) {
        console.error("Board Gen Error", e);
        return { broad: [], niche: [] };
    }
};

export const askPinterestGuru = async (question: string, contextPins: PinData[]): Promise<string> => {
    const ai = getClient();
    
    const context = contextPins.length > 0 
        ? `User is currently working on a project with topic related to: ${contextPins[0].title}.` 
        : "User is asking general advice.";

    const system = `
        You are the "Pinterest Guru" - a top-tier expert in Pinterest algorithm, SEO, and content strategy for 2025-2026.
        Tone: Professional, encouraging, wealthy, strategic ("Billionaire mindset").
        Keep answers concise (max 150 words) but highly actionable.
        You can advise on ANY industry (Real Estate, Crypto, Fashion, Services).
    `;

    try {
        const response = await callWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `${context}\n\nQuestion: ${question}`,
            config: { systemInstruction: system }
        }));

        return response.text || "I am currently analyzing the market. Please ask again.";
    } catch (e) {
        return "Советник сейчас занят анализом рынков. Повторите запрос позже.";
    }
};

// NEW: Remix / Rewrite Logic
export const generateAlternativeTitles = async (currentTitle: string): Promise<string[]> => {
    const ai = getClient();
    const prompt = `
        Generate 3 alternative viral headlines for the following title.
        Target Audience: Russian speaking users.
        Styles:
        1. Provocative/Emotional
        2. List/Digital (e.g. "5 ways...")
        3. Question/Curiosity
        
        Original: "${currentTitle}"
        
        Output format: JSON Array of strings.
        Example: ["New Title 1", "New Title 2", "New Title 3"]
    `;

    try {
        const response = await callWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
             config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                }
             }
        }));
        const titles = cleanAndParseJSON(response.text);
        if (Array.isArray(titles)) return titles.slice(0, 3);
        return [];
    } catch (e) {
        console.error("Title battle failed", e);
        return [];
    }
};

export const rewritePinText = async (text: string, tone: 'shorter' | 'sales' | 'humor', platform: string): Promise<string> => {
    const ai = getClient();
    
    let instruction = "";
    if (tone === 'shorter') instruction = "Make it more concise, punchy, and remove fluff. Keep the key value.";
    if (tone === 'sales') instruction = "Make it persuasive, sales-driven, use FOMO, and strong Call to Action.";
    if (tone === 'humor') instruction = "Add a touch of wit, irony, or humor relevant to the context. Make it engaging.";

    const prompt = `
        Rewrite the following content for platform: ${platform}.
        
        Transformation Goal: ${instruction}
        
        IMPORTANT: OUTPUT MUST BE IN RUSSIAN (or the same language as the original text).
        
        Original Content:
        "${text}"
        
        Output ONLY the rewritten text. No quotes.
    `;

    try {
         const response = await callWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        }));
        return response.text?.trim() || text;
    } catch (e: any) {
        if (e.message === 'QUOTA_EXCEEDED') throw e;
        throw new Error("Rewrite failed");
    }
};
