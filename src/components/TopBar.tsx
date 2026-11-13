import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  LogOut,
  Menu,
  RefreshCw,
  ShieldCheck,
  UserPlus,
  X,
} from 'lucide-react';
import type { RecentGoogleAccount } from '../lib/firebase';
import type { AppScreen, UserProfile } from '../types';

interface TopBarProps {
  user: UserProfile | null;
  activeScreen: AppScreen;
  portalMode: 'admin' | 'user';
  authLoading?: boolean;
  recentAccounts?: RecentGoogleAccount[];
  onNavigate: (screen: AppScreen) => void;
  onSwitchPortal: (mode: 'admin' | 'user') => void;
  onSignInGoogle: (loginHint?: string) => void;
  onForgetRecentAccount?: (email: string) => void;
  onSignOut: () => void;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase() || 'U';
}

export function TopBar({
  user,
  activeScreen,
  portalMode,
  authLoading = false,
  recentAccounts = [],
  onNavigate,
  onSwitchPortal,
  onSignInGoogle,
  onForgetRecentAccount,
  onSignOut,
}: TopBarProps) {
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setAccountMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAccountMenuOpen(false);
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const otherAccounts = recentAccounts.filter(
    (acc) => !user || acc.email.toLowerCase() !== user.email.toLowerCase()
  );

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 sm:gap-6 px-4 sm:px-6 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              onNavigate(
                user ? (portalMode === 'admin' ? 'admin-dashboard' : 'candidate-dashboard') : 'landing'
              );
            }}
            className="font-display text-base sm:text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 hover:text-blue-700 transition-colors cursor-pointer"
          >
            ExamPulse AI
          </button>
        </div>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          {!user ? (
            <>
              <a href="#capabilities" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
                Capabilities
              </a>
              <a href="#proctoring" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
                Proctoring
              </a>
              <a href="#workflow" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
                Workflow
              </a>
              <a href="#google-ai" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
                Google AI Stack
              </a>
            </>
          ) : (
            <>
              {user.role === 'admin' && (
                <button
                  type="button"
                  onClick={() => {
                    onSwitchPortal('admin');
                    onNavigate('admin-dashboard');
                  }}
                  className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    portalMode === 'admin' && activeScreen.startsWith('admin')
                      ? 'text-blue-700 font-semibold'
                      : 'hover:text-slate-900'
                  }`}
                >
                  Admin Studio
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  onSwitchPortal('user');
                  onNavigate('candidate-dashboard');
                }}
                className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  portalMode === 'user' || activeScreen === 'candidate-dashboard'
                    ? 'text-blue-700 font-semibold'
                    : 'hover:text-slate-900'
                }`}
              >
                Candidate Tests
              </button>
              <button
                type="button"
                onClick={() => onNavigate('landing')}
                className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeScreen === 'landing' ? 'text-blue-700 font-semibold' : ''
                }`}
              >
                Overview
              </button>
            </>
          )}
        </nav>

        {/* Right Controls (Desktop + Mobile Menu Trigger) */}
        <div className="flex items-center gap-2 shrink-0">
          {!user ? (
            <button
              type="button"
              disabled={authLoading}
              onClick={() => onSignInGoogle()}
              className="rounded-lg bg-blue-700 px-3 sm:px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {authLoading ? 'Signing in…' : 'Sign in'}
            </button>
          ) : (
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setAccountMenuOpen((v) => !v)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                aria-expanded={accountMenuOpen}
                aria-haspopup="menu"
              >
                {user.photoUrl ? (
                  <img
                    src={user.photoUrl}
                    alt={user.name}
                    referrerPolicy="no-referrer"
                    className="h-5 w-5 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-800 shrink-0">
                    {getInitials(user.name)}
                  </span>
                )}
                <span className="max-w-[100px] sm:max-w-[150px] truncate">
                  {user.name.split(' ')[0]}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              </button>

              {accountMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-2 shadow-xl z-40"
                >
                  <div className="rounded-lg bg-slate-50 px-3 py-2.5 border border-slate-100">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-900 truncate">
                        {user.name}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold shrink-0 ${
                          user.role === 'admin'
                            ? 'bg-blue-100 text-blue-800'
                            : user.isDemo
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {user.role === 'admin' && <ShieldCheck className="h-3 w-3" />}
                        {user.role === 'admin'
                          ? 'Admin'
                          : user.isDemo
                          ? 'Demo'
                          : 'Candidate'}
                      </span>
                    </div>
                    <div className="mt-0.5 font-mono text-[11px] text-slate-500 truncate">
                      {user.email}
                    </div>
                  </div>

                  {otherAccounts.length > 0 && (
                    <div className="mt-2 border-t border-slate-100 pt-2">
                      <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Switch Gmail in this browser
                      </div>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {otherAccounts.map((acc) => (
                          <div
                            key={acc.email}
                            className="flex items-center justify-between gap-1 rounded-lg hover:bg-slate-50 pr-1"
                          >
                            <button
                              type="button"
                              disabled={authLoading}
                              onClick={() => {
                                setAccountMenuOpen(false);
                                onSignInGoogle(acc.email);
                              }}
                              className="flex flex-1 min-w-0 items-center gap-2 px-2 py-1.5 text-left cursor-pointer"
                            >
                              {acc.photoUrl ? (
                                <img
                                  src={acc.photoUrl}
                                  alt={acc.name}
                                  referrerPolicy="no-referrer"
                                  className="h-5 w-5 rounded-full object-cover shrink-0"
                                />
                              ) : (
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-700 shrink-0">
                                  {getInitials(acc.name)}
                                </span>
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-medium text-slate-800 truncate">
                                  {acc.name}
                                </div>
                                <div className="font-mono text-[10px] text-slate-500 truncate">
                                  {acc.email}
                                </div>
                              </div>
                            </button>
                            {onForgetRecentAccount && (
                              <button
                                type="button"
                                title={`Remove ${acc.email} from quick list`}
                                onClick={() => onForgetRecentAccount(acc.email)}
                                className="p-1 text-slate-300 hover:text-red-600 cursor-pointer"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-2 border-t border-slate-100 pt-2 space-y-1">
                    <button
                      type="button"
                      disabled={authLoading}
                      onClick={() => {
                        setAccountMenuOpen(false);
                        onSignInGoogle();
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 cursor-pointer"
                    >
                      <RefreshCw className="h-3.5 w-3.5 shrink-0" />
                      <span>Choose / Switch Gmail Account</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        onSignOut();
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                    >
                      <LogOut className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Mobile Menu Toggle */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
            className="inline-flex md:hidden items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-3">
          {!user ? (
            <div className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              <a
                href="#capabilities"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-3 py-2 hover:bg-slate-50"
              >
                Capabilities
              </a>
              <a
                href="#proctoring"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-3 py-2 hover:bg-slate-50"
              >
                Proctoring
              </a>
              <a
                href="#workflow"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-3 py-2 hover:bg-slate-50"
              >
                Workflow
              </a>
              <a
                href="#google-ai"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-3 py-2 hover:bg-slate-50"
              >
                Google AI Stack
              </a>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                <div className="text-xs font-semibold text-slate-900 truncate">{user.name}</div>
                <div className="font-mono text-[11px] text-slate-500 truncate">{user.email}</div>
              </div>

              <div className="flex flex-col gap-1 text-sm font-medium">
                {user.role === 'admin' && (
                  <button
                    type="button"
                    onClick={() => {
                      onSwitchPortal('admin');
                      onNavigate('admin-dashboard');
                      setMobileMenuOpen(false);
                    }}
                    className={`rounded-lg px-3 py-2.5 text-left cursor-pointer ${
                      portalMode === 'admin' && activeScreen.startsWith('admin')
                        ? 'bg-blue-50 text-blue-800 font-semibold'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Admin Studio
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    onSwitchPortal('user');
                    onNavigate('candidate-dashboard');
                    setMobileMenuOpen(false);
                  }}
                  className={`rounded-lg px-3 py-2.5 text-left cursor-pointer ${
                    portalMode === 'user' || activeScreen === 'candidate-dashboard'
                      ? 'bg-blue-50 text-blue-800 font-semibold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Candidate Tests
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onNavigate('landing');
                    setMobileMenuOpen(false);
                  }}
                  className={`rounded-lg px-3 py-2.5 text-left cursor-pointer ${
                    activeScreen === 'landing'
                      ? 'bg-blue-50 text-blue-800 font-semibold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Overview
                </button>
              </div>

              <div className="border-t border-slate-200 pt-2.5 flex flex-col gap-2">
                <button
                  type="button"
                  disabled={authLoading}
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onSignInGoogle();
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs font-semibold text-blue-800 hover:bg-blue-100 cursor-pointer"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>Switch Gmail Account</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onSignOut();
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
