import type { OptionId, QuestionOption, TestQuestion } from '../types';

export interface GeneratedQuestionDraft {
  questionText: string;
  questionImageUrl?: string;
  options: Array<{ id: OptionId; text: string; imageUrl?: string }>;
  correctOptionId: OptionId;
  shortExplanation: string;
  stepByStepSolution: string[];
  marks?: number;
}

export interface UnlockedKeyRecord {
  questionId: string;
  testId: string;
  correctOptionId: OptionId;
  shortExplanation: string;
  solutionImageUrl?: string;
  stepByStepSolution: string[];
}

async function postJson<T>(url: string, body: unknown, bearerToken?: string): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (bearerToken) {
    headers.Authorization = `Bearer ${bearerToken}`;
  }
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data;
}

export async function fetchVerifiedServerRole(bearerToken: string): Promise<{
  uid: string;
  email: string;
  isMainAdmin: boolean;
  role: 'admin' | 'user';
  immutableMainAdmin: string;
}> {
  const res = await fetch('/api/auth/role', {
    headers: { Authorization: `Bearer ${bearerToken}` },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Role verification failed.');
  }
  return data;
}

export async function syncAdminAnswerKeys(
  bearerToken: string,
  testId: string,
  keys: Array<{
    questionId: string;
    correctOptionId: OptionId;
    shortExplanation: string;
    stepByStepSolution: string[];
    marks?: number;
  }>
): Promise<void> {
  await postJson('/api/admin/answer-keys/sync', { testId, keys }, bearerToken);
}

export async function deleteAdminAnswerKey(
  bearerToken: string,
  testId: string,
  questionId: string
): Promise<void> {
  await postJson('/api/admin/answer-keys/delete', { testId, questionId }, bearerToken);
}

export async function gradeExamOnServer(params: {
  testId: string;
  status: 'submitted' | 'auto_submitted_strike';
  responses: Record<string, { selectedOptionId: OptionId | null }>;
  questionsMeta: Array<{ questionId: string; marks: number }>;
  negativeMarking: boolean;
  negativeMarkValue: number;
}): Promise<{
  grading: {
    score: number;
    maxScore: number;
    accuracy: number;
    correctCount: number;
    wrongCount: number;
    unattemptedCount: number;
  };
  unlockedKeys: Record<string, UnlockedKeyRecord>;
}> {
  return postJson('/api/exam/grade', params);
}

export async function unlockSolutionsOnServer(
  testId: string,
  attemptStatus: string
): Promise<Record<string, UnlockedKeyRecord>> {
  const res = await postJson<{ unlockedKeys: Record<string, UnlockedKeyRecord> }>(
    '/api/exam/unlock-solutions',
    { testId, attemptStatus }
  );
  return res.unlockedKeys;
}

export async function uploadImageDataUrl(dataUrl: string, filename: string): Promise<string> {
  const result = await postJson<{ url: string }>('/api/upload-image', { dataUrl, filename });
  return result.url;
}

export async function generateQuestionsWithAI(params: {
  topicOrNotes: string;
  sectionName: string;
  count: number;
  difficulty: string;
  imageBase64?: string;
  imageMimeType?: string;
  attachImageAsQuestion?: boolean;
}): Promise<GeneratedQuestionDraft[]> {
  const result = await postJson<{ questions: GeneratedQuestionDraft[] }>(
    '/api/ai/generate-questions',
    params
  );
  return result.questions;
}

export async function generateSolutionWithAI(params: {
  questionText?: string;
  questionImageUrl?: string;
  options?: QuestionOption[];
  correctOptionId?: OptionId;
  mode?: 'complete_all' | 'solution_only';
}): Promise<{
  questionText: string;
  options: Array<{ id: OptionId; text: string }>;
  correctOptionId: OptionId;
  shortExplanation: string;
  stepByStepSolution: string[];
}> {
  return postJson('/api/ai/generate-solution', params);
}

export async function generateDiagramWithAI(params: {
  prompt: string;
  topic?: string;
}): Promise<{ svg: string; dataUrl: string }> {
  return postJson('/api/ai/generate-diagram', params);
}

export async function importQuestionsFromJson(params: {
  jsonTextOrData: string;
  sectionName: string;
  mode: 'parse_only' | 'complete_with_gemini';
  count?: number;
}): Promise<{
  questions: GeneratedQuestionDraft[];
  incompleteCount: number;
  parsedAsArray: boolean;
}> {
  return postJson('/api/ai/import-json', params);
}

export async function translateTextsWithAI(
  texts: string[],
  targetLanguage: string
): Promise<string[]> {
  const result = await postJson<{ translations: string[] }>('/api/ai/translate', {
    texts,
    targetLanguage,
  });
  return result.translations;
}

export async function askAiTutor(params: {
  attemptStatus: string;
  questionText: string;
  options: QuestionOption[];
  correctOptionId: OptionId;
  selectedOptionId?: OptionId | null;
  shortExplanation: string;
  stepByStepSolution: string[];
  history: Array<{ role: 'user' | 'model'; text: string }>;
  message: string;
}): Promise<string> {
  const result = await postJson<{ reply: string }>('/api/ai/tutor', params);
  return result.reply;
}

export async function saveQuestionViaAdminServer(
  bearerToken: string,
  testId: string,
  question: TestQuestion,
  options?: unknown
): Promise<TestQuestion> {
  const result = await postJson<{ ok: boolean; question: TestQuestion }>(
    '/api/admin/save-question',
    { testId, question, options },
    bearerToken
  );
  return result.question;
}

export async function deleteQuestionViaAdminServer(
  bearerToken: string,
  testId: string,
  questionId: string
): Promise<void> {
  await postJson('/api/admin/delete-question', { testId, questionId }, bearerToken);
}

