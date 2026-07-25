import { config } from '@/config';
import { logger } from '@/shared/logger';

/**
 * Singleton rate limiter for the Mistral Embedding API.
 *
 * Enforces two constraints:
 *  1. Requests Per Second (RPS) — at most N requests per second (default 1).
 *  2. Tokens Per Minute  (TPM) — at most N tokens in any sliding 60-second window (default 20 000 000).
 *
 * Usage:
 *   const limiter = MistralRateLimiter.getInstance();
 *   await limiter.acquire(estimatedTokens);
 *   // … now safe to call the Mistral API
 */
export class MistralRateLimiter {
  /* ------------------------------------------------------------------ */
  /*  Singleton                                                          */
  /* ------------------------------------------------------------------ */
  private static instance: MistralRateLimiter | null = null;

  static getInstance(): MistralRateLimiter {
    if (!MistralRateLimiter.instance) {
      MistralRateLimiter.instance = new MistralRateLimiter();
    }
    return MistralRateLimiter.instance;
  }

  /** Visible for testing — resets the singleton. */
  static resetInstance(): void {
    MistralRateLimiter.instance = null;
  }

  /* ------------------------------------------------------------------ */
  /*  Configuration                                                      */
  /* ------------------------------------------------------------------ */
  private readonly maxRps: number;
  private readonly maxTpm: number;
  private readonly windowMs = 60_000; // 60-second sliding window

  /* ------------------------------------------------------------------ */
  /*  State                                                              */
  /* ------------------------------------------------------------------ */
  /** Timestamp of the last request that was dispatched. */
  private lastRequestTime = 0;

  /**
   * Sliding window of (timestamp, tokenCount) entries.
   * Entries older than `windowMs` are pruned on every `acquire()` call.
   */
  private tokenLedger: Array<{ ts: number; tokens: number }> = [];

  /** Mutex queue — serialises concurrent `acquire()` calls so each one
   *  sees an up-to-date `lastRequestTime` / `tokenLedger`. */
  private queue: Promise<void> = Promise.resolve();

  /* ------------------------------------------------------------------ */
  /*  Constructor                                                        */
  /* ------------------------------------------------------------------ */
  private constructor() {
    // Read from config (populated from env vars with defaults)
    this.maxRps = config.embeddings.mistralRateLimitRps ?? 1;
    this.maxTpm = config.embeddings.mistralRateLimitTpm ?? 20_000_000;

    logger.info(
      { maxRps: this.maxRps, maxTpm: this.maxTpm },
      '[MistralRateLimiter] Initialised',
    );
  }

  /* ------------------------------------------------------------------ */
  /*  Public API                                                         */
  /* ------------------------------------------------------------------ */

  /**
   * Wait until both RPS and TPM budgets allow the next request.
   *
   * @param estimatedTokens  Estimated token count for the request payload.
   *                         Pass 0 if unknown (RPS will still be enforced).
   */
  async acquire(estimatedTokens: number): Promise<void> {
    // Chain onto the mutex so concurrent callers are serialised.
    this.queue = this.queue.then(() => this.doAcquire(estimatedTokens));
    return this.queue;
  }

  /* ------------------------------------------------------------------ */
  /*  Internals                                                          */
  /* ------------------------------------------------------------------ */

  private async doAcquire(estimatedTokens: number): Promise<void> {
    // ── 1. RPS enforcement ──────────────────────────────────────────
    const minIntervalMs = 1000 / this.maxRps; // e.g. 1000ms for 1 RPS
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;

    if (elapsed < minIntervalMs) {
      const waitMs = Math.ceil(minIntervalMs - elapsed);
      logger.debug({ waitMs }, '[MistralRateLimiter] RPS throttle — waiting');
      await this.sleep(waitMs);
    }

    // ── 2. TPM enforcement ──────────────────────────────────────────
    if (estimatedTokens > 0 && this.maxTpm > 0) {
      await this.waitForTokenBudget(estimatedTokens);
    }

    // ── 3. Record this request ──────────────────────────────────────
    const dispatchTime = Date.now();
    this.lastRequestTime = dispatchTime;

    if (estimatedTokens > 0) {
      this.tokenLedger.push({ ts: dispatchTime, tokens: estimatedTokens });
    }
  }

  /**
   * Block until enough tokens have expired from the sliding window
   * to accommodate `needed` tokens.
   */
  private async waitForTokenBudget(needed: number): Promise<void> {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const now = Date.now();
      this.pruneOldEntries(now);

      const usedTokens = this.tokenLedger.reduce((sum, e) => sum + e.tokens, 0);
      const available = this.maxTpm - usedTokens;

      if (needed <= available) {
        return; // budget is sufficient
      }

      // Find the earliest entry — wait until it expires out of the window.
      const earliest = this.tokenLedger[0];
      if (!earliest) return; // ledger is empty, should not happen but be safe

      const expiresAt = earliest.ts + this.windowMs;
      const waitMs = Math.max(expiresAt - now + 1, 50); // +1ms buffer

      logger.debug(
        { usedTokens, needed, waitMs },
        '[MistralRateLimiter] TPM throttle — waiting for token budget',
      );

      await this.sleep(waitMs);
    }
  }

  /** Remove ledger entries older than the sliding window. */
  private pruneOldEntries(now: number): void {
    const cutoff = now - this.windowMs;
    while (this.tokenLedger.length > 0 && this.tokenLedger[0]!.ts < cutoff) {
      this.tokenLedger.shift();
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                            */
  /* ------------------------------------------------------------------ */

  /**
   * Rough token estimate for a list of texts.
   * Uses chars / 4 which is a widely-used heuristic for embedding tokenisers.
   */
  static estimateTokens(texts: string[]): number {
    let totalChars = 0;
    for (const t of texts) {
      totalChars += t.length;
    }
    return Math.ceil(totalChars / 4);
  }
}
