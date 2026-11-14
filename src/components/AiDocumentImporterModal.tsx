import { useState, useRef } from 'react';
import {
  FileText,
  Upload,
  Sparkles,
  Layers,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Edit3,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Eye,
  RotateCcw,
  BookOpen,
  Info,
  FileSpreadsheet,
  Download,
  ClipboardList,
  Copy,
  Plus,
  Image as ImageIcon,
  ExternalLink,
} from 'lucide-react';
import { MathText } from './MathText';
import { QuestionImage } from './QuestionImage';
import { importDocumentExamWithAI } from '../lib/api';
import type { OptionId, QuestionOption, TestExam, TestQuestion, TestSection } from '../types';

interface AiDocumentImporterModalProps {
  currentTest?: TestExam | null;
  onClose: () => void;
  onImportComplete: (
    testData: {
      title: string;
      description: string;
      sections: TestSection[];
      questions: TestQuestion[];
    },
    publishImmediately: boolean
  ) => Promise<void>;
}

type ImportSourceMode = 'csv' | 'text' | 'pdf';

// Real-world sample CSV template content with KaTeX formulas and hosted diagram URLs
const SAMPLE_CSV_TEMPLATE = `Section,Question,QuestionImageUrl,OptionA,OptionAImageUrl,OptionB,OptionBImageUrl,OptionC,OptionCImageUrl,OptionD,OptionDImageUrl,CorrectOption,Explanation,SolutionImageUrl,StepByStepSolution
Physics,"In a series LCR circuit, $R = 10\\,\\Omega$, $L = 0.1\\text{ H}$, and $C = 10\\,\\mu\\text{F}$. What is the resonant angular frequency $\\omega_0$?",https://images.unsplash.com/photo-1635070041078-e363dbe005cb,"$1000\\text{ rad/s}",,"$500\\text{ rad/s}",,"$2000\\text{ rad/s}",,"$100\\text{ rad/s}",,A,"Resonance occurs when inductive and capacitive reactances cancel out, giving $\\omega_0 = 1/\\sqrt{LC}$.",,"1. Resonance condition: $\\omega_0 L = 1/(\\omega_0 C)$ | 2. $\\omega_0 = 1/\\sqrt{LC} = 1/\\sqrt{0.1 \\times 10^{-5}} = 1/\\sqrt{10^{-6}} = 1000\\text{ rad/s}$"
Physics,"Two capacitors $C_1 = 3\\,\\mu\\text{F}$ and $C_2 = 6\\,\\mu\\text{F}$ are connected in series across a $12\\text{ V}$ battery. What is the potential difference across $C_1$?",,"$8\\text{ V}",,"$4\\text{ V}",,"$6\\text{ V}",,"$12\\text{ V}",,A,"In series, charge $Q$ is constant, so potential divides inversely with capacitance: $V_1 = V \\frac{C_2}{C_1 + C_2}$.",,"1. $C_{eq} = \\frac{C_1 C_2}{C_1 + C_2} = \\frac{18}{9} = 2\\,\\mu\\text{F}$ | 2. $Q = C_{eq} V = 2\\,\\mu\\text{F} \\times 12\\text{ V} = 24\\,\\mu\\text{C}$ | 3. $V_1 = \\frac{Q}{C_1} = \\frac{24}{3} = 8\\text{ V}$"
Chemistry,"Which of the following organic structures represents the major anti-Markovnikov addition product?",https://images.unsplash.com/photo-1532094349884-543bc11b234d,"1-Bromopropane",https://images.unsplash.com/photo-1607604276583-eef5d076aa5f,"2-Bromopropane",,"Cyclopropane",,"Propene",,A,"Addition of $\\text{HBr}$ in the presence of organic peroxides yields the anti-Markovnikov alkyl halide via free radical mechanism.",,"1. Peroxides generate bromine free radicals ($Br^\\bullet$). | 2. The radical attacks the terminal carbon of propene forming a stable secondary free radical. | 3. Hydrogen abstraction yields 1-bromopropane."
Chemistry,"The hybridization and geometry of $\\text{XeF}_4$ are respectively:",,"$\\text{sp}^3\\text{d}^2$, Square Planar",,"$\\text{sp}^3\\text{d}$, See-saw",,"$\\text{sp}^3$, Tetrahedral",,"$\\text{sp}^3\\text{d}^2$, Octahedral",,A,"$\\text{XeF}_4$ has 4 bond pairs and 2 lone pairs giving steric number 6 with square planar geometry.",,"1. Valence electrons on $\\text{Xe} = 8$, $+4$ fluorines $= 12$ electrons $= 6$ pairs. | 2. Steric number $= 6 \\implies \\text{sp}^3\\text{d}^2$. | 3. Two lone pairs occupy trans positions, resulting in a square planar molecular geometry."
Botany,"The primary carboxylating enzyme in the mesophyll cells of $\\text{C}_4$ plants is:",,"PEP Carboxylase (PEPCO)",,"RuBisCO",,"Carbonic Anhydrase",,"Pyruvate Dehydrogenase",,A,"In $\\text{C}_4$ plants, initial carbon fixation occurs in mesophyll cells catalyzed by PEP carboxylase.",,"1. Phosphoenolpyruvate (PEP) accepts $\\text{CO}_2$ forming oxaloacetic acid ($OAA$). | 2. PEP carboxylase lacks oxygenase activity, preventing photorespiration."
Zoology,"Which antibody isotype is primarily secreted in maternal colostrum and mucosal secretions?",,"$\\text{IgA}$",,"$\\text{IgG}$",,"$\\text{IgM}$",,"$\\text{IgE}$",,A,"Dimeric $\\text{IgA}$ possesses a secretory component that protects it from proteolytic enzymes in mucous membranes.",,"1. Secretory $\\text{IgA}$ provides localized mucosal immunity. | 2. It is abundant in saliva, tears, and maternal colostrum to protect newborns."
Mental Agility Test (MAT),"Look at the sequence: $2, 6, 12, 20, 30, \\dots$. What is the next number?",,"$42$",,"$40$",,"$38$",,"$44$",,A,"The differences between consecutive terms are consecutive even numbers: $+4, +6, +8, +10, +12$.",,"1. Differences: $6-2=4$, $12-6=6$, $20-12=8$, $30-20=10$. | 2. Next difference must be $+12$. | 3. $30 + 12 = 42$."
`;

