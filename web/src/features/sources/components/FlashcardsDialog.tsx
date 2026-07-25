"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Layers,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Sparkles,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Shuffle,
  RotateCcw,
  Loader2,
  Sliders,
  Check,
  BookOpen,
  Hand,
} from 'lucide-react';

export interface Flashcard {
  id: number;
  front: string;
  back: string;
  category?: string;
  hint?: string;
}

export interface FlashcardSet {
  title: string;
  description: string;
  cards: Flashcard[];
}

interface FlashcardsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  isGenerating?: boolean;
  flashcardSet: FlashcardSet | null;
  onRegenerate?: (count: number) => void;
}

export function FlashcardsDialog({
  isOpen,
  onClose,
  isGenerating = false,
  flashcardSet,
  onRegenerate,
}: FlashcardsDialogProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [knownCardIds, setKnownCardIds] = useState<Set<number>>(new Set());
  const [reviewCardIds, setReviewCardIds] = useState<Set<number>>(new Set());

  // Settings state
  const [desiredCount, setDesiredCount] = useState(15);
  const [showConfig, setShowConfig] = useState(false);

  // Screen size awareness
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 768);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Swipe / Drag Gestures State
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef<number | null>(null);

  useEffect(() => {
    if (flashcardSet?.cards) {
      setCards(flashcardSet.cards);
      setCurrentIndex(0);
      setIsFlipped(false);
      setShowHint(false);
      setKnownCardIds(new Set());
      setReviewCardIds(new Set());
    }
  }, [flashcardSet]);

  const currentCard = cards[currentIndex];
  const totalCards = cards.length;

  const handleNext = useCallback(() => {
    if (currentIndex < totalCards - 1) {
      setCurrentIndex((prev) => prev + 1);
      setIsFlipped(false);
      setShowHint(false);
      setDragOffset(0);
    }
  }, [currentIndex, totalCards]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setIsFlipped(false);
      setShowHint(false);
      setDragOffset(0);
    }
  }, [currentIndex]);

  const handleFlip = useCallback(() => {
    if (Math.abs(dragOffset) > 10) return; // Prevent flip on drag
    setIsFlipped((prev) => !prev);
  }, [dragOffset]);

  const handleMarkMastered = () => {
    if (!currentCard) return;
    setKnownCardIds((prev) => new Set(prev).add(currentCard.id));
    setReviewCardIds((prev) => {
      const next = new Set(prev);
      next.delete(currentCard.id);
      return next;
    });
    handleNext();
  };

  const handleMarkNeedsReview = () => {
    if (!currentCard) return;
    setReviewCardIds((prev) => new Set(prev).add(currentCard.id));
    setKnownCardIds((prev) => {
      const next = new Set(prev);
      next.delete(currentCard.id);
      return next;
    });
    handleNext();
  };

  const handleShuffle = () => {
    setCards((prev) => [...prev].sort(() => Math.random() - 0.5));
    setCurrentIndex(0);
    setIsFlipped(false);
    setShowHint(false);
  };

  const handleReset = () => {
    if (flashcardSet?.cards) {
      setCards(flashcardSet.cards);
      setCurrentIndex(0);
      setIsFlipped(false);
      setShowHint(false);
      setKnownCardIds(new Set());
      setReviewCardIds(new Set());
    }
  };

  // ── Drag & Swipe Handlers ──
  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    dragStartX.current = clientX;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging || dragStartX.current === null) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const deltaX = clientX - dragStartX.current;
    setDragOffset(deltaX);
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    const SWIPE_THRESHOLD = 45;
    if (dragOffset < -SWIPE_THRESHOLD && currentIndex < totalCards - 1) {
      handleNext();
    } else if (dragOffset > SWIPE_THRESHOLD && currentIndex > 0) {
      handlePrev();
    } else {
      setDragOffset(0);
    }
    dragStartX.current = null;
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        handleFlip();
      } else if (e.key.toLowerCase() === 'h') {
        e.preventDefault();
        setShowHint((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleNext, handlePrev, handleFlip]);

  const progressPercent = totalCards > 0 ? Math.round(((currentIndex + 1) / totalCards) * 100) : 0;

  // Responsive 3D offsets based on window width
  const isSmallScreen = windowWidth < 640;
  const sideOffset = isSmallScreen ? 60 : 115;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      contentClassName="mx-auto my-auto w-[92vw] sm:w-[90vw] md:w-full md:max-w-2xl max-h-[88vh] sm:max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-background border-border shadow-2xl rounded-2xl"
    >
      {/* Header */}
      <DialogHeader className="p-3.5 sm:p-4 pb-2.5 border-b border-border/60 bg-muted/20 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500 border border-purple-500/20">
              <Layers className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </div>
            <div>
              <DialogTitle className="text-xs sm:text-base font-semibold tracking-tight text-foreground flex items-center gap-2">
                <span>{flashcardSet?.title || 'Interactive Flashcards'}</span>
              </DialogTitle>
              <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-1 mt-0.5">
                {flashcardSet?.description || 'Study and review key concepts generated from your sources'}
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
              onClick={() => setShowConfig((prev) => !prev)}
              title="Configure flashcard count"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Settings</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
              onClick={handleShuffle}
              disabled={cards.length <= 1}
              title="Shuffle Cards"
            >
              <Shuffle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Shuffle</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
              onClick={handleReset}
              title="Reset Deck"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Config Bar (collapsible) */}
        {showConfig && (
          <div className="mt-2.5 p-2 sm:p-2.5 rounded-xl bg-card border border-border/80 flex flex-wrap items-center justify-between gap-2 animate-in fade-in duration-200">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Card count:</span>
              <div className="flex items-center gap-1">
                {[10, 15, 20, 25].map((cnt) => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => setDesiredCount(cnt)}
                    className={`px-2 py-0.5 rounded-md text-xs font-medium transition-all ${
                      desiredCount === cnt
                        ? 'bg-purple-500 text-white font-semibold shadow-xs'
                        : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                    }`}
                  >
                    {cnt}
                  </button>
                ))}
              </div>
            </div>
            <Button
              size="sm"
              className="h-6 sm:h-7 text-xs bg-purple-600 hover:bg-purple-700 text-white gap-1.5"
              disabled={isGenerating}
              onClick={() => {
                if (onRegenerate) {
                  onRegenerate(desiredCount);
                  setShowConfig(false);
                }
              }}
            >
              {isGenerating ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Sparkles className="w-3 h-3" />
              )}
              <span>Regenerate ({desiredCount})</span>
            </Button>
          </div>
        )}

        {/* Progress Bar */}
        {totalCards > 0 && (
          <div className="mt-2 space-y-1">
            <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground">
                Card {currentIndex + 1} of {totalCards}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-emerald-500 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> {knownCardIds.size} Mastered
                </span>
                <span className="text-amber-500 font-medium flex items-center gap-1">
                  <XCircle className="w-3 h-3" /> {reviewCardIds.size} Needs Review
                </span>
              </div>
            </div>
            <Progress value={progressPercent} className="h-1 bg-muted" />
          </div>
        )}
      </DialogHeader>

      {/* Content Body with Responsive Centered 3D Stage */}
      <div className="p-2.5 sm:p-4 md:p-6 flex flex-col items-center justify-between flex-1 bg-gradient-to-b from-muted/10 via-background to-muted/10 select-none overflow-y-auto overflow-x-hidden">
        {isGenerating ? (
          <div className="flex flex-col items-center justify-center space-y-3 py-10 my-auto text-center">
            <div className="relative">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-500 animate-pulse">
                <Layers className="w-6 h-6" />
              </div>
              <Loader2 className="w-14 h-14 absolute -top-1 -left-1 text-purple-500 animate-spin stroke-[1.5]" />
            </div>
            <p className="text-sm font-semibold text-foreground">Generating {desiredCount} Flashcards...</p>
            <p className="text-xs text-muted-foreground max-w-sm">
              Extracting key concepts, definitions, and questions from your knowledge sources.
            </p>
          </div>
        ) : !currentCard ? (
          <div className="flex flex-col items-center justify-center space-y-2 py-10 my-auto text-center text-muted-foreground">
            <BookOpen className="w-10 h-10 stroke-1" />
            <p className="text-xs">No flashcards available. Click regenerate to create a deck.</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-between space-y-3 sm:space-y-4 w-full h-full my-auto">
            {/* Fluid 3D Deck Stage */}
            <div className="relative flex items-center justify-center w-full max-w-full h-[270px] sm:h-[300px] md:h-[330px] perspective-1000 touch-none my-auto overflow-hidden">
              
              {cards.map((card, index) => {
                const offset = index - currentIndex;
                // Render visible cards within range -2 to +2
                if (Math.abs(offset) > 2) return null;

                const isCurrent = offset === 0;
                const isPrev = offset === -1;
                const isNext = offset === 1;

                // Dynamic screen-aware 3D spatial transforms
                let translateX = 0;
                let rotateY = 0;
                let rotateZ = 0;
                let scale = 1;
                let opacity = 1;
                let zIndex = 10;

                if (isCurrent) {
                  translateX = dragOffset;
                  rotateZ = dragOffset * 0.04;
                  rotateY = 0;
                  scale = 1;
                  opacity = 1;
                  zIndex = 30;
                } else if (isNext) {
                  translateX = sideOffset + dragOffset * 0.4;
                  rotateY = isSmallScreen ? -14 : -20;
                  rotateZ = 2;
                  scale = isSmallScreen ? 0.82 : 0.84;
                  opacity = 0.65;
                  zIndex = 20;
                } else if (isPrev) {
                  translateX = -sideOffset + dragOffset * 0.4;
                  rotateY = isSmallScreen ? 14 : 20;
                  rotateZ = -2;
                  scale = isSmallScreen ? 0.82 : 0.84;
                  opacity = 0.65;
                  zIndex = 20;
                } else if (offset > 1) {
                  translateX = sideOffset * 1.8;
                  rotateY = -28;
                  scale = 0.7;
                  opacity = 0;
                  zIndex = 10;
                } else if (offset < -1) {
                  translateX = -sideOffset * 1.8;
                  rotateY = 28;
                  scale = 0.7;
                  opacity = 0;
                  zIndex = 10;
                }

                return (
                  <div
                    key={card.id || index}
                    onClick={() => {
                      if (isNext) handleNext();
                      if (isPrev) handlePrev();
                      if (isCurrent) handleFlip();
                    }}
                    onTouchStart={isCurrent ? handleTouchStart : undefined}
                    onTouchMove={isCurrent ? handleTouchMove : undefined}
                    onTouchEnd={isCurrent ? handleTouchEnd : undefined}
                    onMouseDown={isCurrent ? handleTouchStart : undefined}
                    onMouseMove={isCurrent ? handleTouchMove : undefined}
                    onMouseUp={isCurrent ? handleTouchEnd : undefined}
                    onMouseLeave={isCurrent ? handleTouchEnd : undefined}
                    className={`absolute w-[200px] sm:w-[240px] md:w-[260px] h-[250px] sm:h-[290px] md:h-[320px] rounded-2xl cursor-pointer ${
                      isDragging && isCurrent
                        ? 'transition-none'
                        : 'transition-all duration-500 cubic-bezier(0.34, 1.56, 0.64, 1)'
                    } ${isCurrent ? 'cursor-grab active:cursor-grabbing' : 'hover:scale-[0.88] hover:opacity-90'}`}
                    style={{
                      zIndex,
                      opacity,
                      transform: `translateX(${translateX}px) rotateY(${rotateY}deg) rotate(${rotateZ}deg) scale(${scale})`,
                      transformStyle: 'preserve-3d',
                    }}
                    title={isNext ? 'Click to advance' : isPrev ? 'Click to return' : undefined}
                  >
                    <div
                      className={`relative w-full h-full rounded-2xl border transition-transform duration-500 transform-style-3d shadow-xl ${
                        isCurrent && isFlipped
                          ? 'rotate-y-180 border-purple-500/40 bg-card'
                          : isCurrent
                          ? 'border-border/90 bg-card shadow-2xl ring-1 ring-purple-500/20'
                          : 'border-border/60 bg-card/80 backdrop-blur-xs'
                      }`}
                      style={{
                        transformStyle: 'preserve-3d',
                        transform: isCurrent && isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                      }}
                    >
                      {/* FRONT SIDE */}
                      <div
                        className="absolute inset-0 w-full h-full p-4 sm:p-5 flex flex-col justify-between rounded-2xl backface-hidden bg-card"
                        style={{ backfaceVisibility: 'hidden' }}
                      >
                        <div className="flex items-center justify-between">
                          {card.category ? (
                            <Badge
                              variant="outline"
                              className="bg-purple-500/10 text-purple-400 border-purple-500/20 text-[10px] font-medium px-2 py-0.5"
                            >
                              {card.category}
                            </Badge>
                          ) : (
                            <span />
                          )}
                          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                            {isCurrent ? (
                              <>
                                <Hand className="w-3 h-3 text-muted-foreground/60" /> Swipe / Click
                              </>
                            ) : isNext ? (
                              <span className="text-purple-400 font-bold">Next →</span>
                            ) : (
                              <span className="text-purple-400 font-bold">← Prev</span>
                            )}
                          </span>
                        </div>

                        <div className="my-auto text-center px-1 py-1.5 overflow-y-auto max-h-[130px] sm:max-h-[170px] scrollbar-thin">
                          <p className={`font-medium leading-relaxed ${isCurrent ? 'text-xs sm:text-sm text-foreground' : 'text-[10px] sm:text-[11px] text-muted-foreground line-clamp-3'}`}>
                            {card.front}
                          </p>
                        </div>

                        <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-muted-foreground pt-2 border-t border-border/40">
                          {isCurrent && card.hint ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowHint((prev) => !prev);
                              }}
                              className="flex items-center gap-1 text-amber-500 hover:text-amber-400 font-medium transition-colors"
                            >
                              <HelpCircle className="w-3 h-3" />
                              <span>{showHint ? 'Hide Hint' : 'Hint'}</span>
                            </button>
                          ) : (
                            <span />
                          )}

                          <span className="flex items-center gap-1 text-muted-foreground/70 group-hover:text-purple-400 transition-colors">
                            {isCurrent ? (
                              <>
                                <RotateCw className="w-3 h-3" /> Click to flip
                              </>
                            ) : (
                              'Click to select'
                            )}
                          </span>
                        </div>
                      </div>

                      {/* BACK SIDE */}
                      <div
                        className="absolute inset-0 w-full h-full p-4 sm:p-5 flex flex-col justify-between rounded-2xl backface-hidden bg-gradient-to-br from-card via-purple-950/10 to-card"
                        style={{
                          backfaceVisibility: 'hidden',
                          transform: 'rotateY(180deg)',
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <Badge
                            variant="outline"
                            className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px] font-medium px-2 py-0.5"
                          >
                            Answer / Explanation
                          </Badge>
                          <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">
                            Answer
                          </span>
                        </div>

                        <div className="my-auto text-center px-1 py-1.5 overflow-y-auto max-h-[130px] sm:max-h-[170px] scrollbar-thin">
                          <p className="text-xs sm:text-sm font-normal text-foreground leading-relaxed">
                            {card.back}
                          </p>
                        </div>

                        <div className="flex items-center justify-center text-[10px] sm:text-[11px] text-muted-foreground pt-2 border-t border-border/40">
                          <span className="flex items-center gap-1 text-purple-400 font-medium">
                            <Check className="w-3 h-3" /> Answer Revealed
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

            </div>

            {/* Hint Box */}
            {showHint && currentCard.hint && !isFlipped && (
              <div className="w-[200px] sm:w-[240px] md:w-[260px] p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs flex items-start gap-1.5 animate-in fade-in slide-in-from-top-1 duration-200 shrink-0">
                <HelpCircle className="w-3.5 h-3.5 shrink-0 text-amber-400 mt-0.5" />
                <div>
                  <span className="font-semibold block text-amber-400 text-[11px]">Hint:</span>
                  <span className="text-[11px]">{currentCard.hint}</span>
                </div>
              </div>
            )}

            {/* Self-Evaluation Buttons */}
            <div className="flex items-center justify-center gap-2 w-[200px] sm:w-[240px] md:w-[260px] shrink-0 pt-1">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-8 border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:border-amber-500 text-xs gap-1.5"
                onClick={handleMarkNeedsReview}
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Needs Review</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-8 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500 text-xs gap-1.5"
                onClick={handleMarkMastered}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Mastered</span>
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Footer Navigation */}
      <div className="p-3 border-t border-border/60 bg-muted/20 flex items-center justify-between shrink-0">
        <Button
          variant="outline"
          size="sm"
          className="h-7 sm:h-8 text-xs gap-1"
          onClick={handlePrev}
          disabled={currentIndex === 0 || isGenerating}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>Previous</span>
        </Button>

        <span className="text-[10px] sm:text-[11px] text-muted-foreground hidden sm:inline-block">
          Click 3D side cards or use <kbd className="px-1 py-0.5 rounded bg-muted border border-border text-[9px]">←</kbd> <kbd className="px-1 py-0.5 rounded bg-muted border border-border text-[9px]">→</kbd>, <kbd className="px-1 py-0.5 rounded bg-muted border border-border text-[9px]">Space</kbd> to flip
        </span>

        <Button
          variant="outline"
          size="sm"
          className="h-7 sm:h-8 text-xs gap-1"
          onClick={handleNext}
          disabled={currentIndex === totalCards - 1 || isGenerating}
        >
          <span>Next</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </Dialog>
  );
}
