import { TranscriptFormat } from '@/types';
import { DiscoveredCourse, DiscoveredModule, DiscoveredLesson } from './CourseManifestDiscoveryService';
import { CourseManifest, ManifestModule, ManifestLesson, ManifestTranscript } from './ManifestResult';

export interface CourseManifestBuilderOptions {
  readonly courseId?: string;
  readonly courseName?: string;
}

export interface ICourseManifestBuilder {
  /**
   * Convert raw discovered course entities into a strongly-typed CourseManifest domain model.
   */
  build(discoveredCourse: DiscoveredCourse, options?: CourseManifestBuilderOptions): CourseManifest;
}

export class CourseManifestBuilder implements ICourseManifestBuilder {
  build(discoveredCourse: DiscoveredCourse, options?: CourseManifestBuilderOptions): CourseManifest {
    const courseId = options?.courseId ?? discoveredCourse.directoryName;
    const courseName = options?.courseName ?? this.formatHumanReadableName(discoveredCourse.directoryName);

    const modules: ManifestModule[] = discoveredCourse.modules.map((mod) => this.buildModule(mod));

    return {
      courseId,
      courseName,
      rootDirectory: discoveredCourse.rootDirectory,
      modules,
    };
  }

  private buildModule(discoveredModule: DiscoveredModule): ManifestModule {
    const { id: moduleId, name: moduleName } = this.parseIdAndName(discoveredModule.directoryName);
    const lessons: ManifestLesson[] = discoveredModule.lessons.map((lesson) =>
      this.buildLesson(lesson),
    );

    return {
      moduleId,
      moduleName,
      modulePath: discoveredModule.relativePath,
      lessons,
    };
  }

  private buildLesson(discoveredLesson: DiscoveredLesson): ManifestLesson {
    const { id: lessonId, name: lessonName } = this.parseIdAndName(discoveredLesson.directoryName);

    const hasVtt = discoveredLesson.transcriptFiles.some(
      (file) => file.format === TranscriptFormat.VTT,
    );

    let foundPreferred = false;
    const transcripts: ManifestTranscript[] = discoveredLesson.transcriptFiles.map((file) => {
      let preferred = false;
      if (hasVtt) {
        if (file.format === TranscriptFormat.VTT && !foundPreferred) {
          preferred = true;
          foundPreferred = true;
        }
      } else {
        if (!foundPreferred) {
          preferred = true;
          foundPreferred = true;
        }
      }

      return {
        fileName: file.fileName,
        absolutePath: file.absolutePath,
        relativePath: file.relativePath,
        format: file.format,
        preferred,
        fileSize: file.fileSize,
      };
    });

    return {
      lessonId,
      lessonName,
      lessonPath: discoveredLesson.relativePath,
      transcripts,
    };
  }

  private parseIdAndName(directoryName: string): { id: string; name: string } {
    const match = directoryName.match(/^(\d+)[\s-_]*(.+)$/);
    if (match && match[1] && match[2]) {
      return {
        id: match[1],
        name: match[2].trim(),
      };
    }

    return {
      id: directoryName,
      name: this.formatHumanReadableName(directoryName),
    };
  }

  private formatHumanReadableName(rawName: string): string {
    return rawName
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}