// Sample Markdown / Text template
const SAMPLE_TEXT_TEMPLATE = `[SECTION: Physics]
Q: In a series LCR circuit, $R = 10\\,\\Omega$, $L = 0.1\\text{ H}$, and $C = 10\\,\\mu\\text{F}$. What is the resonant angular frequency $\\omega_0$?
IMAGE: https://images.unsplash.com/photo-1635070041078-e363dbe005cb
A: $1000\\text{ rad/s}$
B: $500\\text{ rad/s}$
C: $2000\\text{ rad/s}$
D: $100\\text{ rad/s}$
ANSWER: A
EXPLANATION: Resonance occurs when $\\omega_0 L = 1/(\\omega_0 C) \\implies \\omega_0 = 1/\\sqrt{LC}$.
SOLUTION:
1. Resonance condition: $\\omega_0 L = 1/(\\omega_0 C)$
2. $\\omega_0 = 1/\\sqrt{0.1 \\times 10^{-5}} = 1000\\text{ rad/s}$

[SECTION: Chemistry]
Q: Which of the following represents the major anti-Markovnikov addition product?
IMAGE: https://images.unsplash.com/photo-1532094349884-543bc11b234d
A: 1-Bromopropane
A_IMAGE: https://images.unsplash.com/photo-1607604276583-eef5d076aa5f
B: 2-Bromopropane
C: Cyclopropane
D: Propene
ANSWER: A
EXPLANATION: Reaction of propene with $\\text{HBr}$ in presence of peroxides yields 1-bromopropane via free radical mechanism.
SOLUTION:
- Step 1: Peroxides generate bromine free radicals.
- Step 2: Radical attacks terminal carbon of propene.

[SECTION: Zoology]
Q: Which antibody isotype is primarily secreted in maternal colostrum?
A: $\\text{IgA}$
B: $\\text{IgG}$
C: $\\text{IgM}$
D: $\\text{IgE}$
ANSWER: A
EXPLANATION: Dimeric $\\text{IgA}$ has a secretory component protecting mucosal surfaces.

[SECTION: Mental Agility Test (MAT)]
Q: What comes next in the sequence: $2, 6, 12, 20, 30, \\dots$?
A: $42$
B: $40$
C: $38$
D: $44$
ANSWER: A
EXPLANATION: Consecutive differences are $+4, +6, +8, +10, +12$.
SOLUTION:
1. $30 + 12 = 42$.
`;

