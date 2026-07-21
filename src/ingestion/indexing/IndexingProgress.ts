export class IndexingProgress {
  private _totalChunks: number = 0;
  private _processedChunks: number = 0;
  private _successfulEmbeddings: number = 0;
  private _successfulUploads: number = 0;
  private _failedChunks: number = 0;
  private _retryCount: number = 0;
  private readonly _startTime: number;

  constructor(totalChunks: number) {
    this._totalChunks = totalChunks;
    this._startTime = Date.now();
  }

  public get totalChunks(): number {
    return this._totalChunks;
  }

  public get processedChunks(): number {
    return this._processedChunks;
  }

  public get successfulEmbeddings(): number {
    return this._successfulEmbeddings;
  }

  public get successfulUploads(): number {
    return this._successfulUploads;
  }

  public get failedChunks(): number {
    return this._failedChunks;
  }

  public get retryCount(): number {
    return this._retryCount;
  }

  public get elapsedMs(): number {
    return Date.now() - this._startTime;
  }

  public addSuccessfulEmbeddings(count: number): void {
    this._successfulEmbeddings += count;
  }

  public addSuccessfulUploads(count: number): void {
    this._successfulUploads += count;
    this._processedChunks += count;
  }

  public addFailedChunks(count: number): void {
    this._failedChunks += count;
    this._processedChunks += count;
  }

  public incrementRetryCount(): void {
    this._retryCount++;
  }
}
