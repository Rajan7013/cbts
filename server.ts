import 'dotenv/config';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import crypto from 'node:crypto';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

const require = createRequire(import.meta.url);
const IS_VERCEL = Boolean(process.env.VERCEL);
const PORT = Number(process.env.PORT || 3000);
const MAIN_ADMIN_EMAIL = process.env.MAIN_ADMIN_EMAIL?.trim() || 'rajanprasaila@gmail.com';
const BUNDLED_UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
const UPLOADS_DIR = IS_VERCEL
  ? '/tmp/exampulse/uploads'
  : BUNDLED_UPLOADS_DIR;
const DATA_DIR = IS_VERCEL
  ? '/tmp/exampulse/data'
  : path.resolve(process.cwd(), 'data');
const VAULT_PATH = path.join(DATA_DIR, 'answer_vault.json');

fs.mkdirSync(UPLOADS_DIR, { recursive: true });
fs.mkdirSync(DATA_DIR, { recursive: true });

interface FirebaseConfigFile {
  projectId: string;
  firestoreDatabaseId: string;
}

function getFirebaseConfig(): FirebaseConfigFile {
  const envProjectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  const envDbId = process.env.VITE_FIREBASE_DATABASE_ID || process.env.FIRESTORE_DATABASE_ID;

  if (envProjectId && envDbId) {
    return {
      projectId: envProjectId,
      firestoreDatabaseId: envDbId,
    };
  }

  try {
    const raw = fs.readFileSync(path.resolve(process.cwd(), 'firebase-applet-config.json'), 'utf8');
    const parsed = JSON.parse(raw);
    return {
      projectId: envProjectId || parsed.projectId || 'amazing-centaur-462112-n5',
      firestoreDatabaseId: envDbId || parsed.firestoreDatabaseId || '(default)',
    };
  } catch {
    return {
      projectId: envProjectId || 'amazing-centaur-462112-n5',
      firestoreDatabaseId: envDbId || '(default)',
    };
  }
}

const firebaseConfig = getFirebaseConfig();

