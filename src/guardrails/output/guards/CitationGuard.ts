import { OutputGuard } from '../../../core/contracts';
import { ChatResponse, GuardDecision, GuardResult } from '../../../core/models';

export class CitationGuard implements OutputGuard {
  getName(): string {
    return 'CitationGuard';
  }

  async evaluate(response: ChatResponse): Promise<GuardResult> {
    const text = response.message.content;
    
    // Detect empty brackets (Missing citation ID)
    if (/\[\s*\]/.test(text)) {
      return {
        decision: GuardDecision.REJECT,
        message: 'Missing citation IDs detected in response (e.g., []).',
      };
    }

    // Detect duplicate IDs in the same citation block like [1, 1]
    const multiCitationRegex = /\[([\d,\s]+)\]/g;
    let match: RegExpExecArray | null;
    while ((match = multiCitationRegex.exec(text)) !== null) {
      const ids = (match[1] || '').split(',').map(s => s.trim()).filter(s => s.length > 0);
      const uniqueIds = new Set(ids);
      if (uniqueIds.size !== ids.length) {
        return {
          decision: GuardDecision.REJECT,
          message: `Duplicate citation IDs detected in response block: ${match[0]}`,
        };
      }
      
      // Detect invalid non-numeric or malformed
      if (ids.some(id => isNaN(Number(id)))) {
        return {
          decision: GuardDecision.REJECT,
          message: `Invalid citation reference detected in response: ${match[0]}`,
        };
      }
    }

    return { decision: GuardDecision.ALLOW };
  }
}
