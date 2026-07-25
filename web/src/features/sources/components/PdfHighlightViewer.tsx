"use client"

import React, { useEffect, useState, useRef } from 'react';
import { findExcerptMatch } from './SourceViewer';
import { Loader2, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, FileText, AlertCircle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PdfHighlightViewerProps {
  url: string;
  pageNumber?: number;
  excerpt?: string;
  displayName?: string;
  className?: string;
}

export function PdfHighlightViewer({
  url,
  pageNumber = 1,
  excerpt,
  displayName,
  className,
}: PdfHighlightViewerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [numPages, setNumPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(pageNumber);
  const [scale, setScale] = useState(1.2);
  const [textItems, setTextItems] = useState<any[]>([]);
  const [pageViewport, setPageViewport] = useState<any>(null);
  const [highlightMatch, setHighlightMatch] = useState<{ start: number; end: number } | null>(null);
  const [useIframeFallback, setUseIframeFallback] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const highlightRef = useRef<HTMLSpanElement | null>(null);

  // Sync currentPage if pageNumber prop changes
  useEffect(() => {
    if (pageNumber && pageNumber > 0) {
      setCurrentPage(pageNumber);
    }
  }, [pageNumber]);

  // Load PDF.js library dynamically from CDN
  useEffect(() => {
    let isMounted = true;

    async function initPdfJs() {
      try {
        setLoading(true);
        setError(null);

        // Load PDF.js script dynamically if not present
        if (!(window as any).pdfjsLib) {
          await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            script.onload = () => {
              const pdfjs = (window as any).pdfjsLib;
              if (pdfjs) {
                pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                resolve(pdfjs);
              } else {
                reject(new Error('PDF.js loading failed'));
              }
            };
            script.onerror = () => reject(new Error('Failed to load PDF.js script'));
            document.head.appendChild(script);
          });
        }

        const pdfjs = (window as any).pdfjsLib;
        if (!pdfjs) throw new Error('PDF.js unavailable');

        // Load document
        const loadingTask = pdfjs.getDocument({
          url,
          withCredentials: false,
        });

        const doc = await loadingTask.promise;
        if (!isMounted) return;

        setPdfDoc(doc);
        setNumPages(doc.numPages);
        if (pageNumber > doc.numPages) {
          setCurrentPage(1);
        }
      } catch (err: any) {
        console.warn('PDF.js canvas render failed or CORS restriction, falling back to iframe:', err);
        if (isMounted) {
          setUseIframeFallback(true);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    initPdfJs();

    return () => {
      isMounted = false;
    };
  }, [url]);

  // Render current PDF Page on canvas & extract text layer
  useEffect(() => {
    if (!pdfDoc || useIframeFallback) return;

    let isMounted = true;

    async function renderPage() {
      try {
        setLoading(true);
        const page = await pdfDoc.getPage(currentPage);
        if (!isMounted) return;

        const viewport = page.getViewport({ scale });
        setPageViewport(viewport);

        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        // Render Canvas PDF graphics
        const renderContext = {
          canvasContext: context,
          viewport,
        };
        await page.render(renderContext).promise;
        if (!isMounted) return;

        // Extract Text Content for custom HTML overlay & highlighting
        const textContent = await page.getTextContent();
        if (!isMounted) return;

        const items = textContent.items.map((item: any) => ({
          str: item.str,
          transform: item.transform,
          width: item.width,
          height: item.height,
        }));

        setTextItems(items);

        // Find excerpt match on this page
        if (excerpt) {
          const fullPageText = items.map((i: any) => i.str).join(' ');
          const match = findExcerptMatch(excerpt, fullPageText);
          if (match) {
            setHighlightMatch({ start: match.start, end: match.end });
          } else {
            setHighlightMatch(null);
          }
        }
      } catch (err: any) {
        console.error('Page render error:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    renderPage();

    return () => {
      isMounted = false;
    };
  }, [pdfDoc, currentPage, scale, excerpt, useIframeFallback]);

  // Auto scroll to highlighted text item on page render
  useEffect(() => {
    if (highlightRef.current) {
      const timer = setTimeout(() => {
        highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [currentPage, highlightMatch, loading]);

  if (useIframeFallback) {
    const cleanExcerpt = (excerpt || '').trim().replace(/^(?:\[?\d{1,2}:\d{2}(?::\d{2})?(?:\s*-\s*\d{1,2}:\d{2}(?::\d{2})?)?\]?\s*)*/i, '').replace(/^[“"']|[”"']$/g, '').replace(/\s+/g, ' ').trim();
    const pdfSearchQuery = cleanExcerpt ? encodeURIComponent(cleanExcerpt.split(' ').slice(0, 7).join(' ')) : '';
    const pdfHashParams = [
      currentPage ? `page=${currentPage}` : '',
      pdfSearchQuery ? `search="${pdfSearchQuery}"` : ''
    ].filter(Boolean).join('&');
    const iframeUrl = `${url}${pdfHashParams ? `#${pdfHashParams}` : ''}`;

    return (
      <div className={cn("h-full w-full flex flex-col bg-muted/10", className)}>
        <iframe
          key={iframeUrl}
          src={iframeUrl}
          className="h-full w-full border-0 bg-white"
          title={displayName || 'PDF Viewer'}
        />
      </div>
    );
  }

  // Group matched text items into continuous horizontal line highlights
  let charCount = 0;
  interface HighlightLine {
    left: number;
    top: number;
    width: number;
    height: number;
  }

  const highlightLines: HighlightLine[] = [];

  if (textItems.length > 0 && pageViewport && highlightMatch) {
    const lineMap = new Map<number, { minX: number; maxX: number; top: number; height: number }>();

    textItems.forEach((item: any) => {
      const itemStart = charCount;
      const itemEnd = itemStart + item.str.length;
      charCount = itemEnd + 1;

      const isMatched = itemStart <= highlightMatch.end && itemEnd >= highlightMatch.start;
      if (!isMatched) return;

      const pdfX = item.transform[4];
      const pdfY = item.transform[5];
      const fontHeight = Math.abs(item.transform[3] || item.height || 12);
      const itemWidth = item.width || item.str.length * fontHeight * 0.5;

      const [rectMinX, rectMinY, rectMaxX, rectMaxY] = pageViewport.convertToViewportRectangle([
        pdfX,
        pdfY,
        pdfX + itemWidth,
        pdfY + fontHeight,
      ]);

      const cssLeft = Math.min(rectMinX, rectMaxX);
      const cssTop = Math.min(rectMinY, rectMaxY);
      const cssWidth = Math.max(4, Math.abs(rectMaxX - rectMinX));
      const cssHeight = Math.max(4, Math.abs(rectMaxY - rectMinY));

      const lineKey = Math.round(cssTop / 6) * 6;

      if (!lineMap.has(lineKey)) {
        lineMap.set(lineKey, { minX: cssLeft, maxX: cssLeft + cssWidth, top: cssTop, height: cssHeight });
      } else {
        const line = lineMap.get(lineKey)!;
        line.minX = Math.min(line.minX, cssLeft);
        line.maxX = Math.max(line.maxX, cssLeft + cssWidth);
        line.top = Math.min(line.top, cssTop);
        line.height = Math.max(line.height, cssHeight);
      }
    });

    lineMap.forEach((line) => {
      highlightLines.push({
        left: (line.minX / pageViewport.width) * 100,
        top: (line.top / pageViewport.height) * 100,
        width: ((line.maxX - line.minX) / pageViewport.width) * 100,
        height: (line.height / pageViewport.height) * 100,
      });
    });
  }

  return (
    <div className={cn("flex flex-col h-full bg-slate-900/90 text-white min-h-0", className)}>
      {/* Control Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 shrink-0 text-xs gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-300 hover:text-white hover:bg-slate-800"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            title="Previous Page"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="font-mono text-slate-300">
            Page <span className="font-bold text-white">{currentPage}</span> of {numPages}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-300 hover:text-white hover:bg-slate-800"
            disabled={currentPage >= numPages}
            onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
            title="Next Page"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {highlightMatch && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[11px] font-medium">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            <span>Passage Highlighted on Page {currentPage}</span>
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-300 hover:text-white hover:bg-slate-800"
            disabled={scale <= 0.6}
            onClick={() => setScale((s) => Math.max(0.6, s - 0.2))}
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </Button>
          <span className="font-mono text-[11px] text-slate-400 w-12 text-center">
            {Math.round(scale * 100)}%
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-300 hover:text-white hover:bg-slate-800"
            disabled={scale >= 2.5}
            onClick={() => setScale((s) => Math.min(2.5, s + 0.2))}
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* PDF View Canvas Container */}
      <div ref={containerRef} className="relative flex-1 min-h-0 overflow-auto p-4 sm:p-6 flex flex-col items-center bg-slate-950/80">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/60 z-20 text-slate-300 space-y-2">
            <Loader2 className="w-7 h-7 animate-spin text-amber-500" />
            <p className="text-xs">Rendering PDF page {currentPage}...</p>
          </div>
        )}

        <div className="relative shadow-2xl rounded-sm overflow-hidden bg-white max-w-full h-fit flex shrink-0">
          {/* Main Canvas */}
          <canvas ref={canvasRef} className="block w-full h-auto max-w-full object-contain" />

          {/* Continuous Line Highlighter Overlay */}
          {highlightLines.length > 0 && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {highlightLines.map((line, idx) => (
                <span
                  key={idx}
                  ref={idx === 0 ? highlightRef : null}
                  className="absolute bg-yellow-300/40 dark:bg-yellow-400/35 rounded-[2px] pointer-events-auto"
                  style={{
                    left: `${line.left}%`,
                    top: `${line.top}%`,
                    width: `${line.width}%`,
                    height: `${line.height}%`,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
