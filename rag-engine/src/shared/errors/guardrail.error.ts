import { AppError } from './app.error';

export class InputGuardError extends AppError {
  constructor(message: string, public readonly guardName?: string) {
    super(message, { code: 'INPUT_GUARD_ERROR', statusCode: 400 });
    this.name = 'InputGuardError';
  }
}

export class OutputGuardError extends AppError {
  constructor(message: string, public readonly guardName?: string) {
    super(message, { code: 'OUTPUT_GUARD_ERROR', statusCode: 500 });
    this.name = 'OutputGuardError';
  }
}
