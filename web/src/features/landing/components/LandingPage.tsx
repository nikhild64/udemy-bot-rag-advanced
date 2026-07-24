'use client';

import React, { useEffect, useState } from 'react';
import { SignInButton, SignUpButton } from '@clerk/nextjs';
import { Brain, Database, Zap, Layers, ArrowRight, Check, UploadCloud, Cpu, Sparkles } from 'lucide-react';

export function LandingPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 24);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        /* Hallmark · genre: modern-minimal · macrostructure: Bento Grid · theme: Cobalt-Dark · nav: N1b · footer: Ft1 */
        :root {
          --color-paper: oklch(14% 0 0);
          --color-paper-2: oklch(18% 0 0);
          --color-paper-3: oklch(22% 0 0);
          --color-ink: oklch(98% 0 0);
          --color-ink-2: oklch(75% 0 0);
          --color-accent: #F2A23A; /* Chat window orange primary */
          --color-accent-ink: #121212;
          --color-rule: oklch(26% 0 0);
          --color-focus: var(--color-accent);
          
          --rule-hair: 1px;
          --space-3xs: 0.25rem;
          --space-2xs: 0.5rem;
          --space-xs: 0.75rem;
          --space-sm: 1rem;
          --space-md: 1.5rem;
          --space-lg: 2rem;
          --space-xl: 3rem;
          --space-2xl: 4.5rem;
          --space-3xl: 7rem;
          --page-max: 1200px;
          --page-gutter: 1.5rem;
          --radius-card: 12px;
          
          --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
          --ease-spring: cubic-bezier(0.175, 0.885, 0.32, 1.275);
          --dur-short: 220ms;
        }

        html {
          scroll-behavior: smooth;
        }

        .landing-page {
          background: var(--color-paper);
          color: var(--color-ink);
          min-height: 100vh;
          font-family: var(--font-sans);
          overflow-x: clip;
          position: relative;
        }

        .landing-page::before {
          content: '';
          position: absolute;
          top: -250px;
          left: 50%;
          transform: translateX(-50%);
          width: 1000px;
          height: 500px;
          background: radial-gradient(ellipse at center, color-mix(in oklch, var(--color-accent) 15%, transparent) 0%, transparent 70%);
          pointer-events: none;
          z-index: 0;
        }

        /* N1b Navigation */
        .nav { 
          position: fixed; inset: 0 0 auto; z-index: 500; 
          background: transparent; border-bottom: 1px solid transparent;
          transition: background 240ms, border-color 240ms, box-shadow 240ms; 
        }
        .nav.is-scrolled { 
          background: color-mix(in oklch, var(--color-paper) 72%, transparent);
          backdrop-filter: blur(18px) saturate(160%); 
          border-bottom-color: var(--color-rule); 
          box-shadow: 0 8px 28px -18px oklch(0% 0 0 / 0.4); 
        }
        .nav__inner { 
          max-width: var(--page-max); margin: 0 auto; padding-inline: var(--page-gutter); 
          height: 64px; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; 
        }
        .nav__brand { justify-self: start; display: flex; align-items: center; gap: 0.5rem; font-weight: 700; letter-spacing: -0.02em; color: var(--color-ink); }
        .nav__brand svg { color: var(--color-accent); }
        .nav__center { justify-self: center; display: flex; gap: var(--space-xs); }
        .nav__right { justify-self: end; display: flex; gap: var(--space-xs); align-items: center; }
        .nav__link {
          padding: 0.5rem 0.75rem; color: var(--color-ink-2); font-size: 0.875rem; font-weight: 500;
          border-radius: 6px; transition: color var(--dur-short), background var(--dur-short);
          cursor: pointer; text-decoration: none;
        }
        .nav__link:hover { color: var(--color-ink); background: var(--color-paper-2); }
        @media (max-width: 900px) { .nav__center { display: none; } }

        /* Shared Buttons */
        .btn {
          display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem;
          padding: 0.625rem 1.25rem; font-size: 0.875rem; font-weight: 600;
          border-radius: 999px; white-space: nowrap; cursor: pointer;
          transition: transform var(--dur-short) var(--ease-out), background var(--dur-short);
          border: none; outline: none; text-decoration: none;
        }
        .btn:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }
        .btn:active { transform: scale(0.98); }
        .btn--text { background: transparent; color: var(--color-ink); }
        .btn--text:hover { background: var(--color-paper-2); }
        .btn--accent { background: var(--color-accent); color: var(--color-accent-ink); }
        .btn--accent:hover { transform: translateY(-1px); box-shadow: 0 4px 16px color-mix(in oklch, var(--color-accent) 35%, transparent); }
        .btn--outline { background: transparent; border: 1px solid var(--color-rule); color: var(--color-ink); }
        .btn--outline:hover { background: var(--color-paper-2); }

        /* Hero */
        .hero {
          padding: calc(64px + var(--space-3xl)) var(--page-gutter) var(--space-3xl) var(--page-gutter);
          max-width: 900px; margin: 0 auto; text-align: center;
          position: relative; z-index: 10;
        }
        .hero__pill {
          display: inline-flex; align-items: center; gap: 0.5rem;
          padding: 0.25rem 0.75rem; border-radius: 999px;
          border: 1px solid color-mix(in oklch, var(--color-accent) 30%, transparent);
          background: color-mix(in oklch, var(--color-accent) 8%, var(--color-paper-2));
          font-size: 0.75rem; font-weight: 600; color: var(--color-accent);
          margin-bottom: var(--space-lg);
        }
        .hero__title {
          font-size: clamp(2.5rem, 6vw, 4.5rem); font-weight: 700;
          letter-spacing: -0.035em; line-height: 1.1; margin: 0 0 var(--space-md) 0;
          color: var(--color-ink); font-style: normal;
        }
        .hero__lede {
          font-size: clamp(1rem, 2vw, 1.25rem); color: var(--color-ink-2);
          line-height: 1.6; max-width: 600px; margin: 0 auto var(--space-xl) auto;
        }
        .hero__actions {
          display: flex; gap: var(--space-sm); justify-content: center; flex-wrap: wrap;
        }
        .hero__actions .btn { padding: 0.875rem 1.75rem; font-size: 1rem; }

        /* Section Headings */
        .section-header {
          text-align: center; max-width: 640px; margin: 0 auto var(--space-2xl) auto;
        }
        .section-header__tag {
          font-size: 0.75rem; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.1em; color: var(--color-accent); margin-bottom: var(--space-xs);
        }
        .section-header__title {
          font-size: clamp(1.75rem, 4vw, 2.5rem); font-weight: 700;
          letter-spacing: -0.025em; color: var(--color-ink); margin: 0 0 var(--space-xs) 0;
        }
        .section-header__desc {
          font-size: 1rem; color: var(--color-ink-2); line-height: 1.6; margin: 0;
        }

        /* Bento Grid (Features) */
        .bento-wrapper {
          max-width: var(--page-max); margin: 0 auto; padding: var(--space-2xl) var(--page-gutter) var(--space-3xl) var(--page-gutter);
          scroll-margin-top: 80px;
        }
        .bento {
          display: grid; gap: var(--space-md);
          grid-template-columns: 1fr;
        }
        @media (min-width: 768px) {
          .bento { grid-template-columns: repeat(3, 1fr); }
        }
        .bento__cell {
          background: var(--color-paper-2); border: 1px solid var(--color-rule);
          border-radius: var(--radius-card); padding: var(--space-xl);
          display: flex; flex-direction: column; align-items: flex-start;
          transition: border-color var(--dur-short);
        }
        .bento__cell:hover { border-color: color-mix(in oklch, var(--color-rule) 50%, var(--color-ink)); }
        
        @media (min-width: 768px) {
          .bento__cell:nth-child(1) { grid-column: span 2; }
          .bento__cell:nth-child(2) { grid-column: span 1; }
          .bento__cell:nth-child(3) { grid-column: span 1; }
          .bento__cell:nth-child(4) { grid-column: span 2; }
        }

        .bento__icon {
          width: 40px; height: 40px; border-radius: 8px;
          background: var(--color-paper-3); border: 1px solid var(--color-rule);
          display: flex; align-items: center; justify-content: center;
          margin-bottom: var(--space-lg); color: var(--color-accent);
        }
        .bento__title {
          font-size: 1.25rem; font-weight: 600; color: var(--color-ink);
          margin: 0 0 var(--space-xs) 0; letter-spacing: -0.01em;
        }
        .bento__desc {
          font-size: 0.9375rem; color: var(--color-ink-2); line-height: 1.6; margin: 0;
        }

        /* Methodology Section */
        .methodology-wrapper {
          max-width: var(--page-max); margin: 0 auto; padding: var(--space-2xl) var(--page-gutter) var(--space-3xl) var(--page-gutter);
          border-top: var(--rule-hair) solid var(--color-rule);
          scroll-margin-top: 80px;
        }
        .methodology-grid {
          display: grid; gap: var(--space-md); grid-template-columns: 1fr;
        }
        @media (min-width: 768px) {
          .methodology-grid { grid-template-columns: repeat(3, 1fr); }
        }
        .method-card {
          background: var(--color-paper-2); border: 1px solid var(--color-rule);
          border-radius: var(--radius-card); padding: var(--space-xl);
          position: relative; overflow: hidden;
        }
        .method-card__step {
          font-size: 0.75rem; font-weight: 700; color: var(--color-accent);
          letter-spacing: 0.05em; margin-bottom: var(--space-md);
          display: flex; align-items: center; gap: 0.5rem;
        }
        .method-card__title {
          font-size: 1.125rem; font-weight: 600; color: var(--color-ink);
          margin: 0 0 var(--space-xs) 0;
        }
        .method-card__desc {
          font-size: 0.875rem; color: var(--color-ink-2); line-height: 1.6; margin: 0;
        }

        /* Pricing Section */
        .pricing-wrapper {
          max-width: var(--page-max); margin: 0 auto; padding: var(--space-2xl) var(--page-gutter) var(--space-3xl) var(--page-gutter);
          border-top: var(--rule-hair) solid var(--color-rule);
          scroll-margin-top: 80px;
        }
        .pricing-grid {
          display: grid; gap: var(--space-lg); grid-template-columns: 1fr;
          max-width: 800px; margin: 0 auto;
        }
        @media (min-width: 640px) {
          .pricing-grid { grid-template-columns: repeat(2, 1fr); }
        }
        .pricing-card {
          background: var(--color-paper-2); border: 1px solid var(--color-rule);
          border-radius: var(--radius-card); padding: var(--space-xl);
          display: flex; flex-direction: column; justify-content: space-between;
          position: relative;
        }
        .pricing-card--featured {
          border-color: var(--color-accent);
          box-shadow: 0 0 30px -10px color-mix(in oklch, var(--color-accent) 25%, transparent);
        }
        .pricing-card__badge {
          position: absolute; top: -12px; right: 20px;
          background: var(--color-accent); color: var(--color-accent-ink);
          font-size: 0.7rem; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.05em; padding: 0.15rem 0.6rem; border-radius: 999px;
        }
        .pricing-card__name {
          font-size: 1.125rem; font-weight: 600; color: var(--color-ink); margin: 0 0 var(--space-xs) 0;
        }
        .pricing-card__price {
          font-size: 2.25rem; font-weight: 700; color: var(--color-ink); margin: 0 0 var(--space-xs) 0;
          display: flex; align-items: baseline; gap: 0.25rem;
        }
        .pricing-card__period { font-size: 0.875rem; font-weight: 400; color: var(--color-ink-2); }
        .pricing-card__desc { font-size: 0.875rem; color: var(--color-ink-2); margin-bottom: var(--space-lg); }
        .pricing-card__list {
          list-style: none; padding: 0; margin: 0 0 var(--space-xl) 0; space-y: var(--space-xs);
        }
        .pricing-card__item {
          display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; color: var(--color-ink-2);
          margin-bottom: 0.5rem;
        }
        .pricing-card__item svg { color: var(--color-accent); shrink: 0; }

        /* Ft1 Footer */
        .foot-mast {
          max-width: var(--page-max); margin: 0 auto; padding: var(--space-3xl) var(--page-gutter) var(--space-xl) var(--page-gutter);
          border-top: var(--rule-hair) solid var(--color-rule);
          display: grid; gap: var(--space-md);
        }
        .foot-mast .wordmark { font-weight: 700; color: var(--color-ink); margin: 0; display: flex; align-items: center; gap: 0.35rem; }
        .foot-mast .tagline { color: var(--color-ink-2); font-size: 0.875rem; margin: 0; }
        .foot-mast .links { color: var(--color-ink-2); font-size: 0.875rem; margin: 0; }
        .foot-mast .links span { margin: 0 0.5rem; opacity: 0.5; }
      `}} />
      <div className="landing-page">
        
        {/* N1b Navigation */}
        <header className={`nav ${scrolled ? 'is-scrolled' : ''}`}>
          <div className="nav__inner">
            <div className="nav__brand">
              <Brain className="w-5 h-5" />
              ChaibookLM
            </div>
            <nav className="nav__center">
              <a href="#features" className="nav__link">Features</a>
              <a href="#methodology" className="nav__link">Methodology</a>
              <a href="#pricing" className="nav__link">Pricing</a>
            </nav>
            <div className="nav__right">
              <SignInButton mode="modal">
                <button className="btn btn--text">Sign In</button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="btn btn--accent">Start Building</button>
              </SignUpButton>
            </div>
          </div>
        </header>

        {/* Hero */}
        <section className="hero">
          <div className="hero__pill">ChaibookLM v1.0</div>
          <h1 className="hero__title">Your personal knowledge assistant.</h1>
          <p className="hero__lede">
            Upload PDFs, websites, and playlists. Ask questions and get grounded answers with exact citations in seconds.
          </p>
          <div className="hero__actions">
            <SignUpButton mode="modal">
              <button className="btn btn--accent">Start Building for Free <ArrowRight className="w-4 h-4" /></button>
            </SignUpButton>
            <SignInButton mode="modal">
              <button className="btn btn--outline">Open Workspace</button>
            </SignInButton>
          </div>
        </section>

        {/* Features Section (Bento Grid) */}
        <section id="features" className="bento-wrapper">
          <div className="section-header">
            <div className="section-header__tag">Features</div>
            <h2 className="section-header__title">Built for serious research</h2>
            <p className="section-header__desc">Everything you need to turn raw documents into active, queryable knowledge.</p>
          </div>

          <div className="bento">
            <article className="bento__cell">
              <div className="bento__icon"><Database className="w-5 h-5" /></div>
              <h3 className="bento__title">Multimodal Ingestion</h3>
              <p className="bento__desc">
                Instantly parse PDFs, DOCX, Markdown notes, full web pages, and YouTube video/playlist transcripts automatically into your notebooks.
              </p>
            </article>
            
            <article className="bento__cell">
              <div className="bento__icon"><Zap className="w-5 h-5" /></div>
              <h3 className="bento__title">Vector RAG Retrieval</h3>
              <p className="bento__desc">
                High-dimensional vector embeddings ensure you find the exact snippet of knowledge in milliseconds.
              </p>
            </article>

            <article className="bento__cell">
              <div className="bento__icon"><Layers className="w-5 h-5" /></div>
              <h3 className="bento__title">Zero Hallucinations</h3>
              <p className="bento__desc">
                Every AI response is strictly grounded in your uploaded documents, complete with direct source quotes and clickable citations.
              </p>
            </article>

            <article className="bento__cell">
              <div className="bento__icon"><Brain className="w-5 h-5" /></div>
              <h3 className="bento__title">Notebook Workspaces & Global Search</h3>
              <p className="bento__desc">
                Organize knowledge into dedicated notebooks. Access quick global search and full keyboard navigation (`Cmd+K`) anytime.
              </p>
            </article>
          </div>
        </section>

        {/* Methodology Section */}
        <section id="methodology" className="methodology-wrapper">
          <div className="section-header">
            <div className="section-header__tag">Methodology</div>
            <h2 className="section-header__title">How ChaibookLM Works</h2>
            <p className="section-header__desc">A reliable 3-step pipeline designed for precision and accurate source attribution.</p>
          </div>

          <div className="methodology-grid">
            <article className="method-card">
              <div className="method-card__step">
                <UploadCloud className="w-4 h-4" /> STEP 01
              </div>
              <h3 className="method-card__title">1. Connect & Chunk</h3>
              <p className="method-card__desc">
                Upload files or paste links. ChaibookLM extracts clean text, splits documents into semantic chunks, and prepares them for indexing.
              </p>
            </article>

            <article className="method-card">
              <div className="method-card__step">
                <Cpu className="w-4 h-4" /> STEP 02
              </div>
              <h3 className="method-card__title">2. Vector Embeddings</h3>
              <p className="method-card__desc">
                Chunks are converted into high-dimensional vector representations and stored in a high-speed workspace vector index.
              </p>
            </article>

            <article className="method-card">
              <div className="method-card__step">
                <Sparkles className="w-4 h-4" /> STEP 03
              </div>
              <h3 className="method-card__title">3. Grounded Synthesis</h3>
              <p className="method-card__desc">
                Your questions trigger hybrid semantic search, retrieving relevant context excerpts to generate precise, cited answers.
              </p>
            </article>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="pricing-wrapper">
          <div className="section-header">
            <div className="section-header__tag">Pricing</div>
            <h2 className="section-header__title">Simple, transparent plans</h2>
            <p className="section-header__desc">Start exploring your knowledge base for free today.</p>
          </div>

          <div className="pricing-grid">
            {/* Free Tier */}
            <article className="pricing-card pricing-card--featured">
              <div className="pricing-card__badge">Current Default</div>
              <div>
                <h3 className="pricing-card__name">Free Starter</h3>
                <div className="pricing-card__price">
                  Free
                </div>
                <p className="pricing-card__desc">Ideal for students, researchers, and personal learning.</p>
                <ul className="pricing-card__list">
                  <li className="pricing-card__item"><Check className="w-4 h-4" /> Up to 2 Notebooks per user</li>
                  <li className="pricing-card__item"><Check className="w-4 h-4" /> Full Document & Web URL Ingestion</li>
                  <li className="pricing-card__item"><Check className="w-4 h-4" /> YouTube Transcript Parsing</li>
                  <li className="pricing-card__item"><Check className="w-4 h-4" /> Grounded RAG with Direct Citations</li>
                  <li className="pricing-card__item"><Check className="w-4 h-4" /> Global Search & Shortcuts</li>
                </ul>
              </div>
              <SignUpButton mode="modal">
                <button className="btn btn--accent" style={{ width: '100%' }}>Get Started Free</button>
              </SignUpButton>
            </article>

            {/* Pro Tier */}
            <article className="pricing-card">
              <div className="pricing-card__badge" style={{ background: 'var(--color-paper-3)', color: 'var(--color-ink-2)', border: '1px solid var(--color-rule)' }}>
                Coming Soon
              </div>
              <div>
                <h3 className="pricing-card__name">Pro Workspace</h3>
                <div className="pricing-card__price">
                  Pro Tier
                </div>
                <p className="pricing-card__desc">For power users and teams managing extensive libraries.</p>
                <ul className="pricing-card__list">
                  <li className="pricing-card__item"><Check className="w-4 h-4" /> Unlimited Notebooks</li>
                  <li className="pricing-card__item"><Check className="w-4 h-4" /> Priority Vector Processing</li>
                  <li className="pricing-card__item"><Check className="w-4 h-4" /> Higher File Size Limits</li>
                  <li className="pricing-card__item"><Check className="w-4 h-4" /> Advanced Custom Chunking</li>
                  <li className="pricing-card__item"><Check className="w-4 h-4" /> Multi-notebook Cross Querying</li>
                </ul>
              </div>
            </article>
          </div>
        </section>

        {/* Ft1 Footer */}
        <footer className="foot-mast">
          <p className="wordmark"><Brain className="w-4 h-4" /> ChaibookLM</p>
          <p className="tagline">The product development system for knowledge.</p>
          <p className="links">
            Privacy <span>·</span> Terms <span>·</span> Security
          </p>
        </footer>

      </div>
    </>
  );
}
