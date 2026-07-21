import { createHash } from 'crypto';
import { Chunk, ChunkMetadata, Transcript, TranscriptCue } from '@/core/models';
import { ChunkingStrategy, ChunkingStrategyContext } from './ChunkingStrategy';
import { chunkingConfig } from '@/config';
import { ChunkingError } from '@/shared/errors';

/**
 * Strategy that generates semantically meaningful chunks by grouping consecutive cues,
 * respecting temporal relationships, max/min limits, and configurable overlap.
 */
export class SemanticChunkingStrategy implements ChunkingStrategy {
  readonly name = 'SemanticChunkingStrategy';

  chunk(transcript: Transcript, context: ChunkingStrategyContext): readonly Chunk[] {
    if (!transcript) {
      throw new ChunkingError('Invalid transcript: transcript object is null or undefined');
    }
    if (!transcript.cues || transcript.cues.length === 0) {
      throw new ChunkingError(
        `Empty transcript: cannot generate chunks from empty transcript "${transcript.id || context.transcriptId}"`,
      );
    }

    const maxCharacters = context.config?.maxCharacters ?? chunkingConfig.maxCharacters;
    const overlapCharacters = context.config?.overlapCharacters ?? chunkingConfig.overlapCharacters;
    const minCharacters = context.config?.minCharacters ?? chunkingConfig.minCharacters;

    if (overlapCharacters < 0 || overlapCharacters >= maxCharacters) {
      throw new ChunkingError(
        `Invalid overlap configuration: overlapCharacters (${overlapCharacters}) must be non-negative and strictly less than maxCharacters (${maxCharacters})`,
      );
    }

    // Validate cue timestamps and ordering
    const cues = transcript.cues;
    for (let i = 0; i < cues.length; i++) {
      const cue = cues[i];
      if (!cue) continue;
      if (cue.startTime < 0 || cue.endTime < 0) {
        throw new ChunkingError(
          `Invalid transcript: cue "${cue.id || i}" has negative timestamp (startTime: ${cue.startTime}, endTime: ${cue.endTime})`,
        );
      }
      if (cue.startTime > cue.endTime) {
        throw new ChunkingError(
          `Invalid transcript: cue "${cue.id || i}" has invalid timestamp ordering: startTime (${cue.startTime}) > endTime (${cue.endTime})`,
        );
      }
    }

    const rawChunkGroups: TranscriptCue[][] = [];
    let currentCues: TranscriptCue[] = [];
    let currentLength = 0;

    let i = 0;
    while (i < cues.length) {
      const cue = cues[i];
      if (!cue) {
        i++;
        continue;
      }
      const cueText = cue.text.trim();

      // If current accumulated chunk is empty and this single cue exceeds maxCharacters,
      // split the single cue by sentence boundaries where practical.
      if (currentCues.length === 0 && cueText.length > maxCharacters) {
        const sentences = this.splitTextIntoSentences(cueText, maxCharacters);
        if (sentences.length <= 1) {
          // Cannot cleanly split further into smaller sentences; emit cue as single chunk
          rawChunkGroups.push([cue]);
          i++;
          continue;
        } else {
          for (let sIdx = 0; sIdx < sentences.length; sIdx++) {
            const sentText = sentences[sIdx];
            if (sentText === undefined) continue;
            const subCue: TranscriptCue = {
              ...cue,
              id: `${cue.id}-sub-${sIdx}`,
              text: sentText,
            };
            rawChunkGroups.push([subCue]);
          }
          i++;
          continue;
        }
      }

      const addedLength = currentLength === 0 ? cueText.length : currentLength + 1 + cueText.length;

      if (addedLength <= maxCharacters) {
        currentCues.push(cue);
        currentLength = addedLength;
        i++;
      } else {
        // Finalize current chunk right now
        rawChunkGroups.push([...currentCues]);

        // Compute overlap cues for the next chunk from currentCues
        const overlapCues: TranscriptCue[] = [];
        if (overlapCharacters > 0 && currentCues.length > 1) {
          let overlapLen = 0;
          // Step backwards from end down to index 1 (never take index 0 so loop always makes forward progress)
          for (let m = currentCues.length - 1; m >= 1; m--) {
            const curCue = currentCues[m];
            if (!curCue) continue;
            const textLen = curCue.text.trim().length;
            const newOverlapLen = overlapLen === 0 ? textLen : overlapLen + 1 + textLen;
            if (newOverlapLen <= overlapCharacters) {
              overlapCues.unshift(curCue);
              overlapLen = newOverlapLen;
            } else {
              break;
            }
          }
        }

        currentCues = [...overlapCues];
        currentLength = currentCues.map((c) => c.text.trim()).join(' ').length;
        // Do not advance `i`; next iteration will test adding cues[i] onto overlapCues
      }
    }

    if (currentCues.length > 0) {
      if (rawChunkGroups.length > 0) {
        const finalLen = currentCues.map((c) => c.text.trim()).join(' ').length;
        if (finalLen < minCharacters) {
          const prevGroup = rawChunkGroups[rawChunkGroups.length - 1];
          if (prevGroup) {
            const combinedLen =
              prevGroup.map((c) => c.text.trim()).join(' ').length + 1 + finalLen;

            if (combinedLen <= maxCharacters) {
              // Merge currentCues into prevGroup without duplicates
              const prevIds = new Set(prevGroup.map((c) => c.id || `${c.startTime}-${c.endTime}`));
              for (const c of currentCues) {
                const key = c.id || `${c.startTime}-${c.endTime}`;
                if (!prevIds.has(key)) {
                  prevGroup.push(c);
                }
              }
            } else {
              // Try expanding currentCues backwards from prevGroup until minCharacters is met
              const expanded = [...currentCues];
              let expLen = finalLen;
              for (let m = prevGroup.length - 1; m >= 0; m--) {
                if (expLen >= minCharacters) break;
                const c = prevGroup[m];
                if (!c) continue;
                const isAlreadyIn = expanded.some(
                  (e) => (e.id && e.id === c.id) || (e.startTime === c.startTime && e.endTime === c.endTime),
                );
                if (!isAlreadyIn) {
                  const added = c.text.trim().length + 1;
                  if (expLen + added <= maxCharacters) {
                    expanded.unshift(c);
                    expLen += added;
                  } else {
                    break;
                  }
                }
              }
              rawChunkGroups.push(expanded);
            }
          } else {
            rawChunkGroups.push([...currentCues]);
          }
        } else {
          rawChunkGroups.push([...currentCues]);
        }
      } else {
        rawChunkGroups.push([...currentCues]);
      }
    }

    return rawChunkGroups.map((cuesGroup, index) =>
      this.createChunk(cuesGroup, index, context, transcript),
    );
  }

