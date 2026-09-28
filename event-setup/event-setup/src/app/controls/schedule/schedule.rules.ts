import { schema, validate } from '@angular/forms/signals';
import type { ScheduleValue } from '../../shared/event.model';

export type ScheduleField = 'date' | 'startTime' | 'durationMinutes';

export interface ScheduleIssue {
  readonly field: ScheduleField;
  readonly kind: string;
  readonly message: string;
}

export const MIN_DURATION_MINUTES = 15;
export const MAX_DURATION_MINUTES = 24 * 60;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

/**
 * The single source of truth for "is this schedule any good?".
 *
 * It is a pure function on purpose. Two very different consumers need the
 * same answer and must never disagree:
 *
 *   1. ScheduleControlComponent, to render a message under the right input.
 *   2. `scheduleSchema` below, so the parent signal form goes invalid.
 *
 * Writing the rules twice — once for display, once for the form 
 */
export function validateSchedule(value: ScheduleValue | null | undefined): ScheduleIssue[] {
  if (!value) {
    return [{ field: 'date', kind: 'required', message: 'A schedule is required.' }];
  }

  const issues: ScheduleIssue[] = [];

  if (!value.date) {
    issues.push({ field: 'date', kind: 'required', message: 'Pick a date.' });
  } else if (!DATE_RE.test(value.date)) {
    issues.push({ field: 'date', kind: 'format', message: 'Use the date picker.' });
  }

  if (!value.startTime) {
    issues.push({ field: 'startTime', kind: 'required', message: 'Pick a start time.' });
  } else if (!TIME_RE.test(value.startTime)) {
    issues.push({ field: 'startTime', kind: 'format', message: 'Use the time picker.' });
  }

  const duration = value.durationMinutes;
  if (duration === null || duration === undefined || Number.isNaN(duration)) {
    issues.push({ field: 'durationMinutes', kind: 'required', message: 'Enter a duration.' });
  } else if (!Number.isInteger(duration)) {
    issues.push({
      field: 'durationMinutes',
      kind: 'integer',
      message: 'Duration must be a whole number of minutes.',
    });
  } else if (duration < MIN_DURATION_MINUTES) {
    issues.push({
      field: 'durationMinutes',
      kind: 'min',
      message: `Minimum duration is ${MIN_DURATION_MINUTES} minutes.`,
    });
  } else if (duration > MAX_DURATION_MINUTES) {
    issues.push({
      field: 'durationMinutes',
      kind: 'max',
      message: 'An event cannot run longer than 24 hours.',
    });
  }

  return issues;
}

 
export const scheduleSchema = schema<ScheduleValue>((path) => {
  validate(path, ({ value }) => {
    const issues = validateSchedule(value());
    if (issues.length === 0) {
      return null;
    }
    return issues.map((issue) => ({
      kind: `schedule.${issue.field}.${issue.kind}`,
      message: issue.message,
    }));
  });
});


export function endTimeOf(value: ScheduleValue): string | null {
  if (!TIME_RE.test(value.startTime) || !Number.isInteger(value.durationMinutes)) {
    return null;
  }
  const [hours, minutes] = value.startTime.split(':').map(Number);
  const total = hours * 60 + minutes + value.durationMinutes;
  const endHours = Math.floor(total / 60) % 24;
  const endMinutes = total % 60;
  return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
}
