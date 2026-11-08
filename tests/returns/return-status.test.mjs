import assert from 'node:assert/strict';
import { test } from 'node:test';
import { collectReturnTrades, getReturnState, koreaDate, returnLabel, returnCountdown, returnTextColor } from '../../src/features/returns/return-status.ts';
const rental = (overrides = {}) => ({ id: 'r1', status: 'APPROVED', rental_start_date: '2026-11-01', rental_end_date: '2026-11-10', item: { title: '닌텐도', trade_type: 'RENTAL', status: 'RESERVED' }, ...overrides });

test('remaining days count down to the return date, and same-day rental is due today', () => {
  assert.deepEqual(getReturnState(rental(), '2026-11-08'), { kind: 'upcoming', dueDate: '2026-11-10', days: 2 });
  assert.equal(returnLabel(getReturnState(rental(), '2026-11-10')), '오늘 반납');
  assert.equal(getReturnState(rental({ rental_start_date: '2026-11-10' }), '2026-11-10').kind, 'due-today');
});
test('the day after the return date is one day overdue, including month/year/leap boundaries', () => {
  assert.equal(returnLabel(getReturnState(rental(), '2026-11-11')), '반납 기한 1일 초과');
  assert.equal(getReturnState(rental(), '2026-11-13').days, 3);
  assert.equal(getReturnState(rental({ rental_start_date: '2026-01-01', rental_end_date: '2026-12-31' }), '2027-01-01').days, 1);
  assert.equal(getReturnState(rental({ rental_start_date: '2028-02-01', rental_end_date: '2028-02-29' }), '2028-03-01').days, 1);
});
test('calendar day follows Korea even while UTC is still the previous date', () => {
  assert.equal(koreaDate(new Date('2026-11-10T14:59:59Z')), '2026-11-10');
  assert.equal(koreaDate(new Date('2026-11-10T15:00:00Z')), '2026-11-11');
});
test('future rentals are labelled as not started', () => {
  assert.equal(getReturnState(rental({ rental_start_date: '2026-11-09' }), '2026-11-08').kind, 'scheduled');
});
test('sale, pending and rejected requests do not produce return reminders', () => {
  assert.equal(getReturnState(rental({ item: { trade_type: 'SALE', status: 'RESERVED' } }), '2026-11-11'), null);
  for (const status of ['PENDING', 'REJECTED']) assert.equal(getReturnState(rental({ status }), '2026-11-11'), null);
  assert.equal(getReturnState(rental({ item: null }), '2026-11-11'), null);
});
test('both explicit request completion and existing item-level completion stop overdue alerts', () => {
  assert.equal(getReturnState(rental({ status: 'COMPLETED' }), '2026-11-11').kind, 'returned');
  const legacy = rental({ item: { title: '닌텐도', trade_type: 'RENTAL', status: 'COMPLETED' } });
  assert.equal(getReturnState(legacy, '2026-11-11').kind, 'returned');
  assert.equal(collectReturnTrades([legacy], [], '2026-11-11').length, 0);
});
test('invalid, missing and reversed rental dates are not silently counted as overdue', () => {
  for (const override of [{ rental_end_date: null }, { rental_start_date: null }, { rental_end_date: '2026-02-30' }, { rental_start_date: '2026-11-12' }, { rental_end_date: 'not-a-date' }]) {
    assert.equal(getReturnState(rental(override), '2026-11-11').kind, 'unknown');
  }
});
test('summary deduplicates requests and orders overdue, today, upcoming and future rentals', () => {
  const a = rental({ id: 'today' }), b = rental({ id: 'overdue', rental_end_date: '2026-11-09' });
  const c = rental({ id: 'upcoming', rental_end_date: '2026-11-12' });
  const result = collectReturnTrades([a, b], [a, c], '2026-11-10');
  assert.deepEqual(result.map(entry => entry.trade.id), ['overdue', 'today', 'upcoming']);
  assert.equal(result.find(e => e.trade.id === 'today').direction, 'received');
  assert.deepEqual(collectReturnTrades([], [], '2026-11-10'), []);
});

test('countdown format distinguishes overdue from upcoming with warning text', () => {
  assert.equal(returnCountdown(getReturnState(rental(), '2026-10-10')), 'D-31');
  assert.equal(returnCountdown(getReturnState(rental(), '2026-11-08')), 'D-2');
  assert.equal(returnCountdown(getReturnState(rental(), '2026-11-10')), 'D-Day');
  assert.equal(returnCountdown(getReturnState(rental(), '2026-11-12')), 'D-2!!');
});
test('font changes from neutral to increasingly urgent red as the due date approaches', () => {
  const color = date => returnTextColor(getReturnState(rental(), date));
  assert.equal(color('2026-10-01'), 'text-slate-600');
  assert.equal(color('2026-10-15'), 'text-rose-500');
  assert.equal(color('2026-11-01'), 'text-rose-600');
  assert.equal(color('2026-11-05'), 'text-red-600');
  assert.equal(color('2026-11-08'), 'text-red-700');
  assert.equal(color('2026-11-10'), 'text-red-800');
  assert.equal(color('2026-11-12'), 'text-red-800');
});
test('nearest return date leads regardless of whether a rental has started', () => {
  const active = rental({ id: 'active', rental_end_date: '2026-11-20' });
  const future = rental({ id: 'future', rental_start_date: '2026-11-11', rental_end_date: '2026-11-12' });
  const unknown = rental({ id: 'unknown', rental_end_date: null });
  const overdue = rental({ id: 'overdue', rental_end_date: '2026-11-09' });
  assert.deepEqual(collectReturnTrades([active, unknown], [future, overdue], '2026-11-10').map(entry => entry.trade.id), ['overdue', 'future', 'active', 'unknown']);
});
