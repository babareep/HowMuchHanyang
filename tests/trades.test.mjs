import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rentalDays, canApprove, koreaToday } from '../src/lib/trades.ts';

test('inclusive rental days and invalid/empty ranges', () => {
  assert.equal(rentalDays('2026-11-10', '2026-11-10'), 1);
  assert.equal(rentalDays('2026-11-10', '2026-11-12'), 3);
  assert.equal(rentalDays('2026-11-30', '2026-12-01'), 2);
  assert.equal(rentalDays('2026-11-12', '2026-11-10'), 0);
  assert.equal(rentalDays(null, '2026-11-12'), 0);
  assert.equal(rentalDays('bad', 'bad'), 0);
});
test('only pending requests are approvable; reserved rentals allow another period', () => {
  assert.equal(canApprove({ trade_type: 'SALE', status: 'AVAILABLE' }, { status: 'PENDING' }), true);
  assert.equal(canApprove({ trade_type: 'SALE', status: 'RESERVED' }, { status: 'PENDING' }), false);
  assert.equal(canApprove({ trade_type: 'RENTAL', status: 'RESERVED' }, { status: 'PENDING' }), true);
  assert.equal(canApprove({ trade_type: 'RENTAL', status: 'COMPLETED' }, { status: 'PENDING' }), false);
  for (const status of ['APPROVED', 'REJECTED', 'COMPLETED']) assert.equal(canApprove({ trade_type: 'SALE', status: 'AVAILABLE' }, { status }), false);
});
test('Korean date is an ISO date independent of machine timezone', () => {
  assert.equal(koreaToday(), new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date()));
});
