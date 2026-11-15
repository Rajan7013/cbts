import { useEffect, useState } from 'react';
import { Download, X, Share, PlusSquare, Smartphone, CheckCircle2 } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [installedSuccess, setInstalledSuccess] = useState(false);

  useEffect(() => {
    // Check if running as installed standalone PWA
    const checkStandalone = () => {
      const isStandaloneMedia = window.matchMedia('(display-mode: standalone)').matches;
      const isIosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      return isStandaloneMedia || isIosStandalone;
    };

    if (checkStandalone()) {
      setIsStandalone(true);
      return;
    }

    // Check if dismissed in this session
    const dismissedSession = sessionStorage.getItem('pwa_prompt_dismissed');
    if (dismissedSession) {
      setIsDismissed(true);
    }

    // Check iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isAppleDevice = /iphone|ipad|ipod/.test(userAgent);
    const isSafari = /safari/.test(userAgent) && !/chrome|crios|fxios/.test(userAgent);
    setIsIos(isAppleDevice && isSafari);

    // Listen for beforeinstallprompt (Android Chrome, Edge, etc.)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    // Listen for appinstalled
    const handleAppInstalled = () => {
      setIsStandalone(true);
      setDeferredPrompt(null);
      setInstalledSuccess(true);
      setTimeout(() => setInstalledSuccess(false), 5000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else if (isIos) {
      setShowIosGuide(true);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem('pwa_prompt_dismissed', 'true');
  };

  // Don't render if already in standalone app mode
  if (isStandalone && !installedSuccess) {
    return null;
  }

  // Show install success banner
  if (installedSuccess) {
    return (
      <div className="fixed top-3 left-3 right-3 sm:left-auto sm:right-4 sm:w-96 z-50 bg-emerald-600 text-white p-3.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
        <CheckCircle2 className="h-6 w-6 shrink-0 text-white" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold leading-tight">ExamPulse AI Installed!</p>
          <p className="text-[11px] text-emerald-100 mt-0.5">
            You can now launch it directly from your home screen as a full-screen app.
          </p>
        </div>
      </div>
    );
  }

  // If dismissed and no prompt or not iOS, stay hidden
  if (isDismissed || (!deferredPrompt && !isIos)) {
    return null;
  }

  return (
    <>
      {/* Floating PWA Install Banner (Mobile optimized bottom bar) */}
      <div
        className="fixed bottom-3 left-3 right-3 sm:left-auto sm:right-5 sm:bottom-5 sm:max-w-md z-50 bg-slate-900/95 backdrop-blur-xl border border-blue-500/30 text-white p-3.5 sm:p-4 rounded-3xl shadow-2xl shadow-blue-900/30 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-5"
        style={{ paddingBottom: 'max(0.85rem, env(safe-area-inset-bottom, 0px))' }}
      >
        {/* App Icon */}
        <div className="relative h-11 w-11 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-sm shadow-md shrink-0 border border-white/20">
          <span>EP</span>
          <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 bg-emerald-500 rounded-full border-2 border-slate-900" />
        </div>

        {/* Text Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h4 className="font-display font-bold text-xs sm:text-sm text-white leading-tight truncate">
              Install ExamPulse App
            </h4>
            <span className="px-1.5 py-0.2 rounded-full bg-blue-500/30 text-blue-200 text-[10px] font-semibold border border-blue-400/20">
              Full Screen
            </span>
          </div>
          <p className="text-[11px] text-slate-300 mt-0.5 leading-snug line-clamp-1">
            Remove browser bars & run as a pure full-screen app
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleInstallClick}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
          >
            <Download className="h-3.5 w-3.5 shrink-0" />
            <span>Install</span>
          </button>

          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss"
            className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* iOS Instructions Modal */}
      {showIosGuide && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-3 sm:p-4">
          <div
            className="fixed inset-0"
            onClick={() => setShowIosGuide(false)}
          />
          <div className="relative bg-white text-slate-900 rounded-3xl p-5 sm:p-6 w-full max-w-sm shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-blue-600" />
                <h3 className="font-display font-bold text-sm text-slate-900">
                  Install on iOS (iPhone / iPad)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowIosGuide(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              To launch ExamPulse AI in pure full-screen mode without browser address bars:
            </p>

            <div className="space-y-2.5 text-xs text-slate-700">
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="h-7 w-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0">
                  <Share className="h-4 w-4" />
                </div>
                <span>1. Tap the <strong>Share</strong> button in Safari toolbar.</span>
              </div>

              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="h-7 w-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0">
                  <PlusSquare className="h-4 w-4" />
                </div>
                <span>2. Scroll down and tap <strong>Add to Home Screen</strong>.</span>
              </div>

              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="h-7 w-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0">
                  ✓
                </div>
                <span>3. Open the <strong>ExamPulse</strong> icon from your Home Screen!</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowIosGuide(false)}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
