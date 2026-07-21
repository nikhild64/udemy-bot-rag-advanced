import { Transcript } from './transcript.model';

/**
 * Represents an individual lecture or video within a module.
 */
export interface Lesson {
  readonly id: string;
  readonly moduleId: string;
  readonly title: string;
  readonly transcript?: Transcript;
}
