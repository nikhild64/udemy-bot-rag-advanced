export interface SearchFilter {
  courseId?: string;
  moduleId?: string;
  lessonId?: string;
  language?: string;
  [key: string]: unknown;
}
