/**
 * Domain model representing metadata collected from a discovered source archive.
 */
export interface FileMetadata {
  readonly id?: string;
  readonly name: string;
  readonly path: string;
  readonly extension: string;
  readonly size: number;
  readonly createdAt?: Date;
  readonly modifiedAt: Date;
}
