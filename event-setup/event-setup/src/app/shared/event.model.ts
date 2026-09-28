/**
 * The value shape owned by the Schedule control.
 *
 * `date` is an ISO calendar date (`YYYY-MM-DD`) and `startTime` is a 24h
 * clock time (`HH:mm`) — i.e. exactly what `<input type="date">` and
 * `<input type="time">` hand back. Keeping the control's value in the
 * browser's own string format means the control never has to guess a
 * timezone, and the parent never has to unpick a `Date`.
 */
export interface ScheduleValue {
  readonly date: string;
  readonly startTime: string;
  readonly durationMinutes: number;
}

/** One row inside the Ticket tiers control. */
export interface TicketTier {
  /** Stable identity for `@for` tracking and for row removal. Not user data. */
  readonly id: string;
  readonly label: string;
  /**
   * Price in whole currency units. `NaN` means "the user typed something
   * that is not a number" — the control keeps the row rather than silently
   * dropping the edit, and the validator reports it. See README §6.
   */
  readonly price: number;
}

/** The whole form model. One object, one signal, one source of truth. */
export interface EventSetup {
  readonly name: string;
  readonly description: string;
  readonly freeEvent: boolean;
  readonly schedule: ScheduleValue;
  readonly ticketTiers: readonly TicketTier[];
}

export const DEFAULT_DURATION_MINUTES = 60;

export function emptySchedule(): ScheduleValue {
  return { date: '', startTime: '', durationMinutes: DEFAULT_DURATION_MINUTES };
}

export function emptyEventSetup(): EventSetup {
  return {
    name: '',
    description: '',
    freeEvent: false,
    schedule: emptySchedule(),
    ticketTiers: [],
  };
}
