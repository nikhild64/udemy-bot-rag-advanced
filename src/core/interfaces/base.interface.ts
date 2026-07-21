/**
 * Base interface for domain entities in the clean architecture foundation.
 */
export interface BaseEntity {
  readonly id: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
