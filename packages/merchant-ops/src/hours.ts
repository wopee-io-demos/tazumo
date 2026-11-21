import { toInstant } from './actors.ts';

export const weekdays = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
export type Weekday = (typeof weekdays)[number];

export type Interval = { open: string; close: string };

export type OpeningHours = {
  timeZone: string;
  weekly: Partial<Record<Weekday, Interval[]>>;
  exceptions?: Record<string, Interval[]>;
};

const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

export function isValidTimeZone(timeZone: string): boolean {
  if (typeof timeZone !== 'string' || !timeZone) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

function isRealDate(date: string) {
  const time = Date.parse(`${date}T00:00:00Z`);
  return datePattern.test(date) && !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === date;
}

export function validateOpeningHours(hours: OpeningHours): string[] {
  const errors: string[] = [];
  if (!isValidTimeZone(hours?.timeZone)) errors.push('timeZone');
  const isRecord = (value: unknown) => typeof value === 'object' && value !== null && !Array.isArray(value);
  const checkIntervals = (path: string, intervals: unknown) => {
    if (!Array.isArray(intervals)) {
      errors.push(path);
      return;
    }
    intervals.forEach((interval: Partial<Interval> | null, i) => {
      const open = String(interval?.open);
      if (!timePattern.test(open) || open === '24:00') errors.push(`${path}[${i}].open`);
      if (!timePattern.test(String(interval?.close))) errors.push(`${path}[${i}].close`);
    });
  };
  if (!isRecord(hours?.weekly)) errors.push('weekly');
  if (hours?.exceptions !== undefined && !isRecord(hours.exceptions)) errors.push('exceptions');
  if (errors.includes('weekly') || errors.includes('exceptions')) return errors;
  for (const [day, intervals] of Object.entries(hours.weekly)) {
    if (!(weekdays as readonly string[]).includes(day)) errors.push(`weekly.${day}`);
    else checkIntervals(`weekly.${day}`, intervals);
  }
  for (const [date, intervals] of Object.entries(hours.exceptions ?? {})) {
    if (!isRealDate(date)) errors.push(`exceptions.${date}`);
    else checkIntervals(`exceptions.${date}`, intervals);
  }
  return errors;
}

export function localTime(at: Date, timeZone: string): { date: string; minuteOfDay: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minuteOfDay: Number(parts.hour) * 60 + Number(parts.minute) };
}

const weekdayOf = (date: string) => weekdays[new Date(`${date}T00:00:00Z`).getUTCDay()];

const previousDate = (date: string) => new Date(Date.parse(`${date}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);

const intervalsFor = (hours: OpeningHours, date: string) =>
  hours.exceptions && Object.hasOwn(hours.exceptions, date) ? hours.exceptions[date] : (hours.weekly[weekdayOf(date)] ?? []);

/**
 * Wall-clock semantics: intervals are local times in `hours.timeZone`. A close at or before the open
 * runs past midnight (open === close means 24 hours). In a DST spring-forward gap the skipped local
 * times never occur; in a fall-back overlap both occurrences of a local time are treated alike.
 * An exception date replaces that day's weekly intervals, including their overnight tail.
 * Invalid hours (see `validateOpeningHours`) are treated as closed.
 */
export function isOpenAt(hours: OpeningHours, at: Date | string): boolean {
  const instant = toInstant(at);
  if (!instant || validateOpeningHours(hours).length) return false;
  const { date, minuteOfDay } = localTime(instant, hours.timeZone);
  const today = intervalsFor(hours, date).some(({ open, close }) => {
    const start = minutes(open);
    const end = minutes(close);
    return end > start ? minuteOfDay >= start && minuteOfDay < end : minuteOfDay >= start;
  });
  if (today) return true;
  return intervalsFor(hours, previousDate(date)).some(({ open, close }) => {
    const end = minutes(close);
    return end <= minutes(open) && minuteOfDay < end;
  });
}
