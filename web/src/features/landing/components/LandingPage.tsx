'use client';

import React from 'react';
import { SignInButton, SignUpButton } from '@clerk/nextjs';
import { Sparkles, ArrowRight, Brain, Zap, Layers, Database } from 'lucide-react';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 relative overflow-hidden flex flex-col font-sans">
      {/* Background gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/30 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange-500/20 blur-[120px] rounded-full pointer-events-none" />

      {/* Navigation */}
      <header className="relative z-10 container mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-orange-400 flex items-center justify-center shadow-lg shadow-primary/20">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white">ChaibookLM</span>
        </div>
        <div className="flex items-center gap-4">
          <SignInButton mode="modal">
            <button className="text-sm font-semibold text-slate-300 hover:text-white transition">Sign In</button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button className="px-5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/10 rounded-full text-sm font-semibold text-white transition backdrop-blur-md">
              Get Started
            </button>
          </SignUpButton>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6 mt-16 lg:mt-24">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold uppercase tracking-wider mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Sparkles className="w-4 h-4" /> The future of knowledge management
        </div>
        
        <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight max-w-4xl leading-tight mb-8 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
          Your personal <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-orange-400">AI-powered</span> knowledge assistant.
        </h1>
        
        <p className="text-lg lg:text-xl text-slate-400 max-w-2xl mb-12 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200 leading-relaxed">
          Upload PDFs, websites, and YouTube playlists. Ask questions and get grounded answers with exact citations in seconds.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 animate-in fade-in slide-in-from-bottom-10 duration-700 delay-300">
          <SignUpButton mode="modal">
            <button className="flex items-center gap-2 px-8 py-4 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full font-semibold text-lg shadow-xl shadow-primary/30 transition hover:scale-105 active:scale-95">
              Start Building for Free <ArrowRight className="w-5 h-5" />
            </button>
          </SignUpButton>
          <SignInButton mode="modal">
            <button className="px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-full font-semibold text-lg backdrop-blur-sm transition hover:bg-white/15">
              Log In to Workspace
            </button>
          </SignInButton>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mt-32 mb-20 animate-in fade-in duration-1000 delay-500 text-left">
          <div className="p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/10 transition duration-300">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center mb-4">
              <Database className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Ingest Everything</h3>
            <p className="text-sm text-slate-400 leading-relaxed">Instantly parse PDFs, scrape full websites, and summarize hours of YouTube video playlists automatically.</p>
          </div>
          <div className="p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/10 transition duration-300">
            <div className="w-12 h-12 rounded-2xl bg-primary/20 text-primary flex items-center justify-center mb-4">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Instant Retrieval</h3>
            <p className="text-sm text-slate-400 leading-relaxed">Advanced vector-based RAG ensures you find the exact piece of knowledge you need in milliseconds.</p>
          </div>
          <div className="p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/10 transition duration-300">
            <div className="w-12 h-12 rounded-2xl bg-orange-500/20 text-orange-500 flex items-center justify-center mb-4">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Grounded Citations</h3>
            <p className="text-sm text-slate-400 leading-relaxed">Never hallucinate again. Every answer comes with exact source excerpts and clickable timestamps.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
