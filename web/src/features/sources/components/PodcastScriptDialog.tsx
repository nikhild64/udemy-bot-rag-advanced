'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Dialog, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Radio, Play, Pause, ChevronDown, ChevronUp, Mic, Volume2, Sparkles, Minimize2, Maximize2, X, Gauge } from 'lucide-react';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface PodcastLine {
  speaker: 'Alex' | 'Jamie';
  text: string;
  startTime?: number;
  endTime?: number;
}

export interface PodcastScript {
  title: string;
  synopsis: string;
  lines: PodcastLine[];
  audioUrl?: string;
}

interface PodcastScriptDialogProps {
  isOpen: boolean;
  onClose: () => void;
  isGenerating: boolean;
  script: PodcastScript | null;
}

const SPEED_OPTIONS = [1, 1.25, 1.5, 2];

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

// ─────────────────────────────────────────────────────────────
// Silky-Smooth Liquid Bezier Canvas Dual Moving Waveform
// ─────────────────────────────────────────────────────────────

function CanvasWaveform({
  activeSpeaker,
  isPlaying,
  onTogglePlay,
  playbackRate,
  onCycleSpeed,
}: {
  activeSpeaker: 'Alex' | 'Jamie';
  isPlaying: boolean;
  onTogglePlay: () => void;
  playbackRate: number;
  onCycleSpeed: (e: React.MouseEvent) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const isAlexSpeaking = activeSpeaker === 'Alex' && isPlaying;
  const isJamieSpeaking = activeSpeaker === 'Jamie' && isPlaying;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let t = 0;

    const render = () => {
      // Scale time step with playbackRate for realistic visual speed
      t += 0.015 * (isPlaying ? playbackRate : 0.5);
      const width = canvas.width;
      const height = canvas.height;
      const midY = height / 2;

      ctx.clearRect(0, 0, width, height);

      // Reference dashed baseline
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, midY);
      ctx.lineTo(width, midY);
      ctx.stroke();
      ctx.restore();

      // Smooth Quadratic Bezier Wave Drawing Function
      const drawSmoothWaveLine = (
        isSpeaking: boolean,
        strokeColor: string,
        glowColor: string,
        seed: number,
        offsetY: number,
      ) => {
        ctx.save();

        const maxAmp = isSpeaking ? 36 : isPlaying ? 8 : 3;
        const speed = isSpeaking ? 1.6 : 0.7;
        const numPoints = 28;

        ctx.shadowColor = glowColor;
        ctx.shadowBlur = isSpeaking ? 16 : 4;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = isSpeaking ? 3.5 : 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const pts: { x: number; y: number }[] = [];
        for (let i = 0; i <= numPoints; i++) {
          const progress = i / numPoints;
          const x = progress * width;
          const envelope = Math.sin(progress * Math.PI);

          const wave1 = Math.sin(t * speed + progress * Math.PI * 4 + seed);
          const wave2 = Math.cos(t * speed * 0.8 - progress * Math.PI * 2 + seed * 1.5);

          const verticalDisplacement = (wave1 * 0.7 + wave2 * 0.3) * maxAmp * envelope;
          const y = offsetY - verticalDisplacement;

          pts.push({ x, y });
        }

        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);

        for (let i = 0; i < pts.length - 1; i++) {
          const p1 = pts[i];
          const p2 = pts[i + 1];
          const midX = (p1.x + p2.x) / 2;
          const midY = (p1.y + p2.y) / 2;
          ctx.quadraticCurveTo(p1.x, p1.y, midX, midY);
        }

        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
        ctx.stroke();
        ctx.restore();
      };

      // Draw Jamie's Yellow Line
      drawSmoothWaveLine(
        isJamieSpeaking,
        isJamieSpeaking ? '#F59E0B' : 'rgba(245, 158, 11, 0.35)',
        '#F59E0B',
        2.5,
        midY + 2,
      );

      // Draw Alex's Blue Line
      drawSmoothWaveLine(
        isAlexSpeaking,
        isAlexSpeaking ? '#3B82F6' : 'rgba(59, 130, 246, 0.35)',
        '#3B82F6',
        0,
        midY - 2,
      );

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [activeSpeaker, isPlaying, isAlexSpeaking, isJamieSpeaking, playbackRate]);

  return (
    <div className="relative group/canvas flex flex-col justify-between h-44 p-4 rounded-2xl bg-gradient-to-b from-black/90 via-[#0e0e12] to-[#09090c] border border-white/10 w-full overflow-hidden shadow-2xl">
      {/* Header Badges & Speed Selector */}
      <div className="flex items-center justify-between z-30 shrink-0 mb-1 pointer-events-auto">
        {/* Alex Badge */}
        <div
          className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold transition-all duration-300 ${
            isAlexSpeaking
              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/50 shadow-[0_0_12px_rgba(59,130,246,0.4)] scale-105'
              : 'bg-white/5 text-[#A9A9A9] border border-white/10 opacity-60'
          }`}
        >
          <div className={`w-2 h-2 rounded-full ${isAlexSpeaking ? 'bg-blue-400 animate-ping' : 'bg-blue-600/40'}`} />
          <span>🎙 Alex</span>
        </div>

        {/* Speed Selector Button */}
        <button
          type="button"
          onClick={onCycleSpeed}
          className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-mono font-semibold text-amber-400 transition-all hover:scale-105"
        >
          <Gauge className="w-3.5 h-3.5" />
          <span>{playbackRate}x</span>
        </button>

        {/* Jamie Badge */}
        <div
          className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold transition-all duration-300 ${
            isJamieSpeaking
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.4)] scale-105'
              : 'bg-white/5 text-[#A9A9A9] border border-white/10 opacity-60'
          }`}
        >
          <span>🎤 Jamie</span>
          <div className={`w-2 h-2 rounded-full ${isJamieSpeaking ? 'bg-amber-400 animate-ping' : 'bg-amber-600/40'}`} />
        </div>
      </div>

      {/* Canvas Overlay & Centered Play/Pause Trigger */}
      <div
        onClick={onTogglePlay}
        className="relative flex-1 w-full h-full overflow-hidden flex items-center justify-center cursor-pointer"
      >
        <canvas
          ref={canvasRef}
          width={600}
          height={110}
          className="w-full h-full block"
        />

        {/* Centered Play Button Overlay when Paused or Hovering */}
        <div
          className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${
            !isPlaying ? 'bg-black/40 opacity-100' : 'bg-black/20 opacity-0 group-hover/canvas:opacity-100'
          }`}
        >
          <div
            className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all duration-200 ${
              isPlaying
                ? 'bg-amber-500/90 text-black hover:scale-110 shadow-amber-500/50'
                : 'bg-blue-600/90 text-white hover:scale-110 shadow-blue-600/50 animate-pulse'
            }`}
          >
            {isPlaying ? (
              <Pause className="w-6 h-6 fill-current" />
            ) : (
              <Play className="w-6 h-6 fill-current ml-1" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Silky-Smooth Liquid Bezier Mini Background Waveform
// ─────────────────────────────────────────────────────────────

function MiniBackgroundWaveform({
  activeSpeaker,
  isPlaying,
  playbackRate,
}: {
  activeSpeaker: 'Alex' | 'Jamie';
  isPlaying: boolean;
  playbackRate: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const isAlexSpeaking = activeSpeaker === 'Alex' && isPlaying;
  const isJamieSpeaking = activeSpeaker === 'Jamie' && isPlaying;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let t = 0;

    const render = () => {
      t += 0.015 * (isPlaying ? playbackRate : 0.5);
      const width = canvas.width;
      const height = canvas.height;
      const midY = height / 2;

      ctx.clearRect(0, 0, width, height);

      const drawWave = (
        isSpeaking: boolean,
        strokeColor: string,
        glowColor: string,
        seed: number,
        offsetY: number,
      ) => {
        ctx.save();
        const maxAmp = isSpeaking ? 16 : isPlaying ? 5 : 2;
        const speed = isSpeaking ? 1.6 : 0.7;
        const numPoints = 24;

        ctx.shadowColor = glowColor;
        ctx.shadowBlur = isSpeaking ? 10 : 3;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = isSpeaking ? 2.5 : 1.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const pts: { x: number; y: number }[] = [];
        for (let i = 0; i <= numPoints; i++) {
          const progress = i / numPoints;
          const x = progress * width;
          const envelope = Math.sin(progress * Math.PI);

          const wave1 = Math.sin(t * speed + progress * Math.PI * 4 + seed);
          const wave2 = Math.cos(t * speed * 0.8 - progress * Math.PI * 2 + seed * 1.5);

          const verticalDisplacement = (wave1 * 0.7 + wave2 * 0.3) * maxAmp * envelope;
          const y = offsetY - verticalDisplacement;

          pts.push({ x, y });
        }

        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);

        for (let i = 0; i < pts.length - 1; i++) {
          const p1 = pts[i];
          const p2 = pts[i + 1];
          const midX = (p1.x + p2.x) / 2;
          const midY = (p1.y + p2.y) / 2;
          ctx.quadraticCurveTo(p1.x, p1.y, midX, midY);
        }

        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
        ctx.stroke();
        ctx.restore();
      };

      // Draw Jamie Wave (Amber)
      drawWave(
        isJamieSpeaking,
        isJamieSpeaking ? 'rgba(245, 158, 11, 0.75)' : 'rgba(245, 158, 11, 0.25)',
        '#F59E0B',
        2.5,
        midY + 1,
      );

      // Draw Alex Wave (Blue)
      drawWave(
        isAlexSpeaking,
        isAlexSpeaking ? 'rgba(59, 130, 246, 0.75)' : 'rgba(59, 130, 246, 0.25)',
        '#3B82F6',
        0,
        midY - 1,
      );

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [activeSpeaker, isPlaying, isAlexSpeaking, isJamieSpeaking, playbackRate]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl opacity-40 group-hover/minitile:opacity-60 transition-opacity duration-300">
      <canvas
        ref={canvasRef}
        width={450}
        height={80}
        className="w-full h-full block"
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Dialog Component
// ─────────────────────────────────────────────────────────────

export function PodcastScriptDialog({
  isOpen,
  onClose,
  isGenerating,
  script,
}: PodcastScriptDialogProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeLineIndex, setActiveLineIndex] = useState(0);
  const [isAccordionOpen, setIsAccordionOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const [voices, setVoices] = useState<{ alexVoice: SpeechSynthesisVoice | null; jamieVoice: SpeechSynthesisVoice | null }>({
    alexVoice: null,
    jamieVoice: null,
  });

  const activeLineRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Manage HTML5 Audio playback when script.audioUrl is provided
  useEffect(() => {
    if (!script?.audioUrl || !audioRef.current) return;
    audioRef.current.playbackRate = playbackRate;
    if (isPlaying) {
      audioRef.current.play().catch((err) => console.warn('Audio playback error:', err));
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, playbackRate, script?.audioUrl]);

  // Cycle playback speed without pausing audio
  const handleCycleSpeed = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const currentIndex = SPEED_OPTIONS.indexOf(playbackRate);
    const nextRate = SPEED_OPTIONS[(currentIndex + 1) % SPEED_OPTIONS.length];
    setPlaybackRate(nextRate);

    if (script?.audioUrl && audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    } else if (isPlaying && script && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const currentLine = script.lines[activeLineIndex];
      if (currentLine) {
        const utterance = new SpeechSynthesisUtterance(currentLine.text);
        if (currentLine.speaker === 'Alex') {
          if (voices.alexVoice) utterance.voice = voices.alexVoice;
          utterance.pitch = 0.95;
        } else {
          if (voices.jamieVoice) utterance.voice = voices.jamieVoice;
          utterance.pitch = 1.15;
        }
        utterance.rate = nextRate;

        utterance.onend = () => {
          if (activeLineIndex < script.lines.length - 1) {
            setActiveLineIndex((prev) => prev + 1);
          } else {
            setIsPlaying(false);
            setActiveLineIndex(0);
          }
        };

        utterance.onerror = () => setIsPlaying(false);

        window.speechSynthesis.speak(utterance);
      }
    }
  };

  // Initialize Speech Synthesis Voices
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const loadVoices = () => {
      const allVoices = window.speechSynthesis.getVoices();
      if (!allVoices || allVoices.length === 0) return;

      const englishVoices = allVoices.filter((v) => v.lang.startsWith('en'));
      const alex =
        englishVoices.find((v) => v.name.toLowerCase().includes('male') || v.name.toLowerCase().includes('david') || v.name.toLowerCase().includes('george')) ||
        englishVoices[0] ||
        allVoices[0];

      const jamie =
        englishVoices.find((v) => v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('zira') || v.name.toLowerCase().includes('susan') || v.name.toLowerCase().includes('victoria') || v.name.toLowerCase().includes('google us english')) ||
        englishVoices[1] ||
        allVoices[0];

      setVoices({ alexVoice: alex, jamieVoice: jamie });
    };

    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // Handle Speech Synthesis Playback loop (ONLY when script.audioUrl is NOT present)
  useEffect(() => {
    if (script?.audioUrl) return; // Skip Web Speech synthesis when cloud MP3 audio URL is available

    if (!isPlaying || !script || activeLineIndex >= script.lines.length) {
      if (activeLineIndex >= (script?.lines.length ?? 0)) {
        setIsPlaying(false);
        setActiveLineIndex(0);
      }
      return;
    }

    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();

    const currentLine = script.lines[activeLineIndex];
    const utterance = new SpeechSynthesisUtterance(currentLine.text);

    if (currentLine.speaker === 'Alex') {
      if (voices.alexVoice) utterance.voice = voices.alexVoice;
      utterance.pitch = 0.95;
      utterance.rate = playbackRate;
    } else {
      if (voices.jamieVoice) utterance.voice = voices.jamieVoice;
      utterance.pitch = 1.15;
      utterance.rate = playbackRate;
    }

    utterance.onend = () => {
      if (activeLineIndex < script.lines.length - 1) {
        setActiveLineIndex((prev) => prev + 1);
      } else {
        setIsPlaying(false);
        setActiveLineIndex(0);
      }
    };

    utterance.onerror = () => {
      setIsPlaying(false);
    };

    window.speechSynthesis.speak(utterance);

    return () => {
      window.speechSynthesis.cancel();
    };
  }, [isPlaying, activeLineIndex, script, voices, playbackRate]);

  // Stop speech when dialog closes completely (not when minimized)
  useEffect(() => {
    if (!isOpen) {
      setIsPlaying(false);
      setIsMinimized(false);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    }
  }, [isOpen]);

  // Scroll active line into view inside transcript accordion
  useEffect(() => {
    if (isAccordionOpen && activeLineRef.current) {
      activeLineRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeLineIndex, isAccordionOpen]);

  const togglePlay = () => {
    if (!script) return;
    if (isPlaying) {
      if (!script.audioUrl && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
    }
  };

  const handleLineClick = (idx: number) => {
    setActiveLineIndex(idx);
    setIsPlaying(true);

    if (script?.audioUrl && audioRef.current) {
      const targetLine = script.lines[idx];
      let targetTime = 0;

      if (
        targetLine &&
        targetLine.startTime !== undefined &&
        typeof targetLine.startTime === 'number' &&
        !isNaN(targetLine.startTime)
      ) {
        targetTime = targetLine.startTime;
      } else if (audioRef.current.duration && !isNaN(audioRef.current.duration) && audioRef.current.duration > 0) {
        targetTime = (idx / script.lines.length) * audioRef.current.duration;
      }

      audioRef.current.currentTime = targetTime;
      audioRef.current.play().catch((err) => console.warn('Audio seek error:', err));
    }
  };

  const handleDownload = () => {
    if (!script) return;
    const lines = script.lines
      .map((l) => `${l.speaker === 'Alex' ? '🎙 Alex' : '🎤 Jamie'}: ${l.text}`)
      .join('\n\n');
    const text = `${script.title}\n${'─'.repeat(60)}\n${script.synopsis}\n\n${'─'.repeat(60)}\nTRANSCRIPT\n${'─'.repeat(60)}\n\n${lines}`;
    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${script.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_podcast_transcript.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const currentSpeaker = script?.lines[activeLineIndex]?.speaker || 'Alex';

  const audioElement = script?.audioUrl ? (
    <audio
      ref={audioRef}
      src={script.audioUrl}
      preload="auto"
      onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
      onDurationChange={(e) => setDuration(e.currentTarget.duration || 0)}
      onTimeUpdate={(e) => {
        const audio = e.currentTarget;
        const currTime = audio.currentTime;
        setCurrentTime(currTime);
        if (audio.duration) setDuration(audio.duration);
        if (!script?.lines?.length) return;

        let matchIdx = -1;
        const hasTimestamps = script.lines.some((l) => l.startTime !== undefined);

        if (hasTimestamps) {
          for (let i = 0; i < script.lines.length; i++) {
            const currentLineStart = script.lines[i]?.startTime ?? 0;
            const nextLineStart = script.lines[i + 1]?.startTime;

            if (nextLineStart !== undefined) {
              if (currTime >= currentLineStart && currTime < nextLineStart) {
                matchIdx = i;
                break;
              }
            } else {
              if (currTime >= currentLineStart) {
                matchIdx = i;
                break;
              }
            }
          }
        }

        if (matchIdx !== -1) {
          setActiveLineIndex(matchIdx);
        } else if (audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
          const ratioIdx = Math.min(
            script.lines.length - 1,
            Math.floor((currTime / audio.duration) * script.lines.length)
          );
          setActiveLineIndex(ratioIdx);
        }
      }}
      onEnded={() => {
        setIsPlaying(false);
        setActiveLineIndex(0);
        setCurrentTime(0);
      }}
    />
  ) : null;

  if (!isOpen) return null;

  const miniTileContent = isMinimized && script ? (
    <div
      onClick={() => setIsMinimized(false)}
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 z-[9999] group/minitile bg-[#121216]/95 backdrop-blur-xl border border-white/15 shadow-[0_8px_32px_rgba(0,0,0,0.8)] rounded-2xl p-3 sm:p-3.5 flex items-center gap-2.5 sm:gap-3.5 text-white max-w-none sm:max-w-md w-auto animate-in slide-in-from-bottom-5 duration-300 overflow-hidden cursor-pointer hover:border-amber-500/40 hover:shadow-amber-500/10 transition-all"
    >
      {/* Animated Liquid Waveform Canvas Background */}
      <MiniBackgroundWaveform
        activeSpeaker={currentSpeaker}
        isPlaying={isPlaying}
        playbackRate={playbackRate}
      />

      {/* Interactive Controls & Content Layer */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          togglePlay();
        }}
        className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all duration-200 shrink-0 shadow-lg z-10 ${
          isPlaying
            ? currentSpeaker === 'Alex'
              ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-blue-600/40'
              : 'bg-amber-500 text-black hover:bg-amber-400 shadow-amber-500/40'
            : 'bg-blue-600 text-white hover:bg-blue-500 shadow-blue-600/40'
        }`}
      >
        {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
      </button>

      <div className="min-w-0 flex-1 z-10">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <p className="text-xs font-semibold text-white truncate drop-shadow">{script.title}</p>
          {isPlaying && (
            <span
              className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold shrink-0 ${
                currentSpeaker === 'Alex'
                  ? 'bg-blue-500/25 text-blue-300 border border-blue-500/30'
                  : 'bg-amber-500/25 text-amber-300 border border-amber-500/30'
              }`}
            >
              {currentSpeaker}
            </span>
          )}
        </div>
        <p className="text-[11px] text-white/70 truncate italic mt-0.5 font-medium">
          &ldquo;{script.lines[activeLineIndex]?.text || ''}&rdquo;
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 z-10" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={handleCycleSpeed}
          className="px-1.5 sm:px-2 py-0.5 rounded-md bg-white/10 hover:bg-white/20 border border-white/10 text-[10px] font-mono text-amber-400 font-semibold transition-all hover:scale-105"
        >
          {playbackRate}x
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsMinimized(false);
          }}
          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-white/70 hover:text-white transition-all hover:scale-105"
          title="Expand Studio"
        >
          <Maximize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsMinimized(false);
            onClose();
          }}
          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-white/70 hover:text-white transition-all hover:scale-105"
          title="Close"
        >
          <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>
      </div>
    </div>
  ) : null;

  return (
    <>
      {audioElement}
      {miniTileContent && isMounted ? createPortal(miniTileContent, document.body) : miniTileContent}
      {!isMinimized && (
        <Dialog
          open={isOpen}
          onOpenChange={(open) => {
            if (!open) {
              if (isPlaying) {
                setIsMinimized(true);
              } else {
                onClose();
              }
            }
          }}
          contentClassName="max-w-2xl w-full max-h-[92dvh] bg-[#121212] border border-[#262626] text-white p-0 overflow-hidden rounded-2xl shadow-2xl flex flex-col"
        >
      {/* ── Header ── */}
      <DialogHeader className="px-3.5 sm:px-6 pt-3.5 sm:pt-5 pb-3 sm:pb-4 border-b border-[#262626] shrink-0">
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <div className="p-1.5 sm:p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
              <Radio className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-xs sm:text-base font-semibold text-white leading-tight truncate">
                {isGenerating ? 'Synthesizing Podcast…' : (script?.title || 'AI Audio Studio')}
              </DialogTitle>
              {script?.synopsis && !isGenerating && (
                <p className="text-[10px] sm:text-xs text-[#A9A9A9] mt-0.5 leading-relaxed line-clamp-1">
                  {script.synopsis}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {script && !isGenerating && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsMinimized(true)}
                className="h-7 sm:h-8 text-[11px] sm:text-xs gap-1.5 border-[#3A3A3A] text-[#A9A9A9] hover:text-white hover:border-amber-500/50 px-2 sm:px-3"
                title="Run in Background Mini Player Mode"
              >
                <Minimize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Background Mode</span>
              </Button>
            )}
          </div>
        </div>
      </DialogHeader>

      {/* ── Audio Studio Content ── */}
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 bg-gradient-to-b from-[#181818] to-[#121212] overflow-y-auto flex-1 min-h-0">
        {/* Waveform Canvas with Integrated Play Button Overlay & Speed Toggle */}
        <CanvasWaveform
          activeSpeaker={currentSpeaker}
          isPlaying={isPlaying}
          onTogglePlay={togglePlay}
          playbackRate={playbackRate}
          onCycleSpeed={handleCycleSpeed}
        />

        {/* Audio Seek Bar Slider & Timestamp Counters */}
        {script?.audioUrl && (
          <div className="flex items-center gap-3 px-4 py-2.5 bg-black/40 rounded-xl border border-white/10 shadow-inner">
            <span className="text-xs font-mono font-medium text-amber-400/90 w-10 text-right shrink-0">
              {formatTime(currentTime)}
            </span>
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={currentTime}
              onChange={(e) => {
                const newTime = parseFloat(e.target.value);
                setCurrentTime(newTime);
                if (audioRef.current) {
                  audioRef.current.currentTime = newTime;
                }
              }}
              className="flex-1 h-1.5 bg-white/15 rounded-lg appearance-none cursor-pointer accent-amber-400 hover:accent-amber-300 transition-all"
            />
            <span className="text-xs font-mono font-medium text-[#A9A9A9] w-10 shrink-0">
              {formatTime(duration)}
            </span>
          </div>
        )}



        {/* ── Transcript Accordion ── */}
        {script && (
          <div className="border border-white/10 rounded-2xl overflow-hidden bg-black/30">
            <div className="w-full flex items-center justify-between px-5 py-3 text-xs font-semibold text-[#A9A9A9] bg-white/5 hover:bg-white/10 transition-colors">
              <button
                type="button"
                onClick={() => setIsAccordionOpen(!isAccordionOpen)}
                className="flex items-center gap-2 flex-1 text-left"
              >
                <Mic className="w-3.5 h-3.5 text-amber-400" />
                <span>Full Podcast Transcript</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload();
                  }}
                  className="p-1 rounded-lg hover:bg-white/10 text-[#A9A9A9] hover:text-amber-400 transition-colors"
                  title="Download Transcript (.txt)"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsAccordionOpen(!isAccordionOpen)}
                  className="p-0.5 text-[#A9A9A9] hover:text-white"
                >
                  {isAccordionOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Accordion Content with Fixed Height & Scrollbar */}
            {isAccordionOpen && (
              <div className="max-h-56 overflow-y-auto p-4 space-y-2 border-t border-white/10">
                {script.lines.map((line, idx) => {
                  const isCurrent = idx === activeLineIndex;
                  const isAlex = line.speaker === 'Alex';
                  return (
                    <div
                      key={idx}
                      ref={isCurrent ? activeLineRef : null}
                      onClick={() => handleLineClick(idx)}
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition-all duration-150 flex items-start gap-3 ${
                        isCurrent
                          ? isAlex
                            ? 'bg-blue-500/20 border-blue-500/50 text-white font-medium shadow-sm'
                            : 'bg-amber-500/20 border-amber-500/50 text-white font-medium shadow-sm'
                          : 'bg-white/5 border-transparent hover:border-white/10 text-[#A9A9A9] hover:text-white'
                      }`}
                    >
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase shrink-0 ${
                          isAlex ? 'bg-blue-600/30 text-blue-400' : 'bg-amber-500/30 text-amber-400'
                        }`}
                      >
                        {line.speaker}
                      </span>
                      <p className="leading-relaxed flex-1">{line.text}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </Dialog>
  )}
</>
);
}
