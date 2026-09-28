import { ChangeDetectionStrategy, Component, computed, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import {
  MAX_DURATION_MINUTES,
  MIN_DURATION_MINUTES,
  ScheduleField,
  endTimeOf,
  validateSchedule,
} from './schedule.rules';
import { DEFAULT_DURATION_MINUTES, ScheduleValue, emptySchedule } from '../../shared/event.model';

/**
 * Schedule: date + start time + duration, presented to the parent form as a
 * single value of type ScheduleValue.
 *
 * The parent binds to this the same way it binds to an <input>:
 *
 *     <app-schedule-control [formField]="eventForm.schedule" />
 *
 * and knows nothing about the three inputs inside.
 */
@Component({
  selector: 'app-schedule-control',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ScheduleControlComponent),
      multi: true,
    },
  ],
  template: `
    <fieldset class="schedule" [disabled]="isDisabled()">
      <legend>Schedule</legend>

      <div class="row">
        <div class="field">
          <label [attr.for]="'schedule-date'">Date</label>
          <input
            id="schedule-date"
            type="date"
            [value]="date()"
            (input)="setDate($any($event.target).value)"
            (blur)="markTouched()"
          />
        </div>

        <div class="field">
          <label [attr.for]="'schedule-start'">Start time</label>
          <input
            id="schedule-start"
            type="time"
            [value]="startTime()"
            (input)="setStartTime($any($event.target).value)"
            (blur)="markTouched()"
          />
        </div>

        <div class="field">
          <label [attr.for]="'schedule-duration'">Duration (minutes)</label>
          <input
            id="schedule-duration"
            type="number"
            [min]="minDuration"
            [max]="maxDuration"
            step="5"
            [value]="durationInput()"
            (input)="setDuration($any($event.target).value)"
            (blur)="markTouched()"
          />
        </div>
      </div>

      @if (endTime(); as end) {
        <p class="hint">Ends at {{ end }}.</p>
      }

      @if (disabledReason(); as reason) {
        <p class="hint">{{ reason }}</p>
      }

      @if (visibleIssues().length > 0) {
        <ul class="errors">
          @for (issue of visibleIssues(); track issue.kind + issue.field) {
            <li>{{ issue.message }}</li>
          }
        </ul>
      }
    </fieldset>
  `,
  styles: `
    .schedule {
      border: 1px solid GrayText;
      border-radius: 6px;
      padding: 0.75rem 1rem 0.25rem;
    }
    .row {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
    }
    .row .field {
      flex: 1 1 10rem;
    }
  `,
})
export class ScheduleControlComponent implements ControlValueAccessor {
  protected readonly minDuration = MIN_DURATION_MINUTES;
  protected readonly maxDuration = MAX_DURATION_MINUTES;

 
  readonly revealErrors = input(false, { alias: 'showErrors' });

  readonly disabledReason = input<string | null>(null);

  protected readonly date = signal('');
  protected readonly startTime = signal('');
  protected readonly durationMinutes = signal<number>(DEFAULT_DURATION_MINUTES);

  /** Raw text of the duration box, so a mid-edit "" does not snap back to 60. */
  protected readonly durationInput = signal<string>(String(DEFAULT_DURATION_MINUTES));

  protected readonly isDisabled = signal(false);
  protected readonly touched = signal(false);

  private readonly value = computed<ScheduleValue>(() => ({
    date: this.date(),
    startTime: this.startTime(),
    durationMinutes: this.durationMinutes(),
  }));

  private readonly issues = computed(() => validateSchedule(this.value()));

  /**
   * Errors exist from the first render, but nobody wants to be told a form
   * they have not filled in yet is wrong. Visibility is derived, not stored.
   */
  protected readonly visibleIssues = computed(() =>
    this.touched() || this.revealErrors() ? this.issues() : [],
  );

  protected readonly endTime = computed(() => endTimeOf(this.value()));

  private onChange: (value: ScheduleValue) => void = () => {};
  private onTouched: () => void = () => {};

  // --- ControlValueAccessor ------------------------------------------------

  writeValue(value: ScheduleValue | null): void {
    const next = value ?? emptySchedule();
    this.date.set(next.date ?? '');
    this.startTime.set(next.startTime ?? '');
    this.durationMinutes.set(next.durationMinutes);
    this.durationInput.set(Number.isNaN(next.durationMinutes) ? '' : String(next.durationMinutes));
    // Deliberately no onChange() here. See README Q5.
  }

  registerOnChange(fn: (value: ScheduleValue) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled.set(isDisabled);
  }

  // --- inner field handlers ------------------------------------------------

  protected setDate(raw: string): void {
    this.date.set(raw);
    this.commit();
  }

  protected setStartTime(raw: string): void {
    this.startTime.set(raw);
    this.commit();
  }

  protected setDuration(raw: string): void {
    this.durationInput.set(raw);
    this.durationMinutes.set(raw.trim() === '' ? Number.NaN : Number(raw));
    this.commit();
  }

  protected markTouched(): void {
    if (!this.touched()) {
      this.touched.set(true);
      this.onTouched();
    }
  }

  /** Test seam: which messages belong to which inner field. */
  issuesFor(field: ScheduleField) {
    return this.visibleIssues().filter((issue) => issue.field === field);
  }

  /**
   * Every push to the parent goes through here, and it is only ever called
   * from a user-driven handler — never from an effect watching `value`.
   */
  private commit(): void {
    this.onChange(this.value());
  }
}
