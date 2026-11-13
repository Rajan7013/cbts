import { Fragment, type ReactNode } from 'react';
import {
  getGlobalKatexEngine,
  renderKatexToString,
  type KatexDelimiterRule,
} from '../lib/katexConfig';

interface MathTextProps {
  text?: string | null;
  className?: string;
  inline?: boolean;
}

type Segment =
  | { type: 'text'; value: string }
  | { type: 'math-inline'; value: string }
  | { type: 'math-display'; value: string };

const BARE_LATEX_PATTERN =
  /\\(?:frac\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}|sqrt(?:\[[^\]]+\])?\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}|ce\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}|pu\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}|text\{[^{}]*\}|vec\{[^{}]*\}|hat\{[^{}]*\}|bar\{[^{}]*\}|overline\{[^{}]*\}|theta|alpha|beta|gamma|delta|Delta|epsilon|varepsilon|zeta|eta|iota|kappa|lambda|Lambda|mu|nu|xi|pi|Pi|rho|sigma|Sigma|tau|phi|Phi|chi|psi|Psi|omega|Omega|times|cdot|div|pm|mp|approx|equiv|propto|leq|geq|neq|le|ge|infty|rightarrow|Rightarrow|leftrightarrow|degree|circ)(?![A-Za-z])/;

/**
 * Brace-aware & escape-aware end-delimiter scanner modeled after KaTeX auto-render,
 * preventing early termination on nested `{...}` or escaped `\\)` / `\\]` sequences.
 */
function findEndOfMath(
  rightDelimiter: string,
  text: string,
  startIndex: number,
  singleLineOnly = false
): number {
  let index = startIndex;
  let braceLevel = 0;
  const delimLen = rightDelimiter.length;

  while (index < text.length) {
    const ch = text[index];
    if (singleLineOnly && ch === '\n') {
      return -1;
    }
    if (braceLevel <= 0 && text.slice(index, index + delimLen) === rightDelimiter) {
      return index;
    }
    if (ch === '\\') {
      // Skip the escaped character (unless the right delimiter itself starts with `\`,
      // in which case check first on the next non-escaped iteration).
      index += 2;
      continue;
    }
    if (ch === '{') {
      braceLevel++;
    } else if (ch === '}' && braceLevel > 0) {
      braceLevel--;
    }
    index++;
  }

  return -1;
}

function unescapeDoubleEscapedTex(expr: string): string {
  // Convert double-escaped LaTeX commands (e.g. \\frac, \\sqrt, \\theta) emitted by
  // exported question banks while keeping true line breaks (\\ followed by space/newline) intact.
  return expr.replace(/\\\\([A-Za-z])/g, '\\$1');
}

function isCurrencySpan(inner: string): boolean {
  const trimmed = inner.trim();
  if (!trimmed) return true;
  if (/[\\^_{}=+\-*/<>]/.test(trimmed)) return false;
  // e.g. "$10 and $20", "$5.50 per item", "$100"
  if (/^\d[\d,.]*(?:\s+[a-z]{2,}|\s*$)/i.test(trimmed)) {
    return true;
  }
  // Unbalanced padding with plain English words and no math syntax
  if ((inner.startsWith(' ') || inner.endsWith(' ')) && /\s+[a-z]{2,}/i.test(trimmed)) {
    return true;
  }
  return false;
}

/**
 * Splits input string into plain text, inline math, and display math using the
 * globally configured KaTeX delimiters ($$, $, \[, \(, double-escaped, LMS tags, AMS envs).
 */
function tokenizeMath(input: string): Segment[] {
  const { delimiters } = getGlobalKatexEngine();
  // Sort longest `left` delimiter first so `$$`, `\\[`, `\\(` match before `$`, `\[`, `\(`.
  const orderedDelimiters: KatexDelimiterRule[] = [...delimiters].sort(
    (a, b) => b.left.length - a.left.length
  );

  const segments: Segment[] = [];
  let textBuf = '';
  let i = 0;

  const flushText = () => {
    if (textBuf) {
      segments.push({ type: 'text', value: textBuf });
      textBuf = '';
    }
  };

  while (i < input.length) {
    // Escaped literal dollar sign `\$` outside math
    if (input[i] === '\\' && input[i + 1] === '$') {
      textBuf += '$';
      i += 2;
      continue;
    }

    let matchedRule: KatexDelimiterRule | null = null;
    for (const rule of orderedDelimiters) {
      if (input.startsWith(rule.left, i)) {
        matchedRule = rule;
        break;
      }
    }

    if (matchedRule) {
      const startContent = i + matchedRule.left.length;
      const isSingleDollar = matchedRule.left === '$';
      const isDoubleEscaped =
        matchedRule.left.startsWith('\\\\') && !matchedRule.keepEnvironment;

      const endIdx = findEndOfMath(
        matchedRule.right,
        input,
        startContent,
        isSingleDollar
      );

      if (endIdx !== -1) {
        const rawInner = input.slice(startContent, endIdx);
        const trimmed = rawInner.trim();

        if (matchedRule.keepEnvironment) {
          const fullEnv = input.slice(i, endIdx + matchedRule.right.length).trim();
          if (fullEnv) {
            flushText();
            segments.push({
              type: matchedRule.display ? 'math-display' : 'math-inline',
              value: fullEnv,
            });
            i = endIdx + matchedRule.right.length;
            continue;
          }
        } else if (trimmed && (!isSingleDollar || !isCurrencySpan(rawInner))) {
          flushText();
          const finalExpr = isDoubleEscaped ? unescapeDoubleEscapedTex(trimmed) : trimmed;
          segments.push({
            type: matchedRule.display ? 'math-display' : 'math-inline',
            value: finalExpr,
          });
          i = endIdx + matchedRule.right.length;
          continue;
        }
      }
    }

    textBuf += input[i];
    i += 1;
  }

  flushText();
  return segments;
}

