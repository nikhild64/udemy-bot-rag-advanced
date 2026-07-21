export interface Citation {
  chunkId: string;
  courseId: string;
  courseName: string;
  moduleId: string;
  moduleTitle: string;
  lessonId: string;
  lessonTitle: string;
  transcriptFile: string;
  startTime: number;
  endTime: number;
  similarityScore: number;
  text?: string;
}
