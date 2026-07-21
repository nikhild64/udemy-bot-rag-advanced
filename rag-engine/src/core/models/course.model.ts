import { Lesson } from './lesson.model';

/**
 * Represents a logical section or grouping of lessons within a course.
 */
export interface Module {
  readonly id: string;
  readonly courseId: string;
  readonly title: string;
  readonly lessons: readonly Lesson[];
}

/**
 * Represents one top-level imported learning resource (e.g., a Udemy ZIP archive).
 */
export interface Course {
  readonly id: string;
  readonly title: string;
  readonly modules: readonly Module[];
}
