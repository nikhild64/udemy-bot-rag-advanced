import { ValidationError } from '@/shared/errors';
import { CourseManifest } from './ManifestResult';

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export interface IManifestValidator {
  /**
   * Validate the given course manifest and return all validation errors encountered.
   */
  validate(manifest: CourseManifest): ValidationResult;

  /**
   * Validate the given course manifest and throw a ValidationError if any errors are found.
   */
  assertValid(manifest: CourseManifest): void;
}

export class ManifestValidator implements IManifestValidator {
  validate(manifest: CourseManifest): ValidationResult {
    const errors: string[] = [];

    if (!manifest.courseId || manifest.courseId.trim().length === 0) {
      errors.push('Course ID must be a non-empty string');
    }

    if (!manifest.courseName || manifest.courseName.trim().length === 0) {
      errors.push('Course name must be a non-empty string');
    }

    if (!manifest.rootDirectory || manifest.rootDirectory.trim().length === 0) {
      errors.push('Course root directory must be a non-empty string');
    }

    if (!manifest.modules || manifest.modules.length === 0) {
      errors.push('Course manifest must contain at least one module');
    }

    const seenModuleIds = new Set<string>();

    for (const module of manifest.modules || []) {
      if (!module.moduleId || module.moduleId.trim().length === 0) {
        errors.push('Module ID must be a non-empty string');
      } else {
        if (seenModuleIds.has(module.moduleId)) {
          errors.push(`Duplicate module ID found: '${module.moduleId}'`);
        }
        seenModuleIds.add(module.moduleId);
      }

      if (!module.moduleName || module.moduleName.trim().length === 0) {
        errors.push(`Module '${module.moduleId}' must have a non-empty module name`);
      }

      if (!module.modulePath || module.modulePath.trim().length === 0) {
        errors.push(`Module '${module.moduleId}' must have a non-empty module path`);
      }

      if (!module.lessons || module.lessons.length === 0) {
        errors.push(`Module '${module.moduleName || module.moduleId}' contains no lessons`);
        continue;
      }

      const seenLessonIds = new Set<string>();
      for (const lesson of module.lessons) {
        if (!lesson.lessonId || lesson.lessonId.trim().length === 0) {
          errors.push(`Lesson in module '${module.moduleId}' must have a non-empty lesson ID`);
        } else {
          if (seenLessonIds.has(lesson.lessonId)) {
            errors.push(`Duplicate lesson ID found: '${lesson.lessonId}'`);
          }
          seenLessonIds.add(lesson.lessonId);
        }

        if (!lesson.lessonName || lesson.lessonName.trim().length === 0) {
          errors.push(`Lesson '${lesson.lessonId}' must have a non-empty lesson name`);
        }

        if (!lesson.lessonPath || lesson.lessonPath.trim().length === 0) {
          errors.push(`Lesson '${lesson.lessonId}' must have a non-empty lesson path`);
        }

        if (!lesson.transcripts || lesson.transcripts.length === 0) {
          errors.push(
            `Lesson '${lesson.lessonName || lesson.lessonId}' (${lesson.lessonId}) has no transcript files`,
          );
          continue;
        }

        let preferredCount = 0;
        for (const transcript of lesson.transcripts) {
          if (!transcript.fileName || transcript.fileName.trim().length === 0) {
            errors.push(`Transcript in lesson '${lesson.lessonId}' must have a non-empty file name`);
          }
          if (!transcript.absolutePath || transcript.absolutePath.trim().length === 0) {
            errors.push(`Transcript '${transcript.fileName}' must have a non-empty absolute path`);
          }
          if (!transcript.relativePath || transcript.relativePath.trim().length === 0) {
            errors.push(`Transcript '${transcript.fileName}' must have a non-empty relative path`);
          }
          if (!transcript.format) {
            errors.push(`Transcript '${transcript.fileName}' must have a format specified`);
          }
          if (typeof transcript.fileSize !== 'number' || transcript.fileSize < 0) {
            errors.push(`Transcript '${transcript.fileName}' must have a valid non-negative file size`);
          }
          if (transcript.preferred) {
            preferredCount++;
          }
        }

        if (preferredCount !== 1) {
          errors.push(
            `Lesson '${lesson.lessonId}' must have exactly one preferred transcript (found ${preferredCount})`,
          );
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  assertValid(manifest: CourseManifest): void {
    const result = this.validate(manifest);
    if (!result.valid) {
      throw new ValidationError(
        `Course manifest validation failed:\n- ${result.errors.join('\n- ')}`,
      );
    }
  }
}
