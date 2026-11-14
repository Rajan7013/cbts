import { useEffect, useState } from 'react';
import { ZoomIn, X, AlertTriangle, RefreshCw } from 'lucide-react';

export function normalizeQuestionImageUrl(raw?: string): string {
  if (!raw || typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';

  // If raw XML SVG string was passed without data URL prefix
  if (trimmed.startsWith('<svg') || trimmed.startsWith('<?xml')) {
    try {
      const b64 = btoa(unescape(encodeURIComponent(trimmed)));
      return `data:image/svg+xml;base64,${b64}`;
    } catch {
      return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(trimmed)}`;
    }
  }

  // If data:image/svg+xml;utf8,... was stored, convert to robust base64
  if (trimmed.startsWith('data:image/svg+xml;utf8,')) {
    try {
      const rawSvg = decodeURIComponent(trimmed.slice('data:image/svg+xml;utf8,'.length));
      const b64 = btoa(unescape(encodeURIComponent(rawSvg)));
      return `data:image/svg+xml;base64,${b64}`;
    } catch {
      return trimmed.replace('data:image/svg+xml;utf8,', 'data:image/svg+xml;charset=utf-8,');
    }
  }

  return trimmed;
}

interface QuestionImageProps {
  src?: string;
  alt?: string;
  className?: string;
  allowZoom?: boolean;
}

export function QuestionImage({
  src,
  alt = 'Question diagram',
  className = '',
  allowZoom = true,
}: QuestionImageProps) {
  const [loadError, setLoadError] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const normalized = normalizeQuestionImageUrl(src);

  // Automatically reset loadError whenever src changes so new images always render
  useEffect(() => {
    setLoadError(false);
  }, [src, normalized]);

  if (!normalized) return null;

  if (loadError) {
    return (
      <div className="my-2.5 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-900 shadow-2xs">
        <div className="flex items-center gap-2 min-w-0">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
          <div className="truncate">
            <span className="font-semibold block">Image preview could not be loaded</span>
            <span className="text-[10px] text-amber-700 truncate block">Check format or re-upload diagram</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setLoadError(false)}
          className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100 cursor-pointer shrink-0"
        >
          <RefreshCw className="h-3 w-3" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="relative group my-2.5 inline-block overflow-hidden rounded-xl border border-slate-200/90 bg-white p-2 shadow-2xs">
        <img
          src={normalized}
          alt={alt}
          loading="eager"
          referrerPolicy="no-referrer"
          crossOrigin="anonymous"
          onError={() => setLoadError(true)}
          className={`max-h-72 w-auto max-w-full rounded-lg object-contain transition-transform duration-200 ${
            allowZoom ? 'cursor-zoom-in group-hover:scale-[1.01]' : ''
          } ${className}`}
          onClick={() => {
            if (allowZoom) setIsZoomed(true);
          }}
        />

        {allowZoom && (
          <button
            type="button"
            onClick={() => setIsZoomed(true)}
            title="Click to zoom diagram"
            className="absolute bottom-3 right-3 rounded-lg bg-slate-900/75 p-1.5 text-white opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-xs cursor-pointer shadow-sm"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Lightbox / Zoom Modal */}
      {isZoomed && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setIsZoomed(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[92vh] max-w-[94vw] rounded-2xl bg-white p-4 shadow-2xl border border-slate-700/50 flex flex-col items-center"
          >
            <div className="flex w-full items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-700">{alt}</span>
              <button
                type="button"
                onClick={() => setIsZoomed(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                title="Close zoom view"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-auto p-2 max-h-[82vh] flex items-center justify-center">
              <img
                src={normalized}
                alt={alt}
                referrerPolicy="no-referrer"
                crossOrigin="anonymous"
                className="max-h-[78vh] max-w-full rounded-lg object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