  private createChunk(
    chunkCues: readonly TranscriptCue[],
    index: number,
    context: ChunkingStrategyContext,
    transcript: Transcript,
  ): Chunk {
    const startCue = chunkCues[0];
    const endCue = chunkCues[chunkCues.length - 1];

    if (!startCue || !endCue) {
      throw new ChunkingError('Cannot create chunk from empty cues array');
    }

    const startTime = startCue.startTime;
    const endTime = endCue.endTime;
    const duration = Math.max(0, Number((endTime - startTime).toFixed(3)));
    const text = chunkCues.map((c) => c.text.trim()).join(' ');
    const characterCount = text.length;
    const cueCount = chunkCues.length;

    const courseId = context.courseId || transcript.courseId || 'unknown-course';
    const moduleId = context.moduleId || transcript.moduleId || 'unknown-module';
    const lessonId = context.lessonId || transcript.lessonId || 'unknown-lesson';
    const transcriptId = context.transcriptId || transcript.id || `ts-${lessonId}`;
    const sourceTranscriptPath = context.sourceFile ?? transcript.sourceFile ?? '';

    const chunkIdentity = `${courseId}|${moduleId}|${lessonId}|${index}`;
    const hash = createHash('sha256').update(chunkIdentity).digest('hex');
    const id = `${hash.substring(0, 8)}-${hash.substring(8, 12)}-4${hash.substring(13, 16)}-a${hash.substring(17, 20)}-${hash.substring(20, 32)}`;

    const metadata: ChunkMetadata = {
      courseId,
      courseTitle: context.courseTitle,
      moduleId,
      moduleTitle: context.moduleTitle,
      lessonId,
      lessonTitle: context.lessonTitle,
      transcriptId,
      transcriptFile: sourceTranscriptPath ? sourceTranscriptPath.split(/[/\\]/).pop() : undefined,
      chunkIndex: index,
      startTime,
      endTime,
      duration,
      characterCount,
      cueCount,
      originalCueRange: {
        startCueId: startCue.id,
        endCueId: endCue.id,
        startOrder: startCue.order ?? 0,
        endOrder: endCue.order ?? chunkCues.length - 1,
      },
      language: context.language ?? transcript.language,
    };

    return {
      id,
      text,
      metadata,
      courseId,
      moduleId,
      lessonId,
      transcriptId,
      chunkIndex: index,
      startTime,
      endTime,
      duration,
      characterCount,
      cueCount,
    };
  }

  private splitTextIntoSentences(text: string, maxCharacters: number): string[] {
    // Split by punctuation boundaries (. ! ?) while retaining readable sentence chunks
    const parts = text.split(/(?<=[.!?])\s+/);
    const results: string[] = [];
    let current = '';

    for (const part of parts) {
      if (!current) {
        if (part.length <= maxCharacters) {
          current = part;
        } else {
          // Even a single sentence exceeds maxCharacters; split by words
          const words = part.split(/\s+/);
          let wCurrent = '';
          for (const w of words) {
            const added = wCurrent ? `${wCurrent} ${w}` : w;
            if (added.length <= maxCharacters) {
              wCurrent = added;
            } else {
              if (wCurrent) results.push(wCurrent);
              wCurrent = w;
            }
          }
          if (wCurrent) results.push(wCurrent);
        }
      } else {
        const added = `${current} ${part}`;
        if (added.length <= maxCharacters) {
          current = added;
        } else {
          results.push(current);
          if (part.length <= maxCharacters) {
            current = part;
          } else {
            const words = part.split(/\s+/);
            let wCurrent = '';
            for (const w of words) {
              const wAdded = wCurrent ? `${wCurrent} ${w}` : w;
              if (wAdded.length <= maxCharacters) {
                wCurrent = wAdded;
              } else {
                if (wCurrent) results.push(wCurrent);
                wCurrent = w;
              }
            }
            if (wCurrent) results.push(wCurrent);
            current = '';
          }
        }
      }
    }

    if (current) {
      results.push(current);
    }

    return results;
  }
}
