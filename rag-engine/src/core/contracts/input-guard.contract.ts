import { GuardRequest, GuardResult } from '../models';

export interface InputGuard {
  /**
   * Returns the unique name of the guard for logging and configuration purposes.
   */
  getName(): string;

  /**
   * Evaluates the given request and returns a decision.
   * @param request The request to evaluate
   * @returns A promise resolving to a GuardResult (ALLOW, REJECT, or MODIFY)
   */
  evaluate(request: GuardRequest): Promise<GuardResult>;
}
