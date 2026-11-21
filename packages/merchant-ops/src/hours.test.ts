import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isOpenAt, validateOpeningHours, type OpeningHours } from './index.ts';

const zones = ['Europe/Bratislava', 'Europe/Berlin'];
const weekdays = { mon: [{ open: '08:00', close: '20:00' }], tue: [{ open: '08:00', close: '20:00' }] };

const expectOpen = (hours: OpeningHours, cases: [string, boolean][]) => {
  for (const [instant, open] of cases) assert.equal(isOpenAt(hours, instant), open, `${hours.timeZone} ${instant}`);
};

for (const timeZone of zones) {
  test(`${timeZone}: opening is the same wall-clock time in winter (CET) and summer (CEST)`, () => {
    expectOpen({ timeZone, weekly: weekdays }, [
      ['2026-01-12T06:59:00Z', false],
      ['2026-01-12T07:00:00Z', true],
      ['2026-01-12T18:59:00Z', true],
      ['2026-01-12T19:00:00Z', false],
      ['2026-07-13T05:59:00Z', false],
      ['2026-07-13T06:00:00Z', true],
      ['2026-07-13T17:59:00Z', true],
      ['2026-07-13T18:00:00Z', false],
    ]);
  });

  test(`${timeZone}: spring-forward gap (29 March 2026) skips 02:00 to 03:00 local`, () => {
    expectOpen({ timeZone, weekly: { sun: [{ open: '01:00', close: '03:00' }] } }, [
      ['2026-03-28T23:59:00Z', false],
      ['2026-03-29T00:00:00Z', true],
      ['2026-03-29T00:59:00Z', true],
      ['2026-03-29T01:00:00Z', false],
    ]);
    expectOpen({ timeZone, weekly: { sun: [{ open: '02:30', close: '05:00' }] } }, [
      ['2026-03-29T00:59:00Z', false],
      ['2026-03-29T01:00:00Z', true],
      ['2026-03-29T02:59:00Z', true],
      ['2026-03-29T03:00:00Z', false],
    ]);
  });

  test(`${timeZone}: fall-back overlap (25 October 2026) repeats 02:00 to 03:00 local`, () => {
    expectOpen({ timeZone, weekly: { sun: [{ open: '01:00', close: '03:00' }] } }, [
      ['2026-10-24T22:59:00Z', false],
      ['2026-10-24T23:00:00Z', true],
      ['2026-10-25T00:30:00Z', true],
      ['2026-10-25T01:30:00Z', true],
      ['2026-10-25T01:59:00Z', true],
      ['2026-10-25T02:00:00Z', false],
    ]);
    expectOpen({ timeZone, weekly: { sat: [{ open: '22:00', close: '02:30' }] } }, [
      ['2026-10-25T00:15:00Z', true],
      ['2026-10-25T01:15:00Z', true],
      ['2026-10-25T01:30:00Z', false],
    ]);
  });
}

test('America/New_York changes on different dates (8 March and 1 November 2026)', () => {
  expectOpen({ timeZone: 'America/New_York', weekly: { sun: [{ open: '01:00', close: '03:00' }] } }, [
    ['2026-03-08T06:00:00Z', true],
    ['2026-03-08T06:59:00Z', true],
    ['2026-03-08T07:00:00Z', false],
    ['2026-03-29T00:30:00Z', false],
    ['2026-11-01T05:00:00Z', true],
    ['2026-11-01T06:30:00Z', true],
    ['2026-11-01T07:59:00Z', true],
    ['2026-11-01T08:00:00Z', false],
  ]);
});

test('overnight intervals spill into the next day and stop at close', () => {
  const hours: OpeningHours = { timeZone: 'Europe/Bratislava', weekly: { fri: [{ open: '18:00', close: '02:00' }] } };
  expectOpen(hours, [
    ['2026-11-20T16:59:00Z', false],
    ['2026-11-20T17:00:00Z', true],
    ['2026-11-21T00:30:00Z', true],
    ['2026-11-21T01:00:00Z', false],
  ]);
});

test('date exceptions replace weekly hours but keep the previous night tail', () => {
  const hours: OpeningHours = {
    timeZone: 'Europe/Bratislava',
    weekly: {
      wed: [{ open: '20:00', close: '01:00' }],
      thu: [{ open: '08:00', close: '20:00' }],
      fri: [{ open: '18:00', close: '02:00' }],
    },
    exceptions: { '2026-12-24': [], '2026-12-31': [{ open: '10:00', close: '14:00' }], '2026-11-27': [] },
  };
  expectOpen(hours, [
    ['2026-12-24T09:00:00Z', false],
    ['2026-12-23T23:30:00Z', true],
    ['2026-12-31T08:59:00Z', false],
    ['2026-12-31T09:00:00Z', true],
    ['2026-12-31T13:00:00Z', false],
    ['2026-11-27T18:00:00Z', false],
    ['2026-11-28T00:30:00Z', false],
  ]);
});

test('open equal to close means 24 hours; 24:00 closes at midnight', () => {
  expectOpen({ timeZone: 'Europe/Berlin', weekly: { mon: [{ open: '00:00', close: '00:00' }] } }, [
    ['2026-11-15T23:00:00Z', true],
    ['2026-11-16T22:59:00Z', true],
    ['2026-11-16T23:00:00Z', false],
  ]);
  expectOpen({ timeZone: 'Europe/Berlin', weekly: { mon: [{ open: '12:00', close: '24:00' }] } }, [
    ['2026-11-16T22:59:00Z', true],
    ['2026-11-16T23:00:00Z', false],
  ]);
});

test('invalid configuration is reported and fails closed', () => {
  const bad = {
    timeZone: 'Mars/Olympus',
    weekly: { mon: [{ open: '8:00', close: '25:00' }], fun: [] },
    exceptions: { '2026-02-30': [], '2026-12-24': [{ open: '24:00', close: '24:00' }] },
  } as unknown as OpeningHours;
  assert.deepEqual(validateOpeningHours(bad), [
    'timeZone',
    'weekly.mon[0].open',
    'weekly.mon[0].close',
    'weekly.fun',
    'exceptions.2026-02-30',
    'exceptions.2026-12-24[0].open',
  ]);
  assert.equal(isOpenAt(bad, '2026-11-16T10:00:00Z'), false);
  for (const interval of [{ open: '08:00', close: '25:00' }, { open: '24:00', close: '02:00' }, { open: '8', close: '20:00' }]) {
    const hours = { timeZone: 'Europe/Bratislava', weekly: { fri: [interval], sat: [interval] } };
    assert.notDeepEqual(validateOpeningHours(hours), []);
    assert.equal(isOpenAt(hours, '2026-11-20T21:00:00Z'), false);
    assert.equal(isOpenAt(hours, '2026-11-20T23:30:00Z'), false);
  }
  assert.deepEqual(validateOpeningHours({ timeZone: 'Europe/Berlin' } as OpeningHours), ['weekly']);
  assert.deepEqual(validateOpeningHours({ timeZone: 'Europe/Berlin', weekly: { mon: 'x' } } as unknown as OpeningHours), ['weekly.mon']);
  assert.equal(isOpenAt({ timeZone: 'Europe/Berlin', weekly: weekdays }, 'yesterday'), false);
  assert.deepEqual(validateOpeningHours({ timeZone: 'Europe/Bratislava', weekly: weekdays, exceptions: { '2026-12-24': [] } }), []);
});
