export type UserRole = 'admin' | 'user';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  photoUrl?: string;
  role: UserRole;
  isMainAdmin?: boolean;
  isDemo?: boolean;
}

export interface TestSection {
  id: string;
  name: string;
  questionCount: number;
}

export interface TestExam {
  testId: string;
  title: string;
  description: string;
  createdBy: string;
  startTime: string;
  endTime: string;
  durationMins: number;
  totalQuestions: number;
  passPercentage: number;
  marksPerQuestion?: number;
  negativeMarking: boolean;
  negativeMarkValue: number;
  maxStrikes: number;
  maxAttempts?: number; // Maximum allowed attempts per candidate (1..n, undefined = unlimited)
  enforceFullscreen: boolean;
  detectTabSwitch: boolean;
  proctoringAIEnabled: boolean;
  status: 'draft' | 'published';
  sections: TestSection[];
  questionCountAdded?: number;
}

export type OptionId = 'A' | 'B' | 'C' | 'D';

export interface QuestionOption {
  id: OptionId;
  text: string;
  imageUrl?: string;
}

/**
 * Sanitized question sent to the browser during live exams.
 * Never contains correctOptionId, shortExplanation, or stepByStepSolution.
 */
export interface SanitizedQuestion {
  questionId: string;
  testId: string;
  testStatus: 'draft' | 'published';
  sectionId: string;
  orderIndex: number;
  questionText: string;
  questionImageUrl?: string;
  options: QuestionOption[];
  marks: number;
  // UI compatibility aliases
  stem?: string;
  imageUrl?: string;
  order?: number;
}

/**
 * Full question with answer key & solutions — used strictly in Admin Studio
 * and unlocked post-submission on ExamResultsScreen.
 */
export interface TestQuestion extends SanitizedQuestion {
  correctOptionId: OptionId;
  shortExplanation: string;
  solutionImageUrl?: string;
  stepByStepSolution: string[];
  // UI compatibility aliases
  solution?: {
    shortExplanation?: string;
    imageUrl?: string;
    steps?: string[];
  };
}

export type QuestionVersionSource =
  | 'initial'
  | 'manual_save'
  | 'before_gemini_edit'
  | 'gemini_edit'
  | 'revert';

export interface QuestionVersion {
  versionId: string;
  questionId: string;
  testId: string;
  sectionId: string;
  source: QuestionVersionSource;
  summary: string;
  questionText: string;
  questionImageUrl?: string;
  options: QuestionOption[];
  correctOptionId: OptionId;
  shortExplanation: string;
  stepByStepSolution: string[];
  marks: number;
  createdAtIso: string;
  isLocalOnly?: boolean;
}

export interface StrikeLog {
  count: number;
  reason: string;
  timestamp: string;
}

export interface QuestionResponse {
  selectedOptionId: OptionId | null;
  markedForReview: boolean;
  visited: boolean;
}

export type AttemptStatus = 'in_progress' | 'submitted' | 'auto_submitted_strike';

export interface TestAttempt {
  attemptId: string;
  testId: string;
  testTitle: string;
  userId: string;
  userName: string;
  userEmail: string;
  status: AttemptStatus;
  startedAtIso: string;
  lastActiveAtIso: string;
  submittedAtIso?: string;
  remainingSeconds: number;
  currentQuestionIndex: number;
  currentSectionId: string;
  strikeCount: number;
  strikes: StrikeLog[];
  responses: Record<string, QuestionResponse>;
  score: number;
  maxScore: number;
  accuracy: number;
  correctCount: number;
  wrongCount: number;
  unattemptedCount: number;
  timeTakenSeconds: number;
}

export type AppScreen =
  | 'landing'
  | 'admin-dashboard'
  | 'admin-test-builder'
  | 'admin-question-studio'
  | 'admin-test-overview'
  | 'admin-results'
  | 'candidate-dashboard'
  | 'exam-briefing'
  | 'exam-runner'
  | 'exam-results';
