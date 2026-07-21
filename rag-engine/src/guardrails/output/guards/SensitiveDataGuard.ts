import { OutputGuard } from '../../../core/contracts';
import { ChatResponse, GuardDecision, GuardResult } from '../../../core/models';
import { PiiDetector } from '../../shared/pii-detector';

export class SensitiveDataGuard implements OutputGuard {
  private readonly detector = new PiiDetector();

  getName(): string {
    return 'SensitiveDataGuard';
  }

  async evaluate(response: ChatResponse): Promise<GuardResult> {
    const text = response.message.content;
    const detectedItems = this.detector.detect(text);

    if (detectedItems.length > 0) {
      return {
        decision: GuardDecision.REJECT,
        message: 'Sensitive data detected in the generated response.',
        details: {
          pii: detectedItems,
        },
      };
    }

    return { decision: GuardDecision.ALLOW };
  }
}
