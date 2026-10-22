import { describe, expect, it } from 'vitest';

import { EvidenceBinding } from './evidence-binding';

describe('asynchronous evidence binding', () => {
  it('accepts evidence only for the exact current subject', () => {
    const binding = new EvidenceBinding();
    const token = binding.begin('message A');

    expect(binding.accept(token, 'message A')).toBe(true);
    expect(binding.isBoundTo('message A')).toBe(true);
    expect(binding.isBoundTo('message B')).toBe(false);
  });

  it('does not retire evidence for a same-value input event', () => {
    const binding = new EvidenceBinding();
    const token = binding.begin('message A');
    binding.accept(token, 'message A');

    expect(binding.invalidateIfChanged('message A')).toBe(false);
    expect(binding.isBoundTo('message A')).toBe(true);
  });

  it('rejects a late reply after the subject changes', () => {
    const binding = new EvidenceBinding();
    const token = binding.begin('message A');

    expect(binding.invalidateIfChanged('message B')).toBe(true);
    expect(binding.accept(token, 'message B')).toBe(false);
    expect(binding.isBoundTo('message B')).toBe(false);
  });

  it('keeps an old reply stale even if the subject later returns to its old value', () => {
    const binding = new EvidenceBinding();
    const token = binding.begin('message A');

    binding.invalidateIfChanged('message B');
    binding.invalidateIfChanged('message A');

    expect(binding.accept(token, 'message A')).toBe(false);
  });
});
