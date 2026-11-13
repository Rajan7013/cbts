import { useState, type ReactNode } from 'react';
import {
  LayoutDashboard,
  FileSpreadsheet,
  PlusCircle,
  FileQuestion,
  BarChart3,
  LogOut,
  User,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Sparkles,
} from 'lucide-react';
import type { UserProfile, AppScreen } from '../types';

interface AppSidebarProps {
  user: UserProfile;
  activeScreen: AppScreen;
  portalMode: 'admin' | 'user';
  onNavigate: (screen: AppScreen) => void;
  onSwitchPortal: (mode: 'admin' | 'user') => void;
  onSignOut: () => void;
  children: ReactNode;
}

export function AppSidebarLayout({
  user,
  activeScreen,
  portalMode,
  onNavigate,
  onSwitchPortal,
  onSignOut,
  children,
}: AppSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAdmin = user.role === 'admin';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row overflow-x-hidden">
      {/* Mobile Top Header */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
            aria-label="Open sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-display text-base font-bold text-slate-900">ExamPulse AI</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              isAdmin ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-700'
            }`}
          >
            {isAdmin ? 'Admin' : 'Candidate'}
          </span>
          {user.photoUrl ? (
            <img
              src={user.photoUrl}
              alt={user.name}
              referrerPolicy="no-referrer"
              className="h-7 w-7 rounded-full object-cover border border-slate-200"
            />
          ) : (
            <div className="h-7 w-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
              {user.name[0]}
            </div>
          )}
        </div>
      </header>

      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-950/40 z-50 md:hidden backdrop-blur-xs transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar (Desktop Persistent & Mobile Drawer) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 bg-white border-r border-slate-200 flex flex-col justify-between transition-all duration-200 md:static ${
          mobileOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0'
        } ${collapsed ? 'md:w-20' : 'md:w-64'}`}
      >
        {/* Top Branding & Collapse Button */}
        <div>
          <div className="h-16 flex items-center justify-between px-4 border-b border-slate-100">
            {(!collapsed || mobileOpen) && (
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-blue-700 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                  EP
                </div>
                <div>
                  <span className="font-display font-bold text-slate-900 text-sm tracking-tight block">
                    ExamPulse AI
                  </span>
                  <span className="text-[10px] font-semibold text-blue-700 uppercase tracking-wider block">
                    {isAdmin ? 'Assessment Studio' : 'Candidate Portal'}
                  </span>
                </div>
              </div>
            )}
            {/* Desktop Collapse Toggle */}
            <button
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              className="hidden md:flex p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
            {/* Mobile Close Button */}
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="md:hidden p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            {isAdmin ? (
              <>
                <div className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 ${collapsed && !mobileOpen ? 'hidden' : 'block'}`}>
                  Admin Studio
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onSwitchPortal('admin');
                    onNavigate('admin-dashboard');
                    setMobileOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    activeScreen === 'admin-dashboard'
                      ? 'bg-blue-50 text-blue-700 font-bold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                  title="Dashboard & Tests"
                >
                  <LayoutDashboard className="h-4 w-4 shrink-0 text-blue-700" />
                  {(!collapsed || mobileOpen) && <span>Assessment Tests</span>}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onSwitchPortal('admin');
                    onNavigate('admin-test-builder');
                    setMobileOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    activeScreen === 'admin-test-builder'
                      ? 'bg-blue-50 text-blue-700 font-bold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                  title="Create New Exam"
                >
                  <PlusCircle className="h-4 w-4 shrink-0 text-emerald-600" />
                  {(!collapsed || mobileOpen) && <span>Create New Test</span>}
                </button>

                <div className={`pt-3 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 ${collapsed && !mobileOpen ? 'hidden' : 'block'}`}>
                  Student Mode
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onSwitchPortal('user');
                    onNavigate('candidate-dashboard');
                    setMobileOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    activeScreen === 'candidate-dashboard'
                      ? 'bg-blue-50 text-blue-700 font-bold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                  title="Take Test as Candidate"
                >
                  <FileSpreadsheet className="h-4 w-4 shrink-0 text-indigo-600" />
                  {(!collapsed || mobileOpen) && <span>Candidate Portal</span>}
                </button>
              </>
            ) : (
              <>
                <div className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 ${collapsed && !mobileOpen ? 'hidden' : 'block'}`}>
                  Examinations
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onSwitchPortal('user');
                    onNavigate('candidate-dashboard');
                    setMobileOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    activeScreen === 'candidate-dashboard'
                      ? 'bg-blue-50 text-blue-700 font-bold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                  title="Available Tests & Reports"
                >
                  <FileSpreadsheet className="h-4 w-4 shrink-0 text-blue-700" />
                  {(!collapsed || mobileOpen) && <span>My Tests &amp; Reports</span>}
                </button>
              </>
            )}
          </nav>
        </div>

        {/* User Profile & Sign Out Footer */}
        <div className="p-3 border-t border-slate-100">
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg bg-slate-50 border border-slate-200/60">
            {user.photoUrl ? (
              <img
                src={user.photoUrl}
                alt={user.name}
                referrerPolicy="no-referrer"
                className="h-8 w-8 rounded-full object-cover shrink-0 border border-slate-200"
              />
            ) : (
              <div className="h-8 w-8 rounded-full bg-blue-700 text-white flex items-center justify-center font-bold text-xs shrink-0">
                {user.name[0]}
              </div>
            )}
            {(!collapsed || mobileOpen) && (
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-slate-900 truncate">{user.name}</div>
                <div className="text-[10px] text-slate-500 font-mono truncate">{user.email}</div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onSignOut}
            className={`mt-2 w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer ${
              collapsed && !mobileOpen ? 'justify-center' : ''
            }`}
            title="Sign Out"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {(!collapsed || mobileOpen) && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
