export enum GuardDecision {
  ALLOW = 'ALLOW',
  REJECT = 'REJECT',
  MODIFY = 'MODIFY',
}

export interface GuardRequest {
  readonly query: string;
}

export interface GuardResult {
  readonly decision: GuardDecision;
  readonly message?: string;
  readonly modifiedRequest?: GuardRequest;
  readonly details?: Record<string, any>;
}
