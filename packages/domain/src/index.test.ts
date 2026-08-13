import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  canActAsApprovalSlot,
  canEmitPt,
  canSubmitConclusionForSignatures,
  canTransitionPt,
  isBlockingChecklistAnswer,
  nextStatusAfterApproval,
  suggestAudicampTriage,
} from './index';

describe('domain rules', () => {
  it('only technician emits PT', () => {
    assert.equal(canEmitPt('TECHNICIAN'), true);
    assert.equal(canEmitPt('TST'), false);
    assert.equal(canEmitPt('SUPERVISOR'), false);
    assert.equal(canEmitPt('MANAGER'), false);
    assert.equal(canEmitPt('MASTER'), false);
  });

  it('manager cannot emit PT (explicit)', () => {
    assert.equal(canEmitPt('MANAGER'), false);
  });

  it('manager can fill both approval slots', () => {
    assert.equal(canActAsApprovalSlot('MANAGER', 'TST'), true);
    assert.equal(canActAsApprovalSlot('MANAGER', 'SUPERVISOR'), true);
    assert.equal(canActAsApprovalSlot('TST', 'SUPERVISOR'), false);
  });

  it('blank and NO block checklist', () => {
    assert.equal(isBlockingChecklistAnswer(null), true);
    assert.equal(isBlockingChecklistAnswer('NO'), true);
    assert.equal(isBlockingChecklistAnswer('YES'), false);
    assert.equal(isBlockingChecklistAnswer('NA'), false);
  });

  it('PT state transitions', () => {
    assert.equal(canTransitionPt('DRAFT', 'SUBMITTED'), true);
    assert.equal(canTransitionPt('DRAFT', 'APPROVED'), false);
    assert.equal(canTransitionPt('SUBMITTED', 'PARTIALLY_APPROVED'), true);
    assert.equal(canTransitionPt('PARTIALLY_APPROVED', 'APPROVED'), true);
    assert.equal(canTransitionPt('APPROVED', 'IN_EXECUTION'), true);
    assert.equal(canTransitionPt('IN_EXECUTION', 'SUSPENDED'), true);
    assert.equal(canTransitionPt('SUSPENDED', 'IN_EXECUTION'), true);
    assert.equal(canTransitionPt('IN_EXECUTION', 'CLOSED'), true);
    assert.equal(canTransitionPt('CLOSED', 'DRAFT'), false);
    assert.equal(canTransitionPt('CANCELLED', 'DRAFT'), false);
    assert.equal(canTransitionPt('REJECTED', 'EDIT_AUTHORIZED'), true);
  });

  it('next status after single-slot approval', () => {
    assert.equal(
      nextStatusAfterApproval({
        current: 'SUBMITTED',
        tstApproved: true,
        supervisorApproved: false,
        decision: 'APPROVED',
      }),
      'PARTIALLY_APPROVED',
    );
    assert.equal(
      nextStatusAfterApproval({
        current: 'PARTIALLY_APPROVED',
        tstApproved: true,
        supervisorApproved: true,
        decision: 'APPROVED',
      }),
      'APPROVED',
    );
    assert.equal(
      nextStatusAfterApproval({
        current: 'SUBMITTED',
        tstApproved: false,
        supervisorApproved: false,
        decision: 'REJECTED',
      }),
      'REJECTED',
    );
  });

  it('CAT PDF gate for RA conclusion signatures', () => {
    assert.equal(
      canSubmitConclusionForSignatures({ occurrenceType: 'RA', hasCatPdf: false }).ok,
      false,
    );
    assert.equal(
      canSubmitConclusionForSignatures({ occurrenceType: 'RA', hasCatPdf: true }).ok,
      true,
    );
    assert.equal(
      canSubmitConclusionForSignatures({ occurrenceType: 'RQA', hasCatPdf: false }).ok,
      true,
    );
  });

  it('audicamp triage is proportional without blame', () => {
    assert.equal(
      suggestAudicampTriage({ riskImminent: true, goodPractice: false, deviationsCount: 0 }),
      'IMMINENT_RISK',
    );
    assert.equal(
      suggestAudicampTriage({ riskImminent: false, goodPractice: true, deviationsCount: 0 }),
      'REGISTER_ONLY',
    );
    assert.equal(
      suggestAudicampTriage({ riskImminent: false, goodPractice: false, deviationsCount: 1 }),
      'PAC_SUGGESTED',
    );
  });
});
