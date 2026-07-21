import { AppError } from './app.error';

export class InputGuardError extends AppError {
  constructor(message: string, public readonly guardName?: string) {
    super(message, 'INPUT_GUARD_ERROR', 400); // 400 Bad Request
    this.name = 'InputGuardError';
  }
}
