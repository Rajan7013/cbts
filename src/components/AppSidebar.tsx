import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  LayoutGrid,
  FileSpreadsheet,
  PlusCircle,
  BarChart3,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
  GraduationCap,
  ChevronDown,
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

interface NavItemProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  isActive: boolean;
  collapsed: boolean;
  mobileOpen: boolean;
  onClick: () => void;
  badge?: string;
  badgeColor?: string;
}

function SidebarNavItem({
  icon: Icon,
  label,
  isActive,
  collapsed,
  mobileOpen,
  onClick,
  badge,
  badgeColor = 'bg-blue-100 text-blue-700',
}: NavItemProps) {
  const isCompact = collapsed && !mobileOpen;

  return (
    <div className="relative group">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className={`w-full flex items-center rounded-xl transition-all duration-200 cursor-pointer ${
          isCompact
            ? 'justify-center h-11 w-11 mx-auto'
            : 'gap-3 px-3.5 py-2.5'
        } ${
          isActive
            ? 'bg-blue-50 text-blue-700 font-bold shadow-xs border border-blue-200/60'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 border border-transparent'
        }`}
      >
        <Icon className={`h-5 w-5 shrink-0 ${isActive ? 'text-blue-700' : 'text-slate-500 group-hover:text-slate-900'}`} />
        {!isCompact && (
          <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
            <span className="truncate text-xs font-semibold">{label}</span>
            {badge && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${badgeColor}`}>
                {badge}
              </span>
            )}
          </div>
        )}
      </button>

      {/* Floating tooltip on collapsed view */}
      {isCompact && (
        <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3.5 z-50 hidden group-hover:flex items-center">
          <div className="relative rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-xl whitespace-nowrap">
            <div className="flex items-center gap-1.5">
              <span>{label}</span>
              {badge && (
                <span className="text-[10px] px-1 py-0.2 rounded bg-slate-800 text-slate-300">
                  {badge}
                </span>
              )}
            </div>
            {/* Arrow pointing left */}
            <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-900" />
          </div>
        </div>
      )}
    </div>
  );
}

const DEFAULT_SIDEBAR_WIDTH = 256;
const MIN_SIDEBAR_WIDTH = 190;
const MAX_SIDEBAR_WIDTH = 460;
const COMPACT_SIDEBAR_WIDTH = 76;

export function AppSidebarLayout({
  user,
  activeScreen,
  portalMode: _portalMode,
  onNavigate,
  onSwitchPortal,
  onSignOut,
  children,
}: AppSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return DEFAULT_SIDEBAR_WIDTH;
    const saved = localStorage.getItem('exampulse_sidebar_width');
    const parsed = saved ? parseInt(saved, 10) : DEFAULT_SIDEBAR_WIDTH;
    return isNaN(parsed)
      ? DEFAULT_SIDEBAR_WIDTH
      : Math.min(Math.max(parsed, MIN_SIDEBAR_WIDTH), MAX_SIDEBAR_WIDTH);
  });

  const isAdmin = user.role === 'admin';
  const isCompact = collapsed && !mobileOpen;

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handlePointerMove = (e: PointerEvent) => {
      const nextWidth = Math.min(
        Math.max(e.clientX, MIN_SIDEBAR_WIDTH),
        MAX_SIDEBAR_WIDTH
      );
      setSidebarWidth(nextWidth);
    };

    const handlePointerUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizing]);

  // Persist sidebar width to localStorage
  useEffect(() => {
    if (!isResizing) {
      try {
        localStorage.setItem('exampulse_sidebar_width', sidebarWidth.toString());
      } catch {
        // ignore
      }
    }
  }, [sidebarWidth, isResizing]);

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

      {/* Sidebar: Desktop Persistent & Mobile Drawer */}
      <aside
        style={
          !mobileOpen
            ? {
                width: isCompact ? `${COMPACT_SIDEBAR_WIDTH}px` : `${sidebarWidth}px`,
              }
            : undefined
        }
        className={`fixed inset-y-0 left-0 z-50 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 md:static ${
          mobileOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0'
        } ${
          isResizing
            ? 'transition-none select-none'
            : 'transition-[width,transform] duration-200 ease-out'
        }`}
      >
        {/* Desktop Drag-to-Resize Handle */}
        {!isCompact && (
          <div
            onPointerDown={handlePointerDown}
            onDoubleClick={() => setSidebarWidth(DEFAULT_SIDEBAR_WIDTH)}
            title="Drag left or right to resize sidebar (double-click to reset)"
            className={`hidden md:block absolute top-0 right-0 w-1.5 h-full cursor-col-resize z-20 group hover:w-2 transition-all ${
              isResizing ? 'w-2 bg-blue-600' : 'hover:bg-blue-400/40'
            }`}
          >
            <div
              className={`w-0.5 h-10 mx-auto my-auto absolute inset-y-0 right-0.5 rounded-full ${
                isResizing ? 'bg-white' : 'group-hover:bg-blue-600'
              }`}
            />
          </div>
        )}
        {/* Top Header & Collapse/Expand Toggle */}
        <div>
          <div className="h-16 flex items-center justify-between px-3.5 border-b border-slate-100">
            {!isCompact ? (
              <>
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-9 w-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                    EP
                  </div>
                  <div className="min-w-0">
                    <span className="font-display font-bold text-slate-900 text-sm tracking-tight truncate block leading-tight">
                      ExamPulse
                    </span>
                    <span className="text-[9px] font-bold text-blue-600 uppercase tracking-wider block mt-0.5">
                      {isAdmin ? 'Assessment Studio' : 'Candidate Portal'}
                    </span>
                  </div>
                </div>

                <div className="relative group">
                  <button
                    type="button"
                    onClick={() => setCollapsed(true)}
                    className="hidden md:flex p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                    aria-label="Collapse sidebar"
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </button>
                  <div className="pointer-events-none absolute right-0 top-full mt-1.5 z-50 hidden group-hover:flex items-center">
                    <div className="rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white shadow-md whitespace-nowrap">
                      Collapse sidebar
                    </div>
                  </div>
                </div>

                {/* Mobile Close Button */}
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="md:hidden p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </>
            ) : (
              /* Centered layout when collapsed */
              <div className="w-full flex items-center justify-center">
                <div className="relative group">
                  <button
                    type="button"
                    onClick={() => setCollapsed(false)}
                    className="p-2 rounded-xl text-slate-600 hover:text-blue-700 hover:bg-blue-50 transition-colors cursor-pointer"
                    aria-label="Expand sidebar"
                  >
                    <PanelLeftOpen className="h-5 w-5" />
                  </button>
                  <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3.5 z-50 hidden group-hover:flex items-center">
                    <div className="relative rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-xl whitespace-nowrap">
                      Expand sidebar
                      <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-900" />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            {isAdmin ? (
              <>
                {!isCompact && (
                  <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    ADMIN STUDIO
                  </div>
                )}

                <SidebarNavItem
                  icon={LayoutGrid}
                  label="Tests"
                  isActive={activeScreen === 'admin-dashboard'}
                  collapsed={collapsed}
                  mobileOpen={mobileOpen}
                  onClick={() => {
                    onSwitchPortal('admin');
                    onNavigate('admin-dashboard');
                    setMobileOpen(false);
                  }}
                />

                <SidebarNavItem
                  icon={PlusCircle}
                  label="New Test"
                  isActive={activeScreen === 'admin-test-builder'}
                  collapsed={collapsed}
                  mobileOpen={mobileOpen}
                  onClick={() => {
                    onSwitchPortal('admin');
                    onNavigate('admin-test-builder');
                    setMobileOpen(false);
                  }}
                />

                <SidebarNavItem
                  icon={BarChart3}
                  label="Candidate Results"
                  isActive={activeScreen === 'admin-results'}
                  collapsed={collapsed}
                  mobileOpen={mobileOpen}
                  onClick={() => {
                    onSwitchPortal('admin');
                    onNavigate('admin-results');
                    setMobileOpen(false);
                  }}
                />

                {!isCompact && (
                  <div className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    SWITCH MODE
                  </div>
                )}

                <SidebarNavItem
                  icon={GraduationCap}
                  label="Candidate View"
                  isActive={activeScreen === 'candidate-dashboard'}
                  collapsed={collapsed}
                  mobileOpen={mobileOpen}
                  onClick={() => {
                    onSwitchPortal('user');
                    onNavigate('candidate-dashboard');
                    setMobileOpen(false);
                  }}
                />
              </>
            ) : (
              <>
                {!isCompact && (
                  <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    EXAMINATIONS
                  </div>
                )}

                <SidebarNavItem
                  icon={FileSpreadsheet}
                  label="My Tests & Reports"
                  isActive={activeScreen === 'candidate-dashboard'}
                  collapsed={collapsed}
                  mobileOpen={mobileOpen}
                  onClick={() => {
                    onSwitchPortal('user');
                    onNavigate('candidate-dashboard');
                    setMobileOpen(false);
                  }}
                />
              </>
            )}
          </nav>
        </div>

        {/* User Profile & Sign Out Footer */}
        <div className="p-3 border-t border-slate-100">
          <div className="relative group">
            <div
              className={`flex items-center rounded-xl bg-slate-50/80 hover:bg-slate-100 border border-slate-200/60 p-2 transition-all cursor-pointer ${
                isCompact ? 'justify-center' : 'justify-between gap-2'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {user.photoUrl ? (
                  <img
                    src={user.photoUrl}
                    alt={user.name}
                    referrerPolicy="no-referrer"
                    className="h-8 w-8 rounded-full object-cover shrink-0 border border-slate-200"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                    {user.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase() || 'U'}
                  </div>
                )}
                {!isCompact && (
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 truncate leading-tight">{user.name}</div>
                    <div className="text-[10px] text-slate-500 font-sans truncate">{user.email}</div>
                  </div>
                )}
              </div>

              {!isCompact && (
                <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
              )}
            </div>

            {/* User profile tooltip on collapsed */}
            {isCompact && (
              <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3.5 z-50 hidden group-hover:flex items-center">
                <div className="relative rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-xl whitespace-nowrap">
                  <div className="font-bold text-slate-100">{user.name}</div>
                  <div className="text-[10px] text-slate-400">{user.email}</div>
                  <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-900" />
                </div>
              </div>
            )}
          </div>

          {/* Visible Sign Out button below profile card */}
          {!isCompact ? (
            <button
              type="button"
              onClick={onSignOut}
              className="mt-2.5 w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5 shrink-0" />
              <span>Sign Out</span>
            </button>
          ) : (
            <div className="relative group mt-2">
              <button
                type="button"
                onClick={onSignOut}
                className="w-full flex items-center justify-center h-10 w-10 mx-auto rounded-xl text-slate-600 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                aria-label="Sign Out"
              >
                <LogOut className="h-4 w-4" />
              </button>
              <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3.5 z-50 hidden group-hover:flex items-center">
                <div className="relative rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-xl whitespace-nowrap">
                  <span>Sign Out</span>
                  <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-900" />
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
