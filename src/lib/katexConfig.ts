import katex, { type KatexOptions } from 'katex';
import 'katex/dist/katex.min.css';
import 'katex/contrib/mhchem';
import renderMathInElement from 'katex/contrib/auto-render';

export interface KatexDelimiterRule {
  left: string;
  right: string;
  display: boolean;
  keepEnvironment?: boolean;
}

export interface GlobalKatexEngineConfig {
  delimiters: KatexDelimiterRule[];
  macros: Record<string, string>;
  throwOnError: boolean;
  strict: boolean | 'ignore' | 'warn' | 'error';
  trust: boolean;
  ignoredTags: Array<keyof HTMLElementTagNameMap>;
  ignoredClasses: string[];
}

declare global {
  interface Window {
    __EXAMPULSE_KATEX_CONFIG__?: GlobalKatexEngineConfig;
  }
}

export const GLOBAL_KATEX_DELIMITERS: KatexDelimiterRule[] = [
  // Double-escaped delimiters commonly found in JSON/CSV/SQL exported question banks
  { left: '\\\\[', right: '\\\\]', display: true },
  { left: '\\\\(', right: '\\\\)', display: false },
  // Standard KaTeX / LaTeX delimiters
  { left: '$$', right: '$$', display: true },
  { left: '\\[', right: '\\]', display: true },
  { left: '\\(', right: '\\)', display: false },
  // Legacy LMS / BBCode / Moodle / WordPress math tags
  { left: '[tex]', right: '[/tex]', display: false },
  { left: '[latex]', right: '[/latex]', display: false },
  // AMS & LaTeX environments even when exported without outer math delimiters
  { left: '\\begin{equation}', right: '\\end{equation}', display: true, keepEnvironment: true },
  { left: '\\begin{equation*}', right: '\\end{equation*}', display: true, keepEnvironment: true },
  { left: '\\begin{align}', right: '\\end{align}', display: true, keepEnvironment: true },
  { left: '\\begin{align*}', right: '\\end{align*}', display: true, keepEnvironment: true },
  { left: '\\begin{alignat}', right: '\\end{alignat}', display: true, keepEnvironment: true },
  { left: '\\begin{alignat*}', right: '\\end{alignat*}', display: true, keepEnvironment: true },
  { left: '\\begin{gather}', right: '\\end{gather}', display: true, keepEnvironment: true },
  { left: '\\begin{gather*}', right: '\\end{gather*}', display: true, keepEnvironment: true },
  { left: '\\begin{CD}', right: '\\end{CD}', display: true, keepEnvironment: true },
  { left: '\\begin{cases}', right: '\\end{cases}', display: true, keepEnvironment: true },
  { left: '\\begin{pmatrix}', right: '\\end{pmatrix}', display: false, keepEnvironment: true },
  { left: '\\begin{bmatrix}', right: '\\end{bmatrix}', display: false, keepEnvironment: true },
  // Single dollar inline math (evaluated after $$)
  { left: '$', right: '$', display: false },
];

export const GLOBAL_KATEX_MACROS: Record<string, string> = {
  '\\degree': '^\\circ',
  '\\celsius': '^\\circ\\text{C}',
  '\\R': '\\mathbb{R}',
  '\\N': '\\mathbb{N}',
  '\\Z': '\\mathbb{Z}',
  '\\Q': '\\mathbb{Q}',
  '\\C': '\\mathbb{C}',
  '\\E': '\\mathbb{E}',
  '\\Var': '\\operatorname{Var}',
  '\\Cov': '\\operatorname{Cov}',
  '\\lt': '<',
  '\\gt': '>',
  '\\implies': '\\Rightarrow',
  '\\iff': '\\Leftrightarrow',
};

let activeConfig: GlobalKatexEngineConfig = {
  delimiters: [...GLOBAL_KATEX_DELIMITERS],
  macros: { ...GLOBAL_KATEX_MACROS },
  throwOnError: false,
  strict: false,
  trust: false,
  ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code', 'option', 'input'],
  ignoredClasses: ['math-text', 'katex', 'katex-inline-wrap', 'no-katex'],
};

if (typeof window !== 'undefined') {
  window.__EXAMPULSE_KATEX_CONFIG__ = activeConfig;
}

export function configureGlobalKatexEngine(
  overrides: Partial<GlobalKatexEngineConfig> = {}
): GlobalKatexEngineConfig {
  activeConfig = {
    ...activeConfig,
    ...overrides,
    delimiters: overrides.delimiters ? [...overrides.delimiters] : activeConfig.delimiters,
    macros: overrides.macros
      ? { ...activeConfig.macros, ...overrides.macros }
      : activeConfig.macros,
    ignoredTags: overrides.ignoredTags ? [...overrides.ignoredTags] : activeConfig.ignoredTags,
    ignoredClasses: overrides.ignoredClasses
      ? [...overrides.ignoredClasses]
      : activeConfig.ignoredClasses,
  };

  if (typeof window !== 'undefined') {
    window.__EXAMPULSE_KATEX_CONFIG__ = activeConfig;
  }

  return activeConfig;
}

export function getGlobalKatexEngine(): GlobalKatexEngineConfig {
  return activeConfig;
}

/**
 * Normalizes common exported question-bank artifacts inside math segments
 * (e.g., HTML-encoded operators from Moodle/Canvas/LMS XML/JSON exports).
 */
export function preprocessMathExpression(expr: string): string {
  return expr
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&minus;/gi, '-')
    .replace(/&times;/gi, '\\times ')
    .replace(/&divide;/gi, '\\div ')
    .replace(/&plusmn;/gi, '\\pm ');
}

export function renderKatexToString(expr: string, displayMode: boolean): string {
  const cfg = getGlobalKatexEngine();
  const katexOptions: KatexOptions = {
    displayMode,
    throwOnError: cfg.throwOnError,
    strict: cfg.strict,
    trust: cfg.trust,
    macros: { ...cfg.macros },
  };
  try {
    return katex.renderToString(preprocessMathExpression(expr), katexOptions);
  } catch {
    return expr;
  }
}

export function renderKatexInContainer(element: HTMLElement | null): void {
  if (!element) return;
  const cfg = getGlobalKatexEngine();
  try {
    renderMathInElement(element, {
      delimiters: cfg.delimiters.map(({ left, right, display }) => ({ left, right, display })),
      ignoredTags: cfg.ignoredTags,
      ignoredClasses: cfg.ignoredClasses,
      throwOnError: cfg.throwOnError,
      strict: cfg.strict,
      trust: cfg.trust,
      macros: { ...cfg.macros },
      preProcess: preprocessMathExpression,
      errorCallback: () => {
        // Keep invalid fragments readable without throwing into the UI
      },
    });
  } catch {
    // Non-fatal fallback for malformed DOM fragments
  }
}