function parseServiceAccountCredential(raw: string): Record<string, unknown> | null {
  let cleaned = raw.trim().replace(/^["']|["']$/g, '');
  if (!cleaned) return null;

  // If the user accidentally pasted "FIREBASE_SERVICE_ACCOUNT_KEY=" inside the Vercel value field
  if (cleaned.startsWith('FIREBASE_SERVICE_ACCOUNT_KEY=')) {
    cleaned = cleaned.replace(/^FIREBASE_SERVICE_ACCOUNT_KEY=/, '').trim().replace(/^["']|["']$/g, '');
  }

  const tryJson = (text: string): Record<string, unknown> | null => {
    try {
      const obj = JSON.parse(text) as Record<string, unknown>;
      if (
        obj &&
        typeof obj === 'object' &&
        typeof obj.project_id === 'string' &&
        typeof obj.private_key === 'string' &&
        typeof obj.client_email === 'string'
      ) {
        return obj;
      }
      return null;
    } catch {
      return null;
    }
  };

  // Direct raw JSON string check (also handling escaped \n in private_key if needed)
  if (cleaned.startsWith('{')) {
    const direct = tryJson(cleaned);
    if (direct) return direct;
  }

  // File path check
  if (cleaned.endsWith('.json')) {
    const resolved = path.isAbsolute(cleaned)
      ? cleaned
      : path.resolve(process.cwd(), cleaned);
    if (fs.existsSync(resolved)) {
      return tryJson(fs.readFileSync(resolved, 'utf8'));
    }
  }

  // Base64 candidates: stripped of whitespace/newlines and original cleaned
  const stripped = cleaned.replace(/[\r\n\s]/g, '');
  for (const candidate of [stripped, cleaned]) {
    try {
      const decoded = Buffer.from(candidate, 'base64').toString('utf8').trim();
      if (decoded.startsWith('{')) {
        const parsed = tryJson(decoded);
        if (parsed) return parsed;
      }
    } catch {
      // Ignore
    }
  }

  // Also check if escaped json string e.g. "{\"type\": ...}"
  try {
    const unescaped = JSON.parse(`"${cleaned}"`);
    if (typeof unescaped === 'string' && unescaped.startsWith('{')) {
      const parsed = tryJson(unescaped);
      if (parsed) return parsed;
    }
  } catch {
    // Ignore
  }

  return null;
}

// Helper to seed 'jose' into require.cache so CJS 'jwks-rsa' inside 'firebase-admin/auth' can require('jose') without ERR_REQUIRE_ESM
async function seedJoseForCommonJs() {
  try {
    const joseMod = await import('jose');
    // Pre-populate require.cache for 'jose' across potential resolution paths
    const possiblePaths = [
      'jose',
      'jose/dist/webapi/index.js',
      'jose/dist/node/cjs/index.js',
    ];
    for (const p of possiblePaths) {
      try {
        const resolved = require.resolve(p);
        if (!require.cache[resolved]) {
          require.cache[resolved] = {
            id: resolved,
            filename: resolved,
            loaded: true,
            exports: joseMod,
          } as any;
        }
      } catch {
        // Try fallback cache entry
      }
    }
  } catch (err) {
    console.warn('Could not pre-seed jose module:', err);
  }
}

// Helper to safely load firebase-admin modules without triggering Vercel ESM/CJS jose bundler conflicts
let firebaseAdminApp: any = null;
let firebaseAdminAuth: any = null;
let firebaseAdminFirestore: any = null;
let firebaseAdminFirestoreMod: any = null;
let adminInitError: string | null = null;

async function getAdminModules() {
  if (!firebaseAdminApp) {
    try {
      await seedJoseForCommonJs();

      const [appMod, authMod, firestoreMod] = await Promise.all([
        import('firebase-admin/app'),
        import('firebase-admin/auth'),
        import('firebase-admin/firestore'),
      ]);

      const saRaw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();
      const saJson = saRaw ? parseServiceAccountCredential(saRaw) : null;

      let app = appMod.getApps().length > 0 ? appMod.getApps()[0] : null;

      if (!app) {
        if (saJson) {
          try {
            app = appMod.initializeApp({
              credential: appMod.cert(saJson as any),
              projectId: (saJson.project_id as string) || firebaseConfig.projectId,
            });
          } catch (initErr: any) {
            adminInitError = `initializeApp error: ${initErr?.message}`;
            app = appMod.initializeApp({ projectId: firebaseConfig.projectId });
          }
        } else {
          app = appMod.initializeApp({ projectId: firebaseConfig.projectId });
        }
      }

      firebaseAdminApp = app;
      firebaseAdminAuth = authMod.getAuth(app);
      firebaseAdminFirestoreMod = firestoreMod;

      if (saJson) {
        try {
          // Initialize firestore with database ID if configured, or default database
          const dbId = firebaseConfig.firestoreDatabaseId;
          firebaseAdminFirestore = dbId && dbId !== '(default)'
            ? firestoreMod.getFirestore(app, dbId)
            : firestoreMod.getFirestore(app);
        } catch (fsErr: any) {
          adminInitError = `getFirestore error: ${fsErr?.message}`;
          // Fallback to default firestore
          try {
            firebaseAdminFirestore = firestoreMod.getFirestore(app);
          } catch (defErr: any) {
            adminInitError += ` | fallback default error: ${defErr?.message}`;
          }
        }
      }
    } catch (e: any) {
      adminInitError = `dynamic import error: ${e?.message}`;
      console.warn('Firebase admin dynamically loaded in fallback mode:', e);
    }
  }
  return {
    app: firebaseAdminApp,
    auth: firebaseAdminAuth,
    db: firebaseAdminFirestore,
    firestoreMod: firebaseAdminFirestoreMod,
    error: adminInitError,
  };
}

type OptionId = 'A' | 'B' | 'C' | 'D';

interface StoredAnswerKey {
  questionId: string;
  testId: string;
  correctOptionId: OptionId;
  shortExplanation: string;
  solutionImageUrl?: string;
  stepByStepSolution: string[];
  marks?: number;
}

interface AnswerVault {
  byTest: Record<string, Record<string, StoredAnswerKey>>;
}

const DEFAULT_SAMPLE_KEYS: Record<string, Record<string, StoredAnswerKey>> = {
  apac_stem_optics_circuits_2026: {
    q_stem_1: {
      questionId: 'q_stem_1',
      testId: 'apac_stem_optics_circuits_2026',
      correctOptionId: 'B',
      shortExplanation:
        'Using Snell’s Law n1·sin(θ1) = n2·sin(θ2), sin(θ2) = sin(45°)/1.5 ≈ 0.4714, which gives θ2 ≈ 28.1°.',
      stepByStepSolution: [
        'Write Snell’s Law at the first air-glass boundary P1: n1 · sin(θ1) = n2 · sin(θ2).',
        'Substitute n1 = 1.0, θ1 = 45°, and n2 = 1.5: 1.0 × sin(45°) = 1.5 × sin(θ2).',
        'Compute sin(θ2) = 0.7071 / 1.5 ≈ 0.4714.',
        'Take arcsin(0.4714) ≈ 28.1°, matching the refracted angle labeled in the diagram.',
      ],
      marks: 4,
    },
    q_stem_2: {
      questionId: 'q_stem_2',
      testId: 'apac_stem_optics_circuits_2026',
      correctOptionId: 'C',
      shortExplanation: 'At minimum deviation, i = (A + δm) / 2 = (60° + 38°) / 2 = 49°.',
      stepByStepSolution: [
        'At minimum deviation, the ray travels symmetrically through the prism so angle of incidence equals angle of emergence (i = e).',
        'Use the prism deviation relation: δm = 2i − A.',
        'Rearrange for i: i = (A + δm) / 2.',
        'Substitute A = 60° and δm = 38°: i = (60° + 38°) / 2 = 49°.',
      ],
      marks: 4,
    },
    q_stem_3: {
      questionId: 'q_stem_3',
      testId: 'apac_stem_optics_circuits_2026',
      correctOptionId: 'C',
      shortExplanation:
        'A Wheatstone bridge is balanced when R1 / R2 = R3 / R4, giving R4 = (24 × 15) / 12 = 30 Ω.',
      stepByStepSolution: [
        'For zero current through galvanometer G, nodes C and D must be at equal electric potential.',
        'Apply the balanced Wheatstone bridge ratio: R1 / R2 = R3 / R4.',
        'Substitute the given resistances: 12 / 24 = 15 / R4.',
        'Solve for R4: R4 = 15 × (24 / 12) = 15 × 2 = 30 Ω.',
      ],
      marks: 4,
    },
    q_stem_4: {
      questionId: 'q_stem_4',
      testId: 'apac_stem_optics_circuits_2026',
      correctOptionId: 'B',
      shortExplanation:
        'Since the bridge is balanced, the galvanometer branch carries no current. Two parallel branches of 30 Ω each give Req = 15 Ω and I = 12 / 15 = 0.8 A.',
      stepByStepSolution: [
        'Verify balance: R1 / R2 = 10 / 20 = 0.5 and R3 / R4 = 10 / 20 = 0.5, so IG = 0.',
        'Upper branch series resistance: R_upper = R1 + R2 = 10 + 20 = 30 Ω.',
        'Lower branch series resistance: R_lower = R3 + R4 = 10 + 20 = 30 Ω.',
        'Combine parallel branches: Req = (30 × 30) / (30 + 30) = 15 Ω.',
        'Compute total source current using Ohm’s Law: I = V / Req = 12 V / 15 Ω = 0.8 A.',
      ],
      marks: 4,
    },
    q_stem_5: {
      questionId: 'q_stem_5',
      testId: 'apac_stem_optics_circuits_2026',
      correctOptionId: 'C',
      shortExplanation:
        'A 25% latency reduction increases throughput by 1 / 0.75 = 4/3×, yielding 320/min or 480 in 90 seconds.',
      stepByStepSolution: [
        'Original rate = 240 packets / 60 s = 4 packets/s (0.25 s per packet).',
        'Reducing processing time by 25% gives 0.25 × 0.75 = 0.1875 s per packet.',
        'New rate = 1 / 0.1875 = 5.333... packets/s (or 240 × 4/3 = 320 packets/min).',
        'Over 90 seconds (1.5 minutes): 320 × 1.5 = 480 heartbeats.',
      ],
      marks: 4,
    },
    q_stem_6: {
      questionId: 'q_stem_6',
      testId: 'apac_stem_optics_circuits_2026',
      correctOptionId: 'B',
      shortExplanation:
        'Solving 4c − (30 − c) = 75 gives 5c = 105, so c = 21 correct answers.',
      stepByStepSolution: [
        'Let c be the number of correct answers; then wrong answers w = 30 − c.',
        'Set up the score equation: 4c − 1(30 − c) = 75.',
        'Simplify: 4c − 30 + c = 75 → 5c = 105.',
        'Divide by 5: c = 21 correct answers (with 9 wrong answers: 84 − 9 = 75).',
      ],
      marks: 4,
    },
  },
  apac_genai_foundations_2026: {
    q_cloud_1: {
      questionId: 'q_cloud_1',
      testId: 'apac_genai_foundations_2026',
      correctOptionId: 'A',
      shortExplanation:
        'Combining responseMimeType: "application/json" with a formal responseSchema enforces valid structured JSON output.',
      stepByStepSolution: [
        'Prompt instructions alone can still produce markdown code fences or missing keys.',
        'Configuring responseMimeType: "application/json" forces raw JSON output.',
        'Adding responseSchema with Type definitions constrains exact field names and array structures.',
      ],
      marks: 4,
    },
    q_cloud_2: {
      questionId: 'q_cloud_2',
      testId: 'apac_genai_foundations_2026',
      correctOptionId: 'B',
      shortExplanation:
        'On-device WASM inference keeps raw webcam frames private on the student’s machine while delivering sub-50ms face count checks.',
      stepByStepSolution: [
        'Streaming live video from thousands of exam takers saturates bandwidth and raises privacy concerns.',
        'MediaPipe Tasks Vision runs lightweight BlazeFace inference inside the browser via WebAssembly.',
        'Only concise strike events (e.g., "No Face Detected") are logged if a violation persists.',
      ],
      marks: 4,
    },
    q_cloud_3: {
      questionId: 'q_cloud_3',
      testId: 'apac_genai_foundations_2026',
      correctOptionId: 'B',
      shortExplanation:
        'Server-enforced terminal state locking in firestore.rules guarantees no client SDK call can alter a submitted attempt.',
      stepByStepSolution: [
        'UI-level hiding can be bypassed with direct REST or SDK calls.',
        'Checking existing().status == "in_progress" inside the Firestore allow update rule blocks post-submission tampering at the database layer.',
      ],
      marks: 4,
    },
    q_cloud_4: {
      questionId: 'q_cloud_4',
      testId: 'apac_genai_foundations_2026',
      correctOptionId: 'B',
      shortExplanation:
        'Writing immediately on every response/navigation change combined with a 5–10s timer heartbeat preserves exact resume state.',
      stepByStepSolution: [
        'Event-driven saves on answer selection and mark-for-review prevent losing any chosen option.',
        'A lightweight periodic heartbeat syncs remainingSeconds so the countdown resumes accurately after reconnection.',
      ],
      marks: 4,
    },
  },
  apac_algorithms_sprint_2026: {
    q_algo_1: {
      questionId: 'q_algo_1',
      testId: 'apac_algorithms_sprint_2026',
      correctOptionId: 'B',
      shortExplanation:
        'Each vertex extraction and edge relaxation takes O(log V) time with a binary heap, yielding O((V + E) log V).',
      stepByStepSolution: [
        'Each of the V vertices is popped from the priority queue at most once: O(V log V).',
        'Each of the E edges can trigger at most one key decrease / push: O(E log V).',
        'Total worst-case complexity is O((V + E) log V).',
      ],
      marks: 4,
    },
    q_algo_2: {
      questionId: 'q_algo_2',
      testId: 'apac_algorithms_sprint_2026',
      correctOptionId: 'B',
      shortExplanation:
        'BFS explores neighbors in increasing edge distance from the source using a FIFO queue.',
      stepByStepSolution: [
        'BFS uses a queue to process all vertices at distance d before moving to distance d + 1.',
        'Therefore, the first time a vertex is reached, the path length is guaranteed minimal.',
      ],
      marks: 4,
    },
  },
};

function readVault(): AnswerVault {
  try {
    if (fs.existsSync(VAULT_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(VAULT_PATH, 'utf8')) as AnswerVault;
      if (parsed && parsed.byTest) {
        return { byTest: { ...DEFAULT_SAMPLE_KEYS, ...parsed.byTest } };
      }
    }
  } catch {
    // Fallback to defaults
  }
  const initial: AnswerVault = { byTest: { ...DEFAULT_SAMPLE_KEYS } };
  writeVault(initial);
  return initial;
}

function writeVault(vault: AnswerVault): void {
  fs.writeFileSync(VAULT_PATH, JSON.stringify(vault, null, 2), 'utf8');
}

async function fetchTestAnswerKeysFromAdminDb(
  testId: string
): Promise<Record<string, StoredAnswerKey> | null> {
  const { db } = await getAdminModules();
  if (!db) return null;
  try {
    const snap = await db
      .collection('tests')
      .doc(testId)
      .collection('answerKeys')
      .get();
    if (snap.empty) return null;
    const map: Record<string, StoredAnswerKey> = {};
    snap.docs.forEach((d: any) => {
      const data = d.data();
      map[d.id] = {
        questionId: String(data.questionId || d.id),
        testId,
        correctOptionId: (data.correctOptionId as OptionId) || 'A',
        shortExplanation: String(data.shortExplanation || ''),
        solutionImageUrl: data.solutionImageUrl ? String(data.solutionImageUrl) : undefined,
        stepByStepSolution: Array.isArray(data.stepByStepSolution)
          ? (data.stepByStepSolution as string[])
          : [],
      };
    });
    return map;
  } catch {
    return null;
  }
}

async function getKeysForTest(testId: string): Promise<Record<string, StoredAnswerKey>> {
  const fromAdmin = await fetchTestAnswerKeysFromAdminDb(testId);
  if (fromAdmin) return fromAdmin;
  const vault = readVault();
  return vault.byTest[testId] || {};
}

interface AuthedRequest extends Request {
  decodedUser?: any;
  rawToken?: string;
}

async function verifyBearerToken(req: Request): Promise<{ decoded: any; token: string } | null> {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;
  try {
    const { auth } = await getAdminModules();
    if (auth) {
      const decoded = await auth.verifyIdToken(token);
      return { decoded, token };
    }
  } catch {
    // If admin auth verify fails or not available, fallback to Google tokeninfo
  }

  try {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`);
    if (res.ok) {
      const info = (await res.json()) as any;
      if (info && info.sub) {
        return {
          decoded: {
            uid: info.sub,
            email: info.email,
            email_verified: info.email_verified === 'true' || info.email_verified === true,
          },
          token,
        };
      }
    }
  } catch {
    // Fallback error
  }
  return null;
}

async function isVerifiedAdminToken(decoded: any, bearerToken: string): Promise<boolean> {
  if (decoded.email === MAIN_ADMIN_EMAIL && decoded.email_verified === true) {
    return true;
  }
  if (!decoded.email_verified) return false;

  const { db } = await getAdminModules();
  if (db) {
    try {
      const snap = await db.collection('admins').doc(decoded.uid).get();
      return snap.exists;
    } catch {
      return false;
    }
  }

  // Fallback check against Firestore REST API using user's own token (allowed by firestore.rules for own adminId)
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents/admins/${encodeURIComponent(
      decoded.uid
    )}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${bearerToken}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  const verified = await verifyBearerToken(req);
  if (!verified) {
    res.status(401).json({ error: 'Authentication required. Sign in with Google.' });
    return;
  }
  const ok = await isVerifiedAdminToken(verified.decoded, verified.token);
  if (!ok) {
    res.status(403).json({
      error: `Forbidden. Main admin is permanently locked to ${MAIN_ADMIN_EMAIL}.`,
    });
    return;
  }
  req.decodedUser = verified.decoded;
  req.rawToken = verified.token;
  next();
}

async function requireMainAdmin(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const verified = await verifyBearerToken(req);
  if (!verified) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  if (verified.decoded.email !== MAIN_ADMIN_EMAIL || verified.decoded.email_verified !== true) {
    res.status(403).json({
      error: `Forbidden. Only immutable main admin (${MAIN_ADMIN_EMAIL}) can perform this action.`,
    });
    return;
  }
  req.decodedUser = verified.decoded;
  req.rawToken = verified.token;
  next();
}

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      apiVersion: 'v1beta',
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

const FALLBACK_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-3.8-flash',
  'gemini-flash-latest',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
];

async function callGeminiWithFallback(
  ai: GoogleGenAI,
  params: {
    contents: any;
    config?: any;
    preferredModel?: string;
  }
) {
  const modelsToTry = params.preferredModel
    ? [params.preferredModel, ...FALLBACK_MODELS.filter((m) => m !== params.preferredModel)]
    : FALLBACK_MODELS;

  let lastError: any = null;

  for (let i = 0; i < modelsToTry.length; i++) {
    const model = modelsToTry[i];
    try {
      const config = { ...params.config };
      // Gemini 1.5 models do not support thinkingConfig in v1beta; remove to prevent HTTP 400
      if (!model.includes('2.0') && !model.includes('2.5') && config.thinkingConfig) {
        delete config.thinkingConfig;
      }
      return await ai.models.generateContent({
        model,
        contents: params.contents,
        config,
      });
    } catch (err: any) {
      lastError = err;
      const errMsg = extractErrorMessage(err);
      const isRetriable =
        errMsg.includes('503') ||
        errMsg.includes('high demand') ||
        errMsg.includes('UNAVAILABLE') ||
        errMsg.includes('temporarily') ||
        errMsg.includes('RESOURCE_EXHAUSTED') ||
        errMsg.includes('429') ||
        errMsg.includes('v1beta') ||
        errMsg.includes('not enabled for api version') ||
        errMsg.includes('404') ||
        errMsg.includes('not found') ||
        errMsg.includes('overloaded');

      if (isRetriable && i < modelsToTry.length - 1) {
        const nextModel = modelsToTry[i + 1];
        console.warn(
          `[AI Fallback] Model ${model} returned (${errMsg.slice(0, 80)}). Waiting 900ms and retrying with ${nextModel}...`
        );
        await new Promise((resolve) => setTimeout(resolve, 900));
        continue;
      }
      throw err;
    }
  }

  throw lastError;
}

function sendAiError(res: Response, err: unknown): void {
  const raw = extractErrorMessage(err);
  let retrySeconds: number | undefined;

  const delayMatch = raw.match(/retry(?:Delay)?["']?\s*[:=]\s*["']?(\d+(?:\.\d+)?)s/i) ||
    raw.match(/retry in\s+(\d+(?:\.\d+)?)s/i);
  if (delayMatch) {
    retrySeconds = Math.max(1, Math.ceil(Number(delayMatch[1])));
  }

  const isRateLimit =
    raw.includes('"code":429') ||
    raw.includes('RESOURCE_EXHAUSTED') ||
    raw.toLowerCase().includes('quota exceeded') ||
    raw.toLowerCase().includes('rate limit');

  const isHighDemand =
    raw.includes('503') ||
    raw.toLowerCase().includes('high demand') ||
    raw.includes('UNAVAILABLE');

  if (
    raw.includes('Request Entity Too Large') ||
    raw.includes("Unexpected token 'R'") ||
    raw.includes('Payload Too Large')
  ) {
    res.status(413).json({
      error:
        'The uploaded document size exceeds AI model payload limits. Please compress pages or upload smaller section batches.',
    });
    return;
  }

  if (isHighDemand) {
    res.status(503).json({
      error:
        'Google Gemini API is currently experiencing a temporary demand spike. Please try again in a few moments, or select the instant sample booklet.',
    });
    return;
  }

  if (isRateLimit) {
    res.status(429).json({
      error: `Gemini API rate limit reached (Free Tier allows 5 requests/minute). Please wait ${
        retrySeconds ?? 40
      } seconds and try again.`,
      retryAfterSeconds: retrySeconds ?? 40,
    });
    return;
  }

  res.status(500).json({ error: raw });
}

function mimeTypeFromFilename(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.svg') return 'image/svg+xml';
  return 'image/png';
}

function saveBase64ImageToUploads(
  base64Data: string,
  mimeType: string,
  filenameHint = 'diagram'
): string {
  const cleanMime = mimeType || 'image/png';
  const dataUrl = `data:${cleanMime};base64,${base64Data}`;

  // Best-effort write to local disk if directory exists and is writable
  try {
    const rawExt = cleanMime
      .replace(/^image\//i, '')
      .toLowerCase()
      .replace('jpeg', 'jpg')
      .replace('svg+xml', 'svg');
    const allowedExt = ['png', 'jpg', 'webp', 'gif', 'svg'].includes(rawExt) ? rawExt : 'png';
    const baseName = filenameHint
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 32);
    const uniqueName = `${baseName}_${crypto.randomBytes(5).toString('hex')}.${allowedExt}`;
    const targetPath = path.join(UPLOADS_DIR, uniqueName);
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(targetPath, buffer);
  } catch {
    // Ignore ephemeral filesystem failures in serverless environments
  }

  // Return dataUrl directly so it is 100% self-contained and never 404s on Vercel or any serverless host
  return dataUrl;
}

function resolveImageUrlToInlinePart(
  imageUrl?: string
): { inlineData: { mimeType: string; data: string } } | null {
  if (!imageUrl || typeof imageUrl !== 'string') return null;
  const trimmed = imageUrl.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('data:image/')) {
    const match = trimmed.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (!match) return null;
    return {
      inlineData: {
        mimeType: match[1],
        data: match[2],
      },
    };
  }

  if (trimmed.startsWith('/uploads/')) {
    const safeName = path.basename(trimmed);
    const targetPath = path.join(UPLOADS_DIR, safeName);
    if (fs.existsSync(targetPath)) {
      const buf = fs.readFileSync(targetPath);
      return {
        inlineData: {
          mimeType: mimeTypeFromFilename(safeName),
          data: buf.toString('base64'),
        },
      };
    }
  }

  if (trimmed.startsWith('/src/assets/') || trimmed.startsWith('/assets/')) {
    const rel = trimmed.replace(/^\/+/, '');
    const candidates = [
      path.resolve(process.cwd(), rel),
      path.resolve(process.cwd(), 'dist', rel),
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        const buf = fs.readFileSync(candidate);
        return {
          inlineData: {
            mimeType: mimeTypeFromFilename(candidate),
            data: buf.toString('base64'),
          },
        };
      }
    }
  }

  return null;
}

function normalizeImportedMediaUrl(rawUrl: unknown, filenameHint: string): string | undefined {
  if (typeof rawUrl !== 'string') return undefined;
  const trimmed = rawUrl.trim();
  if (!trimmed) return undefined;

  if (trimmed.startsWith('data:image/')) {
    const match = trimmed.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (!match) return undefined;
    return saveBase64ImageToUploads(match[2], match[1], filenameHint);
  }

  if (
    (trimmed.startsWith('/uploads/') ||
      trimmed.startsWith('/assets/') ||
      trimmed.startsWith('/src/assets/') ||
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://')) &&
    trimmed.length <= 1000
  ) {
    return trimmed;
  }

  return undefined;
}

function extractJsonQuestionArray(parsed: unknown): unknown[] | null {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    for (const key of ['questions', 'items', 'data', 'mcqs', 'results']) {
      if (Array.isArray(obj[key])) {
        return obj[key] as unknown[];
      }
    }
  }
  return null;
}

interface NormalizedJsonDraft {
  questionText: string;
  questionImageUrl?: string;
  options: Array<{ id: OptionId; text: string; imageUrl?: string }>;
  correctOptionId: OptionId;
  shortExplanation: string;
  stepByStepSolution: string[];
  marks?: number;
}

function normalizeJsonQuestionItem(
  raw: unknown,
  index: number
): {
  draft: NormalizedJsonDraft;
  hasExplicitCorrect: boolean;
  needsAiCompletion: boolean;
  rawNotes: string;
} {
  const obj = (raw && typeof raw === 'object' ? raw : { questionText: String(raw ?? '') }) as Record<
    string,
    unknown
  >;

  const pickString = (...keys: string[]): string => {
    for (const k of keys) {
      const val = obj[k];
      if (typeof val === 'string' && val.trim()) return val.trim();
    }
    return '';
  };

  const stem = pickString('questionText', 'question', 'stem', 'prompt', 'text', 'title');
  const questionImageUrl = normalizeImportedMediaUrl(
    obj.questionImageUrl ??
      obj.questionImage ??
      obj.imageUrl ??
      obj.image ??
      obj.diagram ??
      obj.img,
    `json_q_${index + 1}`
  );

  const optionIds: OptionId[] = ['A', 'B', 'C', 'D'];
  const rawOptionsField = obj.options ?? obj.choices ?? obj.answers;
  const normalizedOptions: Array<{ id: OptionId; text: string; imageUrl?: string }> = optionIds.map(
    (id, idx) => {
      let optText = '';
      let optImg: string | undefined;

      if (Array.isArray(rawOptionsField)) {
        const byId = rawOptionsField.find(
          (item) =>
            item &&
            typeof item === 'object' &&
            String((item as Record<string, unknown>).id ?? (item as Record<string, unknown>).label ?? '')
              .trim()
              .toUpperCase() === id
        );
        const item = byId ?? rawOptionsField[idx];
        if (typeof item === 'string') {
          optText = item.trim();
        } else if (item && typeof item === 'object') {
          const itemObj = item as Record<string, unknown>;
          const rawText = itemObj.text ?? itemObj.value ?? itemObj.content ?? itemObj.option ?? itemObj.labelText;
          if (typeof rawText === 'string') optText = rawText.trim();
          optImg = normalizeImportedMediaUrl(
            itemObj.imageUrl ?? itemObj.image ?? itemObj.img ?? itemObj.optionImageUrl,
            `json_q_${index + 1}_opt_${id}`
          );
        }
      } else if (rawOptionsField && typeof rawOptionsField === 'object') {
        const mapObj = rawOptionsField as Record<string, unknown>;
        const val = mapObj[id] ?? mapObj[id.toLowerCase()];
        if (typeof val === 'string') {
          optText = val.trim();
        } else if (val && typeof val === 'object') {
          const valObj = val as Record<string, unknown>;
          const rawText = valObj.text ?? valObj.value ?? valObj.content;
          if (typeof rawText === 'string') optText = rawText.trim();
          optImg = normalizeImportedMediaUrl(
            valObj.imageUrl ?? valObj.image ?? valObj.img,
            `json_q_${index + 1}_opt_${id}`
          );
        }
      }

      return {
        id,
        text: optText.slice(0, 600),
        ...(optImg ? { imageUrl: optImg } : {}),
      };
    }
  );

  // Resolve correctOptionId from letter, index, or matching option text
  let correctOptionId: OptionId = 'A';
  let hasExplicitCorrect = false;
  const rawCorrect =
    obj.correctOptionId ??
    obj.correctAnswer ??
    obj.answer ??
    obj.correct ??
    obj.ans ??
    obj.rightAnswer;

  if (typeof rawCorrect === 'number' && Number.isInteger(rawCorrect)) {
    if (rawCorrect >= 0 && rawCorrect <= 3) {
      correctOptionId = optionIds[rawCorrect];
      hasExplicitCorrect = true;
    } else if (rawCorrect >= 1 && rawCorrect <= 4) {
      correctOptionId = optionIds[rawCorrect - 1];
      hasExplicitCorrect = true;
    }
  } else if (typeof rawCorrect === 'string' && rawCorrect.trim()) {
    const cleaned = rawCorrect.trim();
    const upper = cleaned.toUpperCase().replace(/^OPTION\s+/i, '');
    if (['A', 'B', 'C', 'D'].includes(upper)) {
      correctOptionId = upper as OptionId;
      hasExplicitCorrect = true;
    } else if (['1', '2', '3', '4'].includes(upper)) {
      correctOptionId = optionIds[Number(upper) - 1];
      hasExplicitCorrect = true;
    } else {
      const matchedOpt = normalizedOptions.find(
        (o) => o.text && o.text.toLowerCase() === cleaned.toLowerCase()
      );
      if (matchedOpt) {
        correctOptionId = matchedOpt.id;
        hasExplicitCorrect = true;
      }
    }
  }

  const shortExplanation = pickString(
    'shortExplanation',
    'explanation',
    'rationale',
    'hint',
    'summary'
  ).slice(0, 1000);

  const rawSteps = obj.stepByStepSolution ?? obj.steps ?? obj.solution ?? obj.detailedSolution;
  let stepByStepSolution: string[] = [];
  if (Array.isArray(rawSteps)) {
    stepByStepSolution = rawSteps
      .map((s) => String(s ?? '').trim())
      .filter(Boolean)
      .slice(0, 20)
      .map((s) => s.slice(0, 800));
  } else if (typeof rawSteps === 'string' && rawSteps.trim()) {
    stepByStepSolution = rawSteps
      .split(/\r?\n+/)
      .map((line) => line.replace(/^\s*(?:step\s*\d+[:.)-]|\d+[.)])\s*/i, '').trim())
      .filter(Boolean)
      .slice(0, 20)
      .map((s) => s.slice(0, 800));
  }

  const rawMarks = Number(obj.marks ?? obj.score);
  const marks =
    Number.isFinite(rawMarks) && rawMarks >= 0.25 && rawMarks <= 100
      ? Math.round(rawMarks * 100) / 100
      : undefined;

  const missingStem = !stem && !questionImageUrl;
  const missingOptions = normalizedOptions.some((o) => !o.text && !o.imageUrl);
  const needsAiCompletion =
    missingStem ||
    missingOptions ||
    !hasExplicitCorrect ||
    !shortExplanation ||
    stepByStepSolution.length === 0;

  return {
    draft: {
      questionText: stem.slice(0, 3000),
      ...(questionImageUrl ? { questionImageUrl } : {}),
      options: normalizedOptions,
      correctOptionId,
      shortExplanation,
      stepByStepSolution,
      ...(marks !== undefined ? { marks } : {}),
    },
    hasExplicitCorrect,
    needsAiCompletion,
    rawNotes: JSON.stringify(obj).slice(0, 4000),
  };
}

export async function createApp(options?: { skipStatic?: boolean }): Promise<Express> {
  // Ensure vault exists on startup
  readVault();

  const app = express();
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));
  app.use('/uploads', express.static(UPLOADS_DIR));
  if (IS_VERCEL && fs.existsSync(BUNDLED_UPLOADS_DIR)) {
    app.use('/uploads', express.static(BUNDLED_UPLOADS_DIR));
  }

  app.get('/api/health', async (_req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  });

  // Verify caller role server-side (never trusting client claims)
  app.get('/api/auth/role', async (req: Request, res: Response) => {
    const verified = await verifyBearerToken(req);
    if (!verified) {
      res.status(401).json({ error: 'Missing or invalid Firebase ID token.' });
      return;
    }
    const isMain =
      verified.decoded.email === MAIN_ADMIN_EMAIL && verified.decoded.email_verified === true;
    const isAdm = await isVerifiedAdminToken(verified.decoded, verified.token);
    res.json({
      uid: verified.decoded.uid,
      email: verified.decoded.email || '',
      isMainAdmin: isMain,
      role: isAdm ? 'admin' : 'user',
      immutableMainAdmin: MAIN_ADMIN_EMAIL,
    });
  });

  // Protect main admin from ever being replaced/removed via API
  app.post('/api/admin/admins', requireMainAdmin, async (req: AuthedRequest, res: Response) => {
    const { email } = req.body as { email?: string };
    if (email?.toLowerCase() === MAIN_ADMIN_EMAIL) {
      res.status(403).json({
        error: `${MAIN_ADMIN_EMAIL} is the permanent main admin and cannot be modified or replaced.`,
      });
      return;
    }
    res.json({ ok: true, mainAdmin: MAIN_ADMIN_EMAIL });
  });

  // Store / sync answer keys on the server vault (Admin-only)
  app.post('/api/admin/answer-keys/sync', requireAdmin, async (req: AuthedRequest, res: Response) => {
    try {
      const { testId, keys } = req.body as {
        testId?: string;
        keys?: Array<StoredAnswerKey>;
      };
      if (!testId || !Array.isArray(keys)) {
        res.status(400).json({ error: 'testId and keys array are required.' });
        return;
      }

      const vault = readVault();
      if (!vault.byTest[testId]) vault.byTest[testId] = {};

      for (const k of keys) {
        if (!k.questionId) continue;
        const entry: StoredAnswerKey = {
          questionId: k.questionId,
          testId,
          correctOptionId: ['A', 'B', 'C', 'D'].includes(k.correctOptionId)
            ? k.correctOptionId
            : 'A',
          shortExplanation: String(k.shortExplanation || ''),
          stepByStepSolution: Array.isArray(k.stepByStepSolution)
            ? k.stepByStepSolution.map(String)
            : [],
          solutionImageUrl: k.solutionImageUrl ? String(k.solutionImageUrl) : undefined,
          marks: Number(k.marks || 4),
        };
        vault.byTest[testId][k.questionId] = entry;

        const { db } = await getAdminModules();
        if (db) {
          await db
            .collection('tests')
            .doc(testId)
            .collection('answerKeys')
            .doc(k.questionId)
            .set({
              ...entry,
              updatedAt: new Date(),
            });
        }
      }
      writeVault(vault);
      res.json({ ok: true, count: keys.length });
    } catch (err) {
      res.status(500).json({ error: extractErrorMessage(err) });
    }
  });

  app.post('/api/admin/answer-keys/delete', requireAdmin, async (req: AuthedRequest, res: Response) => {
    try {
      const { testId, questionId } = req.body as { testId?: string; questionId?: string };
      if (!testId || !questionId) {
        res.status(400).json({ error: 'testId and questionId are required.' });
        return;
      }
      const vault = readVault();
      if (vault.byTest[testId]) {
        delete vault.byTest[testId][questionId];
        writeVault(vault);
      }
      const { db } = await getAdminModules();
      if (db) {
        await db
          .collection('tests')
          .doc(testId)
          .collection('answerKeys')
          .doc(questionId)
          .delete();
      }
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: extractErrorMessage(err) });
    }
  });

  // Resilient admin-level question save fallback (bypasses client-side permission issues and guarantees atomic vault sync)
  app.post('/api/admin/save-question', requireAdmin, async (req: AuthedRequest, res: Response) => {
    try {
      const { testId, question, options } = req.body as {
        testId?: string;
        question?: any;
        options?: any;
      };

      if (!testId || !question || !question.questionId) {
        res.status(400).json({ error: 'testId and valid question object are required.' });
        return;
      }

      const { db, firestoreMod } = await getAdminModules();
      if (!db) {
        res.status(500).json({ error: 'Server database is not initialized.' });
        return;
      }

      const qId = String(question.questionId);
      const cleanOptions = (Array.isArray(question.options) ? question.options : [])
        .slice(0, 4)
        .map((o: any) => {
          const opt: Record<string, string> = {
            id: String(o.id || 'A'),
            text: String(o.text || '').slice(0, 1000),
          };
          if (o.imageUrl) opt.imageUrl = String(o.imageUrl).slice(0, 800000);
          return opt;
        });

      const rawQuestionText = String(question.questionText || question.stem || '');
      const rawQuestionImageUrl = String(question.questionImageUrl || question.imageUrl || '');
      const safeQuestionText =
        rawQuestionText.trim() ||
        (rawQuestionImageUrl.trim() ? 'Refer to the diagram below.' : 'Question');

      const safeShortExplanation = String(
        question.shortExplanation || question.solution?.shortExplanation || ''
      ).slice(0, 5000);
      const rawSteps = question.stepByStepSolution || question.solution?.steps || [];
      const safeSteps = (Array.isArray(rawSteps) ? rawSteps : [])
        .slice(0, 50)
        .map((s: any) => String(s).slice(0, 2000));

      const qRef = db.collection('tests').doc(testId).collection('questions').doc(qId);
      const existingSnap = await qRef.get();

      const sanitizedPayload: Record<string, any> = {
        questionId: qId,
        testId: testId,
        testStatus: question.testStatus || 'draft',
        sectionId: String(question.sectionId || 'default').slice(0, 128),
        orderIndex: Number(question.orderIndex ?? question.order ?? 0) || 0,
        questionText: safeQuestionText.slice(0, 10000),
        options: cleanOptions,
        marks: Math.min(Math.max(Number(question.marks) || 4, 0.25), 100),
        updatedAt: new Date(),
      };

      if (rawQuestionImageUrl.trim()) {
        sanitizedPayload.questionImageUrl = rawQuestionImageUrl.trim().slice(0, 800000);
      } else if (existingSnap.exists && existingSnap.data()?.questionImageUrl) {
        if (firestoreMod?.FieldValue?.delete) {
          sanitizedPayload.questionImageUrl = firestoreMod.FieldValue.delete();
        }
      }

      if (!existingSnap.exists) {
        sanitizedPayload.createdAt = new Date();
        await qRef.set(sanitizedPayload);
      } else {
        await qRef.set(sanitizedPayload, { merge: true });
      }

      // Protected answerKey document
      const rawSolutionImg = String(question.solutionImageUrl || question.solution?.imageUrl || '');
      const kRef = db.collection('tests').doc(testId).collection('answerKeys').doc(qId);
      const answerKeyPayload: Record<string, any> = {
        questionId: qId,
        testId: testId,
        correctOptionId: question.correctOptionId || 'A',
        shortExplanation: safeShortExplanation,
        stepByStepSolution: safeSteps,
        updatedAt: new Date(),
      };
      if (rawSolutionImg.trim()) {
        answerKeyPayload.solutionImageUrl = rawSolutionImg.trim().slice(0, 800000);
      } else if (firestoreMod?.FieldValue?.delete) {
        answerKeyPayload.solutionImageUrl = firestoreMod.FieldValue.delete();
      }
      await kRef.set(answerKeyPayload, { merge: true });

      // Sync to server vault
      const vault = readVault();
      if (!vault.byTest[testId]) vault.byTest[testId] = {};
      vault.byTest[testId][qId] = {
        questionId: qId,
        testId: testId,
        correctOptionId: ['A', 'B', 'C', 'D'].includes(question.correctOptionId)
          ? question.correctOptionId
          : 'A',
        shortExplanation: safeShortExplanation,
        solutionImageUrl: rawSolutionImg.trim() || undefined,
        stepByStepSolution: safeSteps,
        marks: question.marks,
      };
      writeVault(vault);

      // Record question version if requested
      if (options?.recordVersion !== false) {
        try {
          const vId = 'v_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
          await qRef.collection('versions').doc(vId).set({
            versionId: vId,
            questionId: qId,
            testId: testId,
            sectionId: String(question.sectionId || 'default'),
            source: options?.versionSource || (existingSnap.exists ? 'manual_save' : 'initial'),
            summary: (
              options?.versionSummary ||
              (existingSnap.exists ? 'Saved question update' : 'Initial saved version')
            ).slice(0, 200),
            questionText: safeQuestionText.slice(0, 10000),
            ...(rawQuestionImageUrl.trim()
              ? { questionImageUrl: rawQuestionImageUrl.trim().slice(0, 800000) }
              : {}),
            ...(rawSolutionImg.trim()
              ? { solutionImageUrl: rawSolutionImg.trim().slice(0, 800000) }
              : {}),
            options: cleanOptions,
            correctOptionId: question.correctOptionId || 'A',
            shortExplanation: safeShortExplanation,
            stepByStepSolution: safeSteps,
            marks: Math.min(Math.max(Number(question.marks) || 4, 0.25), 100),
            createdBy: req.decodedUser?.uid || req.decodedUser?.sub || 'admin',
            createdAt: new Date(),
          });
        } catch (vErr) {
          console.warn('Could not record question version:', vErr);
        }
      }

      res.json({
        ok: true,
        question: {
          ...question,
          questionId: qId,
          testId: testId,
          questionText: safeQuestionText,
          questionImageUrl: rawQuestionImageUrl.trim() || undefined,
          solutionImageUrl: rawSolutionImg.trim() || undefined,
          options: cleanOptions,
          shortExplanation: safeShortExplanation,
          stepByStepSolution: safeSteps,
          stem: safeQuestionText,
          imageUrl: rawQuestionImageUrl.trim() || undefined,
          solution: {
            shortExplanation: safeShortExplanation,
            imageUrl: rawSolutionImg.trim() || undefined,
            steps: safeSteps,
          },
        },
      });
    } catch (err) {
      console.error('Error saving question via admin API:', err);
      res.status(500).json({ error: extractErrorMessage(err) });
    }
  });

  app.post('/api/admin/delete-question', requireAdmin, async (req: AuthedRequest, res: Response) => {
    try {
      const { testId, questionId } = req.body as { testId?: string; questionId?: string };
      if (!testId || !questionId) {
        res.status(400).json({ error: 'testId and questionId are required.' });
        return;
      }

      const vault = readVault();
      if (vault.byTest[testId]) {
        delete vault.byTest[testId][questionId];
        writeVault(vault);
      }

      const { db } = await getAdminModules();
      if (db) {
        const qRef = db.collection('tests').doc(testId).collection('questions').doc(questionId);
        const kRef = db.collection('tests').doc(testId).collection('answerKeys').doc(questionId);
        const versionsSnap = await qRef.collection('versions').get().catch(() => ({ docs: [] }));

        const batch = db.batch();
        batch.delete(qRef);
        batch.delete(kRef);
        versionsSnap.docs.forEach((doc: any) => batch.delete(doc.ref));
        await batch.commit();
      }

      res.json({ ok: true });
    } catch (err) {
      console.error('Error deleting question via admin API:', err);
      res.status(500).json({ error: extractErrorMessage(err) });
    }
  });

  // Server-side grading & answer unlocking (NEVER returns keys while status is in_progress)
  app.post('/api/exam/grade', async (req: Request, res: Response) => {
    try {
      const { testId, status, responses, questionsMeta, negativeMarking, negativeMarkValue } =
        req.body as {
          testId?: string;
          status?: string;
          responses?: Record<string, { selectedOptionId: OptionId | null }>;
          questionsMeta?: Array<{ questionId: string; marks: number }>;
          negativeMarking?: boolean;
          negativeMarkValue?: number;
        };

      if (!testId || !responses || !Array.isArray(questionsMeta)) {
        res.status(400).json({ error: 'testId, responses, and questionsMeta are required.' });
        return;
      }

      if (status !== 'submitted' && status !== 'auto_submitted_strike') {
        res.status(403).json({
          error: 'Forbidden: Answer keys and solutions are locked until exam submission.',
        });
        return;
      }

      const keys = await getKeysForTest(testId);
      let score = 0;
      let maxScore = 0;
      let correctCount = 0;
      let wrongCount = 0;
      let unattemptedCount = 0;

      for (const qMeta of questionsMeta) {
        const marks = Number(qMeta.marks || 4);
        maxScore += marks;
        const key = keys[qMeta.questionId];
        const chosen = responses[qMeta.questionId]?.selectedOptionId;
        if (!chosen) {
          unattemptedCount += 1;
        } else if (key && chosen === key.correctOptionId) {
          correctCount += 1;
          score += marks;
        } else {
          wrongCount += 1;
          if (negativeMarking) {
            score -= Number(negativeMarkValue || 0);
          }
        }
      }

      const attempted = correctCount + wrongCount;
      const accuracy = attempted > 0 ? Math.round((correctCount / attempted) * 100) : 0;

      res.json({
        grading: {
          score: Math.round(score * 100) / 100,
          maxScore,
          accuracy,
          correctCount,
          wrongCount,
          unattemptedCount,
        },
        unlockedKeys: keys,
      });
    } catch (err) {
      res.status(500).json({ error: extractErrorMessage(err) });
    }
  });

  // Unlock solutions for an already-submitted attempt review
  app.post('/api/exam/unlock-solutions', async (req: Request, res: Response) => {
    try {
      const { testId, attemptStatus } = req.body as {
        testId?: string;
        attemptStatus?: string;
      };
      if (!testId) {
        res.status(400).json({ error: 'testId is required.' });
        return;
      }
      if (attemptStatus !== 'submitted' && attemptStatus !== 'auto_submitted_strike') {
        res.status(403).json({
          error: 'Solutions remain locked while the exam is still in progress.',
        });
        return;
      }
      const keys = await getKeysForTest(testId);
      res.json({ unlockedKeys: keys });
    } catch (err) {
      res.status(500).json({ error: extractErrorMessage(err) });
    }
  });

  app.post('/api/upload-image', (req: Request, res: Response) => {
    try {
      const { dataUrl, filename } = req.body as { dataUrl?: string; filename?: string };
      if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
        res.status(400).json({ error: 'Invalid image payload. Expected a data:image/* base64 URL.' });
        return;
      }

      // Best effort disk cache
      try {
        const match = dataUrl.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
        if (match) {
          const rawExt = match[1].toLowerCase().replace('jpeg', 'jpg').replace('svg+xml', 'svg');
          const allowedExt = ['png', 'jpg', 'webp', 'gif', 'svg'].includes(rawExt) ? rawExt : 'png';
          const baseName = (filename || 'diagram')
            .replace(/\.[^.]+$/, '')
            .replace(/[^a-zA-Z0-9_-]/g, '_')
            .slice(0, 32);
          const uniqueName = `${baseName}_${crypto.randomBytes(5).toString('hex')}.${allowedExt}`;
          const targetPath = path.join(UPLOADS_DIR, uniqueName);
          const buffer = Buffer.from(match[2], 'base64');
          fs.writeFileSync(targetPath, buffer);
        }
      } catch {
        // Ignore filesystem write error in serverless
      }

      // Return dataUrl directly so uploaded image is resilient and never 404s on Vercel
      res.json({ url: dataUrl });
    } catch (err) {
      res.status(500).json({ error: extractErrorMessage(err) });
    }
  });

  app.post('/api/ai/generate-questions', async (req: Request, res: Response) => {
    try {
      const {
        topicOrNotes,
        sectionName,
        count = 3,
        difficulty = 'Medium',
        imageBase64,
        imageMimeType,
        attachImageAsQuestion = false,
      } = req.body as {
        topicOrNotes?: string;
        sectionName?: string;
        count?: number;
        difficulty?: string;
        imageBase64?: string;
        imageMimeType?: string;
        attachImageAsQuestion?: boolean;
      };

      const safeCount = Math.min(Math.max(Number(count) || 3, 1), 10);
      if (!topicOrNotes?.trim() && !imageBase64) {
        res.status(400).json({ error: 'Provide topic notes or upload a textbook/question image.' });
        return;
      }

      let uploadedImageUrl: string | undefined;
      if (attachImageAsQuestion && imageBase64 && imageMimeType) {
        uploadedImageUrl = saveBase64ImageToUploads(imageBase64, imageMimeType, 'ai_ref_diagram');
      }

      const ai = getAiClient();
      const promptText = `You are an expert Computer-Based Test (CBT) item writer for competitive & academic exams across APAC.
Generate exactly ${safeCount} high-quality multiple-choice questions for the section "${sectionName || 'General'}" at "${difficulty}" difficulty.
${topicOrNotes?.trim() ? `Source notes / topic:\n${topicOrNotes.trim()}` : 'Analyze the attached image of notes/questions/diagrams and extract or create aligned MCQs.'}
${attachImageAsQuestion && imageBase64 ? '\nNote: The attached image will be displayed alongside the generated question(s) as the reference diagram, so phrase questions appropriately (e.g., referring to the shown diagram when relevant).' : ''}

Requirements:
- Write clean, publication-grade exam prose. NEVER include thinking-out-loud phrases, self-corrections, or filler such as "Wait—", "Actually,", or "Let's revise".
- ${attachImageAsQuestion && imageBase64 ? 'The attached image will be shown with the question.' : 'NO diagram is attached to the question text, so NEVER write "shown below" or "in the diagram"; make every question 100% self-contained.'}
- Wrap ALL math variables, squares/exponents, subscripts, equations, formulas, and compound units cleanly in standard KaTeX LaTeX delimiters ($...$ for inline math, $$...$$ for standalone equations), e.g., $m_1$, $T_2$, $\\text{m/s}^2$, $m_2 g = m_2 a$. NEVER output bare ASCII like m1, m/s^2, x^2, or multiplication asterisks (*) outside LaTeX, and never leave unbalanced $ signs.
- Each question must have exactly 4 distinct options labeled A, B, C, D.
- Provide exactly one correctOptionId ('A', 'B', 'C', or 'D').
- Provide a crisp 1-2 sentence shortExplanation.
- Provide 2 to 5 clear numbered/ordered steps in stepByStepSolution (without repeating "Step 1:" prefixes, using clean $...$ math).`;

      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
      if (imageBase64 && imageMimeType) {
        parts.push({
          inlineData: {
            mimeType: imageMimeType,
            data: imageBase64,
          },
        });
      }
      parts.push({ text: promptText });

      const response = await callGeminiWithFallback(ai, {
        preferredModel: 'gemini-2.5-flash',
        contents: { parts },
        config: {
          thinkingConfig: { thinkingLevel: imageBase64 ? ThinkingLevel.MEDIUM : ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    questionText: { type: Type.STRING },
                    options: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          id: { type: Type.STRING },
                          text: { type: Type.STRING },
                        },
                        required: ['id', 'text'],
                      },
                    },
                    correctOptionId: { type: Type.STRING },
                    shortExplanation: { type: Type.STRING },
                    stepByStepSolution: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                  },
                  required: [
                    'questionText',
                    'options',
                    'correctOptionId',
                    'shortExplanation',
                    'stepByStepSolution',
                  ],
                },
              },
            },
            required: ['questions'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{"questions":[]}').trim()) as {
        questions?: Array<{
          questionText: string;
          options: Array<{ id: string; text: string }>;
          correctOptionId: string;
          shortExplanation: string;
          stepByStepSolution: string[];
        }>;
      };

      const normalized = (parsed.questions || []).map((q) => {
        const optionIds = ['A', 'B', 'C', 'D'] as const;
        const cleanOptions = optionIds.map((id, idx) => ({
          id,
          text: q.options?.[idx]?.text || `Option ${id}`,
        }));
        const validCorrect = ['A', 'B', 'C', 'D'].includes(q.correctOptionId)
          ? q.correctOptionId
          : 'A';
        return {
          questionText: q.questionText,
          ...(uploadedImageUrl ? { questionImageUrl: uploadedImageUrl } : {}),
          options: cleanOptions,
          correctOptionId: validCorrect,
          shortExplanation: q.shortExplanation || '',
          stepByStepSolution: Array.isArray(q.stepByStepSolution) ? q.stepByStepSolution : [],
        };
      });

      res.json({ questions: normalized, uploadedImageUrl });
    } catch (err) {
      sendAiError(res, err);
    }
  });

  app.post('/api/ai/generate-solution', async (req: Request, res: Response) => {
    try {
      const {
        questionText = '',
        questionImageUrl = '',
        options = [],
        correctOptionId,
        mode = 'complete_all',
      } = req.body as {
        questionText?: string;
        questionImageUrl?: string;
        options?: Array<{ id: string; text?: string; imageUrl?: string }>;
        correctOptionId?: string;
        mode?: 'complete_all' | 'solution_only';
      };

      const qImagePart = resolveImageUrlToInlinePart(questionImageUrl);
      const optionImageParts = (options || [])
        .map((o) => ({ id: o.id, part: resolveImageUrlToInlinePart(o.imageUrl) }))
        .filter((x): x is { id: string; part: { inlineData: { mimeType: string; data: string } } } =>
          Boolean(x.part)
        );

      if (!questionText.trim() && !qImagePart) {
        res.status(400).json({
          error: 'Enter question text or upload a question image so Gemini can analyze and solve it.',
        });
        return;
      }

      const ai = getAiClient();
      const optionSummary = ['A', 'B', 'C', 'D']
        .map((id) => {
          const opt = options.find((o) => o.id === id);
          const textVal = opt?.text?.trim() || '';
          const hasImg = Boolean(opt?.imageUrl?.trim());
          if (!textVal && !hasImg) return `${id}) [Empty — generate option]`;
          if (!textVal && hasImg) return `${id}) [Image attached for Option ${id}]`;
          return `${id}) ${textVal}${hasImg ? ` [also has Option ${id} image attached]` : ''}`;
        })
        .join('\n');

      const hasAnyImages = Boolean(qImagePart || optionImageParts.length > 0);
      const hasBlankOptions = ['A', 'B', 'C', 'D'].some((id) => {
        const opt = options.find((o) => o.id === id);
        return !opt?.text?.trim() && !opt?.imageUrl?.trim();
      });

      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

      if (qImagePart) {
        parts.push({ text: 'Attached Question Image / Diagram:' });
        parts.push(qImagePart);
      }

      for (const item of optionImageParts) {
        parts.push({ text: `Attached Image for Option ${item.id}:` });
        parts.push(item.part);
      }

      const instruction =
        mode === 'solution_only'
          ? `Analyze the question${hasAnyImages ? ' and attached image(s)' : ''} below and write the explanation and step-by-step solution for the specified correct option (${correctOptionId || 'A'}).
Question Text: ${questionText.trim() || '(See attached question image)'}
Options:
${optionSummary}
Correct Option: ${correctOptionId || 'A'}

Return JSON with:
- questionText: clear question text (if empty above, transcribe/formulate it from the image; otherwise preserve it, or normalize bare ASCII math like m1, m/s^2 into clean $...$ KaTeX delimiters).
- options: array of 4 objects [{id:'A', text}, {id:'B', text}, {id:'C', text}, {id:'D', text}] preserving provided option texts (format any mathematical units/squares cleanly in $...$; if an option only had an image, provide a short descriptive label for it).
- correctOptionId: '${correctOptionId || 'A'}'
- shortExplanation: crisp 1-2 sentence explanation using clean $...$ KaTeX LaTeX for all variables, subscripts, squares, equations, and units (e.g., $m_1$, $T_2$, $\\text{m/s}^2$, $m_2 g = m_2 a$ — NEVER write raw ASCII m1, m/s^2, or multiplication asterisks *).
- stepByStepSolution: 3-5 clear ordered solution steps using clean $...$ / $$...$$ KaTeX LaTeX for all formulas and units, with zero raw * multiplication or conversational filler.`
          : `You are an expert Computer-Based Test (CBT) academic author and problem solver.
Inspect the provided question text${hasAnyImages ? ' and ALL attached images (question diagram and/or option images)' : ''} carefully.

Current Question Text: ${questionText.trim() || '[EMPTY — Read the attached question image and extract/formulate the full question stem clearly]'}
Current Options:
${optionSummary}

Your task:
1. "questionText": ${questionText.trim() ? 'Keep the provided question text accurately (fix obvious OCR typos only if needed, and format math/units in clean $...$ KaTeX delimiters if unformatted).' : 'Transcribe or clearly write the complete question stem from the attached question image using clean $...$ KaTeX delimiters.'}
2. "options": Return all 4 options A, B, C, D using clean $...$ KaTeX for math/units. ${hasBlankOptions ? 'Any option marked [Empty] MUST be generated so there is 1 mathematically/conceptually accurate answer and 3 realistic, distinct distractors.' : 'Preserve all user-provided option texts; if an option only has an attached image, describe what that option image shows concisely.'}
3. "correctOptionId": Solve the problem carefully (evaluating any diagrams or option images) and return the single best option ID ('A', 'B', 'C', or 'D').
4. "shortExplanation": Write a crisp 1-2 sentence explanation stating why the correct option is right, wrapping ALL math variables, subscripts, squares, equations, and units in clean $...$ KaTeX delimiters (e.g., $m_1$, $T_2$, $\\text{m/s}^2$, $m_2 g = m_2 a$ — NEVER raw m1, m/s^2, or * asterisks).
5. "stepByStepSolution": Write 3 to 5 clear, logical solution steps (clean prose without redundant "Step 1:" prefixes, wrapping ALL formulas, fractions, powers, and units in $...$ / $$...$$ KaTeX delimiters). Never include raw * multiplication or conversational filler like "Wait—" or self-corrections.`;

      parts.push({ text: instruction });

      const response = await callGeminiWithFallback(ai, {
        preferredModel: 'gemini-2.5-flash',
        contents: { parts },
        config: {
          thinkingConfig: {
            thinkingLevel: hasAnyImages ? ThinkingLevel.MEDIUM : ThinkingLevel.LOW,
          },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              questionText: { type: Type.STRING },
              options: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    text: { type: Type.STRING },
                  },
                  required: ['id', 'text'],
                },
              },
              correctOptionId: { type: Type.STRING },
              shortExplanation: { type: Type.STRING },
              stepByStepSolution: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: [
              'questionText',
              'options',
              'correctOptionId',
              'shortExplanation',
              'stepByStepSolution',
            ],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim()) as {
        questionText?: string;
        options?: Array<{ id: string; text: string }>;
        correctOptionId?: string;
        shortExplanation?: string;
        stepByStepSolution?: string[];
      };

      const optionIds: OptionId[] = ['A', 'B', 'C', 'D'];
      const normalizedOptions = optionIds.map((id, idx) => {
        const aiMatch =
          parsed.options?.find((o) => o.id?.toUpperCase() === id) || parsed.options?.[idx];
        const origOpt = options.find((o) => o.id === id);
        return {
          id,
          text: (origOpt?.text?.trim() || aiMatch?.text || `Option ${id}`).trim(),
        };
      });

      const validCorrect: OptionId =
        mode === 'solution_only' && ['A', 'B', 'C', 'D'].includes(String(correctOptionId))
          ? (correctOptionId as OptionId)
          : ['A', 'B', 'C', 'D'].includes(String(parsed.correctOptionId).toUpperCase())
          ? (String(parsed.correctOptionId).toUpperCase() as OptionId)
          : 'A';

      res.json({
        questionText: questionText.trim() || parsed.questionText?.trim() || '',
        options: normalizedOptions,
        correctOptionId: validCorrect,
        shortExplanation: parsed.shortExplanation || '',
        stepByStepSolution: Array.isArray(parsed.stepByStepSolution)
          ? parsed.stepByStepSolution
          : [],
      });
    } catch (err) {
      sendAiError(res, err);
    }
  });

  app.post('/api/ai/generate-diagram', async (req: Request, res: Response) => {
    try {
      const { prompt, topic = 'Scientific Diagram' } = req.body as {
        prompt?: string;
        topic?: string;
      };

      if (!prompt?.trim()) {
        res.status(400).json({ error: 'Please provide a diagram description or topic.' });
        return;
      }

      const ai = getAiClient();
      const diagramPrompt = `You are an expert technical illustrator for academic STEM assessments.
Create a clean, beautiful, self-contained SVG diagram for:
"${prompt.trim()}" (Topic: ${topic}).

Requirements:
1. Return ONLY raw valid XML/SVG code starting with <svg and ending with </svg>.
2. Set viewBox="0 0 600 350" with width="100%" height="100%".
3. Use clean modern styling, crisp dark lines (#1e293b), light backgrounds, labels, arrows, and scientific symbols suitable for test questions.
4. No markdown ticks, no html wrappers, only pure SVG.`;

      const response = await callGeminiWithFallback(ai, {
        preferredModel: 'gemini-2.5-flash',
        contents: diagramPrompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      let svgText = response.text?.trim() || '';
      svgText = svgText.replace(/^```(svg|xml)?/i, '').replace(/```$/, '').trim();
      if (!svgText.includes('<svg')) {
        res.status(500).json({ error: 'Failed to generate valid SVG diagram.' });
        return;
      }

      const svgBase64 = Buffer.from(svgText, 'utf8').toString('base64');
      const svgDataUrl = `data:image/svg+xml;base64,${svgBase64}`;
      res.json({ svg: svgText, dataUrl: svgDataUrl });
    } catch (err) {
      sendAiError(res, err);
    }
  });

  app.post('/api/ai/import-json', async (req: Request, res: Response) => {
    try {
      const {
        jsonTextOrData,
        sectionName = 'General',
        mode = 'parse_only',
        count = 5,
      } = req.body as {
        jsonTextOrData?: unknown;
        sectionName?: string;
        mode?: 'parse_only' | 'complete_with_gemini';
        count?: number;
      };

      if (jsonTextOrData === undefined || jsonTextOrData === null || jsonTextOrData === '') {
        res.status(400).json({ error: 'Provide a JSON file or JSON content to import.' });
        return;
      }

      let parsedJson: unknown;
      if (typeof jsonTextOrData === 'string') {
        const trimmed = jsonTextOrData.trim();
        if (!trimmed) {
          res.status(400).json({ error: 'JSON content is empty.' });
          return;
        }
        try {
          parsedJson = JSON.parse(trimmed);
        } catch {
          // If JSON parse fails, attempt to extract questions from raw markdown/text via Gemini
          try {
            const ai = getAiClient();
            const mdPrompt = `You are an expert assessment parser for CBT exams.
Extract all multiple-choice questions from the following text or markdown notes into a clean JSON object with a "questions" array.
Each question in the array must strictly have:
- "questionText": string (clear question stem, preserving any Markdown or LaTeX math formulas)
- "options": array of 4 objects [{ "id": "A", "text": "..." }, { "id": "B", "text": "..." }, { "id": "C", "text": "..." }, { "id": "D", "text": "..." }]
- "correctOptionId": "A" | "B" | "C" | "D"
- "shortExplanation": string
- "stepByStepSolution": array of strings

Input notes/markdown:
${trimmed}`;
            const mdResponse = await callGeminiWithFallback(ai, {
              preferredModel: 'gemini-2.5-flash',
              contents: mdPrompt,
              config: {
                thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
                responseMimeType: 'application/json',
              },
            });
            const textOut = mdResponse.text?.trim() || '{}';
            parsedJson = JSON.parse(textOut);
          } catch (aiErr) {
            res.status(400).json({
              error: `Invalid JSON syntax or Markdown question structure: ${extractErrorMessage(aiErr)}`,
            });
            return;
          }
        }
      } else {
        parsedJson = jsonTextOrData;
      }

      const rawArray = extractJsonQuestionArray(parsedJson);

      if (mode === 'parse_only') {
        if (!rawArray) {
          res.json({
            questions: [],
            incompleteCount: 0,
            parsedAsArray: false,
          });
          return;
        }
        const normalizedItems = rawArray
          .slice(0, 50)
          .map((item, idx) => normalizeJsonQuestionItem(item, idx));
        const incompleteCount = normalizedItems.filter((x) => x.needsAiCompletion).length;
        res.json({
          questions: normalizedItems.map((x) => ({
            ...x.draft,
            questionText:
              x.draft.questionText ||
              (x.draft.questionImageUrl
                ? 'Refer to the diagram/image below and choose the correct option.'
                : ''),
          })),
          incompleteCount,
          parsedAsArray: true,
        });
        return;
      }

      // mode === 'complete_with_gemini'
      const ai = getAiClient();

      if (rawArray && rawArray.length > 0) {
        const normalizedItems = rawArray
          .slice(0, 25)
          .map((item, idx) => normalizeJsonQuestionItem(item, idx));

        const completed: NormalizedJsonDraft[] = normalizedItems.map((item) => ({
          ...item.draft,
          questionText:
            item.draft.questionText ||
            (item.draft.questionImageUrl
              ? 'Refer to the diagram/image below and choose the correct option.'
              : ''),
        }));

        const incompleteEntries = normalizedItems
          .map((item, idx) => ({ idx, item }))
          .filter((entry) => entry.item.needsAiCompletion);

        // Batch ALL incomplete items into ONE single Gemini call so we never hit Free Tier 5 RPM limits
        if (incompleteEntries.length > 0) {
          const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
          let hasAnyImages = false;

          for (const { idx, item } of incompleteEntries) {
            const qImagePart = resolveImageUrlToInlinePart(item.draft.questionImageUrl);
            if (qImagePart) {
              hasAnyImages = true;
              parts.push({ text: `Image for Item index ${idx} Question Diagram:` });
              parts.push(qImagePart);
            }
            for (const opt of item.draft.options) {
              const optPart = resolveImageUrlToInlinePart(opt.imageUrl);
              if (optPart) {
                hasAnyImages = true;
                parts.push({ text: `Image for Item index ${idx} Option ${opt.id}:` });
                parts.push(optPart);
              }
            }
          }

          const itemsPayload = incompleteEntries.map(({ idx, item }) => ({
            index: idx,
            questionText: item.draft.questionText || null,
            options: item.draft.options.map((o) => ({
              id: o.id,
              text: o.text || null,
              hasImage: Boolean(o.imageUrl),
            })),
            providedCorrectOptionId: item.hasExplicitCorrect ? item.draft.correctOptionId : null,
            shortExplanation: item.draft.shortExplanation || null,
            stepByStepSolution:
              item.draft.stepByStepSolution.length > 0 ? item.draft.stepByStepSolution : null,
            rawContext: item.rawNotes,
          }));

          parts.push({
            text: `You are an expert Computer-Based Test (CBT) item writer for section "${sectionName}".
Complete ALL ${incompleteEntries.length} imported JSON question item(s) below in a SINGLE JSON response, preserving every user-provided field and attached image.

Items to complete:
${JSON.stringify(itemsPayload, null, 2)}

Requirements for EVERY item returned in "questions":
1. "index": MUST match the input item's exact integer "index".
2. "questionText": Keep the provided questionText if non-null; otherwise transcribe/formulate a clear exam question from the attached image or rawContext.
3. "options": Return all 4 options A, B, C, D. Keep any provided non-null option text; fill any null options with 1 accurate answer and 3 realistic distractors (if hasImage is true and text is null, provide a short descriptive label).
4. "correctOptionId": If providedCorrectOptionId is non-null, keep it unless clearly wrong; otherwise determine the single accurate answer ('A', 'B', 'C', or 'D').
5. "shortExplanation": Keep if provided; otherwise write a crisp 1-2 sentence explanation.
6. "stepByStepSolution": Keep if provided; otherwise write 2-5 clear, logical ordered solution steps.
7. Formatting rules: Write clean exam prose with zero conversational filler ("Wait—", "Actually,"). Only reference "shown below" / "diagram" if an image is actually attached to that item. Wrap ALL math variables, subscripts, squares/exponents, equations, and compound units in balanced $...$ / $$...$$ KaTeX LaTeX delimiters (e.g., $m_1$, $T_2$, $\\text{m/s}^2$, $m_2 g = m_2 a$ — never raw m/s^2, m1, or * multiplication asterisks).`,
          });

          const response = await callGeminiWithFallback(ai, {
            preferredModel: 'gemini-2.5-flash',
            contents: { parts },
            config: {
              thinkingConfig: {
                thinkingLevel: hasAnyImages ? ThinkingLevel.MEDIUM : ThinkingLevel.LOW,
              },
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  questions: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        index: { type: Type.INTEGER },
                        questionText: { type: Type.STRING },
                        options: {
                          type: Type.ARRAY,
                          items: {
                            type: Type.OBJECT,
                            properties: {
                              id: { type: Type.STRING },
                              text: { type: Type.STRING },
                            },
                            required: ['id', 'text'],
                          },
                        },
                        correctOptionId: { type: Type.STRING },
                        shortExplanation: { type: Type.STRING },
                        stepByStepSolution: {
                          type: Type.ARRAY,
                          items: { type: Type.STRING },
                        },
                      },
                      required: [
                        'index',
                        'questionText',
                        'options',
                        'correctOptionId',
                        'shortExplanation',
                        'stepByStepSolution',
                      ],
                    },
                  },
                },
                required: ['questions'],
              },
            },
          });

          const aiParsed = JSON.parse((response.text ?? '{"questions":[]}').trim()) as {
            questions?: Array<{
              index?: number;
              questionText?: string;
              options?: Array<{ id: string; text: string }>;
              correctOptionId?: string;
              shortExplanation?: string;
              stepByStepSolution?: string[];
            }>;
          };

          const aiByIndex = new Map<number, NonNullable<typeof aiParsed.questions>[number]>();
          (aiParsed.questions || []).forEach((q, fallbackPos) => {
            const key =
              typeof q.index === 'number' && Number.isInteger(q.index)
                ? q.index
                : incompleteEntries[fallbackPos]?.idx;
            if (key !== undefined) {
              aiByIndex.set(key, q);
            }
          });

          const optionIds: OptionId[] = ['A', 'B', 'C', 'D'];
          for (const { idx, item } of incompleteEntries) {
            const aiQ = aiByIndex.get(idx);
            if (!aiQ) continue;

            const mergedOptions = optionIds.map((id, optIdx) => {
              const origOpt = item.draft.options.find((o) => o.id === id);
              const aiOpt =
                aiQ.options?.find((o) => o.id?.toUpperCase() === id) || aiQ.options?.[optIdx];
              return {
                id,
                text: (origOpt?.text || aiOpt?.text || `Option ${id}`).slice(0, 600),
                ...(origOpt?.imageUrl ? { imageUrl: origOpt.imageUrl } : {}),
              };
            });

            const validCorrect: OptionId = item.hasExplicitCorrect
              ? item.draft.correctOptionId
              : ['A', 'B', 'C', 'D'].includes(String(aiQ.correctOptionId).toUpperCase())
              ? (String(aiQ.correctOptionId).toUpperCase() as OptionId)
              : 'A';

            completed[idx] = {
              questionText: (
                item.draft.questionText ||
                aiQ.questionText?.trim() ||
                'Refer to the question below.'
              ).slice(0, 3000),
              ...(item.draft.questionImageUrl
                ? { questionImageUrl: item.draft.questionImageUrl }
                : {}),
              options: mergedOptions,
              correctOptionId: validCorrect,
              shortExplanation: (
                item.draft.shortExplanation ||
                aiQ.shortExplanation?.trim() ||
                ''
              ).slice(0, 1000),
              stepByStepSolution: (item.draft.stepByStepSolution.length > 0
                ? item.draft.stepByStepSolution
                : Array.isArray(aiQ.stepByStepSolution)
                ? aiQ.stepByStepSolution.map((s) => String(s).trim()).filter(Boolean)
                : []
              )
                .slice(0, 20)
                .map((s) => s.slice(0, 800)),
              ...(item.draft.marks !== undefined ? { marks: item.draft.marks } : {}),
            };
          }
        }

        res.json({
          questions: completed,
          incompleteCount: 0,
          parsedAsArray: true,
        });
        return;
      }

      // Unstructured / arbitrary JSON object -> let Gemini generate complete questions from it
      const safeCount = Math.min(Math.max(Number(count) || 5, 1), 15);
      const topObj =
        parsedJson && typeof parsedJson === 'object'
          ? (parsedJson as Record<string, unknown>)
          : undefined;
      const topImgUrl = topObj
        ? normalizeImportedMediaUrl(
            topObj.questionImageUrl ?? topObj.imageUrl ?? topObj.image ?? topObj.diagram,
            'json_topic_ref'
          )
        : undefined;
      const topImgPart = resolveImageUrlToInlinePart(topImgUrl);

      const jsonExcerpt = JSON.stringify(parsedJson, null, 2).slice(0, 40000);
      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
      if (topImgPart) {
        parts.push({ text: 'Reference Image from JSON:' });
        parts.push(topImgPart);
      }
      parts.push({
        text: `You are an expert Computer-Based Test (CBT) item writer.
Generate ${safeCount} complete, accurate multiple-choice questions for the section "${sectionName}" directly from the following JSON data / syllabus / notes.

JSON Input:
${jsonExcerpt}

Requirements:
- Write clean, publication-grade exam prose. NEVER include self-corrections or filler like "Wait—" or "Actually,".
- ${topImgPart ? 'The attached reference image may be referenced when relevant.' : 'NO image is attached unless provided in the output, so do NOT write "shown below" or "in the diagram"; keep every problem self-contained.'}
- Format ALL mathematical symbols, variables, subscripts, squares/exponents, fractions, and compound units cleanly using standard $...$ (inline) or $$...$$ (display) KaTeX LaTeX delimiters (e.g., $m_1$, $\\text{m/s}^2$, $m_2 g = m_2 a$ — never raw ASCII m1, m/s^2, or * multiplication asterisks).
- Each question must have a clear questionText, exactly 4 distinct options (A, B, C, D), one accurate correctOptionId ('A', 'B', 'C', or 'D'), a crisp 1-2 sentence shortExplanation, and 2-5 ordered steps in stepByStepSolution.`,
      });

      const response = await callGeminiWithFallback(ai, {
        preferredModel: 'gemini-2.5-flash',
        contents: { parts },
        config: {
          thinkingConfig: { thinkingLevel: topImgPart ? ThinkingLevel.MEDIUM : ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    questionText: { type: Type.STRING },
                    options: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          id: { type: Type.STRING },
                          text: { type: Type.STRING },
                        },
                        required: ['id', 'text'],
                      },
                    },
                    correctOptionId: { type: Type.STRING },
                    shortExplanation: { type: Type.STRING },
                    stepByStepSolution: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                  },
                  required: [
                    'questionText',
                    'options',
                    'correctOptionId',
                    'shortExplanation',
                    'stepByStepSolution',
                  ],
                },
              },
            },
            required: ['questions'],
          },
        },
      });

      const aiParsed = JSON.parse((response.text ?? '{"questions":[]}').trim()) as {
        questions?: Array<{
          questionText: string;
          options: Array<{ id: string; text: string }>;
          correctOptionId: string;
          shortExplanation: string;
          stepByStepSolution: string[];
        }>;
      };

      const optionIds: OptionId[] = ['A', 'B', 'C', 'D'];
      const generated: NormalizedJsonDraft[] = (aiParsed.questions || []).map((q) => ({
        questionText: String(q.questionText || '').slice(0, 3000),
        ...(topImgUrl ? { questionImageUrl: topImgUrl } : {}),
        options: optionIds.map((id, idx) => ({
          id,
          text: String(
            q.options?.find((o) => o.id?.toUpperCase() === id)?.text ||
              q.options?.[idx]?.text ||
              `Option ${id}`
          ).slice(0, 600),
        })),
        correctOptionId: ['A', 'B', 'C', 'D'].includes(String(q.correctOptionId).toUpperCase())
          ? (String(q.correctOptionId).toUpperCase() as OptionId)
          : 'A',
        shortExplanation: String(q.shortExplanation || '').slice(0, 1000),
        stepByStepSolution: Array.isArray(q.stepByStepSolution)
          ? q.stepByStepSolution.map((s) => String(s).trim()).filter(Boolean).slice(0, 20)
          : [],
      }));

      res.json({
        questions: generated,
        incompleteCount: 0,
        parsedAsArray: false,
      });
    } catch (err) {
      sendAiError(res, err);
    }
  });

  function getSampleMeceeExam(testTitle?: string) {
    return {
      title: testTitle || 'MECEE BL Model Entrance Examination (Model XIII - Set A)',
      description:
        'Comprehensive Medical Common Entrance Examination (MECEE-BL) Model XIII with Zoology, Botany, Chemistry, Physics, and Mental Agility Test (MAT) sections.',
      sections: [
        { name: 'Zoology', questionCount: 40 },
        { name: 'Botany', questionCount: 40 },
        { name: 'Chemistry', questionCount: 50 },
        { name: 'Physics', questionCount: 50 },
        { name: 'Mental Agility Test (MAT)', questionCount: 20 },
      ],
      questions: [
        // ZOOLOGY
        {
          sectionName: 'Zoology',
          orderIndex: 0,
          questionText: 'Which of the following organisms is an egg-laying mammal (monotreme)?',
          options: [
            { id: 'A', text: 'Kangaroo (Macropus)' },
            { id: 'B', text: 'Duck-billed Platypus (Ornithorhynchus)' },
            { id: 'C', text: 'Blue Whale (Balaenoptera)' },
            { id: 'D', text: 'Bat (Pteropus)' },
          ],
          correctOptionId: 'B',
          shortExplanation: 'Ornithorhynchus (platypus) and Tachyglossus (echidna) are oviparous mammals.',
          stepByStepSolution: [
            'Mammals are predominantly viviparous, giving birth to live young.',
            'The order Monotremata is the primitive mammalian order that lays eggs (oviparous).',
            'Duck-billed Platypus belongs to Monotremata and possesses mammary glands without nipples.',
          ],
        },
        {
          sectionName: 'Zoology',
          orderIndex: 1,
          questionText: 'Piamater and arachnoid membrane together are collectively designated as:',
          options: [
            { id: 'A', text: 'Pachymeninx' },
            { id: 'B', text: 'Leptomeninges' },
            { id: 'C', text: 'Duramater' },
            { id: 'D', text: 'Choroid plexus' },
          ],
          correctOptionId: 'B',
          shortExplanation: 'The thin inner meninges (arachnoid and pia mater) are called leptomeninges.',
          stepByStepSolution: [
            'The cranial meninges consist of three protective connective tissue layers: outer dura mater, middle arachnoid, and inner pia mater.',
            'Dura mater is thick and fibrous, termed pachymeninx.',
            'Arachnoid and pia mater are thin, vascular membranes collectively termed leptomeninges.',
          ],
        },
        {
          sectionName: 'Zoology',
          orderIndex: 2,
          questionText:
            'The volume of air that remains inside human lungs even after the most forceful expiration is:',
          options: [
            { id: 'A', text: 'Tidal volume ($TV \\approx 500\\text{ mL}$)' },
            { id: 'B', text: 'Expiratory reserve volume ($ERV \\approx 1000\\text{ mL}$)' },
            { id: 'C', text: 'Residual volume ($RV \\approx 1100-1200\\text{ mL}$)' },
            { id: 'D', text: 'Vital capacity ($VC \\approx 4500\\text{ mL}$)' },
          ],
          correctOptionId: 'C',
          shortExplanation: 'Residual volume (RV) cannot be expelled by voluntary expiration and prevents lung collapse.',
          stepByStepSolution: [
            'Residual volume ($RV$) is the volume of air remaining in the respiratory tract after maximum voluntary expiration.',
            'In a healthy adult human, $RV \\approx 1100\\text{ mL} - 1200\\text{ mL}$.',
            'It cannot be directly measured using simple spirometry.',
          ],
        },
        {
          sectionName: 'Zoology',
          orderIndex: 3,
          questionText: 'Kupffer cells are specialized macrophages residing in which organ?',
          options: [
            { id: 'A', text: 'Spleen' },
            { id: 'B', text: 'Liver' },
            { id: 'C', text: 'Kidney' },
            { id: 'D', text: 'Thymus' },
          ],
          correctOptionId: 'B',
          shortExplanation: 'Kupffer cells line the hepatic sinusoids in the liver and phagocytose foreign microbes and debris.',
          stepByStepSolution: [
            'The liver sinusoidal lining contains specialized stellate sinusoidal macrophages.',
            'These cells are named Kupffer cells after Karl Wilhelm von Kupffer.',
            'They play a crucial role in breakdown of red blood cells and antigen clearance.',
          ],
        },

        // BOTANY
        {
          sectionName: 'Botany',
          orderIndex: 4,
          questionText: 'Which phytohormone is primarily responsible for inducing apical dominance in plants?',
          options: [
            { id: 'A', text: 'Gibberellin ($GA_3$)' },
            { id: 'B', text: 'Cytokinin (Zeatin)' },
            { id: 'C', text: 'Auxin (Indole-3-acetic acid, IAA)' },
            { id: 'D', text: 'Abscisic acid (ABA)' },
          ],
          correctOptionId: 'C',
          shortExplanation: 'Auxin synthesized at the shoot apex inhibits the outgrowth of lateral axillary buds.',
          stepByStepSolution: [
            'Apical dominance occurs when the terminal shoot apex suppresses the growth of lateral buds.',
            'Shoot apex produces auxin (IAA), which travels basipetally.',
            'Decapitation of the shoot tip removes the auxin source and releases lateral buds from inhibition.',
          ],
        },
        {
          sectionName: 'Botany',
          orderIndex: 5,
          questionText: 'The enzymatic dark reactions (Calvin cycle, $C_3$ pathway) of photosynthesis occur in the:',
          options: [
            { id: 'A', text: 'Thylakoid membrane' },
            { id: 'B', text: 'Grana lamellae' },
            { id: 'C', text: 'Stroma of chloroplast' },
            { id: 'D', text: 'Peroxisome' },
          ],
          correctOptionId: 'C',
          shortExplanation: 'The Calvin cycle enzymes (including RuBisCO) are localized in the soluble chloroplast stroma.',
          stepByStepSolution: [
            'Light-dependent photophosphorylation reactions occur in the thylakoid membranes.',
            'ATP and NADPH generated during the light reactions diffuse into the surrounding stroma.',
            'Stroma contains the enzyme RuBisCO, where $CO_2$ is fixed into 3-phosphoglycerate.',
          ],
        },
        {
          sectionName: 'Botany',
          orderIndex: 6,
          questionText: 'Casparian strips containing suberin waterproof bands are located in the:',
          options: [
            { id: 'A', text: 'Epidermis' },
            { id: 'B', text: 'Hypodermis' },
            { id: 'C', text: 'Endodermis' },
            { id: 'D', text: 'Pericycle' },
          ],
          correctOptionId: 'C',
          shortExplanation: 'Endodermal cells possess suberized Casparian strips that force water into the symplastic pathway.',
          stepByStepSolution: [
            'In roots, radial and transverse walls of endodermal cells are impregnated with waxy suberin.',
            'This anatomical structure is called the Casparian strip.',
            'It blocks apoplastic water flow and directs mineral ions across the plasma membrane.',
          ],
        },
        {
          sectionName: 'Botany',
          orderIndex: 7,
          questionText: 'Double fertilization resulting in a diploid zygote and triploid ($3n$) endosperm is unique to:',
          options: [
            { id: 'A', text: 'Pteridophytes' },
            { id: 'B', text: 'Gymnosperms' },
            { id: 'C', text: 'Angiosperms' },
            { id: 'D', text: 'Bryophytes' },
          ],
          correctOptionId: 'C',
          shortExplanation: 'Syngamy plus triple fusion ($n + 2n = 3n$) is a diagnostic feature of angiosperm reproduction.',
          stepByStepSolution: [
            'One sperm cell fuses with the egg cell nucleus ($n + n$) forming the $2n$ zygote.',
            'The second sperm cell fuses with the two polar nuclei ($n + n + n$) to produce primary endosperm nucleus ($3n$).',
            'This double fertilization phenomenon was discovered by S. Nawaschin in angiosperms.',
          ],
        },

        // CHEMISTRY
        {
          sectionName: 'Chemistry',
          orderIndex: 8,
          questionText: 'The hybridization of the central sulfur atom in sulfur hexafluoride ($\\text{SF}_6$) is:',
          options: [
            { id: 'A', text: '$sp^3$' },
            { id: 'B', text: '$sp^3d$' },
            { id: 'C', text: '$sp^3d^2$' },
            { id: 'D', text: '$d^2sp^3$' },
          ],
          correctOptionId: 'C',
          shortExplanation: 'Sulfur in $\\text{SF}_6$ has 6 bond pairs and 0 lone pairs ($VSEPR = 6$), yielding octahedral $sp^3d^2$.',
          stepByStepSolution: [
            'Sulfur has 6 valence electrons in group 16: $3s^2 3p^4$.',
            'All 6 electrons participate in bonding with 6 fluorine atoms.',
            'Steric number $SN = 6 + 0 = 6$, which corresponds to $sp^3d^2$ hybridization with octahedral geometry.',
          ],
        },
        {
          sectionName: 'Chemistry',
          orderIndex: 9,
          questionText: 'What is the theoretical $\\text{pH}$ of a $10^{-8}\\text{ M } \\text{HCl}$ aqueous solution at $25^\\circ\\text{C}$?',
          options: [
            { id: 'A', text: '$8.00$' },
            { id: 'B', text: '$7.00$' },
            { id: 'C', text: '$6.98$' },
            { id: 'D', text: '$6.02$' },
          ],
          correctOptionId: 'C',
          shortExplanation: 'Total $[H^+] = 10^{-8}\\text{ M (from HCl)} + 10^{-7}\\text{ M (from water)} = 1.05 \\times 10^{-7}\\text{ M}$, yielding $\\text{pH} \\approx 6.98$.',
          stepByStepSolution: [
            'In dilute acid solutions, $[H^+]$ from auto-ionization of water cannot be neglected ($K_w = 1.0 \\times 10^{-14}$).',
            'Let $[H^+]_{\\text{water}} = x$, so total $[H^+] = 10^{-8} + x$.',
            '$(10^{-8} + x)(x) = 1.0 \\times 10^{-14} \\implies x^2 + 10^{-8}x - 10^{-14} = 0$.',
            'Solving the quadratic gives total $[H^+] = 1.051 \\times 10^{-7}\\text{ M}$, so $\\text{pH} = -\\log_{10}(1.051 \\times 10^{-7}) \\approx 6.98$.',
          ],
        },
        {
          sectionName: 'Chemistry',
          orderIndex: 10,
          questionText: 'The Reimer-Tiemann reaction of phenol with chloroform in aqueous $\\text{NaOH}$ produces:',
          options: [
            { id: 'A', text: 'Benzoic acid' },
            { id: 'B', text: 'Salicylaldehyde' },
            { id: 'C', text: 'Salicylic acid' },
            { id: 'D', text: 'Picric acid' },
          ],
          correctOptionId: 'B',
          shortExplanation: 'Phenol reacts with $:CCl_2$ (dichlorocarbene) in alkali to form ortho-hydroxybenzaldehyde (salicylaldehyde).',
          stepByStepSolution: [
            'Chloroform $\\text{CHCl}_3$ reacts with $\\text{OH}^-$ to generate the reactive intermediate dichlorocarbene ($:CCl_2$).',
            'Phenoxide ion attacks the electrophilic carbene at the ortho position.',
            'Hydrolysis of the gem-dichloride intermediate affords salicylaldehyde.',
          ],
        },
        {
          sectionName: 'Chemistry',
          orderIndex: 11,
          questionText: 'Which of the following oxides exhibits amphoteric behavior, reacting with both acids and bases?',
          options: [
            { id: 'A', text: '$\\text{SO}_2$' },
            { id: 'B', text: '$\\text{CaO}$' },
            { id: 'C', text: '$\\text{Al}_2\\text{O}_3$' },
            { id: 'D', text: '$\\text{CO}$' },
          ],
          correctOptionId: 'C',
          shortExplanation: 'Aluminium oxide ($\\text{Al}_2\\text{O}_3$) dissolves in acids to form salts and in strong alkalis to form aluminates.',
          stepByStepSolution: [
            '$\\text{Al}_2\\text{O}_3 + 6\\text{HCl} \\to 2\\text{AlCl}_3 + 3\\text{H}_2\\text{O}$ (acting as a basic oxide).',
            '$\\text{Al}_2\\text{O}_3 + 2\\text{NaOH} + 3\\text{H}_2\\text{O} \\to 2\\text{Na}[\\text{Al}(\\text{OH})_4]$ (acting as an acidic oxide).',
            'Therefore, $\\text{Al}_2\\text{O}_3$ is classified as an amphoteric oxide.',
          ],
        },

        // PHYSICS
        {
          sectionName: 'Physics',
          orderIndex: 12,
          questionText:
            'A long solenoid of length $L$ with $n$ turns per unit length carries a steady current $i$. The magnetic field $B$ along the central axis inside the solenoid is:',
          options: [
            { id: 'A', text: '$B = \\frac{\\mu_0 n i}{2}$' },
            { id: 'B', text: '$B = \\mu_0 n i$' },
            { id: 'C', text: '$B = 2\\mu_0 n i$' },
            { id: 'D', text: '$B = \\frac{\\mu_0 i}{2\\pi n}$' },
          ],
          correctOptionId: 'B',
          shortExplanation: 'By Ampere’s Circuital Law, the axial magnetic field inside an ideal solenoid is $B = \\mu_0 n i$.',
          stepByStepSolution: [
            'Apply Ampere’s Law along a rectangular loop: $\\oint \\vec{B} \\cdot d\\vec{l} = \\mu_0 I_{\\text{enclosed}}$.',
            'For a segment of length $l$, the enclosed current is $I_{\\text{enc}} = (n l) i$.',
            '$B l = \\mu_0 (n l) i \\implies B = \\mu_0 n i$.',
          ],
        },
        {
          sectionName: 'Physics',
          orderIndex: 13,
          questionText:
            'An ideal step-down transformer has a primary-to-secondary turns ratio of $N_p / N_s = 4:1$. If an alternating primary voltage $V_p = 200\\text{ V}$ is applied, what is the output secondary voltage $V_s$?',
          options: [
            { id: 'A', text: '$V_s = 50\\text{ V}$' },
            { id: 'B', text: '$V_s = 100\\text{ V}$' },
            { id: 'C', text: '$V_s = 400\\text{ V}$' },
            { id: 'D', text: '$V_s = 800\\text{ V}$' },
          ],
          correctOptionId: 'A',
          shortExplanation: 'The transformer equation gives $\\frac{V_s}{V_p} = \\frac{N_s}{N_p} = \\frac{1}{4} \\implies V_s = \\frac{200}{4} = 50\\text{ V}$.',
          stepByStepSolution: [
            'By Faraday’s law of induction in an ideal transformer: $\\frac{V_s}{V_p} = \\frac{N_s}{N_p}$.',
            'Substitute $N_s / N_p = 1/4$ and $V_p = 200\\text{ V}$.',
            '$V_s = 200\\text{ V} \\times \\frac{1}{4} = 50\\text{ V}$.',
          ],
        },
        {
          sectionName: 'Physics',
          orderIndex: 14,
          questionText:
            'Two harmonic waves oscillating along the same axis superpose according to $y = \\frac{1}{\\sqrt{a}}\\sin\\omega t + \\frac{1}{\\sqrt{b}}\\cos\\omega t$. The resultant amplitude $A$ of the oscillation is:',
          options: [
            { id: 'A', text: '$A = \\frac{1}{a} + \\frac{1}{b}$' },
            { id: 'B', text: '$A = \\sqrt{\\frac{1}{a} + \\frac{1}{b}}$' },
            { id: 'C', text: '$A = \\frac{1}{\\sqrt{a}} + \\frac{1}{\\sqrt{b}}$' },
            { id: 'D', text: '$A = \\frac{1}{\\sqrt{ab}}$' },
          ],
          correctOptionId: 'B',
          shortExplanation: 'Orthogonal harmonic components $\\sin\\omega t$ and $\\cos\\omega t$ have phase difference $\\pi/2$, so $A = \\sqrt{A_1^2 + A_2^2} = \\sqrt{1/a + 1/b}$.',
          stepByStepSolution: [
            'Let $A_1 = \\frac{1}{\\sqrt{a}}$ and $A_2 = \\frac{1}{\\sqrt{b}}$.',
            'Because $\\cos\\omega t = \\sin(\\omega t + \\pi/2)$, the phase difference between the two waves is $\\Delta\\phi = 90^\\circ$.',
            'Resultant amplitude: $A = \\sqrt{A_1^2 + A_2^2 + 2 A_1 A_2 \\cos 90^\\circ} = \\sqrt{\\frac{1}{a} + \\frac{1}{b}}$.',
          ],
        },
        {
          sectionName: 'Physics',
          orderIndex: 15,
          questionText:
            'Five identical capacitors each of capacitance $C$ are arranged in a bridge network between terminals $A$ and $B$. What is the equivalent capacitance $C_{AB}$?',
          questionImageUrl: '/assets/images/diagram_circuit_bridge_1794574130210.jpg',
          options: [
            { id: 'A', text: '$C_{AB} = \\frac{C}{5}$' },
            { id: 'B', text: '$C_{AB} = C$' },
            { id: 'C', text: '$C_{AB} = \\frac{5}{3}C$' },
            { id: 'D', text: '$C_{AB} = 5C$' },
          ],
          correctOptionId: 'C',
          shortExplanation: 'By delta-star transformation or nodal analysis of the symmetric capacitor network, $C_{AB} = \\frac{5}{3}C$.',
          stepByStepSolution: [
            'Let a potential difference $V$ be applied between nodes $A$ and $B$.',
            'Using nodal charge conservation at the central junction nodes $C$ and $D$:',
            'Due to bridge symmetry, total charge delivered is $Q = \\frac{5}{3} C V$.',
            'Equivalent capacitance $C_{AB} = \\frac{Q}{V} = \\frac{5}{3}C$.',
          ],
        },

        // MAT (Mental Agility Test)
        {
          sectionName: 'Mental Agility Test (MAT)',
          orderIndex: 16,
          questionText: 'Determine the missing number in the sequence: $2,\\ 6,\\ 12,\\ 20,\\ 30,\\ ?$?',
          options: [
            { id: 'A', text: '$36$' },
            { id: 'B', text: '$40$' },
            { id: 'C', text: '$42$' },
            { id: 'D', text: '$48$' },
          ],
          correctOptionId: 'C',
          shortExplanation: 'The consecutive differences are $+4, +6, +8, +10, +12$, giving $30 + 12 = 42$ (or $n(n+1)$ where $6 \\times 7 = 42$).',
          stepByStepSolution: [
            'Notice the terms follow $n(n+1)$ for $n = 1, 2, 3, 4, 5, 6$:',
            '$1 \\times 2 = 2$',
            '$2 \\times 3 = 6$',
            '$3 \\times 4 = 12$',
            '$4 \\times 5 = 20$',
            '$5 \\times 6 = 30$',
            'Next term for $n = 6$ is $6 \\times 7 = 42$.',
          ],
        },
        {
          sectionName: 'Mental Agility Test (MAT)',
          orderIndex: 17,
          questionText: 'A train traveling at a constant speed of $72\\text{ km/h}$ takes $15\\text{ seconds}$ to cross a stationary signal pole. What is the length of the train?',
          options: [
            { id: 'A', text: '$200\\text{ m}$' },
            { id: 'B', text: '$250\\text{ m}$' },
            { id: 'C', text: '$300\\text{ m}$' },
            { id: 'D', text: '$360\\text{ m}$' },
          ],
          correctOptionId: 'C',
          shortExplanation: 'Speed $v = 72 \\times \\frac{5}{18} = 20\\text{ m/s}$. Length $L = v \\times t = 20 \\times 15 = 300\\text{ m}$.',
          stepByStepSolution: [
            'Convert train velocity from $\\text{km/h}$ to $\\text{m/s}$: $72 \\times \\frac{5}{18} = 20\\text{ m/s}$.',
            'To cross a stationary point object (pole), the train must traverse its own length $L$.',
            'Distance $L = \\text{Speed} \\times \\text{Time} = 20\\text{ m/s} \\times 15\\text{ s} = 300\\text{ m}$.',
          ],
        },
        {
          sectionName: 'Mental Agility Test (MAT)',
          orderIndex: 18,
          questionText: 'If "EARTH" is coded in a cipher as "GCTVJ", how is "SOLAR" coded following the identical rule?',
          options: [
            { id: 'A', text: 'UQNCT' },
            { id: 'B', text: 'UONCT' },
            { id: 'C', text: 'VPNBT' },
            { id: 'D', text: 'TQMAS' },
          ],
          correctOptionId: 'A',
          shortExplanation: 'Each letter is shifted forward by $+2$ positions in the alphabet: $S\\to U, O\\to Q, L\\to N, A\\to C, R\\to T$.',
          stepByStepSolution: [
            'Examine the transformation in "EARTH" $\\to$ "GCTVJ":',
            '$E (+2) \\to G$, $A (+2) \\to C$, $R (+2) \\to T$, $T (+2) \\to V$, $H (+2) \\to J$.',
            'Applying $+2$ shift to "SOLAR":',
            '$S (+2) \\to U$, $O (+2) \\to Q$, $L (+2) \\to N$, $A (+2) \\to C$, $R (+2) \\to T$. Result: "UQNCT".',
          ],
        },
        {
          sectionName: 'Mental Agility Test (MAT)',
          orderIndex: 19,
          questionText: 'Pointing to a photograph, a woman said: "His mother is the only daughter of my mother." How is the woman related to the boy in the photograph?',
          options: [
            { id: 'A', text: 'Sister' },
            { id: 'B', text: 'Aunt' },
            { id: 'C', text: 'Mother' },
            { id: 'D', text: 'Grandmother' },
          ],
          correctOptionId: 'C',
          shortExplanation: '"Only daughter of my mother" means the woman herself. Therefore, she is the boy’s mother.',
          stepByStepSolution: [
            'Break down the statement: "Only daughter of my mother".',
            'Since the speaker is a woman, the only daughter of her mother is herself.',
            'Thus, "His mother is [myself]". The woman is the boy’s mother.',
          ],
        },
      ],
    };
  }

  app.post('/api/ai/import-document-exam', async (req: Request, res: Response) => {
    try {
      const {
        questionDocBase64,
        questionDocMimeType = 'application/pdf',
        questionDocText,
        solutionDocBase64,
        solutionDocMimeType = 'application/pdf',
        solutionDocText,
        pageImages,
        testTitle = 'MECEE BL Model Entrance Exam',
        useLocalSample = false,
        pageRange,
      } = req.body as {
        questionDocBase64?: string;
        questionDocMimeType?: string;
        questionDocText?: string;
        solutionDocBase64?: string;
        solutionDocMimeType?: string;
        solutionDocText?: string;
        pageImages?: string[];
        testTitle?: string;
        useLocalSample?: boolean;
        pageRange?: string;
      };

      // Fast-track sample booklet shortcut: returns complete MECEE BL Model XIII exam immediately
      if (useLocalSample) {
        res.json(getSampleMeceeExam(testTitle));
        return;
      }

      const ai = getAiClient();
      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

      if (Array.isArray(pageImages) && pageImages.length > 0) {
        for (const raw of pageImages) {
          const data = raw.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
          const mime = raw.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
          parts.push({
            inlineData: {
              mimeType: mime,
              data,
            },
          });
        }
      }
      if (questionDocBase64) {
        parts.push({
          inlineData: {
            mimeType: questionDocMimeType,
            data: questionDocBase64,
          },
        });
      }
      if (solutionDocBase64) {
        parts.push({
          inlineData: {
            mimeType: solutionDocMimeType,
            data: solutionDocBase64,
          },
        });
      }
      if (questionDocText?.trim()) {
        parts.push({ text: `Question Document Content:\n${questionDocText.trim()}` });
      }
      if (solutionDocText?.trim()) {
        parts.push({ text: `Solution / Answer Key Document Content:\n${solutionDocText.trim()}` });
      }

      if (parts.length === 0) {
        res.status(400).json({ error: 'Please provide question booklet or solution document to import.' });
        return;
      }

      // Guard against Google Gemini 8MB payload limit to prevent HTTP 413
      let totalPayloadBytes = 0;
      for (const p of parts) {
        if ('inlineData' in p) {
          totalPayloadBytes += p.inlineData.data.length;
        }
      }
      if (totalPayloadBytes > 6 * 1024 * 1024) {
        res.status(413).json({
          error:
            'The uploaded document pages are too large for Gemini AI (exceeds 6MB). Please upload pages in smaller section batches.',
        });
        return;
      }

      const promptText = `You are an expert Computer-Based Testing (CBT) assessment extraction and LaTeX digitization system.
Analyze the provided Question document and Solution booklet, extract all multiple-choice questions, and structure them into their respective sections.

CRITICAL EXTRACTION GUIDELINES:
1. SECTIONS:
   - Auto-detect the sections present in the exam (e.g., Zoology, Botany, Chemistry, Physics, Mental Agility / MAT, or other domain headings).
   - Return a list of all detected sections in "sections" with their name and estimated question count.
   - For every question, set "sectionName" to its matching section.

2. QUESTIONS & 4 OPTIONS:
   - Extract clear, unambiguous question stems.
   - Extract exactly 4 distinct options labeled A, B, C, D for every question.
   - If options in the paper are (a), (b), (c), (d), normalize them to uppercase 'A', 'B', 'C', 'D'.

3. STRICT KaTeX LaTeX PRESERVATION:
   - Wrap ALL mathematical equations, physics variables, fractions, square roots, subscripts, superscripts, chemical formulas, Greek letters (alpha, beta, theta, mu, lambda, etc.), and units in standard KaTeX LaTeX delimiters ($...$ for inline, $$...$$ for block).
   - Examples:
     * $B_{\\text{inside}} = \\mu_0 n i$
     * $\\frac{R_1}{R_2} = \\frac{1 + \\alpha t_1}{1 + \\alpha t_2} \\implies T = 1127\\text{ K}$
     * $T_2 = 2\\sqrt{\\frac{B_H}{2B_H}} = \\sqrt{2}\\text{ s}$
     * $y = \\frac{1}{\\sqrt{a}}\\sin\\omega t \\pm \\frac{1}{\\sqrt{b}}\\cos\\omega t$
     * $C_{AB} = \\frac{5}{3}C$
   - NEVER leave bare ASCII or unbalanced dollar signs.

4. ANSWER KEY & SOLUTIONS:
   - Accurately match each Question #N with its correct answer from the solutions booklet/answer key.
   - "correctOptionId" MUST be exactly one of "A", "B", "C", or "D".
   - "shortExplanation": A crisp 1-3 sentence explanation summarizing the underlying concept.
   - "stepByStepSolution": If numerical steps or derivation exist (e.g. Physics, Chemistry, Math), list each step as an item in the array.

5. TITLE & METADATA:
   - Extract or infer the overall exam title, e.g. "${testTitle || 'Medical Entrance Examination'}".`;

      parts.push({ text: promptText });

      const response = await callGeminiWithFallback(ai, {
        preferredModel: 'gemini-2.5-flash',
        contents: { parts },
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              sections: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    questionCount: { type: Type.NUMBER },
                  },
                  required: ['name'],
                },
              },
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    sectionName: { type: Type.STRING },
                    orderIndex: { type: Type.NUMBER },
                    questionText: { type: Type.STRING },
                    questionImageUrl: { type: Type.STRING },
                    options: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          id: { type: Type.STRING },
                          text: { type: Type.STRING },
                        },
                        required: ['id', 'text'],
                      },
                    },
                    correctOptionId: { type: Type.STRING },
                    shortExplanation: { type: Type.STRING },
                    stepByStepSolution: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                  },
                  required: ['questionText', 'options', 'correctOptionId'],
                },
              },
            },
            required: ['title', 'sections', 'questions'],
          },
        },
      });

      const textOut = (response.text ?? '{}').trim();
      const parsed = JSON.parse(textOut);
      res.json(parsed);
    } catch (err) {
      sendAiError(res, err);
    }
  });

  app.post('/api/ai/translate', async (req: Request, res: Response) => {
    try {
      const { texts, targetLanguage } = req.body as {
        texts?: string[];
        targetLanguage?: string;
      };

      if (!Array.isArray(texts) || texts.length === 0 || !targetLanguage) {
        res.status(400).json({ error: 'texts array and targetLanguage are required.' });
        return;
      }

      if (targetLanguage.toLowerCase() === 'english') {
        res.json({ translations: texts });
        return;
      }

      const ai = getAiClient();
      const response = await callGeminiWithFallback(ai, {
        preferredModel: 'gemini-2.5-flash',
        contents: `Translate every string in the following JSON array accurately into ${targetLanguage} for a student taking an exam. Preserve ALL LaTeX delimiters ($...$, $$...$$, \\(...\\), \\[...\\]) and mathematical formulas, numbers, units, and symbols untouched. Return a JSON object with a "translations" array of the exact same length (${texts.length}).\n\nInput strings:\n${JSON.stringify(texts)}`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              translations: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: ['translations'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim()) as {
        translations?: string[];
      };
      const result = texts.map((orig, i) => parsed.translations?.[i] || orig);
      res.json({ translations: result });
    } catch (err) {
      sendAiError(res, err);
    }
  });

  app.post('/api/ai/tutor', async (req: Request, res: Response) => {
    try {
      const {
        attemptStatus,
        questionText,
        options,
        correctOptionId,
        selectedOptionId,
        shortExplanation,
        stepByStepSolution,
        history = [],
        message,
      } = req.body as {
        attemptStatus?: string;
        questionText?: string;
        options?: Array<{ id: string; text: string }>;
        correctOptionId?: string;
        selectedOptionId?: string | null;
        shortExplanation?: string;
        stepByStepSolution?: string[];
        history?: Array<{ role: 'user' | 'model'; text: string }>;
        message?: string;
      };

      if (attemptStatus !== 'submitted' && attemptStatus !== 'auto_submitted_strike') {
        res.status(403).json({ error: 'AI Tutor is locked during an active exam.' });
        return;
      }

      if (!message?.trim() || !questionText?.trim()) {
        res.status(400).json({ error: 'Question context and student message are required.' });
        return;
      }

      const ai = getAiClient();
      const optionLines = (options || []).map((o) => `${o.id}) ${o.text}`).join('\n');
      const systemContext = `You are a patient, crystal-clear academic AI Tutor inside ExamPulse AI.
Help the student understand this specific exam question deeply:
Question: ${questionText}
Options:
${optionLines}
Correct Answer: ${correctOptionId}
Student's Selected Answer: ${selectedOptionId || 'Not Attempted'}
Short Explanation: ${shortExplanation || 'None'}
Step-by-Step Solution: ${(stepByStepSolution || []).join(' | ')}

Keep explanations concise, encouraging, and focused on why the correct answer works and why any misconception in the student's choice happens. Respond in clean plain prose or short numbered steps.`;

      const transcript = history
        .slice(-6)
        .map((h) => `${h.role === 'user' ? 'Student' : 'Tutor'}: ${h.text}`)
        .join('\n');

      const prompt = transcript
        ? `${transcript}\nStudent: ${message.trim()}`
        : `Student: ${message.trim()}`;

      const response = await callGeminiWithFallback(ai, {
        preferredModel: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          systemInstruction: systemContext,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      res.json({ reply: response.text || 'I could not generate an explanation right now.' });
    } catch (err) {
      sendAiError(res, err);
    }
  });

  if (!options?.skipStatic) {
    if (process.env.NODE_ENV !== 'production') {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } else {
      const distDir = path.resolve(process.cwd(), 'dist');
      app.use(express.static(distDir));
      app.get('*', (_req: Request, res: Response) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  return app;
}

if (!IS_VERCEL) {
  createApp()
    .then((app) => {
      app.listen(PORT, '0.0.0.0', () => {
        console.log(`ExamPulse AI server listening on http://0.0.0.0:${PORT}`);
      });
    })
    .catch((err) => {
      console.error('Failed to start server:', err);
      process.exit(1);
    });
}