// RFC 4180 compliant CSV / TSV parser
function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let insideQuotes = false;

  const firstLine = input.split(/\r?\n/)[0] || '';
  const delimiter =
    firstLine.includes('\t') &&
    (firstLine.match(/\t/g)?.length || 0) > (firstLine.match(/,/g)?.length || 0)
      ? '\t'
      : ',';

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    const nextChar = input[i + 1];

    if (insideQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++;
      } else if (char === '"') {
        insideQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        insideQuotes = true;
      } else if (char === delimiter) {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (char === '\r') {
        if (nextChar === '\n') i++;
        currentRow.push(currentField.trim());
        if (currentRow.some((c) => c.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      } else if (char === '\n') {
        currentRow.push(currentField.trim());
        if (currentRow.some((c) => c.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((c) => c.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

// Convert parsed CSV rows into typed question objects
function parseCsvRows(csvText: string): Array<{
  sectionName: string;
  questionText: string;
  questionImageUrl?: string;
  options: Array<{ id: OptionId; text: string; imageUrl?: string }>;
  correctOptionId: OptionId;
  shortExplanation: string;
  solutionImageUrl?: string;
  stepByStepSolution: string[];
}> {
  const rows = parseCsv(csvText);
  if (rows.length < 2) return [];

  const headerRow = rows[0].map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const findCol = (synonyms: string[]): number =>
    headerRow.findIndex((col) => synonyms.includes(col));

  const colSection = findCol(['section', 'subject', 'domain', 'topic']);
  const colQuestion = findCol(['question', 'questiontext', 'stem', 'q']);
  const colQImg = findCol([
    'questionimageurl',
    'questionimage',
    'imageurl',
    'image',
    'diagram',
    'qimage',
  ]);
  const colOptA = findCol(['optiona', 'a', 'opta']);
  const colOptAImg = findCol(['optionaimageurl', 'optionaimage', 'aimage', 'aimageurl']);
  const colOptB = findCol(['optionb', 'b', 'optb']);
  const colOptBImg = findCol(['optionbimageurl', 'optionbimage', 'bimage', 'bimageurl']);
  const colOptC = findCol(['optionc', 'c', 'optc']);
  const colOptCImg = findCol(['optioncimageurl', 'optioncimage', 'cimage', 'cimageurl']);
  const colOptD = findCol(['optiond', 'd', 'optd']);
  const colOptDImg = findCol(['optiondimageurl', 'optiondimage', 'dimage', 'dimageurl']);
  const colCorrect = findCol([
    'correctoption',
    'correct',
    'answer',
    'ans',
    'key',
    'correctoptionid',
  ]);
  const colExpl = findCol(['explanation', 'shortexplanation', 'explain', 'exp']);
  const colSolImg = findCol(['solutionimageurl', 'solutionimage', 'solimage']);
  const colSol = findCol([
    'stepbystepsolution',
    'solution',
    'steps',
    'stepsolution',
    'detailedsolution',
  ]);

  const questions: any[] = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length === 0 || !r.some((c) => c.trim().length > 0)) continue;

    const getVal = (colIdx: number, fallbackIdx: number): string => {
      if (colIdx >= 0 && r[colIdx] !== undefined) return r[colIdx].trim();
      if (fallbackIdx >= 0 && r[fallbackIdx] !== undefined) return r[fallbackIdx].trim();
      return '';
    };

    const sectionName = getVal(colSection, 0) || 'General';
    const questionText = getVal(colQuestion, 1);
    if (!questionText) continue;

    const qImg = getVal(colQImg, 2);
    const optAText = getVal(colOptA, 3) || 'Option A';
    const optAImg = getVal(colOptAImg, 4);
    const optBText = getVal(colOptB, 5) || 'Option B';
    const optBImg = getVal(colOptBImg, 6);
    const optCText = getVal(colOptC, 7) || 'Option C';
    const optCImg = getVal(colOptCImg, 8);
    const optDText = getVal(colOptD, 9) || 'Option D';
    const optDImg = getVal(colOptDImg, 10);

    const rawCorrect = getVal(colCorrect, 11).toUpperCase();
    const correctOptionId: OptionId = ['A', 'B', 'C', 'D'].includes(rawCorrect)
      ? (rawCorrect as OptionId)
      : 'A';

    const shortExplanation = getVal(colExpl, 12);
    const solutionImageUrl = getVal(colSolImg, 13);
    const rawSteps = getVal(colSol, 14);

    let stepByStepSolution: string[] = [];
    if (rawSteps) {
      stepByStepSolution = rawSteps
        .split(/\||\n/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    }

    questions.push({
      sectionName,
      questionText,
      questionImageUrl: qImg || undefined,
      options: [
        { id: 'A', text: optAText, imageUrl: optAImg || undefined },
        { id: 'B', text: optBText, imageUrl: optBImg || undefined },
        { id: 'C', text: optCText, imageUrl: optCImg || undefined },
        { id: 'D', text: optDText, imageUrl: optDImg || undefined },
      ],
      correctOptionId,
      shortExplanation,
      solutionImageUrl: solutionImageUrl || undefined,
      stepByStepSolution,
    });
  }

  return questions;
}

// Convert plain text / markdown exam into structured question objects
function parseTextExam(text: string): Array<{
  sectionName: string;
  questionText: string;
  questionImageUrl?: string;
  options: Array<{ id: OptionId; text: string; imageUrl?: string }>;
  correctOptionId: OptionId;
  shortExplanation: string;
  solutionImageUrl?: string;
  stepByStepSolution: string[];
}> {
  const lines = text.split(/\r?\n/);
  const questions: any[] = [];
  let currentSection = 'General';
  let curQ: any = null;
  let inSolution = false;

  const pushCurrent = () => {
    if (curQ && curQ.questionText) {
      const optMap = new Map(curQ.options.map((o: any) => [o.id, o]));
      const fullOptions = (['A', 'B', 'C', 'D'] as OptionId[]).map((id) => {
        return optMap.get(id) || { id, text: `Option ${id}` };
      });
      curQ.options = fullOptions;
      questions.push(curQ);
    }
    curQ = null;
    inSolution = false;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const secMatch = trimmed.match(/^(?:\[?\s*SECTION\s*[:=]\s*|###\s+)([^\]\n]+)\]?/i);
    if (secMatch) {
      pushCurrent();
      currentSection = secMatch[1].trim();
      continue;
    }

    const qMatch = trimmed.match(/^(?:Q\s*\d*[:.]|Question\s*\d*[:.])\s*(.*)/i);
    if (qMatch) {
      pushCurrent();
      curQ = {
        sectionName: currentSection,
        questionText: qMatch[1].trim(),
        options: [],
        correctOptionId: 'A',
        shortExplanation: '',
        stepByStepSolution: [],
      };
      continue;
    }

    if (!curQ) continue;

    const imgMatch = trimmed.match(/^(?:IMAGE|DIAGRAM|Q_IMAGE)\s*[:=]\s*(https?:\/\/[^\s]+)/i);
    if (imgMatch) {
      curQ.questionImageUrl = imgMatch[1].trim();
      continue;
    }

    const optMatch =
      trimmed.match(/^([A-D])[\):.]\s*(.*)/i) || trimmed.match(/^\(([A-D])\)\s*(.*)/i);
    if (optMatch) {
      inSolution = false;
      const optId = optMatch[1].toUpperCase() as OptionId;
      const optText = optMatch[2].trim();
      curQ.options.push({ id: optId, text: optText });
      continue;
    }

    const optImgMatch = trimmed.match(
      /^(?:([A-D])_IMAGE|IMAGE_([A-D]))\s*[:=]\s*(https?:\/\/[^\s]+)/i
    );
    if (optImgMatch) {
      const optId = (optImgMatch[1] || optImgMatch[2]).toUpperCase() as OptionId;
      const existing = curQ.options.find((o: any) => o.id === optId);
      if (existing) {
        existing.imageUrl = optImgMatch[3].trim();
      } else {
        curQ.options.push({ id: optId, text: '', imageUrl: optImgMatch[3].trim() });
      }
      continue;
    }

    const ansMatch = trimmed.match(/^(?:ANS|ANSWER|CORRECT(?:_OPTION)?|KEY)\s*[:=]\s*([A-D])/i);
    if (ansMatch) {
      inSolution = false;
      curQ.correctOptionId = ansMatch[1].toUpperCase() as OptionId;
      continue;
    }

    const expMatch = trimmed.match(/^(?:EXP|EXPLANATION|EXPLAIN)\s*[:=]\s*(.*)/i);
    if (expMatch) {
      inSolution = false;
      curQ.shortExplanation = expMatch[1].trim();
      continue;
    }

    const solImgMatch = trimmed.match(
      /^(?:SOL_IMAGE|SOLUTION_IMAGE)\s*[:=]\s*(https?:\/\/[^\s]+)/i
    );
    if (solImgMatch) {
      curQ.solutionImageUrl = solImgMatch[1].trim();
      continue;
    }

    if (/^(?:SOLUTION|STEPS|DERIVATION)\s*[:=]?/i.test(trimmed)) {
      inSolution = true;
      continue;
    }

    if (inSolution) {
      const cleanStep = trimmed.replace(/^[-*•\d.]+\s*/, '').trim();
      if (cleanStep) {
        curQ.stepByStepSolution.push(cleanStep);
      }
      continue;
    }

    if (curQ.options.length === 0) {
      curQ.questionText += '\n' + trimmed;
    }
  }

  pushCurrent();
  return questions;
}

export function AiDocumentImporterModal({
  currentTest,
  onClose,
  onImportComplete,
}: AiDocumentImporterModalProps) {
  const [step, setStep] = useState<'upload' | 'preview'>('upload');
  const [importMode, setImportMode] = useState<ImportSourceMode>('csv');

  // Metadata
  const [testTitle, setTestTitle] = useState(
    currentTest?.title || 'MECEE BL Model Entrance Exam (Model: XIII)'
  );
  const [testDescription, setTestDescription] = useState(
    currentTest?.description ||
      'Comprehensive medical entrance examination model test with Zoology, Botany, Chemistry, Physics, and MAT sections.'
  );

  // CSV Inputs
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvRawText, setCsvRawText] = useState<string>('');

  // Plain Text Inputs
  const [textExamContent, setTextExamContent] = useState<string>('');

  // PDF & Fast-track Inputs
  const [questionFile, setQuestionFile] = useState<File | null>(null);
  const [solutionFile, setSolutionFile] = useState<File | null>(null);
  const [useLocalSample, setUseLocalSample] = useState(false);

  // Loading & Error States
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Extracted Data for Pre-Publish Preview
  const [extractedSections, setExtractedSections] = useState<TestSection[]>([]);
  const [extractedQuestions, setExtractedQuestions] = useState<TestQuestion[]>([]);
  const [activeSectionId, setActiveSectionId] = useState<string>('all');
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);

  // Inline Question Editing Form State
  const [editForm, setEditForm] = useState<{
    questionText: string;
    questionImageUrl: string;
    options: QuestionOption[];
    correctOptionId: OptionId;
    shortExplanation: string;
    solutionImageUrl: string;
    stepByStepSolution: string[];
  } | null>(null);

  const [saving, setSaving] = useState(false);

  // Download Sample CSV
  const handleDownloadSampleCsv = () => {
    const blob = new Blob([SAMPLE_CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'exampulse_500_questions_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Populate sample Markdown/text
  const handleLoadSampleText = () => {
    setTextExamContent(SAMPLE_TEXT_TEMPLATE.trim());
  };

  // Convert File to Base64 (for PDF/Docs)
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1] || result;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Dynamically load PDF.js in the browser for client-side rendering
  const loadPdfJs = async (): Promise<any> => {
    if (typeof window === 'undefined') return null;
    if ((window as any).pdfjsLib) return (window as any).pdfjsLib;

    return new Promise((resolve, reject) => {
      const existing = document.getElementById('pdfjs-cdn-script');
      if (existing) {
        existing.addEventListener('load', () => resolve((window as any).pdfjsLib));
        return;
      }
      const script = document.createElement('script');
      script.id = 'pdfjs-cdn-script';
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = async () => {
        const pdfjs = (window as any).pdfjsLib;
        if (pdfjs) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            const workerCode = await fetch(
              'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
              { signal: controller.signal }
            ).then((r) => r.text());
            clearTimeout(timeoutId);
            const blob = new Blob([workerCode], { type: 'application/javascript' });
            pdfjs.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);
          } catch {
            try {
              pdfjs.GlobalWorkerOptions.workerSrc =
                'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            } catch {}
          }
          resolve(pdfjs);
        } else {
          reject(new Error('PDF engine initialized without pdfjsLib'));
        }
      };
      script.onerror = () => reject(new Error('Could not load PDF processing engine'));
      document.head.appendChild(script);
    });
  };

  // Render PDF pages client-side to lightweight compressed JPEGs (~50KB/page)
  const renderPdfPagesClientSide = async (
    file: File,
    maxPages = 16,
    onProgress?: (current: number, total: number) => void
  ): Promise<{ pageImages: string[]; text: string }> => {
    const pdfjs = await loadPdfJs();
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: buffer }).promise;
    const numPages = Math.min(pdf.numPages, maxPages);
    const pageImages: string[] = [];
    let extractedText = '';

    for (let i = 1; i <= numPages; i++) {
      onProgress?.(i, numPages);
      const page = await pdf.getPage(i);

      try {
        const content = await page.getTextContent();
        const str = content.items.map((it: any) => it.str).join(' ');
        if (str.trim().length > 30) {
          extractedText += `\n--- Page ${i} ---\n` + str;
        }
      } catch {
        // Continue if text extraction fails
      }

      const unscaledViewport = page.getViewport({ scale: 1.0 });
      const targetScale = Math.min(1.2, 850 / unscaledViewport.width);
      const viewport = page.getViewport({ scale: targetScale });

      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        await page.render({ canvasContext: ctx, viewport }).promise;
        const jpeg = canvas.toDataURL('image/jpeg', 0.65);
        pageImages.push(jpeg);
      }
    }

    return { pageImages, text: extractedText };
  };

  // Assemble and Transition to Step 2 Pre-Publish Studio
  const transitionToPreview = (
    rawQuestions: Array<{
      sectionName?: string;
      questionText: string;
      questionImageUrl?: string;
      options: QuestionOption[];
      correctOptionId: OptionId;
      shortExplanation: string;
      solutionImageUrl?: string;
      stepByStepSolution: string[];
    }>,
    inferredTitle?: string,
    inferredDescription?: string
  ) => {
    if (!rawQuestions || rawQuestions.length === 0) {
      throw new Error('No questions found. Please check your data formatting.');
    }

    // Auto-discover unique sections
    const sectionNames = Array.from(
      new Set(rawQuestions.map((q) => (q.sectionName || 'General').trim()))
    );

    const testId = currentTest?.testId || `test_${Date.now()}`;
    const createdSections: TestSection[] = sectionNames.map((name, idx) => ({
      id: `sec_${idx + 1}_${Date.now()}`,
      name: name || `Section ${idx + 1}`,
      questionCount: 0,
    }));

    if (createdSections.length === 0) {
      createdSections.push({
        id: `sec_1_${Date.now()}`,
        name: 'General',
        questionCount: rawQuestions.length,
      });
    }

    const mappedQuestions: TestQuestion[] = rawQuestions.map((q, idx) => {
      const sName = (q.sectionName || '').trim().toLowerCase();
      const matchSec =
        createdSections.find((s) => s.name.trim().toLowerCase() === sName) || createdSections[0];

      const optionIds: OptionId[] = ['A', 'B', 'C', 'D'];
      const formattedOptions: QuestionOption[] = optionIds.map((optId) => {
        const found = q.options.find((o) => o.id?.toUpperCase() === optId);
        return {
          id: optId,
          text: found ? found.text : `Option ${optId}`,
          imageUrl: found?.imageUrl?.trim() || undefined,
        };
      });

      const cleanCorrect: OptionId = ['A', 'B', 'C', 'D'].includes(q.correctOptionId?.toUpperCase())
        ? (q.correctOptionId.toUpperCase() as OptionId)
        : 'A';

      return {
        questionId: `q_${Date.now()}_${idx + 1}`,
        testId,
        testStatus: 'draft',
        sectionId: matchSec.id,
        orderIndex: idx + 1,
        questionText: q.questionText || `Question ${idx + 1}`,
        questionImageUrl: q.questionImageUrl?.trim() || undefined,
        options: formattedOptions,
        correctOptionId: cleanCorrect,
        shortExplanation: q.shortExplanation || '',
        solutionImageUrl: q.solutionImageUrl?.trim() || undefined,
        stepByStepSolution: Array.isArray(q.stepByStepSolution) ? q.stepByStepSolution : [],
        marks: 1,
      };
    });

    const finalizedSections = createdSections.map((sec) => ({
      ...sec,
      questionCount: mappedQuestions.filter((q) => q.sectionId === sec.id).length,
    }));

    if (inferredTitle) setTestTitle(inferredTitle);
    if (inferredDescription) setTestDescription(inferredDescription);

    setExtractedSections(finalizedSections);
    setExtractedQuestions(mappedQuestions);
    setActiveSectionId('all');
    setStep('preview');
  };

  // Main Processing Handler
  const handleStartProcessing = async () => {
    setError(null);

    // MODE 1: CSV / SPREADSHEET
    if (importMode === 'csv') {
      try {
        let contentToParse = csvRawText.trim();
        if (csvFile) {
          contentToParse = await csvFile.text();
        }

        if (!contentToParse) {
          setError('Please upload a CSV file or paste spreadsheet contents.');
          return;
        }

        const parsed = parseCsvRows(contentToParse);
        if (parsed.length === 0) {
          setError(
            'Could not detect questions in CSV. Ensure your file has "Question" and "OptionA" columns (or download our template).'
          );
          return;
        }

        transitionToPreview(parsed, testTitle, testDescription);
        return;
      } catch (csvErr: any) {
        setError(csvErr?.message || 'Failed to parse CSV spreadsheet.');
        return;
      }
    }

    // MODE 2: PLAIN TEXT / MARKDOWN
    if (importMode === 'text') {
      try {
        if (!textExamContent.trim()) {
          setError('Please paste your questions or click "Load Sample Questions Syntax".');
          return;
        }

        const parsed = parseTextExam(textExamContent);
        if (parsed.length === 0) {
          setError('No questions recognized. Use "Q: ...", "A: ...", "ANSWER: ..." format.');
          return;
        }

        transitionToPreview(parsed, testTitle, testDescription);
        return;
      } catch (txtErr: any) {
        setError(txtErr?.message || 'Failed to parse text document.');
        return;
      }
    }

    // MODE 3: PDF & BOOKLET AI / FAST-TRACK
    if (!useLocalSample && !questionFile) {
      setError('Please upload at least the Question booklet PDF/document, or select the sample booklet.');
      return;
    }

    setLoading(true);
    setLoadingStep('Initializing AI assessment extraction engine…');

    try {
      let combinedQuestions: any[] = [];
      let combinedTitle = testTitle;
      let combinedDescription = testDescription;

      if (useLocalSample) {
        setLoadingStep('Loading MECEE BL Model XIII Booklet (Zoology, Botany, Chemistry, Physics, MAT)…');
        const result = await importDocumentExamWithAI({
          useLocalSample: true,
          testTitle,
        });
        combinedQuestions = result.questions || [];
        combinedTitle = result.title || testTitle;
        combinedDescription = result.description || testDescription;
      } else if (questionFile) {
        const isPdf =
          questionFile.type === 'application/pdf' ||
          questionFile.name.toLowerCase().endsWith('.pdf');
        const fileSizeMb = questionFile.size / (1024 * 1024);

        if (isPdf) {
          setLoadingStep(`Rendering ${fileSizeMb.toFixed(1)}MB PDF client-side into lightweight page stream…`);

          let pageImages: string[] = [];
          let extractedText = '';

          try {
            const res = await renderPdfPagesClientSide(questionFile, 16, (cur, tot) => {
              setLoadingStep(`Optimizing page ${cur} of ${tot} (rendering crisp 850px diagrams)…`);
            });
            pageImages = res.pageImages;
            extractedText = res.text;
          } catch (pdfErr) {
            console.warn('Client-side PDF rendering failed:', pdfErr);
          }

          if (pageImages.length > 0) {
            const BATCH_SIZE = 1;
            const totalBatches = Math.ceil(pageImages.length / BATCH_SIZE);

            for (let b = 0; b < totalBatches; b++) {
              const startPage = b * BATCH_SIZE + 1;
              const endPage = Math.min((b + 1) * BATCH_SIZE, pageImages.length);
              setLoadingStep(
                `Extracting Page ${startPage}/${pageImages.length} (${combinedQuestions.length} questions collected)…`
              );

              const batchSlice = pageImages.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);
              let success = false;
              let lastPageErr: any = null;

              for (let attempt = 1; attempt <= 2; attempt++) {
                try {
                  const batchRes = await importDocumentExamWithAI({
                    pageImages: batchSlice,
                    questionDocText: extractedText ? extractedText.slice(0, 3000) : undefined,
                    testTitle,
                    pageRange: `${startPage}-${endPage}`,
                  });

                  if (batchRes.questions && batchRes.questions.length > 0) {
                    combinedQuestions.push(...batchRes.questions);
                  }
                  if (b === 0 && batchRes.title) {
                    combinedTitle = batchRes.title;
                  }
                  success = true;
                  break;
                } catch (pageErr: any) {
                  lastPageErr = pageErr;
                  const errMsg = pageErr?.message || String(pageErr);
                  const isSpike =
                    errMsg.includes('503') || errMsg.includes('demand') || errMsg.includes('429');
                  if (attempt < 2 && isSpike) {
                    setLoadingStep(
                      `Temporary demand spike on page ${startPage}. Waiting 2.5s and retrying (attempt 2/2)…`
                    );
                    await new Promise((resolve) => setTimeout(resolve, 2500));
                  }
                }
              }

              if (!success) {
                console.warn(`Page ${startPage} extraction notice:`, lastPageErr);
                if (b === 0 && combinedQuestions.length === 0) {
                  throw lastPageErr;
                }
              }
            }
          } else {
            setLoadingStep('Uploading document to AI extractor…');
            const b64 = await fileToBase64(questionFile);
            const result = await importDocumentExamWithAI({
              questionDocBase64: b64,
              questionDocMimeType: 'application/pdf',
              testTitle,
            });
            combinedQuestions = result.questions || [];
            combinedTitle = result.title || testTitle;
            combinedDescription = result.description || testDescription;
          }
        } else {
          setLoadingStep('Uploading document to AI extractor…');
          const qB64 = await fileToBase64(questionFile);
          let sB64: string | undefined;
          if (solutionFile) {
            sB64 = await fileToBase64(solutionFile).catch(() => undefined);
          }
          setLoadingStep('AI analyzing sections, converting formulas to KaTeX LaTeX, and pairing answer keys…');
          const result = await importDocumentExamWithAI({
            questionDocBase64: qB64,
            questionDocMimeType: questionFile.type || 'application/octet-stream',
            solutionDocBase64: sB64,
            solutionDocMimeType: solutionFile?.type || 'application/octet-stream',
            testTitle,
          });
          combinedQuestions = result.questions || [];
          combinedTitle = result.title || testTitle;
          combinedDescription = result.description || testDescription;
        }
      }

      transitionToPreview(combinedQuestions, combinedTitle, combinedDescription);
    } catch (err: any) {
      setError(err?.message || 'Failed to process document with AI.');
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  // Section Move Up & Down
  const handleMoveSection = (secId: string, direction: 'up' | 'down') => {
    const idx = extractedSections.findIndex((s) => s.id === secId);
    if (idx < 0) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= extractedSections.length) return;

    const updated = [...extractedSections];
    const [moved] = updated.splice(idx, 1);
    updated.splice(targetIdx, 0, moved);
    setExtractedSections(updated);
  };

  // Move Question to another section
  const handleMoveQuestionSection = (questionId: string, targetSectionId: string) => {
    setExtractedQuestions((prev) =>
      prev.map((q) => (q.questionId === questionId ? { ...q, sectionId: targetSectionId } : q))
    );
    setExtractedSections((prev) =>
      prev.map((s) => {
        const count = extractedQuestions.filter((q) =>
          q.questionId === questionId ? targetSectionId === s.id : q.sectionId === s.id
        ).length;
        return { ...s, questionCount: count };
      })
    );
  };

  // Delete question
  const handleDeleteQuestion = (questionId: string) => {
    const updated = extractedQuestions.filter((q) => q.questionId !== questionId);
    setExtractedQuestions(updated);
    setExtractedSections((prev) =>
      prev.map((s) => ({
        ...s,
        questionCount: updated.filter((q) => q.sectionId === s.id).length,
      }))
    );
  };

  // Start Editing Question Inline
  const handleStartEditing = (q: TestQuestion) => {
    setEditingQuestionId(q.questionId);
    setEditForm({
      questionText: q.questionText,
      questionImageUrl: q.questionImageUrl || '',
      options: JSON.parse(JSON.stringify(q.options)),
      correctOptionId: q.correctOptionId,
      shortExplanation: q.shortExplanation || '',
      solutionImageUrl: q.solutionImageUrl || '',
      stepByStepSolution: [...(q.stepByStepSolution || [])],
    });
  };

  // Save Inline Question Edit
  const handleSaveInlineEdit = (questionId: string) => {
    if (!editForm) return;
    setExtractedQuestions((prev) =>
      prev.map((q) => {
        if (q.questionId !== questionId) return q;
        return {
          ...q,
          questionText: editForm.questionText,
          questionImageUrl: editForm.questionImageUrl.trim() || undefined,
          options: editForm.options,
          correctOptionId: editForm.correctOptionId,
          shortExplanation: editForm.shortExplanation,
          solutionImageUrl: editForm.solutionImageUrl.trim() || undefined,
          stepByStepSolution: editForm.stepByStepSolution,
        };
      })
    );
    setEditingQuestionId(null);
    setEditForm(null);
  };

  // Commit and finish
  const handleCommit = async (publishImmediately: boolean) => {
    setSaving(true);
    setError(null);
    try {
      await onImportComplete(
        {
          title: testTitle,
          description: testDescription,
          sections: extractedSections,
          questions: extractedQuestions,
        },
        publishImmediately
      );
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save imported assessment.');
    } finally {
      setSaving(false);
    }
  };

  const visibleQuestions =
    activeSectionId === 'all'
      ? extractedQuestions
      : extractedQuestions.filter((q) => q.sectionId === activeSectionId);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-50/50 via-white to-indigo-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display font-bold text-base sm:text-lg text-slate-900 leading-tight">
                Universal Exam & Question Importer
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Bulk import 500+ questions with LaTeX formulas, hosted diagram links (Unsplash/ImgBB), and verified solutions.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="px-6 py-2.5 bg-rose-50 border-b border-rose-200 text-xs font-semibold text-rose-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-rose-700 hover:underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-slate-50/50">
          {/* ======================================================== */}
          {/* STEP 1: UPLOAD & INGESTION OPTIONS                       */}
          {/* ======================================================== */}
          {step === 'upload' && (
            <div className="space-y-6 max-w-4xl mx-auto">
              {/* Target Exam Info */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-blue-600" />
                  <span>Target Exam Details</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Exam Title
                    </label>
                    <input
                      type="text"
                      value={testTitle}
                      onChange={(e) => setTestTitle(e.target.value)}
                      placeholder="e.g. MECEE BL Model Entrance Exam (Model: XIII)"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 focus:outline-hidden focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Exam Description
                    </label>
                    <input
                      type="text"
                      value={testDescription}
                      onChange={(e) => setTestDescription(e.target.value)}
                      placeholder="e.g. Zoology, Botany, Chemistry, Physics, and MAT sections."
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 focus:outline-hidden focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Source Selector Tabs */}
              <div className="flex items-center gap-2 p-1 bg-slate-200/70 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setImportMode('csv')}
                  className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    importMode === 'csv'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  <span>1. Spreadsheet / CSV (500+ Qs)</span>
                  <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-full font-semibold">
                    Fastest
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setImportMode('text')}
                  className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    importMode === 'text'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ClipboardList className="h-4 w-4" />
                  <span>2. Paste Text / Markdown</span>
                </button>

                <button
                  type="button"
                  onClick={() => setImportMode('pdf')}
                  className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    importMode === 'pdf'
                      ? 'bg-white text-purple-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Sparkles className="h-4 w-4" />
                  <span>3. PDF / Scanned Booklet (AI)</span>
                </button>
              </div>

              {/* ======================================================= */}
              {/* TAB 1: CSV / SPREADSHEET (500+ QUESTIONS)               */}
              {/* ======================================================= */}
              {importMode === 'csv' && (
                <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">
                        Universal Spreadsheet Ingester
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Upload or paste Excel / Google Sheets CSV. Supports KaTeX math ($...$), diagram links for questions & options.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleDownloadSampleCsv}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold cursor-pointer transition-colors shrink-0"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Download 500-Q CSV Template</span>
                    </button>
                  </div>

                  {/* Dropzone */}
                  <div className="border-2 border-dashed border-blue-200 rounded-2xl p-6 flex flex-col items-center justify-center text-center space-y-3 bg-blue-50/20">
                    <div className="h-12 w-12 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center">
                      <FileSpreadsheet className="h-6 w-6" />
                    </div>

                    <div>
                      <div className="text-xs font-bold text-slate-900">
                        {csvFile ? csvFile.name : 'Select or Drop CSV / TSV File'}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Accepts comma-separated or tab-separated exports from Excel / Google Sheets
                      </div>
                    </div>

                    <input
                      type="file"
                      id="csvFileInput"
                      accept=".csv,.tsv,.txt"
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          setCsvFile(e.target.files[0]);
                          setCsvRawText('');
                        }
                      }}
                      className="hidden"
                    />

                    <label
                      htmlFor="csvFileInput"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-xs font-bold cursor-pointer transition-colors shadow-xs"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      <span>{csvFile ? 'Choose Different File' : 'Browse CSV File'}</span>
                    </label>
                  </div>

                  {/* Or Direct Paste */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Or Paste CSV / Tab-Separated Values Directly:
                    </label>
                    <textarea
                      rows={4}
                      value={csvRawText}
                      onChange={(e) => {
                        setCsvRawText(e.target.value);
                        if (csvFile) setCsvFile(null);
                      }}
                      placeholder={`Section,Question,QuestionImageUrl,OptionA,OptionAImageUrl,OptionB,OptionBImageUrl,OptionC,OptionCImageUrl,OptionD,OptionDImageUrl,CorrectOption,Explanation,SolutionImageUrl,StepByStepSolution\nPhysics,"Calculate $V = IR$ when $I=2\\text{ A}, R=10\\,\\Omega$",,"$20\\text{ V}",,"$10\\text{ V}",,"$5\\text{ V}",,"$40\\text{ V}",,A,"Ohm's law gives $V = 20\\text{ V}$",,"1. $V = 2 \\times 10 = 20\\text{ V}$"`}
                      className="w-full font-mono text-[11px] rounded-xl border border-slate-200 bg-white p-3 text-slate-800 focus:outline-hidden focus:border-blue-500"
                    />
                  </div>
                </div>
              )}

              {/* ======================================================= */}
              {/* TAB 2: PLAIN TEXT / MARKDOWN                            */}
              {/* ======================================================= */}
              {importMode === 'text' && (
                <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">
                        Fast Copy-Paste Text Ingester
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Paste question stems, options, and solutions in human-readable notation.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleLoadSampleText}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-bold cursor-pointer transition-colors shrink-0"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      <span>Load Sample Syntax</span>
                    </button>
                  </div>

                  <div>
                    <textarea
                      rows={10}
                      value={textExamContent}
                      onChange={(e) => setTextExamContent(e.target.value)}
                      placeholder={`[SECTION: Physics]\nQ: In a Young's double slit experiment, the fringe width is $\\beta = \\frac{\\lambda D}{d}$.\nIMAGE: https://images.unsplash.com/photo-1635070041078-e363dbe005cb\nA: Increases\nB: Decreases\nC: Remains constant\nD: Becomes zero\nANSWER: A\nEXPLANATION: Fringe width is directly proportional to $\\lambda$.\nSOLUTION:\n1. $\\beta = \\frac{\\lambda D}{d}$\n2. As $\\lambda$ increases, $\\beta$ increases.`}
                      className="w-full font-mono text-[11px] rounded-xl border border-slate-200 bg-white p-3 text-slate-800 focus:outline-hidden focus:border-indigo-500"
                    />
                  </div>
                </div>
              )}

              {/* ======================================================= */}
              {/* TAB 3: PDF & BOOKLET AI / FAST-TRACK                    */}
              {/* ======================================================= */}
              {importMode === 'pdf' && (
                <div className="space-y-4">
                  {/* Upload Dropzones */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* 1. Question Booklet */}
                    <div className="bg-white rounded-2xl border-2 border-dashed border-blue-200/80 p-5 shadow-2xs flex flex-col items-center justify-center text-center space-y-3">
                      <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                        <FileText className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900">1. Question Booklet (PDF / DOCX)</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {questionFile ? questionFile.name : 'Contains question stems, diagrams, and options A-D'}
                        </div>
                      </div>

                      <input
                        type="file"
                        id="questionFileInput"
                        accept=".pdf,.docx,.txt"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            setQuestionFile(e.target.files[0]);
                            setUseLocalSample(false);
                          }
                        }}
                        className="hidden"
                      />
                      <label
                        htmlFor="questionFileInput"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold cursor-pointer transition-colors"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        <span>{questionFile ? 'Change Question PDF' : 'Upload Questions PDF'}</span>
                      </label>
                    </div>

                    {/* 2. Solution / Answer Key Booklet */}
                    <div className="bg-white rounded-2xl border-2 border-dashed border-indigo-200/80 p-5 shadow-2xs flex flex-col items-center justify-center text-center space-y-3">
                      <div className="h-12 w-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <CheckCircle2 className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900">2. Hints & Solutions Booklet</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {solutionFile ? solutionFile.name : 'Optional separate booklet for answers & derivations'}
                        </div>
                      </div>

                      <input
                        type="file"
                        id="solutionFileInput"
                        accept=".pdf,.docx,.txt"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            setSolutionFile(e.target.files[0]);
                            setUseLocalSample(false);
                          }
                        }}
                        className="hidden"
                      />
                      <label
                        htmlFor="solutionFileInput"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-bold cursor-pointer transition-colors"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        <span>{solutionFile ? 'Change Solution PDF' : 'Upload Solutions PDF'}</span>
                      </label>
                    </div>
                  </div>

                  {/* Local Sample Booklet Shortcut */}
                  <div className="bg-gradient-to-r from-blue-50 via-white to-purple-50 rounded-2xl border border-blue-200/80 p-4 flex items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs shrink-0">
                        SET A
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">
                          Fast-Track: Use Local MECEE BL Model XIII Booklets
                        </span>
                        <span className="text-[11px] text-slate-600 block">
                          Instantly loads your local <code>DOC-20260921-WA0011.pdf</code> & <code>DOC-20260921-WA0012.pdf</code> files in &lt;50ms.
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setUseLocalSample(true);
                        setQuestionFile(null);
                        setSolutionFile(null);
                      }}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs ${
                        useLocalSample
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'bg-white border border-purple-200 text-purple-700 hover:bg-purple-50'
                      }`}
                    >
                      {useLocalSample ? 'Selected ✓' : 'Select Local Sample'}
                    </button>
                  </div>
                </div>
              )}

              {/* Action Button */}
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleStartProcessing}
                  className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 text-xs sm:text-sm font-bold shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all"
                >
                  {loading ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />
                      <span>{loadingStep || 'Processing Ingestion…'}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      <span>Review & Adjust in Pre-Publish Studio →</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* STEP 2: PRE-PUBLISH INTERACTIVE PREVIEW & ADJUSTMENTS     */}
          {/* ======================================================== */}
          {step === 'preview' && (
            <div className="space-y-6">
              {/* Summary Bar */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-display font-bold text-base text-slate-900">{testTitle}</h3>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1">
                    <span className="font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full">
                      {extractedQuestions.length} Questions Ready
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="font-semibold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full">
                      {extractedSections.length} Sections
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                      {extractedQuestions.filter((q) => q.questionImageUrl || q.options.some((o) => o.imageUrl)).length} Diagrams
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setStep('upload')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Import More</span>
                  </button>
                </div>
              </div>

              {/* Section Management Strip (Move Up, Move Down, Rename) */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-blue-600" />
                    <span className="text-xs font-bold text-slate-900">
                      Sections Management (Reorder Up/Down & Filter)
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Use arrows to adjust section appearance order
                  </span>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  <button
                    type="button"
                    onClick={() => setActiveSectionId('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                      activeSectionId === 'all'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    All Questions ({extractedQuestions.length})
                  </button>

                  {extractedSections.map((sec, idx) => {
                    const isSelected = activeSectionId === sec.id;
                    return (
                      <div
                        key={sec.id}
                        className={`inline-flex items-center rounded-xl text-xs font-semibold border transition-all shrink-0 ${
                          isSelected
                            ? 'bg-blue-50 text-blue-700 border-blue-200/70 font-bold shadow-2xs'
                            : 'bg-white border-slate-200/80 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setActiveSectionId(sec.id)}
                          className="px-3 py-1.5 flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>{sec.name}</span>
                          <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded-md">
                            {sec.questionCount}
                          </span>
                        </button>

                        <div className="flex items-center pr-1.5 gap-0.5 border-l border-slate-200/60 pl-1">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMoveSection(sec.id, 'up');
                            }}
                            className="p-1 text-slate-400 hover:text-blue-700 hover:bg-blue-100/70 rounded disabled:opacity-20 cursor-pointer transition-colors"
                            title="Move section left/up"
                          >
                            <ChevronLeft className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === extractedSections.length - 1}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMoveSection(sec.id, 'down');
                            }}
                            className="p-1 text-slate-400 hover:text-blue-700 hover:bg-blue-100/70 rounded disabled:opacity-20 cursor-pointer transition-colors"
                            title="Move section right/down"
                          >
                            <ChevronRight className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Questions List with Full Diagram and Math Preview */}
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 px-1">
                  <span>Showing {visibleQuestions.length} Questions</span>
                  <span className="text-[11px] font-medium text-slate-500">
                    KaTeX math rendered • Option diagrams supported • Click edit icon to modify
                  </span>
                </div>

                <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
                  {visibleQuestions.map((q, idx) => {
                    const sec = extractedSections.find((s) => s.id === q.sectionId);
                    const isEditing = editingQuestionId === q.questionId;

                    return (
                      <div
                        key={q.questionId}
                        className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-3.5 transition-all"
                      >
                        {/* Header line: Question #, Section Badge & Actions */}
                        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                          <div className="flex items-center gap-2">
                            <span className="font-display font-bold text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg">
                              Q{idx + 1}
                            </span>
                            <span className="text-xs font-semibold text-slate-500">
                              Section: <strong className="text-slate-800">{sec?.name || 'General'}</strong>
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {/* Move Section Selector */}
                            <select
                              value={q.sectionId}
                              onChange={(e) => handleMoveQuestionSection(q.questionId, e.target.value)}
                              className="text-[11px] font-semibold text-slate-600 bg-slate-100/80 rounded-lg px-2 py-1 border border-slate-200 focus:outline-hidden cursor-pointer"
                              title="Assign to another section"
                            >
                              {extractedSections.map((s) => (
                                <option key={s.id} value={s.id}>
                                  Move to {s.name}
                                </option>
                              ))}
                            </select>

                            {/* Edit Button */}
                            <button
                              type="button"
                              onClick={() => (isEditing ? setEditingQuestionId(null) : handleStartEditing(q))}
                              className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                                isEditing
                                  ? 'bg-blue-600 text-white'
                                  : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'
                              }`}
                              title="Edit question text, image, options or explanation"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>

                            {/* Delete Button */}
                            <button
                              type="button"
                              onClick={() => handleDeleteQuestion(q.questionId)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                              title="Remove question"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* =================================================== */}
                        {/* INLINE EDIT MODE                                    */}
                        {/* =================================================== */}
                        {isEditing && editForm ? (
                          <div className="space-y-3 bg-blue-50/30 p-4 rounded-xl border border-blue-200/70">
                            <div>
                              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                                Question Stem (with KaTeX $...$):
                              </label>
                              <textarea
                                rows={2}
                                value={editForm.questionText}
                                onChange={(e) =>
                                  setEditForm({ ...editForm, questionText: e.target.value })
                                }
                                className="w-full text-xs rounded-lg border border-slate-200 bg-white p-2.5 text-slate-900 focus:outline-hidden focus:border-blue-500"
                              />
                            </div>

                            <div>
                              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                                Question Diagram URL (Unsplash / ImgBB link):
                              </label>
                              <input
                                type="text"
                                value={editForm.questionImageUrl}
                                onChange={(e) =>
                                  setEditForm({ ...editForm, questionImageUrl: e.target.value })
                                }
                                placeholder="https://images.unsplash.com/... or https://i.ibb.co/..."
                                className="w-full text-xs rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-900 focus:outline-hidden focus:border-blue-500"
                              />
                            </div>

                            {/* 4 Options Edit */}
                            <div className="space-y-2 pt-1">
                              <label className="text-[11px] font-bold text-slate-700 block">
                                Options A - D (and optional diagram link per option):
                              </label>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {editForm.options.map((opt, oIdx) => (
                                  <div
                                    key={opt.id}
                                    className="p-2.5 rounded-lg border border-slate-200 bg-white space-y-1.5 text-xs"
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="font-bold text-slate-800">Option {opt.id}:</span>
                                      <label className="flex items-center gap-1 text-[11px] font-semibold cursor-pointer">
                                        <input
                                          type="radio"
                                          name={`correct_${q.questionId}`}
                                          checked={editForm.correctOptionId === opt.id}
                                          onChange={() =>
                                            setEditForm({ ...editForm, correctOptionId: opt.id })
                                          }
                                        />
                                        <span className={editForm.correctOptionId === opt.id ? 'text-emerald-700 font-bold' : 'text-slate-500'}>
                                          Correct
                                        </span>
                                      </label>
                                    </div>

                                    <input
                                      type="text"
                                      value={opt.text}
                                      onChange={(e) => {
                                        const updatedOpts = [...editForm.options];
                                        updatedOpts[oIdx] = { ...opt, text: e.target.value };
                                        setEditForm({ ...editForm, options: updatedOpts });
                                      }}
                                      placeholder={`Text for Option ${opt.id}`}
                                      className="w-full text-xs rounded-md border border-slate-200 px-2 py-1"
                                    />

                                    <input
                                      type="text"
                                      value={opt.imageUrl || ''}
                                      onChange={(e) => {
                                        const updatedOpts = [...editForm.options];
                                        updatedOpts[oIdx] = { ...opt, imageUrl: e.target.value };
                                        setEditForm({ ...editForm, options: updatedOpts });
                                      }}
                                      placeholder="Option diagram image link (optional)"
                                      className="w-full text-[10px] rounded-md border border-slate-200 px-2 py-1 text-slate-600"
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Explanation Edit */}
                            <div>
                              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                                Short Explanation:
                              </label>
                              <textarea
                                rows={2}
                                value={editForm.shortExplanation}
                                onChange={(e) =>
                                  setEditForm({ ...editForm, shortExplanation: e.target.value })
                                }
                                className="w-full text-xs rounded-lg border border-slate-200 bg-white p-2.5 text-slate-900 focus:outline-hidden focus:border-blue-500"
                              />
                            </div>

                            <div className="flex justify-end gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => setEditingQuestionId(null)}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveInlineEdit(q.questionId)}
                                className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 cursor-pointer shadow-xs"
                              >
                                Save Changes ✓
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* =================================================== */
                          /* NORMAL PREVIEW MODE                                 */
                          /* =================================================== */
                          <>
                            {/* Question Stem with KaTeX */}
                            <div className="text-xs sm:text-sm font-semibold text-slate-900 leading-relaxed">
                              <MathText text={q.questionText} />
                            </div>

                            {/* Question Diagram if present */}
                            {q.questionImageUrl && (
                              <div className="rounded-xl border border-slate-200/80 p-2 max-w-md bg-slate-50/50 space-y-1">
                                <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
                                  <span>Question Diagram:</span>
                                  <a
                                    href={q.questionImageUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-blue-600 hover:underline flex items-center gap-1"
                                  >
                                    <span>Open link</span>
                                    <ExternalLink className="h-2.5 w-2.5" />
                                  </a>
                                </div>
                                <QuestionImage src={q.questionImageUrl} alt={`Q${idx + 1} diagram`} className="max-h-48 object-contain rounded-lg" />
                              </div>
                            )}

                            {/* 4 Options Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                              {q.options.map((opt) => {
                                const isCorrect = opt.id === q.correctOptionId;
                                return (
                                  <div
                                    key={opt.id}
                                    className={`rounded-xl border p-2.5 text-xs flex flex-col justify-between gap-2 ${
                                      isCorrect
                                        ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950 font-semibold'
                                        : 'bg-slate-50/70 border-slate-200/80 text-slate-700'
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span
                                          className={`h-5 w-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${
                                            isCorrect
                                              ? 'bg-emerald-600 text-white'
                                              : 'bg-slate-200 text-slate-600'
                                          }`}
                                        >
                                          {opt.id}
                                        </span>
                                        <div className="min-w-0">
                                          <MathText text={opt.text} />
                                        </div>
                                      </div>

                                      {isCorrect && (
                                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full shrink-0">
                                          Correct ✓
                                        </span>
                                      )}
                                    </div>

                                    {/* Option Image Diagram if present */}
                                    {opt.imageUrl && (
                                      <div className="rounded-lg border border-slate-200/80 p-1 bg-white mt-1">
                                        <QuestionImage
                                          src={opt.imageUrl}
                                          alt={`Option ${opt.id} diagram`}
                                          className="max-h-24 object-contain rounded"
                                        />
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>

                            {/* Solution & Explanation */}
                            {q.shortExplanation && (
                              <div className="rounded-xl bg-blue-50/50 border border-blue-100/80 p-3 text-xs space-y-1">
                                <span className="font-bold text-blue-900 block flex items-center gap-1">
                                  <Info className="h-3.5 w-3.5 text-blue-600" />
                                  <span>Explanation & Solution:</span>
                                </span>
                                <div className="text-slate-700 leading-relaxed">
                                  <MathText text={q.shortExplanation} />
                                </div>

                                {q.solutionImageUrl && (
                                  <div className="rounded-lg border border-blue-200/80 p-1.5 max-w-sm bg-white mt-2">
                                    <QuestionImage
                                      src={q.solutionImageUrl}
                                      alt="Solution diagram"
                                      className="max-h-36 object-contain rounded"
                                    />
                                  </div>
                                )}

                                {q.stepByStepSolution && q.stepByStepSolution.length > 0 && (
                                  <div className="space-y-1.5 pt-2">
                                    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                                      Step-by-Step Derivation:
                                    </div>
                                    <div className="space-y-1.5">
                                      {q.stepByStepSolution.map((st, sIdx) => {
                                        // Clean redundant prefixes like "1. ", "1) ", "Step 1: ", "• ", "- "
                                        const cleanStep =
                                          st
                                            .replace(/^(?:step\s*)?\d+[\.\):\s-]\s*/i, '')
                                            .replace(/^[-*•]\s*/, '')
                                            .trim() || st;
                                        return (
                                          <div
                                            key={sIdx}
                                            className="flex items-start gap-2 text-xs text-slate-700 bg-white/70 rounded-lg p-2 border border-slate-100/90 shadow-2xs"
                                          >
                                            <span className="shrink-0 h-4.5 w-4.5 rounded-full bg-blue-100 text-blue-700 font-bold text-[10px] flex items-center justify-center mt-0.5">
                                              {sIdx + 1}
                                            </span>
                                            <div className="flex-1 min-w-0 leading-relaxed pt-0.5">
                                              <MathText text={cleanStep} inline />
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bottom Actions: Save as Draft OR Publish Immediately */}
              <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setStep('upload')}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  ← Back to Ingest
                </button>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleCommit(false)}
                    className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-800 disabled:opacity-40 cursor-pointer shadow-xs transition-colors"
                  >
                    Save as Draft in Studio
                  </button>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleCommit(true)}
                    className="flex-1 sm:flex-initial px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white disabled:opacity-40 cursor-pointer shadow-md transition-colors"
                  >
                    {saving ? 'Publishing…' : 'Approve & Publish Exam Now ✓'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
