export interface EvidenceToken {
  readonly generation: number;
  readonly subject: string;
}

/**
 * Binds asynchronous evidence to the exact input that requested it.
 *
 * Workers cannot be cancelled once their cryptographic operation has started,
 * so callers use the generation token to ignore replies made stale by a newer
 * operation or an input edit.
 */
export class EvidenceBinding {
  private generation = 0;
  private subject: string | null = null;
  private bound = false;

  begin(subject: string): EvidenceToken {
    this.generation += 1;
    this.subject = subject;
    this.bound = false;
    return { generation: this.generation, subject };
  }

  invalidateIfChanged(subject: string): boolean {
    if (this.subject === subject) return false;
    this.generation += 1;
    this.subject = subject;
    this.bound = false;
    return true;
  }

  isCurrent(token: EvidenceToken, currentSubject: string): boolean {
    return token.generation === this.generation
      && token.subject === this.subject
      && token.subject === currentSubject;
  }

  accept(token: EvidenceToken, currentSubject: string): boolean {
    if (!this.isCurrent(token, currentSubject)) return false;
    this.bound = true;
    return true;
  }

  isBoundTo(subject: string): boolean {
    return this.bound && this.subject === subject;
  }
}
