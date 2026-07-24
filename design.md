# Design — ChaibookLM

Locked design system for ChaibookLM. Future Hallmark runs and project components read this file first; pages defer to it. Amend intentionally — the file is the rule.

## System
- Genre · modern-minimal
- Macrostructure · Bento Grid
- Theme · Cobalt-Orange (Vibe: "Dark, technical, high-contrast with warm orange signal accent")
- Axes · dark-paper / sans-display / warm-orange-accent

## Tokens (canonical · `globals.css` / `LandingPage.tsx` is source of truth)
```css
:root {
  --color-paper:      #121212;
  --color-paper-2:    #1A1A1A;
  --color-paper-3:    #232323;
  --color-ink:        #FFFFFF;
  --color-ink-2:      #A9A9A9;
  --color-rule:       #2B2B2B;
  --color-accent:     #F2A23A; /* Brand Chat Window Orange */
  --color-accent-ink: #121212;
  --color-focus:      var(--color-accent);

  --font-sans:        var(--font-sans), system-ui, sans-serif;
  --font-display:     var(--font-sans);
  --font-mono:        var(--font-mono), monospace;

  /* Spacing scale: --space-3xs (4px) … --space-3xl (112px) */
  /* Type scale: clamp(2.5rem, 6vw, 4.5rem) display, 1.25rem lede, 1rem body */

  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --dur-fast: 180ms;  --dur-base: 240ms;  --dur-slow: 320ms;

  --radius-card: 12px;  --radius-pill: 999px;  --radius-input: 8px;
}
```

## CTA voice
- Primary · Fill `#F2A23A` (Orange) · Dark ink `#121212` · Radius `999px` · Padding `0.875rem 1.75rem`
- Secondary · Outline `#2B2B2B` hairline · Text `#FFFFFF` · Hover `#1A1A1A` · Radius `999px`

## Nav & Footer
- Nav Archetype · `N1b` Canonical SaaS three-section (Wordmark left, links center, CTA right, frosted scroll backdrop)
- Footer Archetype · `Ft1` Mast-headed (Wordmark + tagline + legal links strip)

## Background & Glows
- Background · `#121212` canvas
- Ambient Glow · Top-centered subtle radial bloom using `radial-gradient(ellipse at center, color-mix(in oklch, #F2A23A 15%, transparent) 0%, transparent 70%)`

## Motion stance
- Subtle CSS transitions on hover (`transform: translateY(-1px)`, `scale(0.98)`, border color mix)
- Reduced-motion fallback · ≤150ms opacity crossfade.
