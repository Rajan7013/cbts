import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  auth,
  BOOTSTRAPPED_ADMIN_EMAIL,
  db,
  handleFirestoreError,
  OperationType,
} from './firebase';
import {
  deleteAdminAnswerKey,
  deleteQuestionViaAdminServer,
  fetchVerifiedServerRole,
  gradeExamOnServer,
  saveQuestionViaAdminServer,
  syncAdminAnswerKeys,
  unlockSolutionsOnServer,
} from './api';
import { buildSampleTests } from './seedData';
import type {
  OptionId,
  QuestionVersion,
  QuestionVersionSource,
  SanitizedQuestion,
  TestAttempt,
  TestExam,
  TestQuestion,
  UserProfile,
} from '../types';

export interface SaveQuestionOptions {
  versionSource?: QuestionVersionSource;
  versionSummary?: string;
  recordVersion?: boolean;
}

const DEMO_STORAGE_KEY = 'exampulse_demo_state_v2';

interface DemoStore {
  tests: TestExam[];
  questionsByTest: Record<string, SanitizedQuestion[]>;
  attempts: TestAttempt[];
}

export function generateId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  const ts = Date.now().toString(36);
  return `${prefix}_${ts}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function stripAnswerFields(q: TestQuestion | SanitizedQuestion): SanitizedQuestion {
  return {
    questionId: q.questionId,
    testId: q.testId,
    testStatus: q.testStatus,
    sectionId: q.sectionId,
    orderIndex: q.orderIndex,
    questionText: q.questionText,
    ...(q.questionImageUrl ? { questionImageUrl: q.questionImageUrl } : {}),
    options: q.options,
    marks: q.marks,
  };
}

function getDemoStore(): DemoStore {
  try {
    const raw = localStorage.getItem(DEMO_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DemoStore;
      if (Array.isArray(parsed.tests) && parsed.questionsByTest && Array.isArray(parsed.attempts)) {
        return parsed;
      }
    }
  } catch {
    // Fall back to fresh seed
  }
  const seeded = buildSampleTests('demo_admin_uid');
  const sanitizedMap: Record<string, SanitizedQuestion[]> = {};
  for (const [tid, qs] of Object.entries(seeded.questionsByTest)) {
    sanitizedMap[tid] = qs.map(stripAnswerFields);
  }
  const initial: DemoStore = {
    tests: seeded.tests,
    questionsByTest: sanitizedMap,
    attempts: seeded.sampleAttempts,
  };
  saveDemoStore(initial);
  return initial;
}

function saveDemoStore(store: DemoStore): void {
  try {
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage quota errors
  }
}

function tsToIso(val: unknown): string {
  if (val && typeof val === 'object' && 'toDate' in val && typeof (val as Timestamp).toDate === 'function') {
    return (val as Timestamp).toDate().toISOString();
  }
  if (typeof val === 'string') return val;
  return new Date().toISOString();
}

async function getIdTokenOrThrow(): Promise<string> {
  const cur = auth.currentUser;
  if (!cur) throw new Error('Authentication required.');
  return cur.getIdToken();
}

export async function syncFirebaseUserProfile(firebaseUser: {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  getIdToken: () => Promise<string>;
}): Promise<UserProfile> {
  const userPath = `users/${firebaseUser.uid}`;
  const name = (firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Candidate').slice(0, 120);
  const email = (firebaseUser.email || 'unknown@example.com').slice(0, 200);
  const photoUrl = firebaseUser.photoURL ? firebaseUser.photoURL.slice(0, 500) : undefined;

  try {
    const userRef = doc(db, 'users', firebaseUser.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      const payload: Record<string, unknown> = {
        uid: firebaseUser.uid,
        name,
        email,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (photoUrl) payload.photoUrl = photoUrl;
      await setDoc(userRef, payload);
    } else {
      const payload: Record<string, unknown> = {
        name,
        email,
        updatedAt: serverTimestamp(),
      };
      if (photoUrl) payload.photoUrl = photoUrl;
      await updateDoc(userRef, payload);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, userPath);
  }

  // Server-verified role check (rajanprasaila@gmail.com is immutable main admin)
  let role: 'admin' | 'user' =
    email === BOOTSTRAPPED_ADMIN_EMAIL && firebaseUser.emailVerified ? 'admin' : 'user';
  let isMainAdmin = email === BOOTSTRAPPED_ADMIN_EMAIL && firebaseUser.emailVerified;

  try {
    const token = await firebaseUser.getIdToken();
    const serverRole = await fetchVerifiedServerRole(token);
    role = serverRole.role;
    isMainAdmin = serverRole.isMainAdmin;
  } catch {
    if (!isMainAdmin) {
      try {
        const adminSnap = await getDoc(doc(db, 'admins', firebaseUser.uid));
        if (adminSnap.exists()) role = 'admin';
      } catch {
        // Not an admin
      }
    }
  }

  return {
    uid: firebaseUser.uid,
    name,
    email,
    photoUrl,
    role,
    isMainAdmin,
    isDemo: false,
  };
}

export async function listTests(user: UserProfile, isAdminMode: boolean): Promise<TestExam[]> {
  if (user.isDemo) {
    const store = getDemoStore();
    return store.tests
      .filter((t) => t.status === 'published')
      .map((t) => ({
        ...t,
        questionCountAdded: (store.questionsByTest[t.testId] || []).length,
      }));
  }

  const testsPath = 'tests';
  try {
    const testsRef = collection(db, testsPath);
    const q =
      isAdminMode && user.role === 'admin'
        ? query(testsRef, orderBy('createdAt', 'desc'))
        : query(testsRef, where('status', '==', 'published'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      return {
        testId: String(data.testId || d.id),
        title: String(data.title || ''),
        description: String(data.description || ''),
        createdBy: String(data.createdBy || ''),
        startTime: String(data.startTime || ''),
        endTime: String(data.endTime || ''),
        durationMins: Number(data.durationMins || 30),
        totalQuestions: Number(data.totalQuestions || 0),
        passPercentage: Number(data.passPercentage || 50),
        marksPerQuestion: Number(data.marksPerQuestion ?? 4),
        negativeMarking: Boolean(data.negativeMarking),
        negativeMarkValue: Number(data.negativeMarkValue ?? 0),
        maxStrikes: Number(data.maxStrikes ?? 3),
        enforceFullscreen: Boolean(data.enforceFullscreen),
        detectTabSwitch: Boolean(data.detectTabSwitch),
        proctoringAIEnabled: Boolean(data.proctoringAIEnabled),
        status: data.status === 'published' ? 'published' : 'draft',
        sections: Array.isArray(data.sections) ? (data.sections as TestExam['sections']) : [],
      };
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, testsPath);
  }
}

export async function saveTest(user: UserProfile, test: TestExam): Promise<TestExam> {
  if (user.isDemo || user.role !== 'admin') {
    throw new Error(`Unauthorized. Only ${BOOTSTRAPPED_ADMIN_EMAIL} or authorized admins can modify tests.`);
  }

  const testPath = `tests/${test.testId}`;
  try {
    const testRef = doc(db, 'tests', test.testId);
    const existingSnap = await getDoc(testRef);
    const sanitizedSections = test.sections.slice(0, 20).map((s) => ({
      id: s.id.slice(0, 64),
      name: s.name.slice(0, 100),
      questionCount: Number(s.questionCount) || 0,
    }));

    if (!existingSnap.exists()) {
      await setDoc(testRef, {
        testId: test.testId,
        title: test.title.slice(0, 160),
        description: test.description.slice(0, 1000),
        createdBy: user.uid,
        startTime: test.startTime.slice(0, 40),
        endTime: test.endTime.slice(0, 40),
        durationMins: Math.min(Math.max(Number(test.durationMins) || 20, 1), 600),
        totalQuestions: Math.min(Math.max(Number(test.totalQuestions) || 1, 1), 300),
        passPercentage: Math.min(Math.max(Number(test.passPercentage) || 0, 0), 100),
        marksPerQuestion: Math.min(Math.max(Number(test.marksPerQuestion) || 4, 0.25), 100),
        negativeMarking: Boolean(test.negativeMarking),
        negativeMarkValue: Math.min(Math.max(Number(test.negativeMarkValue) || 0, 0), 100),
        maxStrikes: Math.min(Math.max(Number(test.maxStrikes) || 0, 0), 20),
        enforceFullscreen: Boolean(test.enforceFullscreen),
        detectTabSwitch: Boolean(test.detectTabSwitch),
        proctoringAIEnabled: Boolean(test.proctoringAIEnabled),
        status: test.status,
        sections: sanitizedSections,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const prevStatus = existingSnap.data()?.status;
      await updateDoc(testRef, {
        title: test.title.slice(0, 160),
        description: test.description.slice(0, 1000),
        startTime: test.startTime.slice(0, 40),
        endTime: test.endTime.slice(0, 40),
        durationMins: Math.min(Math.max(Number(test.durationMins) || 20, 1), 600),
        totalQuestions: Math.min(Math.max(Number(test.totalQuestions) || 1, 1), 300),
        passPercentage: Math.min(Math.max(Number(test.passPercentage) || 0, 0), 100),
        marksPerQuestion: Math.min(Math.max(Number(test.marksPerQuestion) || 4, 0.25), 100),
        negativeMarking: Boolean(test.negativeMarking),
        negativeMarkValue: Math.min(Math.max(Number(test.negativeMarkValue) || 0, 0), 100),
        maxStrikes: Math.min(Math.max(Number(test.maxStrikes) || 0, 0), 20),
        enforceFullscreen: Boolean(test.enforceFullscreen),
        detectTabSwitch: Boolean(test.detectTabSwitch),
        proctoringAIEnabled: Boolean(test.proctoringAIEnabled),
        status: test.status,
        sections: sanitizedSections,
        updatedAt: serverTimestamp(),
      });

      if (prevStatus !== test.status) {
        const qSnap = await getDocs(collection(db, 'tests', test.testId, 'questions'));
        if (!qSnap.empty) {
          const batch = writeBatch(db);
          qSnap.docs.forEach((qd) => {
            batch.update(qd.ref, { testStatus: test.status, updatedAt: serverTimestamp() });
          });
          await batch.commit();
        }
      }
    }
    return test;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, testPath);
  }
}

export async function deleteTest(user: UserProfile, testId: string): Promise<void> {
  if (user.isDemo || user.role !== 'admin') {
    throw new Error('Unauthorized.');
  }

  const testPath = `tests/${testId}`;
  try {
    const [qSnap, kSnap] = await Promise.all([
      getDocs(collection(db, 'tests', testId, 'questions')),
      getDocs(collection(db, 'tests', testId, 'answerKeys')),
    ]);
    const versionSnaps = await Promise.all(
      qSnap.docs.map((qd) =>
        getDocs(collection(db, 'tests', testId, 'questions', qd.id, 'versions'))
      )
    );
    const batch = writeBatch(db);
    versionSnaps.forEach((vs) => vs.docs.forEach((vd) => batch.delete(vd.ref)));
    qSnap.docs.forEach((qd) => batch.delete(qd.ref));
    kSnap.docs.forEach((kd) => batch.delete(kd.ref));
    batch.delete(doc(db, 'tests', testId));
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, testPath);
  }
}

/**
 * Fetches ONLY sanitized question stems & options for candidates during a live exam.
 * Answer keys and solutions are never present in these documents.
 */
export async function listSanitizedQuestions(
  user: UserProfile,
  testId: string
): Promise<SanitizedQuestion[]> {
  if (user.isDemo) {
    const store = getDemoStore();
    return [...(store.questionsByTest[testId] || [])]
      .map(stripAnswerFields)
      .sort((a, b) => a.orderIndex - b.orderIndex);
  }

  const qPath = `tests/${testId}/questions`;
  try {
    const snap = await getDocs(
      query(collection(db, 'tests', testId, 'questions'), where('testStatus', '==', 'published'))
    );
    return snap.docs
      .map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          questionId: String(data.questionId || d.id),
          testId: String(data.testId || testId),
          testStatus: 'published' as const,
          sectionId: String(data.sectionId || ''),
          orderIndex: Number(data.orderIndex || 0),
          questionText: String(data.questionText || ''),
          questionImageUrl: data.questionImageUrl ? String(data.questionImageUrl) : undefined,
          options: Array.isArray(data.options) ? (data.options as SanitizedQuestion['options']) : [],
          marks: Number(data.marks ?? 4),
        };
      })
      .sort((a, b) => a.orderIndex - b.orderIndex);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, qPath);
  }
}

/**
 * Admin-only question + answerKey loader.
 */
export async function listQuestionsAdmin(
  user: UserProfile,
  testId: string
): Promise<TestQuestion[]> {
  if (user.isDemo || user.role !== 'admin') {
    throw new Error('Unauthorized.');
  }

  const qPath = `tests/${testId}/questions`;
  try {
    const [qSnap, kSnap] = await Promise.all([
      getDocs(collection(db, 'tests', testId, 'questions')),
      getDocs(collection(db, 'tests', testId, 'answerKeys')),
    ]);

    const keyMap: Record<string, Record<string, unknown>> = {};
    kSnap.docs.forEach((kd) => {
      keyMap[kd.id] = kd.data() as Record<string, unknown>;
    });

    const merged: TestQuestion[] = qSnap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      const qId = String(data.questionId || d.id);
      const key = keyMap[qId] || {};
      const qText = String(data.questionText || data.stem || '');
      const qImg = data.questionImageUrl ? String(data.questionImageUrl) : data.imageUrl ? String(data.imageUrl) : undefined;
      const qShort = String(key.shortExplanation ?? data.shortExplanation ?? '');
      const qSolImg = key.solutionImageUrl ? String(key.solutionImageUrl) : undefined;
      const qSteps = Array.isArray(key.stepByStepSolution)
        ? (key.stepByStepSolution as string[])
        : Array.isArray(data.stepByStepSolution)
        ? (data.stepByStepSolution as string[])
        : [];
      return {
        questionId: qId,
        testId: String(data.testId || testId),
        testStatus: data.testStatus === 'published' ? 'published' : 'draft',
        sectionId: String(data.sectionId || ''),
        orderIndex: Number(data.orderIndex ?? data.order ?? 0),
        questionText: qText,
        questionImageUrl: qImg,
        options: Array.isArray(data.options) ? (data.options as TestQuestion['options']) : [],
        marks: Number(data.marks ?? 4),
        correctOptionId:
          (key.correctOptionId as TestQuestion['correctOptionId']) ||
          (data.correctOptionId as TestQuestion['correctOptionId']) ||
          'A',
        shortExplanation: qShort,
        solutionImageUrl: qSolImg,
        stepByStepSolution: qSteps,
        stem: qText,
        imageUrl: qImg,
        order: Number(data.orderIndex ?? data.order ?? 0),
        solution: {
          shortExplanation: qShort,
          imageUrl: qSolImg,
          steps: qSteps,
        },
      };
    });

    // Keep server vault synced when admin loads test studio
    const token = await getIdTokenOrThrow();
    await syncAdminAnswerKeys(
      token,
      testId,
      merged.map((m) => ({
        questionId: m.questionId,
        correctOptionId: m.correctOptionId,
        shortExplanation: m.shortExplanation,
        stepByStepSolution: m.stepByStepSolution,
        marks: m.marks,
      }))
    ).catch(() => {});

    return merged.sort((a, b) => a.orderIndex - b.orderIndex);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, qPath);
  }
}

function normalizeFourOptions(options: TestQuestion['options']) {
  const ids: OptionId[] = ['A', 'B', 'C', 'D'];
  return ids.map((id, idx) => {
    const found = options.find((o) => o.id === id) || options[idx];
    const opt: Record<string, string> = {
      id,
      text: ((found?.text || '') || (found?.imageUrl ? `Option ${id}` : `Option ${id}`)).slice(0, 600),
    };
    if (found?.imageUrl?.trim()) {
      opt.imageUrl = found.imageUrl.trim().slice(0, 800000);
    }
    return opt;
  });
}

export async function recordQuestionVersion(
  user: UserProfile,
  question: TestQuestion,
  source: QuestionVersionSource,
  summary: string
): Promise<QuestionVersion> {
  if (user.isDemo || user.role !== 'admin') {
    throw new Error('Unauthorized.');
  }

  const versionId = generateId('ver');
  const vPath = `tests/${question.testId}/questions/${question.questionId}/versions/${versionId}`;
  const cleanOptions = normalizeFourOptions(question.options);
  const rawText = String(question.questionText || question.stem || '');
  const rawImg = String(question.questionImageUrl || question.imageUrl || '');
  const safeQuestionText = (
    rawText.trim() ||
    (rawImg.trim() ? 'Refer to the diagram below.' : 'Question')
  ).slice(0, 10000);
  const safeSectionId = (question.sectionId || 'default').slice(0, 128);
  const safeSummary = (summary.trim() || 'Saved revision').slice(0, 200);
  const safeShort = String(question.shortExplanation || question.solution?.shortExplanation || '').slice(0, 5000);
  const rawSteps = question.stepByStepSolution || question.solution?.steps || [];
  const safeSteps = (Array.isArray(rawSteps) ? rawSteps : [])
    .slice(0, 50)
    .map((s) => String(s).slice(0, 2000));
  const safeMarks = Math.min(Math.max(Number(question.marks) || 4, 0.25), 100);
  const safeCorrect: OptionId = ['A', 'B', 'C', 'D'].includes(question.correctOptionId)
    ? question.correctOptionId
    : 'A';

  try {
    const payload: Record<string, unknown> = {
      versionId,
      questionId: question.questionId,
      testId: question.testId,
      sectionId: safeSectionId,
      source,
      summary: safeSummary,
      questionText: safeQuestionText,
      options: cleanOptions,
      correctOptionId: safeCorrect,
      shortExplanation: safeShort,
      stepByStepSolution: safeSteps,
      marks: safeMarks,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
    };
    if (rawImg.trim()) {
      payload.questionImageUrl = rawImg.trim().slice(0, 800000);
    }
    const rawSolutionImg = String(question.solutionImageUrl || question.solution?.imageUrl || '');
    if (rawSolutionImg.trim()) {
      payload.solutionImageUrl = rawSolutionImg.trim().slice(0, 800000);
    }

    await setDoc(
      doc(db, 'tests', question.testId, 'questions', question.questionId, 'versions', versionId),
      payload
    );

    return {
      versionId,
      questionId: question.questionId,
      testId: question.testId,
      sectionId: safeSectionId,
      source,
      summary: safeSummary,
      questionText: safeQuestionText,
      solutionImageUrl: rawSolutionImg.trim() || undefined,
      ...(question.questionImageUrl?.trim()
        ? { questionImageUrl: question.questionImageUrl.trim().slice(0, 800000) }
        : {}),
      options: cleanOptions.map((o) => ({
        id: o.id as OptionId,
        text: o.text,
        ...(o.imageUrl ? { imageUrl: o.imageUrl } : {}),
      })),
      correctOptionId: safeCorrect,
      shortExplanation: safeShort,
      stepByStepSolution: safeSteps,
      marks: safeMarks,
      createdAtIso: new Date().toISOString(),
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, vPath);
  }
}

export async function listQuestionVersions(
  user: UserProfile,
  testId: string,
  questionId: string
): Promise<QuestionVersion[]> {
  if (user.isDemo || user.role !== 'admin') {
    throw new Error('Unauthorized.');
  }

  const vPath = `tests/${testId}/questions/${questionId}/versions`;
  try {
    const snap = await getDocs(
      query(
        collection(db, 'tests', testId, 'questions', questionId, 'versions'),
        orderBy('createdAt', 'desc')
      )
    );
    return snap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      return {
        versionId: String(data.versionId || d.id),
        questionId: String(data.questionId || questionId),
        testId: String(data.testId || testId),
        sectionId: String(data.sectionId || 'default'),
        source: (data.source as QuestionVersionSource) || 'manual_save',
        summary: String(data.summary || 'Saved revision'),
        questionText: String(data.questionText || ''),
        questionImageUrl: data.questionImageUrl ? String(data.questionImageUrl) : undefined,
        options: Array.isArray(data.options) ? (data.options as TestQuestion['options']) : [],
        correctOptionId: ['A', 'B', 'C', 'D'].includes(String(data.correctOptionId))
          ? (String(data.correctOptionId) as OptionId)
          : 'A',
        shortExplanation: String(data.shortExplanation || ''),
        stepByStepSolution: Array.isArray(data.stepByStepSolution)
          ? (data.stepByStepSolution as string[])
          : [],
        marks: Number(data.marks ?? 4),
        createdAtIso: tsToIso(data.createdAt),
      };
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, vPath);
  }
}

export async function saveQuestion(
  user: UserProfile,
  question: TestQuestion,
  options?: SaveQuestionOptions
): Promise<TestQuestion> {
  if (user.isDemo || user.role !== 'admin') {
    throw new Error('Unauthorized.');
  }

  const qPath = `tests/${question.testId}/questions/${question.questionId}`;
  try {
    const qRef = doc(db, 'tests', question.testId, 'questions', question.questionId);
    const kRef = doc(db, 'tests', question.testId, 'answerKeys', question.questionId);
    const [existingSnap, existingKeySnap, versionsSnap] = await Promise.all([
      getDoc(qRef),
      getDoc(kRef),
      getDocs(collection(db, 'tests', question.testId, 'questions', question.questionId, 'versions')),
    ]);

    const shouldRecordVersion = options?.recordVersion !== false;

    // Backfill initial snapshot for pre-existing questions updated for the first time
    if (shouldRecordVersion && existingSnap.exists() && versionsSnap.empty) {
      const prevQData = existingSnap.data() as Record<string, unknown>;
      const prevKData = (existingKeySnap.exists() ? existingKeySnap.data() : {}) as Record<string, unknown>;
      const prevQuestion: TestQuestion = {
        questionId: question.questionId,
        testId: question.testId,
        testStatus: prevQData.testStatus === 'published' ? 'published' : 'draft',
        sectionId: String(prevQData.sectionId || question.sectionId || 'default'),
        orderIndex: Number(prevQData.orderIndex || 0),
        questionText: String(prevQData.questionText || 'Question'),
        ...(prevQData.questionImageUrl ? { questionImageUrl: String(prevQData.questionImageUrl) } : {}),
        options: Array.isArray(prevQData.options)
          ? (prevQData.options as TestQuestion['options'])
          : question.options,
        marks: Number(prevQData.marks ?? question.marks ?? 4),
        correctOptionId: ['A', 'B', 'C', 'D'].includes(String(prevKData.correctOptionId))
          ? (String(prevKData.correctOptionId) as OptionId)
          : 'A',
        shortExplanation: String(prevKData.shortExplanation || ''),
        stepByStepSolution: Array.isArray(prevKData.stepByStepSolution)
          ? (prevKData.stepByStepSolution as string[])
          : [],
      };
      await recordQuestionVersion(user, prevQuestion, 'initial', 'Original saved version');
    }

    const cleanOptions = question.options.slice(0, 4).map((o) => {
      const opt: Record<string, string> = {
        id: o.id,
        text: (o.text || '').slice(0, 1000),
      };
      if (o.imageUrl) opt.imageUrl = o.imageUrl.slice(0, 800000);
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
      .map((s) => String(s).slice(0, 2000));

    // Sanitized question payload — ZERO answers or solutions stored here
    const sanitizedPayload: Record<string, unknown> = {
      testStatus: question.testStatus || 'draft',
      sectionId: String(question.sectionId || 'default').slice(0, 128),
      orderIndex: Number(question.orderIndex ?? question.order ?? 0) || 0,
      questionText: safeQuestionText.slice(0, 10000),
      options: cleanOptions,
      marks: Math.min(Math.max(Number(question.marks) || 4, 0.25), 100),
      updatedAt: serverTimestamp(),
    };
    if (rawQuestionImageUrl.trim()) {
      sanitizedPayload.questionImageUrl = rawQuestionImageUrl.trim().slice(0, 800000);
    } else if (existingSnap.exists() && existingSnap.data()?.questionImageUrl) {
      sanitizedPayload.questionImageUrl = deleteField();
    }

    if (!existingSnap.exists()) {
      await setDoc(qRef, {
        ...sanitizedPayload,
        questionId: question.questionId,
        testId: question.testId,
        createdAt: serverTimestamp(),
      });
    } else {
      await updateDoc(qRef, sanitizedPayload);
    }

    // Protected answerKey document (readable ONLY by admins in firestore.rules)
    const rawSolutionImg = String(question.solutionImageUrl || question.solution?.imageUrl || '');
    const answerKeyPayload: Record<string, unknown> = {
      questionId: question.questionId,
      testId: question.testId,
      correctOptionId: question.correctOptionId || 'A',
      shortExplanation: safeShortExplanation,
      stepByStepSolution: safeSteps,
      updatedAt: serverTimestamp(),
    };
    if (rawSolutionImg.trim()) {
      answerKeyPayload.solutionImageUrl = rawSolutionImg.trim().slice(0, 800000);
    }
    await setDoc(kRef, answerKeyPayload);

    // Record new version snapshot
    if (shouldRecordVersion) {
      const vSource: QuestionVersionSource =
        options?.versionSource || (existingSnap.exists() ? 'manual_save' : 'initial');
      const vSummary =
        options?.versionSummary ||
        (existingSnap.exists() ? 'Saved question update' : 'Initial saved version');
      await recordQuestionVersion(user, question, vSource, vSummary).catch(() => {});
    }

    // Sync to server-side vault for leak-proof grading
    const token = await getIdTokenOrThrow();
    await syncAdminAnswerKeys(token, question.testId, [
      {
        questionId: question.questionId,
        correctOptionId: question.correctOptionId || 'A',
        shortExplanation: safeShortExplanation,
        solutionImageUrl: rawSolutionImg.trim() || undefined,
        stepByStepSolution: safeSteps,
        marks: question.marks,
      },
    ]);

    return {
      ...question,
      questionText: safeQuestionText,
      questionImageUrl: rawQuestionImageUrl.trim() || undefined,
      shortExplanation: safeShortExplanation,
      stepByStepSolution: safeSteps,
      stem: safeQuestionText,
      imageUrl: rawQuestionImageUrl.trim() || undefined,
      solution: {
        shortExplanation: safeShortExplanation,
        steps: safeSteps,
      },
    };
  } catch (err) {
    console.warn('[saveQuestion] Client-side save failed, attempting admin API fallback:', err);
    try {
      const token = await getIdTokenOrThrow();
      const saved = await saveQuestionViaAdminServer(token, question.testId, question, options);
      return saved;
    } catch (fallbackErr) {
      console.error('[saveQuestion] Admin API fallback also failed:', fallbackErr);
      handleFirestoreError(err, OperationType.WRITE, qPath);
    }
  }
}

export async function deleteQuestion(
  user: UserProfile,
  testId: string,
  questionId: string
): Promise<void> {
  if (user.isDemo || user.role !== 'admin') {
    throw new Error('Unauthorized.');
  }

  const qPath = `tests/${testId}/questions/${questionId}`;
  try {
    const vSnap = await getDocs(
      collection(db, 'tests', testId, 'questions', questionId, 'versions')
    );
    const batch = writeBatch(db);
    vSnap.docs.forEach((vd) => batch.delete(vd.ref));
    batch.delete(doc(db, 'tests', testId, 'questions', questionId));
    batch.delete(doc(db, 'tests', testId, 'answerKeys', questionId));
    await batch.commit();

    const token = await getIdTokenOrThrow();
    await deleteAdminAnswerKey(token, testId, questionId).catch(() => {});
  } catch (err) {
    console.warn('[deleteQuestion] Client-side delete failed, attempting admin API fallback:', err);
    try {
      const token = await getIdTokenOrThrow();
      await deleteQuestionViaAdminServer(token, testId, questionId);
    } catch (fallbackErr) {
      console.error('[deleteQuestion] Admin API fallback also failed:', fallbackErr);
      handleFirestoreError(err, OperationType.DELETE, qPath);
    }
  }
}

export async function applyMarksToAllQuestions(
  user: UserProfile,
  testId: string,
  marks: number
): Promise<void> {
  if (user.isDemo || user.role !== 'admin') {
    throw new Error('Unauthorized.');
  }

  const safeMarks = Math.min(Math.max(Number(marks) || 4, 0.25), 100);
  const qPath = `tests/${testId}/questions`;
  try {
    const [qSnap, kSnap] = await Promise.all([
      getDocs(collection(db, 'tests', testId, 'questions')),
      getDocs(collection(db, 'tests', testId, 'answerKeys')),
    ]);

    if (!qSnap.empty) {
      const batch = writeBatch(db);
      qSnap.docs.forEach((qd) => {
        batch.update(qd.ref, { marks: safeMarks, updatedAt: serverTimestamp() });
      });
      await batch.commit();
    }

    const keyMap: Record<string, Record<string, unknown>> = {};
    kSnap.docs.forEach((kd) => {
      keyMap[kd.id] = kd.data() as Record<string, unknown>;
    });

    const token = await getIdTokenOrThrow();
    await syncAdminAnswerKeys(
      token,
      testId,
      qSnap.docs.map((qd) => {
        const key = keyMap[qd.id] || {};
        return {
          questionId: qd.id,
          correctOptionId: (key.correctOptionId as TestQuestion['correctOptionId']) || 'A',
          shortExplanation: String(key.shortExplanation ?? ''),
          stepByStepSolution: Array.isArray(key.stepByStepSolution)
            ? (key.stepByStepSolution as string[])
            : [],
          marks: safeMarks,
        };
      })
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, qPath);
  }
}

export async function seedSampleTestsToFirestore(user: UserProfile): Promise<void> {
  if (user.isDemo || user.role !== 'admin') {
    throw new Error('Only authorized admins can seed Firestore tests.');
  }
  const { tests, questionsByTest } = buildSampleTests(user.uid);
  for (const t of tests) {
    await saveTest(user, { ...t, createdBy: user.uid });
    const qs = questionsByTest[t.testId] || [];
    for (const q of qs) {
      await saveQuestion(user, q);
    }
  }
}

function mapDocToAttempt(id: string, data: Record<string, unknown>): TestAttempt {
  return {
    attemptId: String(data.attemptId || id),
    testId: String(data.testId || ''),
    testTitle: String(data.testTitle || ''),
    userId: String(data.userId || ''),
    userName: String(data.userName || ''),
    userEmail: String(data.userEmail || ''),
    status: (data.status as TestAttempt['status']) || 'in_progress',
    startedAtIso: tsToIso(data.startedAt),
    lastActiveAtIso: tsToIso(data.lastActiveAt),
    submittedAtIso: data.submittedAt ? tsToIso(data.submittedAt) : undefined,
    remainingSeconds: Number(data.remainingSeconds || 0),
    currentQuestionIndex: Number(data.currentQuestionIndex || 0),
    currentSectionId: String(data.currentSectionId || ''),
    strikeCount: Number(data.strikeCount || 0),
    strikes: Array.isArray(data.strikes) ? (data.strikes as TestAttempt['strikes']) : [],
    responses:
      data.responses && typeof data.responses === 'object'
        ? (data.responses as TestAttempt['responses'])
        : {},
    score: Number(data.score || 0),
    maxScore: Number(data.maxScore || 0),
    accuracy: Number(data.accuracy || 0),
    correctCount: Number(data.correctCount || 0),
    wrongCount: Number(data.wrongCount || 0),
    unattemptedCount: Number(data.unattemptedCount || 0),
    timeTakenSeconds: Number(data.timeTakenSeconds || 0),
  };
}

export async function listUserAttempts(user: UserProfile): Promise<TestAttempt[]> {
  if (user.isDemo) {
    const store = getDemoStore();
    return store.attempts.filter((a) => a.userId === user.uid);
  }

  const attemptsPath = 'attempts';
  try {
    const snap = await getDocs(
      query(collection(db, attemptsPath), where('userId', '==', user.uid))
    );
    return snap.docs.map((d) => mapDocToAttempt(d.id, d.data() as Record<string, unknown>));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, attemptsPath);
  }
}

export async function listAllAttemptsForTest(
  user: UserProfile,
  testId: string
): Promise<TestAttempt[]> {
  if (user.isDemo || user.role !== 'admin') {
    throw new Error('Unauthorized.');
  }

  const attemptsPath = 'attempts';
  try {
    const snap = await getDocs(
      query(collection(db, attemptsPath), where('testId', '==', testId))
    );
    return snap.docs.map((d) => mapDocToAttempt(d.id, d.data() as Record<string, unknown>));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, attemptsPath);
  }
}

export async function createAttempt(
  user: UserProfile,
  test: TestExam
): Promise<TestAttempt> {
  const attemptId = generateId('att');
  const nowIso = new Date().toISOString();
  const initialSectionId = test.sections[0]?.id || 'default';
  const totalSeconds = Math.max(1, test.durationMins) * 60;

  const attempt: TestAttempt = {
    attemptId,
    testId: test.testId,
    testTitle: test.title.slice(0, 160),
    userId: user.uid,
    userName: user.name.slice(0, 120),
    userEmail: user.email.slice(0, 200),
    status: 'in_progress',
    startedAtIso: nowIso,
    lastActiveAtIso: nowIso,
    remainingSeconds: totalSeconds,
    currentQuestionIndex: 0,
    currentSectionId: initialSectionId,
    strikeCount: 0,
    strikes: [],
    responses: {},
    score: 0,
    maxScore: 0,
    accuracy: 0,
    correctCount: 0,
    wrongCount: 0,
    unattemptedCount: test.totalQuestions,
    timeTakenSeconds: 0,
  };

  if (user.isDemo) {
    const store = getDemoStore();
    store.attempts.unshift(attempt);
    saveDemoStore(store);
    return attempt;
  }

  const path = `attempts/${attemptId}`;
  try {
    await setDoc(doc(db, 'attempts', attemptId), {
      attemptId,
      testId: attempt.testId,
      testTitle: attempt.testTitle,
      userId: user.uid,
      userName: attempt.userName,
      userEmail: attempt.userEmail,
      status: 'in_progress',
      startedAt: serverTimestamp(),
      lastActiveAt: serverTimestamp(),
      remainingSeconds: attempt.remainingSeconds,
      currentQuestionIndex: 0,
      currentSectionId: initialSectionId,
      strikeCount: 0,
      strikes: [],
      responses: {},
      score: 0,
      maxScore: 0,
      accuracy: 0,
      correctCount: 0,
      wrongCount: 0,
      unattemptedCount: attempt.unattemptedCount,
      timeTakenSeconds: 0,
    });
    return attempt;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function syncAttemptProgress(
  user: UserProfile,
  attempt: TestAttempt
): Promise<void> {
  if (user.isDemo) {
    const store = getDemoStore();
    const idx = store.attempts.findIndex((a) => a.attemptId === attempt.attemptId);
    const updated = { ...attempt, lastActiveAtIso: new Date().toISOString() };
    if (idx >= 0) store.attempts[idx] = updated;
    else store.attempts.unshift(updated);
    saveDemoStore(store);
    return;
  }

  const path = `attempts/${attempt.attemptId}`;
  try {
    await updateDoc(doc(db, 'attempts', attempt.attemptId), {
      lastActiveAt: serverTimestamp(),
      remainingSeconds: Math.max(0, Math.round(attempt.remainingSeconds)),
      currentQuestionIndex: Math.max(0, attempt.currentQuestionIndex),
      currentSectionId: attempt.currentSectionId.slice(0, 128),
      strikeCount: attempt.strikeCount,
      strikes: attempt.strikes.slice(0, 50),
      responses: attempt.responses,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

/**
 * Server-verified grading & answer unlocking upon submission.
 */
export async function finalizeAttempt(
  user: UserProfile,
  test: TestExam,
  questions: SanitizedQuestion[],
  attempt: TestAttempt,
  status: 'submitted' | 'auto_submitted_strike'
): Promise<{ attempt: TestAttempt; unlockedQuestions: TestQuestion[] }> {
  let grading = {
    score: 0,
    maxScore: questions.reduce((sum, q) => sum + (Number(q.marks) || 4), 0),
    accuracy: 0,
    correctCount: 0,
    wrongCount: 0,
    unattemptedCount: questions.length,
  };
  let unlockedKeys: Record<string, UnlockedKeyRecord> = {};

  try {
    const res = await gradeExamOnServer({
      testId: test.testId,
      status,
      responses: attempt.responses,
      questionsMeta: questions.map((q) => ({ questionId: q.questionId, marks: q.marks })),
      negativeMarking: test.negativeMarking,
      negativeMarkValue: test.negativeMarkValue,
    });
    if (res && res.grading) {
      grading = res.grading;
      unlockedKeys = res.unlockedKeys || {};
    }
  } catch (gradeErr) {
    console.warn('gradeExamOnServer fallback used:', gradeErr);
  }

  const totalSeconds = Math.max(1, test.durationMins) * 60;
  const timeTakenSeconds = Math.max(0, totalSeconds - Math.max(0, attempt.remainingSeconds));
  const nowIso = new Date().toISOString();

  const finalized: TestAttempt = {
    ...attempt,
    status,
    lastActiveAtIso: nowIso,
    submittedAtIso: nowIso,
    timeTakenSeconds,
    ...grading,
  };

  const unlockedQuestions: TestQuestion[] = questions.map((q) => {
    const key = unlockedKeys[q.questionId];
    return {
      ...q,
      correctOptionId: key?.correctOptionId || 'A',
      shortExplanation: key?.shortExplanation || '',
      stepByStepSolution: key?.stepByStepSolution || [],
    };
  });

  if (user.isDemo) {
    const store = getDemoStore();
    const idx = store.attempts.findIndex((a) => a.attemptId === attempt.attemptId);
    if (idx >= 0) store.attempts[idx] = finalized;
    else store.attempts.unshift(finalized);
    saveDemoStore(store);
    return { attempt: finalized, unlockedQuestions };
  }

  const path = `attempts/${attempt.attemptId}`;
  try {
    const sanitizedResponses: Record<string, any> = {};
    for (const [k, v] of Object.entries(attempt.responses || {})) {
      if (v && typeof v === 'object') {
        sanitizedResponses[k] = {
          selectedOptionId: v.selectedOptionId || null,
          markedForReview: Boolean(v.markedForReview),
          visited: Boolean(v.visited),
        };
      }
    }

    await updateDoc(doc(db, 'attempts', attempt.attemptId), {
      status,
      lastActiveAt: serverTimestamp(),
      submittedAt: serverTimestamp(),
      remainingSeconds: Math.max(0, Math.round(attempt.remainingSeconds)),
      currentQuestionIndex: Math.max(0, attempt.currentQuestionIndex),
      currentSectionId: (attempt.currentSectionId || 'default').slice(0, 128),
      strikeCount: attempt.strikeCount || 0,
      strikes: (attempt.strikes || []).slice(0, 50),
      responses: sanitizedResponses,
      score: grading.score,
      maxScore: grading.maxScore,
      accuracy: grading.accuracy,
      correctCount: grading.correctCount,
      wrongCount: grading.wrongCount,
      unattemptedCount: grading.unattemptedCount,
      timeTakenSeconds,
    });
    return { attempt: finalized, unlockedQuestions };
  } catch (err) {
    console.error('Failed to update attempt doc in Firestore:', err);
    // Return finalized attempt so candidate is NEVER stuck on a dead exam screen
    return { attempt: finalized, unlockedQuestions };
  }
}

export async function unlockQuestionsForReview(
  testId: string,
  sanitizedQuestions: SanitizedQuestion[],
  attemptStatus: TestAttempt['status']
): Promise<TestQuestion[]> {
  const unlockedKeys = await unlockSolutionsOnServer(testId, attemptStatus);
  return sanitizedQuestions.map((q) => {
    const key = unlockedKeys[q.questionId];
    return {
      ...q,
      correctOptionId: key?.correctOptionId || 'A',
      shortExplanation: key?.shortExplanation || '',
      stepByStepSolution: key?.stepByStepSolution || [],
    };
  });
}