function renderKatexHtml(expr: string, displayMode: boolean): string {
  return renderKatexToString(expr, displayMode);
}

/**
 * Renders un-delimited math/science expressions cleanly:
 * - Bare LaTeX commands (\frac{a}{b}, \sqrt{x}, \theta, \times, etc.) -> KaTeX
 * - Exponents / squares (m/s^2, x^2, 10^-3, 10^{-5}, (a+b)^2) -> <sup>
 * - Underscore subscripts (m_1, T_2, F_{net}, v_0) -> <sub>
 * - Common physics indexed variables (m1, m2, T2, v1, F1, m2g) -> <sub>
 */
function renderPlainMathNotation(text: string, keyPrefix: string): ReactNode[] {
  const tokenRegex = new RegExp(
    [
      // 1. URLs (preserve untouched)
      `https?:\\/\\/[^\\s]+`,
      // 2. Bare LaTeX commands
      BARE_LATEX_PATTERN.source,
      // 3. Exponents: base^exp (e.g. s^2, 10^-3, 10^{-5}, (x+1)^2, x^(n+1))
      `(?:\\([^()\\n]+\\)|[A-Za-z0-9)\\]]+)\\^(?:\\{[^}\\n]+\\}|\\([^)\\n]+\\)|-?\\d+[A-Za-z]?|[A-Za-z])`,
      // 4. Underscore subscripts on short math tokens (e.g. m_1, T_2, F_{net}, KE_1)
      `(?<![A-Za-z0-9_])[A-Za-z]{1,2}_(?:\\{[^}\\n]+\\}|[A-Za-z0-9]{1,4})(?![A-Za-z0-9_])`,
      // 5. Common un-underscored physics/chem variables (m1, m2, T2, v1, F1, R2, m2g, H2O, CO2)
      `(?<![A-Za-z0-9])[mTvuFRqVIPnkxyrh][0-9](?![0-9.])|(?<![A-Za-z0-9])a[0-3](?![A-Za-z0-9.])|\\b(?:H2O|CO2|SO2|NO2|O2|N2|H2|Cl2)\\b`,
    ].join('|'),
    'g'
  );

  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let partIdx = 0;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(
        <Fragment key={`${keyPrefix}-t-${partIdx++}`}>
          {text.slice(lastIndex, match.index)}
        </Fragment>
      );
    }

    const token = match[0];

    if (/^https?:\/\//.test(token)) {
      nodes.push(<Fragment key={`${keyPrefix}-u-${partIdx++}`}>{token}</Fragment>);
    } else if (token.startsWith('\\')) {
      nodes.push(
        <span
          key={`${keyPrefix}-k-${partIdx++}`}
          className="katex-inline-wrap"
          dangerouslySetInnerHTML={{ __html: renderKatexHtml(token, false) }}
        />
      );
    } else if (token.includes('^')) {
      const caretIdx = token.indexOf('^');
      const base = token.slice(0, caretIdx);
      let exp = token.slice(caretIdx + 1);
      if (
        (exp.startsWith('{') && exp.endsWith('}')) ||
        (exp.startsWith('(') && exp.endsWith(')'))
      ) {
        exp = exp.slice(1, -1);
      }
      nodes.push(
        <span key={`${keyPrefix}-sup-${partIdx++}`} className="whitespace-nowrap">
          {renderPlainMathNotation(base, `${keyPrefix}-sb-${partIdx}`)}
          <sup className="text-[0.74em] leading-none font-normal ml-[0.5px]">
            {exp}
          </sup>
        </span>
      );
    } else if (token.includes('_')) {
      const underIdx = token.indexOf('_');
      const base = token.slice(0, underIdx);
      let sub = token.slice(underIdx + 1);
      if (sub.startsWith('{') && sub.endsWith('}')) {
        sub = sub.slice(1, -1);
      }
      nodes.push(
        <span key={`${keyPrefix}-sub-${partIdx++}`} className="whitespace-nowrap">
          {base}
          <sub className="text-[0.74em] leading-none font-normal ml-[0.5px]">
            {sub}
          </sub>
        </span>
      );
    } else if (/^(H2O|CO2|SO2|NO2|O2|N2|H2|Cl2)$/.test(token)) {
      const chemParts = token.split(/(2)/g);
      nodes.push(
        <span key={`${keyPrefix}-ch-${partIdx++}`} className="whitespace-nowrap">
          {chemParts.map((cp, ci) =>
            cp === '2' ? (
              <sub key={ci} className="text-[0.74em] leading-none font-normal">
                2
              </sub>
            ) : (
              <Fragment key={ci}>{cp}</Fragment>
            )
          )}
        </span>
      );
    } else {
      // Single-letter physics subscript like m1, T2, m2g -> m<sub>1</sub>, T<sub>2</sub>
      const base = token[0];
      const digit = token[1];
      nodes.push(
        <span key={`${keyPrefix}-pv-${partIdx++}`} className="whitespace-nowrap">
          {base}
          <sub className="text-[0.74em] leading-none font-normal ml-[0.5px]">
            {digit}
          </sub>
        </span>
      );
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(
      <Fragment key={`${keyPrefix}-tail`}>{text.slice(lastIndex)}</Fragment>
    );
  }

  return nodes;
}

