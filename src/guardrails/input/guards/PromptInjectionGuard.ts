import { InputGuard } from '../../../core/contracts';
import { GuardDecision, GuardRequest, GuardResult } from '../../../core/models';

export class PromptInjectionGuard implements InputGuard {
  private readonly patterns = [
    /ignore (?:all )?(?:previous )?instructions/i,
    /reveal (?:your )?system prompt/i,
    /forget (?:all )?(?:previous )?instructions/i,
    /override (?:developer )?instructions/i,
    /bypass (?:all )?rules/i,
  ];

  getName(): string {
    return 'PromptInjectionGuard';
  }

  async evaluate(request: GuardRequest): Promise<GuardResult> {
    for (const pattern of this.patterns) {
      if (pattern.test(request.query)) {
        return {
          decision: GuardDecision.REJECT,
          message: 'Potential prompt injection detected.',
        };
      }
    }
    return { decision: GuardDecision.ALLOW };
  }
}
