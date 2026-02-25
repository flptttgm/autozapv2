export interface ExtractedContent {
  text: string;
  pages?: string[];
  rows?: string[];
}

// Dynamically load pdf.js from CDN
let pdfjsLib: any = null;

async function loadPdfJs(): Promise<any> {
  if (pdfjsLib) return pdfjsLib;
  
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      pdfjsLib = (window as any).pdfjsLib;
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      resolve(pdfjsLib);
    };
    script.onerror = () => reject(new Error('Falha ao carregar PDF.js'));
    document.head.appendChild(script);
  });
}

export async function extractTextFromPDF(file: File): Promise<ExtractedContent> {
  const pdfjs = await loadPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  
  const pages: string[] = [];
  let fullText = '';
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (pageText) {
      pages.push(pageText);
      fullText += (fullText ? '\n\n' : '') + pageText;
    }
  }
  
  return { text: fullText, pages };
}

export async function extractTextFromTXT(file: File): Promise<ExtractedContent> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      resolve({ text });
    };
    reader.onerror = () => reject(new Error('Erro ao ler arquivo TXT'));
    reader.readAsText(file);
  });
}

export async function extractTextFromCSV(file: File): Promise<ExtractedContent> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const csvText = e.target?.result as string;
      const lines = csvText.split('\n').filter(line => line.trim());
      
      if (lines.length === 0) {
        resolve({ text: '', rows: [] });
        return;
      }
      
      // Parse header
      const header = parseCSVLine(lines[0]);
      const rows: string[] = [];
      let fullText = '';
      
      // Parse each row and convert to readable text
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length === 0) continue;
        
        const rowText = header
          .map((col, idx) => `${col}: ${values[idx] || ''}`)
          .join(' | ');
        
        rows.push(rowText);
        fullText += (fullText ? '\n' : '') + rowText;
      }
      
      resolve({ text: fullText, rows });
    };
    reader.onerror = () => reject(new Error('Erro ao ler arquivo CSV'));
    reader.readAsText(file);
  });
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if ((char === ',' || char === ';') && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

export async function extractTextFromFile(file: File): Promise<ExtractedContent> {
  const extension = getFileExtension(file.name);
  
  switch (extension) {
    case 'pdf':
      return extractTextFromPDF(file);
    case 'txt':
      return extractTextFromTXT(file);
    case 'csv':
      return extractTextFromCSV(file);
    default:
      throw new Error(`Formato não suportado: ${extension}`);
  }
}
