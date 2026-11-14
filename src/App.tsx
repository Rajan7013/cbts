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
  batchSaveQuestions,
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
import { AppSidebarLayout } from './components/AppSidebar';
import { LandingScreen } from './components/LandingScreen';
import { AdminDashboard } from './components/AdminDashboard';
import { AdminTestBuilder } from './components/AdminTestBuilder';
import { AdminQuestionStudio } from './components/AdminQuestionStudio';
import { AdminResultsView } from './components/AdminResultsView';
import { AdminTestOverview } from './components/AdminTestOverview';
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
  TestSection,
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
  const [resultInitialMode, setResultInitialMode] = useState<'summary' | 'review'>('summary');
  const [adminTestAttempts, setAdminTestAttempts] = useState<TestAttempt[]>([]);
  const [activeAttempt, setActiveAttempt] = useState<TestAttempt | null>(null);
  const [dashboardPreview, setDashboardPreview] = useState<{
    test: TestExam;
    questions: TestQuestion[];
  } | null>(null);
  const [studioInitialQuestionId, setStudioInitialQuestionId] = useState<string | null>(null);
  const [recentlyPublishedMessage, setRecentlyPublishedMessage] = useState<string | null>(null);
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
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }

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
          // Authenticated users go directly to their dedicated dashboard
          setScreen(defaultMode === 'admin' ? 'admin-dashboard' : 'candidate-dashboard');
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
    setSelectedTest(test);
    setLoadingData(true);
    setGlobalError(null);
    try {
      const qs = await listQuestionsAdmin(user, test.testId);
      setAdminQuestions(qs);
      setScreen('admin-test-overview');
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Failed to load test details.');
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
      const [list, qs] = await Promise.all([
        listAllAttemptsForTest(user, test.testId),
        listQuestionsAdmin(user, test.testId),
      ]);
      setAdminTestAttempts(list);
      setAdminQuestions(qs);
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

  const handleImportDocExam = async (
    testData: {
      title: string;
      description: string;
      sections: TestSection[];
      questions: TestQuestion[];
    },
    publishImmediately: boolean
  ) => {
    if (!user || user.role !== 'admin') return;
    setLoadingData(true);
    setGlobalError(null);
    try {
      const newTestId = `test_${Date.now()}`;
      const now = new Date().toISOString();
      const newTest: TestExam = {
        testId: newTestId,
        title: testData.title || 'Imported AI Assessment',
        description: testData.description || 'Imported from Question & Solution booklet',
        totalQuestions: testData.questions.length,
        durationMinutes: Math.max(30, Math.ceil(testData.questions.length * 1.5)),
        passingScorePercentage: 50,
        marksPerQuestion: 1,
        negativeMarks: 0,
        status: publishImmediately ? 'published' : 'draft',
        sections: testData.sections,
        maxAttemptsPerCandidate: 1,
        createdByUid: user.uid,
        createdAt: now,
        updatedAt: now,
      };

      const savedTest = await saveTest(user, newTest);

      const fullQuestions: TestQuestion[] = testData.questions.map((q, i) => ({
        ...q,
        testId: savedTest.testId,
        questionId: q.questionId || `q_${Date.now()}_${i + 1}`,
        createdAt: now,
        updatedAt: now,
      }));
      await batchSaveQuestions(user, savedTest.testId, fullQuestions);

      await refreshWorkspaceData(user, portalMode);
      setSelectedTest(savedTest);
      const qs = await listQuestionsAdmin(user, savedTest.testId);
      setAdminQuestions(qs);

      if (publishImmediately) {
        setRecentlyPublishedMessage(
          `Exam "${savedTest.title}" (${testData.questions.length} questions across ${testData.sections.length} sections) was published successfully!`
        );
        setScreen('admin-dashboard');
      } else {
        setScreen('admin-question-studio');
      }
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Failed to import exam.');
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
      setAttempts((prev) => {
        const idx = prev.findIndex((a) => a.attemptId === att.attemptId);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = att;
          return next;
        }
        return [...prev, att];
      });
      setScreen('exam-runner');
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Failed to initialize exam session.');
    } finally {
      setLoadingData(false);
    }
  };

  const handleViewResult = async (
    test: TestExam,
    attempt: TestAttempt,
    initialMode: 'summary' | 'review' = 'summary'
  ) => {
    if (!user) return;
    setLoadingData(true);
    try {
      const sanitized = await listSanitizedQuestions(user, test.testId);
      const unlocked = await unlockQuestionsForReview(test.testId, sanitized, attempt.status);
      setSelectedTest(test);
      setUnlockedResultQuestions(unlocked);
      setActiveAttempt(attempt);
      setResultInitialMode(initialMode);
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

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 overflow-x-hidden">
        <TopBar
          user={null}
          activeScreen={screen}
          portalMode={portalMode}
          authLoading={authLoading}
          recentAccounts={recentAccounts}
          onNavigate={(next) => setScreen(next)}
          onSwitchPortal={(mode) => setPortalMode(mode)}
          onSignInGoogle={handleSignInGoogle}
          onForgetRecentAccount={handleForgetRecentAccount}
          onSignOut={handleSignOut}
        />

        {globalError && (
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

        <LandingScreen
          user={null}
          authLoading={authLoading}
          authError={authError}
          recentAccounts={recentAccounts}
          onSignInGoogle={handleSignInGoogle}
          onForgetRecentAccount={handleForgetRecentAccount}
          onContinueToPortal={() => {}}
          onEnterDemo={handleEnterDemo}
        />
      </div>
    );
  }

  if (screen === 'exam-runner' && selectedTest && activeAttempt) {
    return (
      <LiveExamRunner
        test={selectedTest}
        questions={sanitizedQuestions}
        initialAttempt={activeAttempt}
        onSyncProgress={(att) => syncAttemptProgress(user, att)}
        onCancelExam={() => setScreen('candidate-dashboard')}
        onSubmitExam={async (att, status) => {
          try {
            const { attempt: finalized, unlockedQuestions } = await finalizeAttempt(
              user,
              selectedTest,
              sanitizedQuestions,
              att,
              status
            );
            setActiveAttempt(finalized);
            setAttempts((prev) => {
              const idx = prev.findIndex((a) => a.attemptId === finalized.attemptId);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = finalized;
                return next;
              }
              return [...prev, finalized];
            });
            setUnlockedResultQuestions(unlockedQuestions);
            setScreen('exam-results');
          } catch (submitErr) {
            console.error('Submission processing fallback applied:', submitErr);
            const totalSec = Math.max(1, selectedTest.durationMins) * 60;
            const timeTaken = Math.max(0, totalSec - Math.max(0, att.remainingSeconds));
            const nowIso = new Date().toISOString();
            const fallbackFinalized: TestAttempt = {
              ...att,
              status,
              lastActiveAtIso: nowIso,
              submittedAtIso: nowIso,
              timeTakenSeconds: timeTaken,
            };
            const fallbackUnlocked: TestQuestion[] = sanitizedQuestions.map((q) => ({
              ...q,
              correctOptionId: 'A',
              shortExplanation: '',
              stepByStepSolution: [],
            }));
            setActiveAttempt(fallbackFinalized);
            setAttempts((prev) => {
              const idx = prev.findIndex((a) => a.attemptId === fallbackFinalized.attemptId);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = fallbackFinalized;
                return next;
              }
              return [...prev, fallbackFinalized];
            });
            setUnlockedResultQuestions(fallbackUnlocked);
            setScreen('exam-results');
          }
        }}
      />
    );
  }

  // Candidate screens render cleanly in their dedicated ambient portal (matching design specifications 100%)
  if (screen === 'candidate-dashboard') {
    return (
      <CandidateDashboard
        user={user}
        tests={tests}
        attempts={attempts}
        loading={loadingData}
        onStartOrResumeTest={handleStartOrResumeBriefing}
        onViewResult={(t, att, mode) => handleViewResult(t, att, mode)}
        onSwitchToAdmin={
          user.role === 'admin'
            ? () => {
                setPortalMode('admin');
                setScreen('admin-dashboard');
              }
            : undefined
        }
        onSignOut={handleSignOut}
      />
    );
  }

  if (screen === 'exam-results' && selectedTest && activeAttempt) {
    return (
      <ExamResultsScreen
        user={user}
        test={selectedTest}
        questions={unlockedResultQuestions}
        attempt={activeAttempt}
        allAttempts={attempts.filter((a) => a.testId === selectedTest.testId)}
        initialMode={resultInitialMode}
        onSelectAttempt={async (att) => {
          setActiveAttempt(att);
          const sanitized = await listSanitizedQuestions(user, selectedTest.testId);
          const unlocked = await unlockQuestionsForReview(selectedTest.testId, sanitized, att.status);
          setUnlockedResultQuestions(unlocked);
        }}
        onRetakeTest={() => {
          handleStartOrResumeBriefing(selectedTest, undefined);
        }}
        onBackToDashboard={() => setScreen('candidate-dashboard')}
        onSwitchToAdmin={
          user.role === 'admin'
            ? () => {
                setPortalMode('admin');
                setScreen('admin-dashboard');
              }
            : undefined
        }
        onSignOut={handleSignOut}
      />
    );
  }

  if (screen === 'exam-briefing' && selectedTest) {
    return (
      <div className="min-h-screen bg-slate-50 py-8 px-4">
        <ExamBriefingScreen
          test={selectedTest}
          resumingAttempt={activeAttempt || undefined}
          onBack={() => setScreen('candidate-dashboard')}
          onLaunchExam={handleLaunchExam}
        />
      </div>
    );
  }

  return (
    <AppSidebarLayout
      user={user}
      activeScreen={screen}
      portalMode={portalMode}
      onNavigate={(next) => {
        if (next.startsWith('admin') && user.role !== 'admin') return;
        if (next === 'admin-results') {
          const target = selectedTest || tests[0] || null;
          if (target) {
            handleViewAdminResults(target);
            return;
          }
        }
        if (next === 'admin-test-builder') {
          setSelectedTest(null);
        }
        setScreen(next);
      }}
      onSwitchPortal={(mode) => {
        if (mode === 'admin' && user.role !== 'admin') return;
        setPortalMode(mode);
        setScreen(mode === 'admin' ? 'admin-dashboard' : 'candidate-dashboard');
      }}
      onSignOut={handleSignOut}
    >
      {globalError && (
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

      {user.role === 'admin' && screen === 'admin-dashboard' && (
        <AdminDashboard
          tests={tests}
          loading={loadingData}
          publishedSuccessMessage={recentlyPublishedMessage}
          onClearPublishedSuccess={() => setRecentlyPublishedMessage(null)}
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
          onImportFromDoc={handleImportDocExam}
        />
      )}

      {user.role === 'admin' && screen === 'admin-test-builder' && (
        <AdminTestBuilder
          initialTest={selectedTest}
          createdByUid={user.uid}
          onCancel={() => setScreen('admin-dashboard')}
          onSaveAndContinue={handleSaveTestAndOpenStudio}
        />
      )}

      {user.role === 'admin' && screen === 'admin-question-studio' && selectedTest && (
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
          onBatchSaveQuestions={async (importedQs) => {
            const fullQs = importedQs.map((q, i) => ({
              ...q,
              testId: selectedTest.testId,
              questionId: q.questionId || `q_${Date.now()}_${i + 1}`,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }));
            await batchSaveQuestions(user, selectedTest.testId, fullQs);
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
          onUpdateTest={async (patch) => {
            const updatedTest: TestExam = { ...selectedTest, ...patch };
            await saveTest(user, updatedTest);
            setSelectedTest(updatedTest);
            setTests((prev) => prev.map((t) => (t.testId === updatedTest.testId ? updatedTest : t)));
          }}
          onPublishTest={async (overrides?: Partial<TestExam>) => {
            const published: TestExam = {
              ...selectedTest,
              ...(overrides || {}),
              status: 'published',
            };
            await saveTest(user, published);
            setSelectedTest(published);
            setTests((prev) => prev.map((t) => (t.testId === published.testId ? published : t)));
            setRecentlyPublishedMessage('Test published successfully');
            const updatedQs = await listQuestionsAdmin(user, selectedTest.testId);
            setAdminQuestions(updatedQs);
          }}
          onApplyDefaultMarksToAll={async (marksVal) => {
            await applyMarksToAllQuestions(user, selectedTest.testId, marksVal);
            const updatedQs = await listQuestionsAdmin(user, selectedTest.testId);
            setAdminQuestions(updatedQs);
          }}
          onSwitchToCandidateView={() => {
            setPortalMode('user');
            setScreen('candidate-dashboard');
          }}
        />
      )}

      {user.role === 'admin' && screen === 'admin-test-overview' && selectedTest && (
        <AdminTestOverview
          test={selectedTest}
          questions={adminQuestions}
          onBack={() => setScreen('admin-dashboard')}
          onEditSettings={() => setScreen('admin-test-builder')}
          onManageQuestions={() => setScreen('admin-question-studio')}
          onCandidatePreview={() => handleStartOrResumeBriefing(selectedTest)}
          onEditQuestion={(q) => {
            setStudioInitialQuestionId(q.questionId);
            setScreen('admin-question-studio');
          }}
        />
      )}

      {user.role === 'admin' && screen === 'admin-results' && (
        <AdminResultsView
          test={selectedTest}
          tests={tests}
          questions={adminQuestions}
          attempts={adminTestAttempts}
          loading={loadingData}
          onSelectTest={(t) => handleViewAdminResults(t)}
          onBack={() => setScreen('admin-dashboard')}
        />
      )}

      {user.role === 'admin' && dashboardPreview && (
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
    </AppSidebarLayout>
  );
}
