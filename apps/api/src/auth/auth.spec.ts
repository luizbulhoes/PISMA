import { canEmitPt } from '@pisma/domain';

describe('authorization invariants', () => {
  it('blocks non-technician PT emission', () => {
    expect(canEmitPt('TECHNICIAN')).toBe(true);
    expect(canEmitPt('TST')).toBe(false);
    expect(canEmitPt('MANAGER')).toBe(false);
  });
});
