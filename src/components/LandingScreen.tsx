import {
  ArrowRight,
  Languages,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  UserCheck,
  X,
} from 'lucide-react';
import heroWorkspaceImg from '../assets/images/hero_exam_workspace_1794574130760.jpg';
import type { RecentGoogleAccount } from '../lib/firebase';
import type { UserProfile } from '../types';

interface LandingScreenProps {
  user: UserProfile | null;
  authLoading: boolean;
  authError: string | null;
  recentAccounts: RecentGoogleAccount[];
  onSignInGoogle: (loginHint?: string) => void;
  onForgetRecentAccount: (email: string) => void;
  onContinueToPortal: () => void;
  onEnterDemo: (role: 'admin' | 'user') => void;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase() || 'G';
}

export function LandingScreen({
  user,
  authLoading,
  authError,
  recentAccounts,
  onSignInGoogle,
  onForgetRecentAccount,
  onContinueToPortal,
  onEnterDemo,
}: LandingScreenProps) {
  return (
    <main className="bg-slate-50 text-slate-900">
      <section className="mx-auto max-w-7xl px-4 sm:px-6 pt-8 pb-12 sm:pt-12 sm:pb-16 lg:pt-16 lg:pb-20">
        <div className="grid grid-cols-1 gap-8 sm:gap-10 lg:grid-cols-12 lg:items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-between min-w-0">
            <div>
              <p className="text-xs font-medium tracking-wide text-slate-500">
                APAC Assessment Platform · Built with Gemini API, MediaPipe &amp; Firebase
              </p>
              <h1 className="mt-3 sm:mt-4 font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl leading-[1.12] text-balance">
                Build AI-powered CBT exams and proctored tests in minutes.
              </h1>
              <p className="mt-4 sm:mt-5 max-w-xl text-sm sm:text-base leading-relaxed text-slate-600">
                Create sectioned, diagram-supported tests manually or from textbook photos with Gemini AI.
                Enforce fullscreen &amp; MediaPipe proctoring strikes, let candidates resume seamlessly
                after drops, and unlock step-by-step multilingual solutions.
              </p>

              {authError && (
                <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs sm:text-sm text-red-800 space-y-2">
                  <p>{authError}</p>
                  <button
                    type="button"
                    disabled={authLoading}
                    onClick={() => onSignInGoogle()}
                    className="inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-100 cursor-pointer"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Open Google Account Chooser Again</span>
                  </button>
                </div>
              )}

              <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3">
                {user ? (
                  <button
                    type="button"
                    onClick={onContinueToPortal}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-800 transition-colors whitespace-nowrap cursor-pointer shadow-sm"
                  >
                    <span>
                      Go to {user.role === 'admin' ? 'Admin Studio' : 'Candidate Portal'}
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={authLoading}
                      onClick={() => onSignInGoogle()}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60 transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <span>
                        {authLoading ? 'Signing in…' : 'Sign in with Google'}
                      </span>
                      <ArrowRight className="h-4 w-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onEnterDemo('user')}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-100 transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <UserCheck className="h-4 w-4 text-blue-700" />
                      <span>Demo Candidate Exam</span>
                    </button>
                  </>
                )}
              </div>

              {!user && recentAccounts.length > 0 && (
                <div className="mt-5 rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-800">
                      Quick-Pick Gmail in this Browser
                    </span>
                    <button
                      type="button"
                      disabled={authLoading}
                      onClick={() => onSignInGoogle()}
                      className="text-xs font-semibold text-blue-700 hover:underline cursor-pointer"
                    >
                      + Use another Gmail
                    </button>
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Multiple Google accounts? Tap any Gmail below or choose another account in Google&apos;s picker.
                  </p>
                  <div className="mt-2.5 flex flex-col sm:flex-row sm:flex-wrap gap-2">
                    {recentAccounts.map((acc) => {
                      const isCurrent = user?.email.toLowerCase() === acc.email.toLowerCase();
                      return (
                        <div
                          key={acc.email}
                          className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 transition-colors ${
                            isCurrent
                              ? 'border-blue-300 bg-blue-50/70'
                              : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100'
                          }`}
                        >
                          <button
                            type="button"
                            disabled={authLoading}
                            onClick={() => onSignInGoogle(acc.email)}
                            className="flex min-w-0 flex-1 items-center gap-2 text-left cursor-pointer"
                          >
                            {acc.photoUrl ? (
                              <img
                                src={acc.photoUrl}
                                alt={acc.name}
                                referrerPolicy="no-referrer"
                                className="h-6 w-6 rounded-full object-cover shrink-0"
                              />
                            ) : (
                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-800 shrink-0">
                                {getInitials(acc.name)}
                              </span>
                            )}
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-slate-900 truncate">
                                {acc.name}
                                {isCurrent ? ' (Active)' : ''}
                              </div>
                              <div className="font-mono text-[11px] text-slate-500 truncate">
                                {acc.email}
                              </div>
                            </div>
                          </button>
                          <button
                            type="button"
                            title={`Remove ${acc.email}`}
                            onClick={() => onForgetRecentAccount(acc.email)}
                            className="p-1 text-slate-400 hover:text-red-600 shrink-0 cursor-pointer"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-8 sm:mt-10 grid grid-cols-3 gap-3 sm:gap-6 border-t border-slate-200 pt-5 sm:pt-6">
              <div>
                <div className="font-mono text-lg sm:text-2xl font-semibold text-slate-900 tabular-nums">
                  2-Portal
                </div>
                <div className="mt-1 text-[11px] sm:text-xs text-slate-500">
                  Admin Builder &amp; Live CBT
                </div>
              </div>
              <div>
                <div className="font-mono text-lg sm:text-2xl font-semibold text-slate-900 tabular-nums">
                  5s Sync
                </div>
                <div className="mt-1 text-[11px] sm:text-xs text-slate-500">
                  Instant Pause &amp; Resume
                </div>
              </div>
              <div>
                <div className="font-mono text-lg sm:text-2xl font-semibold text-slate-900 tabular-nums">
                  On-Device
                </div>
                <div className="mt-1 text-[11px] sm:text-xs text-slate-500">
                  MediaPipe Face Proctor
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="relative h-full min-h-[240px] sm:min-h-[340px] overflow-hidden rounded-xl border border-slate-200 bg-slate-200">
              <img
                src={heroWorkspaceImg}
                alt="Candidate taking a calm proctored computer-based exam in a modern sunlit university study studio"
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/85 via-slate-950/45 to-transparent p-4 sm:p-6 text-white">
                <p className="text-[11px] sm:text-xs font-medium text-slate-200">
                  Real-Time Assessment Integrity · Fullscreen + Tab-Switch + AI Face Guard
                </p>
                <p className="mt-1 font-display text-base sm:text-lg font-semibold text-white">
                  Zero lost progress on network drops, zero friction for educators.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="capabilities" className="border-t border-slate-200 bg-white py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <h2 className="font-display text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-slate-900">
              End-to-end CBT workflows powered by Google AI
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Every stage of computer-based testing—from question authoring and diagram uploads to live
              anti-cheat proctoring and personalized post-exam doubt resolution—lives in one workspace.
            </p>
          </div>

          <div className="mt-8 sm:mt-10 grid grid-cols-1 gap-6 sm:gap-8 md:grid-cols-2 lg:grid-cols-4">
            <div className="border-t border-slate-200 pt-5">
              <Sparkles className="h-5 w-5 text-blue-700" />
              <h3 className="mt-3 font-display text-base font-semibold text-slate-900">
                Gemini AI Question Studio
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Paste syllabus notes or upload a textbook photo to synthesize structured 4-option MCQs,
                short explanations, and step-by-step solutions automatically.
              </p>
            </div>

            <div id="proctoring" className="border-t border-slate-200 pt-5">
              <ShieldCheck className="h-5 w-5 text-blue-700" />
              <h3 className="mt-3 font-display text-base font-semibold text-slate-900">
                Strike &amp; MediaPipe Proctoring
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Detects fullscreen exit, tab switches, window blur, and on-device webcam face count via
                MediaPipe Vision. Auto-submits the instant max strikes are hit.
              </p>
            </div>

            <div id="workflow" className="border-t border-slate-200 pt-5">
              <RotateCcw className="h-5 w-5 text-blue-700" />
              <h3 className="mt-3 font-display text-base font-semibold text-slate-900">
                Seamless Pause &amp; Resume
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Every response, review mark, strike log, and timer heartbeat syncs continuously so
                candidates resume right where they left off after a refresh or drop.
              </p>
            </div>

            <div id="google-ai" className="border-t border-slate-200 pt-5">
              <Languages className="h-5 w-5 text-blue-700" />
              <h3 className="mt-3 font-display text-base font-semibold text-slate-900">
                APAC Multilingual AI Tutor
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Translate questions and step-by-step solutions into Hindi, Tamil, Bengali, Bahasa, or
                Japanese, and ask Gemini Tutor why a chosen option went wrong.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