function renderInlineMarkdown(text: string, keyPrefix: string) {
  // Handle **bold**, `code`, and strict *italic* (never consuming multiplication like m2*g = m2*a)
  const parts = text.split(
    /(\*\*[^*\n]+\*\*|`[^`\n]+`|(?<![A-Za-z0-9)\]}])\*(?!\s)[^*\n=]+(?<!\s)\*(?![A-Za-z0-9(\[{]))/g
  );
  return parts.map((part, idx) => {
    const key = `${keyPrefix}-${idx}`;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={key} className="font-semibold text-slate-900">
          {renderPlainMathNotation(part.slice(2, -2), `${key}-b`)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={key}
          className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.88em] text-slate-800"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (
      part.startsWith('*') &&
      part.endsWith('*') &&
      !part.startsWith('**') &&
      part.length > 2
    ) {
      return (
        <em key={key} className="italic">
          {renderPlainMathNotation(part.slice(1, -1), `${key}-i`)}
        </em>
      );
    }
    return <Fragment key={key}>{renderPlainMathNotation(part, key)}</Fragment>;
  });
}

export function MathText({ text, className = '', inline = false }: MathTextProps) {
  if (!text) return null;

  const segments = tokenizeMath(text);

  if (inline) {
    return (
      <span className={`math-text ${className}`}>
        {segments.map((seg, idx) => {
          if (seg.type === 'math-inline' || seg.type === 'math-display') {
            return (
              <span
                key={idx}
                className="katex-inline-wrap"
                dangerouslySetInnerHTML={{
                  __html: renderKatexHtml(seg.value, false),
                }}
              />
            );
          }
          const lines = seg.value.split('\n');
          return (
            <Fragment key={idx}>
              {lines.map((line, lIdx) => (
                <Fragment key={lIdx}>
                  {lIdx > 0 && ' '}
                  {renderInlineMarkdown(line, `${idx}-${lIdx}`)}
                </Fragment>
              ))}
            </Fragment>
          );
        })}
      </span>
    );
  }

  return (
    <div className={`math-text break-words ${className}`}>
      {segments.map((seg, idx) => {
        if (seg.type === 'math-display') {
          return (
            <div
              key={idx}
              className="my-2 overflow-x-auto py-1 text-center"
              dangerouslySetInnerHTML={{
                __html: renderKatexHtml(seg.value, true),
              }}
            />
          );
        }
        if (seg.type === 'math-inline') {
          return (
            <span
              key={idx}
              className="katex-inline-wrap"
              dangerouslySetInnerHTML={{
                __html: renderKatexHtml(seg.value, false),
              }}
            />
          );
        }

        // Preserve paragraphs, headings, bullets, and single newlines cleanly
        const lines = seg.value.split('\n');
        return (
          <Fragment key={idx}>
            {lines.map((line, lIdx) => {
              const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
              if (headingMatch) {
                return (
                  <span
                    key={lIdx}
                    className="block font-display font-semibold text-slate-900 mt-1.5 mb-0.5"
                  >
                    {renderInlineMarkdown(headingMatch[2], `${idx}-${lIdx}`)}
                  </span>
                );
              }
              const bulletMatch = line.match(/^[-*]\s+(.+)$/);
              if (bulletMatch && lIdx > 0) {
                return (
                  <span key={lIdx} className="block pl-3.5 relative mt-0.5">
                    <span className="absolute left-0 text-slate-400">•</span>
                    {renderInlineMarkdown(bulletMatch[1], `${idx}-${lIdx}`)}
                  </span>
                );
              }
              return (
                <Fragment key={lIdx}>
                  {lIdx > 0 && <br />}
                  {renderInlineMarkdown(line, `${idx}-${lIdx}`)}
                </Fragment>
              );
            })}
          </Fragment>
        );
      })}
    </div>
  );
}
