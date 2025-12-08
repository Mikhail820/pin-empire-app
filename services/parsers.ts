
// Service to handle file parsing logic (Client Side)

declare global {
    interface Window {
        pdfjsLib: any;
        mammoth: any;
    }
}

// Safer initialization check
const initPDFWorker = () => {
    if (window.pdfjsLib && !window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
}

export const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
};

export const parsePDF = async (file: File): Promise<string> => {
    try {
        initPDFWorker();
        if (!window.pdfjsLib) {
            throw new Error("PDF Library not loaded yet.");
        }

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = "";
        
        // Limit to first 15 pages to avoid memory issues with huge books
        const maxPages = Math.min(pdf.numPages, 15);
        
        for (let i = 1; i <= maxPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const pageText = textContent.items.map((item: any) => item.str).join(" ");
            fullText += pageText + "\n";
        }
        
        return fullText.trim() || "No text found in PDF (might be image-based).";
    } catch (e) {
        console.error("PDF Parse Error", e);
        throw new Error("Failed to parse PDF. Ensure it is text-based.");
    }
};

export const parseDOCX = async (file: File): Promise<string> => {
    try {
        const arrayBuffer = await file.arrayBuffer();
        if (!window.mammoth) throw new Error("Mammoth Library not loaded.");
        const result = await window.mammoth.extractRawText({ arrayBuffer });
        return result.value.trim();
    } catch (e) {
        console.error("DOCX Parse Error", e);
        throw new Error("Failed to parse DOCX.");
    }
};

export const processFile = async (file: File): Promise<{ text: string, type: 'text' | 'image', base64?: string }> => {
    const type = file.type;
    
    // Images
    if (type.startsWith('image/')) {
        const base64 = await fileToBase64(file);
        return { text: '', type: 'image', base64 };
    }
    
    // Text Files
    if (type === 'text/plain' || type === 'application/json' || type === 'text/markdown') {
        const text = await file.text();
        return { text, type: 'text' };
    }

    // PDF
    if (type === 'application/pdf') {
        const text = await parsePDF(file);
        return { text, type: 'text' };
    }

    // DOCX
    if (type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const text = await parseDOCX(file);
        return { text, type: 'text' };
    }

    throw new Error(`Unsupported file type: ${type}`);
};