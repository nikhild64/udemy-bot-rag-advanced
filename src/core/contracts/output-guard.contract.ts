import { ChatResponse, GuardResult } from '../models';

export interface OutputGuard {
  /**
   * Returns the unique name of the guard for logging and configuration purposes.
   */
  getName(): string;

  /**
   * Evaluates the given response and returns a decision.
   * @param response The response to evaluate
   * @returns A promise resolving to a GuardResult (ALLOW, REJECT, or MODIFY)
   */
  evaluate(response: ChatResponse): Promise<GuardResult>;
}
