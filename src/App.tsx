import { useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import {
  auth,
  createGoogleAuthProvider,
  forgetRecentGoogleAccount,
  formatFirebaseAuthError,
  getRecentGoogleAccounts,
  rememberGoogleAccount,
  testFirestoreConnection,
  type RecentGoogleAccount,
} from './lib/firebase';
import {
  applyMarksToAllQuestions,
  createAttempt,
  deleteQuestion,
  deleteTest,
  finalizeAttempt,
  listAllAttemptsForTest,
  listQuestionsAdmin,
  listQuestionVersions,
  listSanitizedQuestions,
  listTests,
  listUserAttempts,
  recordQuestionVersion,
  saveQuestion,
  saveTest,
  seedSampleTestsToFirestore,
  syncAttemptProgress,
  syncFirebaseUserProfile,
  unlockQuestionsForReview,
  type SaveQuestionOptions,
} from './lib/dataService';
import { TopBar } from './components/TopBar';
import { LandingScreen } from './components/LandingScreen';
import { AdminDashboard } from './components/AdminDashboard';
import { AdminTestBuilder } from './components/AdminTestBuilder';
import { AdminQuestionStudio } from './components/AdminQuestionStudio';
import { AdminResultsView } from './components/AdminResultsView';
import { QuestionPreviewModal } from './components/QuestionPreviewModal';
import { CandidateDashboard } from './components/CandidateDashboard';
import { ExamBriefingScreen } from './components/ExamBriefingScreen';
import { LiveExamRunner } from './components/LiveExamRunner';
import { ExamResultsScreen } from './components/ExamResultsScreen';
import type {
  AppScreen,
  SanitizedQuestion,
  TestAttempt,
  TestExam,
  TestQuestion,
  UserProfile,
} from './types';

const DEMO_SESSION_KEY = 'exampulse_demo_session_role';

function buildDemoCandidateProfile(): UserProfile {
  return {
    uid: 'demo_student_uid',
    name: 'Demo Candidate',
    email: 'candidate@exampulse.demo',
    role: 'user',
    isMainAdmin: false,
    isDemo: true,
  };
}

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [recentAccounts, setRecentAccounts] = useState<RecentGoogleAccount[]>(() =>
    getRecentGoogleAccounts()
  );

  const [portalMode, setPortalMode] = useState<'admin' | 'user'>('user');
  const [screen, setScreen] = useState<AppScreen>('landing');

  const [tests, setTests] = useState<TestExam[]>([]);
  const [attempts, setAttempts] = useState<TestAttempt[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Active selection states
  const [selectedTest, setSelectedTest] = useState<TestExam | null>(null);
  const [sanitizedQuestions, setSanitizedQuestions] = useState<SanitizedQuestion[]>([]);
  const [adminQuestions, setAdminQuestions] = useState<TestQuestion[]>([]);
  const [unlockedResultQuestions, setUnlockedResultQuestions] = useState<TestQuestion[]>([]);
  const [adminTestAttempts, setAdminTestAttempts] = useState<TestAttempt[]>([]);
  const [activeAttempt, setActiveAttempt] = useState<TestAttempt | null>(null);
  const [dashboardPreview, setDashboardPreview] = useState<{
    test: TestExam;
    questions: TestQuestion[];
  } | null>(null);
  const [studioInitialQuestionId, setStudioInitialQuestionId] = useState<string | null>(null);
  const activeUidRef = useRef<string | null>(null);

  const resetWorkspaceSelections = useCallback(() => {
    setTests([]);
    setAttempts([]);
    setSelectedTest(null);
    setActiveAttempt(null);
    setSanitizedQuestions([]);
    setAdminQuestions([]);
    setUnlockedResultQuestions([]);
    setAdminTestAttempts([]);
    setDashboardPreview(null);
    setStudioInitialQuestionId(null);
    setGlobalError(null);
  }, []);

  useEffect(() => {
    testFirestoreConnection();

    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          const isAccountSwitch =
            activeUidRef.current !== null && activeUidRef.current !== fbUser.uid;
          if (isAccountSwitch) {
            resetWorkspaceSelections();
          }
          activeUidRef.current = fbUser.uid;

          const profile = await syncFirebaseUserProfile({
            uid: fbUser.uid,
            displayName: fbUser.displayName,
            email: fbUser.email,
            photoURL: fbUser.photoURL,
            emailVerified: fbUser.emailVerified,
            getIdToken: () => fbUser.getIdToken(),
          });
          localStorage.removeItem(DEMO_SESSION_KEY);
          setRecentAccounts(
            rememberGoogleAccount({
              email: profile.email,
              name: profile.name,
              photoUrl: profile.photoUrl,
            })
          );
          setAuthError(null);
          setUser(profile);
          const defaultMode = profile.role === 'admin' ? 'admin' : 'user';
          setPortalMode(defaultMode);
          // Keep screen at landing if user navigated to landing, or go to candidate dashboard by default
          setScreen((prev) => (prev === 'landing' ? 'landing' : defaultMode === 'admin' ? 'admin-dashboard' : 'candidate-dashboard'));
        } catch (err) {
          setAuthError(err instanceof Error ? err.message : 'Failed to sync user profile.');
        }
      } else {
        activeUidRef.current = null;
        const savedDemo = localStorage.getItem(DEMO_SESSION_KEY);
        if (savedDemo === 'user') {
          const demoProfile = buildDemoCandidateProfile();
          setUser(demoProfile);
          setPortalMode('user');
          setScreen('candidate-dashboard');
        } else {
          localStorage.removeItem(DEMO_SESSION_KEY);
          setUser(null);
          setScreen('landing');
        }
      }
      setAuthReady(true);
    });

    return () => unsub();
  }, [resetWorkspaceSelections]);

  const refreshWorkspaceData = useCallback(
    async (activeUser: UserProfile, mode: 'admin' | 'user') => {
      setLoadingData(true);
      setGlobalError(null);
      try {
        const isAdminQuery = mode === 'admin' && activeUser.role === 'admin';
        const [fetchedTests, fetchedAttempts] = await Promise.all([
          listTests(activeUser, isAdminQuery),
          listUserAttempts(activeUser),
        ]);
        setTests(fetchedTests);
        setAttempts(fetchedAttempts);
      } catch (err) {
        setGlobalError(err instanceof Error ? err.message : 'Failed to load workspace data.');
      } finally {
        setLoadingData(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!user) return;
    if (screen === 'admin-dashboard' || screen === 'candidate-dashboard') {
      refreshWorkspaceData(user, portalMode);
    }
  }, [user, portalMode, screen, refreshWorkspaceData]);

  // Synchronous gesture before signInWithPopup so mobile Chrome/Safari allow the account picker
  const handleSignInGoogle = async (loginHint?: string) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const provider = createGoogleAuthProvider(loginHint);
      const cred = await signInWithPopup(auth, provider);
      // If user re-selected a different Gmail or refreshed the same account, remember it
      if (cred.user.email) {
        setRecentAccounts(
          rememberGoogleAccount({
            email: cred.user.email,
            name: cred.user.displayName || cred.user.email.split('@')[0],
            photoUrl: cred.user.photoURL || undefined,
          })
        );
      }
    } catch (err) {
      const readable = formatFirebaseAuthError(err);
      setAuthError(readable);
      if (user) {
        setGlobalError(readable);
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleForgetRecentAccount = (email: string) => {
    setRecentAccounts(forgetRecentGoogleAccount(email));
  };

  const handleEnterDemo = () => {
    localStorage.setItem(DEMO_SESSION_KEY, 'user');
    const demoUser = buildDemoCandidateProfile();
    setUser(demoUser);
    setPortalMode('user');
    setScreen('candidate-dashboard');
  };

  const handleSignOut = async () => {
    localStorage.removeItem(DEMO_SESSION_KEY);
    if (auth.currentUser) {
      await signOut(auth);
    }
    activeUidRef.current = null;
    setUser(null);
    resetWorkspaceSelections();
    setScreen('landing');
  };

  // Admin handlers (strictly gated to verified role === 'admin')
  const handleSaveTestAndOpenStudio = async (test: TestExam) => {
    if (!user || user.role !== 'admin') return;
    const isEditingExistingTest = Boolean(selectedTest && selectedTest.testId === test.testId);
    const prevMarks = selectedTest?.marksPerQuestion;
    const saved = await saveTest(user, test);
    if (
      isEditingExistingTest &&
      saved.marksPerQuestion !== undefined &&
      prevMarks !== saved.marksPerQuestion
    ) {
      await applyMarksToAllQuestions(user, saved.testId, saved.marksPerQuestion).catch(() => {});
    }
    setSelectedTest(saved);
    const qs = await listQuestionsAdmin(user, saved.testId);
    setAdminQuestions(qs);
    setScreen('admin-question-studio');
  };

  const handleOpenQuestionStudio = async (test: TestExam) => {
    if (!user || user.role !== 'admin') return;
    setSelectedTest(test);
    setStudioInitialQuestionId(null);
    setLoadingData(true);
    try {
      const qs = await listQuestionsAdmin(user, test.testId);
      setAdminQuestions(qs);
      setScreen('admin-question-studio');
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Failed to load test questions.');
    } finally {
      setLoadingData(false);
    }
  };

  const handlePreviewTestFromDashboard = async (test: TestExam) => {
    if (!user || user.role !== 'admin') return;
    setLoadingData(true);
    setGlobalError(null);
    try {
      const qs = await listQuestionsAdmin(user, test.testId);
      setDashboardPreview({ test, questions: qs });
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Failed to load questions for preview.');
    } finally {
      setLoadingData(false);
    }
  };

  const handleViewAdminResults = async (test: TestExam) => {
    if (!user || user.role !== 'admin') return;
    setSelectedTest(test);
    setScreen('admin-results');
    setLoadingData(true);
    try {
      const list = await listAllAttemptsForTest(user, test.testId);
      setAdminTestAttempts(list);
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Failed to load candidate attempts.');
    } finally {
      setLoadingData(false);
    }
  };

  const handleTogglePublish = async (test: TestExam) => {
    if (!user || user.role !== 'admin') return;
    const nextStatus = test.status === 'published' ? 'draft' : 'published';
    const updated: TestExam = { ...test, status: nextStatus };
    await saveTest(user, updated);
    await refreshWorkspaceData(user, portalMode);
  };

  const handleDeleteTest = async (test: TestExam) => {
    if (!user || user.role !== 'admin') return;
    await deleteTest(user, test.testId);
    await refreshWorkspaceData(user, portalMode);
  };

  const handleSeedSamples = async () => {
    if (!user || user.role !== 'admin') return;
    setLoadingData(true);
    try {
      await seedSampleTestsToFirestore(user);
      await refreshWorkspaceData(user, portalMode);
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Failed to seed sample tests.');
    } finally {
      setLoadingData(false);
    }
  };

  // Candidate handlers — ONLY sanitized questions (zero answers/solutions) are loaded
  const handleStartOrResumeBriefing = async (test: TestExam, existingAttempt?: TestAttempt) => {
    if (!user) return;
    setLoadingData(true);
    setGlobalError(null);
    try {
      const qs = await listSanitizedQuestions(user, test.testId);
      if (qs.length === 0) {
        setGlobalError('This test does not have any questions yet.');
        return;
      }
      setSelectedTest(test);
      setSanitizedQuestions(qs);
      setActiveAttempt(existingAttempt || null);
      setScreen('exam-briefing');
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Failed to load exam questions.');
    } finally {
      setLoadingData(false);
    }
  };

  const handleLaunchExam = async () => {
    if (!user || !selectedTest) return;
    setLoadingData(true);
    try {
      const att = activeAttempt || (await createAttempt(user, selectedTest));
      setActiveAttempt(att);
      setScreen('exam-runner');
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Failed to initialize exam session.');
    } finally {
      setLoadingData(false);
    }
  };

  const handleViewResult = async (test: TestExam, attempt: TestAttempt) => {
    if (!user) return;
    setLoadingData(true);
    try {
      const sanitized = await listSanitizedQuestions(user, test.testId);
      const unlocked = await unlockQuestionsForReview(test.testId, sanitized, attempt.status);
      setSelectedTest(test);
      setUnlockedResultQuestions(unlocked);
      setActiveAttempt(attempt);
      setScreen('exam-results');
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Failed to unlock exam result.');
    } finally {
      setLoadingData(false);
    }
  };

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 text-sm text-slate-500">
        Initializing ExamPulse AI…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 overflow-x-hidden">
      {screen !== 'exam-runner' && (
        <TopBar
          user={user}
          activeScreen={screen}
          portalMode={portalMode}
          authLoading={authLoading}
          recentAccounts={recentAccounts}
          onNavigate={(next) => {
            if (next.startsWith('admin') && user?.role !== 'admin') return;
            setScreen(next);
          }}
          onSwitchPortal={(mode) => {
            if (mode === 'admin' && user?.role !== 'admin') return;
            setPortalMode(mode);
          }}
          onSignInGoogle={handleSignInGoogle}
          onForgetRecentAccount={handleForgetRecentAccount}
          onSignOut={handleSignOut}
        />
      )}

      {globalError && screen !== 'exam-runner' && (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
            <span className="min-w-0 flex-1">{globalError}</span>
            <button
              type="button"
              onClick={() => setGlobalError(null)}
              className="font-semibold underline shrink-0 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {screen === 'landing' && (
        <LandingScreen
          user={user}
          authLoading={authLoading}
          authError={authError}
          recentAccounts={recentAccounts}
          onSignInGoogle={handleSignInGoogle}
          onForgetRecentAccount={handleForgetRecentAccount}
          onContinueToPortal={() => {
            if (!user) return;
            const target =
              user.role === 'admin' && portalMode === 'admin'
                ? 'admin-dashboard'
                : 'candidate-dashboard';
            setScreen(target);
          }}
          onEnterDemo={handleEnterDemo}
        />
      )}

      {user && user.role === 'admin' && screen === 'admin-dashboard' && (
        <AdminDashboard
          tests={tests}
          loading={loadingData}
          onCreateNew={() => {
            setSelectedTest(null);
            setScreen('admin-test-builder');
          }}
          onSeedSample={handleSeedSamples}
          onEditSettings={(t) => {
            setSelectedTest(t);
            setScreen('admin-test-builder');
          }}
          onManageQuestions={handleOpenQuestionStudio}
          onPreviewQuestions={handlePreviewTestFromDashboard}
          onViewResults={handleViewAdminResults}
          onTogglePublish={handleTogglePublish}
          onDeleteTest={handleDeleteTest}
        />
      )}

      {user && user.role === 'admin' && screen === 'admin-test-builder' && (
        <AdminTestBuilder
          initialTest={selectedTest}
          createdByUid={user.uid}
          onCancel={() => setScreen('admin-dashboard')}
          onSaveAndContinue={handleSaveTestAndOpenStudio}
        />
      )}

      {user && user.role === 'admin' && screen === 'admin-question-studio' && selectedTest && (
        <AdminQuestionStudio
          test={selectedTest}
          questions={adminQuestions}
          initialQuestionId={studioInitialQuestionId}
          onBack={() => {
            setStudioInitialQuestionId(null);
            setScreen('admin-dashboard');
          }}
          onEditTestDetails={() => setScreen('admin-test-builder')}
          onSaveQuestion={async (q, opts?: SaveQuestionOptions) => {
            await saveQuestion(user, q, opts);
            const updated = await listQuestionsAdmin(user, selectedTest.testId);
            setAdminQuestions(updated);
          }}
          onLoadQuestionVersions={async (questionId) =>
            listQuestionVersions(user, selectedTest.testId, questionId)
          }
          onRecordQuestionVersion={async (q, source, summary) =>
            recordQuestionVersion(user, q, source, summary)
          }
          onDeleteQuestion={async (qId) => {
            await deleteQuestion(user, selectedTest.testId, qId);
            const updated = await listQuestionsAdmin(user, selectedTest.testId);
            setAdminQuestions(updated);
          }}
          onPublishTest={async () => {
            const published: TestExam = { ...selectedTest, status: 'published' };
            await saveTest(user, published);
            setSelectedTest(published);
            const updatedQs = await listQuestionsAdmin(user, selectedTest.testId);
            setAdminQuestions(updatedQs);
          }}
          onApplyDefaultMarksToAll={async (marksVal) => {
            await applyMarksToAllQuestions(user, selectedTest.testId, marksVal);
            const updatedQs = await listQuestionsAdmin(user, selectedTest.testId);
            setAdminQuestions(updatedQs);
          }}
        />
      )}

      {user && user.role === 'admin' && screen === 'admin-results' && selectedTest && (
        <AdminResultsView
          test={selectedTest}
          attempts={adminTestAttempts}
          loading={loadingData}
          onBack={() => setScreen('admin-dashboard')}
        />
      )}

      {user && screen === 'candidate-dashboard' && (
        <CandidateDashboard
          tests={tests}
          attempts={attempts}
          loading={loadingData}
          onStartOrResumeTest={handleStartOrResumeBriefing}
          onViewResult={handleViewResult}
        />
      )}

      {user && screen === 'exam-briefing' && selectedTest && (
        <ExamBriefingScreen
          test={selectedTest}
          resumingAttempt={activeAttempt || undefined}
          onBack={() => setScreen('candidate-dashboard')}
          onLaunchExam={handleLaunchExam}
        />
      )}

      {user && screen === 'exam-runner' && selectedTest && activeAttempt && (
        <LiveExamRunner
          test={selectedTest}
          questions={sanitizedQuestions}
          initialAttempt={activeAttempt}
          onSyncProgress={(att) => syncAttemptProgress(user, att)}
          onSubmitExam={async (att, status) => {
            const { attempt: finalized, unlockedQuestions } = await finalizeAttempt(
              user,
              selectedTest,
              sanitizedQuestions,
              att,
              status
            );
            setActiveAttempt(finalized);
            setUnlockedResultQuestions(unlockedQuestions);
            setScreen('exam-results');
          }}
        />
      )}

      {user && screen === 'exam-results' && selectedTest && activeAttempt && (
        <ExamResultsScreen
          test={selectedTest}
          questions={unlockedResultQuestions}
          attempt={activeAttempt}
          onBackToDashboard={() => setScreen('candidate-dashboard')}
        />
      )}

      {user && user.role === 'admin' && dashboardPreview && (
        <QuestionPreviewModal
          test={dashboardPreview.test}
          questions={dashboardPreview.questions}
          onClose={() => setDashboardPreview(null)}
          onEditQuestion={(q) => {
            setSelectedTest(dashboardPreview.test);
            setAdminQuestions(dashboardPreview.questions);
            setStudioInitialQuestionId(q.questionId);
            setDashboardPreview(null);
            setScreen('admin-question-studio');
          }}
        />
      )}
    </div>
  );
}
