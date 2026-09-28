import { ChangeDetectionStrategy, Component, computed, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MAX_TIERS, TicketTierIssue, validateTicketTiers } from './ticket-tiers.rules';
import type { TicketTier } from '../../shared/event.model';

let nextRowId = 0;

/** Ids are local bookkeeping for `@for` tracking, not user data. */
function createRowId(): string {
  return `tier-${++nextRowId}`;
}

/**
 * Ticket tiers: a list the user grows and shrinks, exposed to the parent
 * form as a single `TicketTier[]` value.
 *
 *     <app-ticket-tiers-control [formField]="eventForm.ticketTiers" />
 *
 * The parent never sees rows, never knows the length, and never has to
 * rebuild a FormArray when a row is added.
 */
@Component({
  selector: 'app-ticket-tiers-control',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TicketTiersControlComponent),
      multi: true,
    },
  ],
  template: `
    <fieldset class="tiers" [disabled]="isDisabled()">
      <legend>Ticket tiers</legend>

      @if (disabledReason(); as reason) {
        <p class="hint">{{ reason }}</p>
      }

      @if (rows().length === 0) {
        <p class="hint">No tiers yet.</p>
      }

      @for (row of rows(); track row.id; let i = $index) {
        <div class="tier-row">
          <div class="field">
            <label [attr.for]="row.id + '-label'">Name</label>
            <input
              [id]="row.id + '-label'"
              type="text"
              placeholder="Early bird"
              [value]="row.label"
              (input)="setLabel(row.id, $any($event.target).value)"
              (blur)="markTouched()"
            />
          </div>

          <div class="field price">
            <label [attr.for]="row.id + '-price'">Price</label>
            <input
              [id]="row.id + '-price'"
              type="number"
              min="0"
              step="1"
              placeholder="0"
              [value]="priceInputs()[row.id] ?? ''"
              (input)="setPrice(row.id, $any($event.target).value)"
              (blur)="markTouched()"
            />
          </div>

          <button type="button" (click)="removeRow(row.id)" [attr.aria-label]="'Remove tier ' + (i + 1)">
            Remove
          </button>

          @if (issuesForRow(i).length > 0) {
            <ul class="errors row-errors">
              @for (issue of issuesForRow(i); track issue.kind + issue.field) {
                <li>{{ issue.message }}</li>
              }
            </ul>
          }
        </div>
      }

      <button type="button" (click)="addRow()" [disabled]="rows().length >= maxTiers">
        Add tier
      </button>

      @if (rows().length > 0) {
        <p class="hint">{{ summary() }}</p>
      }

      @if (listIssues().length > 0) {
        <ul class="errors">
          @for (issue of listIssues(); track issue.kind) {
            <li>{{ issue.message }}</li>
          }
        </ul>
      }
    </fieldset>
  `,
  styles: `
    .tiers {
      border: 1px solid GrayText;
      border-radius: 6px;
      padding: 0.75rem 1rem 1rem;
    }
    .tier-row {
      display: grid;
      grid-template-columns: 1fr 8rem auto;
      gap: 0.75rem;
      align-items: end;
      margin-bottom: 0.75rem;
    }
    .tier-row .field {
      margin-bottom: 0;
    }
    .row-errors {
      grid-column: 1 / -1;
    }
  `,
})
export class TicketTiersControlComponent implements ControlValueAccessor {
  protected readonly maxTiers = MAX_TIERS;

  readonly revealErrors = input(false, { alias: 'showErrors' });
  readonly disabledReason = input<string | null>(null);

  protected readonly rows = signal<readonly TicketTier[]>([]);

  /**
   * Raw text per row id, keyed separately from the model. Without this, a
   * user clearing the price box to retype it would see "0" reappear under
   * their cursor, because NaN has to round-trip through the number model.
   */
  protected readonly priceInputs = signal<Record<string, string>>({});

  protected readonly isDisabled = signal(false);
  protected readonly touched = signal(false);

  private readonly issues = computed(() => validateTicketTiers(this.rows()));

  protected readonly visibleIssues = computed<readonly TicketTierIssue[]>(() =>
    this.touched() || this.revealErrors() ? this.issues() : [],
  );

  protected readonly listIssues = computed(() =>
    this.visibleIssues().filter((issue) => issue.rowIndex === null),
  );

  protected readonly summary = computed(() => {
    const rows = this.rows();
    const prices = rows.map((row) => row.price).filter((price) => !Number.isNaN(price));
    if (prices.length === 0) {
      return `${rows.length} tier${rows.length === 1 ? '' : 's'}.`;
    }
    const low = Math.min(...prices);
    const high = Math.max(...prices);
    const range = low === high ? `${low}` : `${low}–${high}`;
    return `${rows.length} tier${rows.length === 1 ? '' : 's'}, ${range}.`;
  });

  private onChange: (value: readonly TicketTier[]) => void = () => {};
  private onTouched: () => void = () => {};

  // --- ControlValueAccessor ------------------------------------------------

  writeValue(value: readonly TicketTier[] | null): void {
    const incoming = (value ?? []).map((tier) => ({
      ...tier,
      id: tier.id || createRowId(),
    }));
    this.rows.set(incoming);
    this.priceInputs.set(
      Object.fromEntries(
        incoming.map((tier) => [tier.id, Number.isNaN(tier.price) ? '' : String(tier.price)]),
      ),
    );
    
  }

  registerOnChange(fn: (value: readonly TicketTier[]) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled.set(isDisabled);
  }

  // --- row editing ---------------------------------------------------------

  protected addRow(): void {
    const id = createRowId();
    this.rows.update((rows) => [...rows, { id, label: '', price: Number.NaN }]);
    this.priceInputs.update((inputs) => ({ ...inputs, [id]: '' }));
    this.markTouched();
    this.commit();
  }

  protected removeRow(id: string): void {
    this.rows.update((rows) => rows.filter((row) => row.id !== id));
    this.priceInputs.update((inputs) => {
      const rest = { ...inputs };
      delete rest[id];
      return rest;
    });
    this.markTouched();
    this.commit();
  }

  protected setLabel(id: string, label: string): void {
    this.rows.update((rows) => rows.map((row) => (row.id === id ? { ...row, label } : row)));
    this.commit();
  }

  protected setPrice(id: string, raw: string): void {
    const price = raw.trim() === '' ? Number.NaN : Number(raw);
    this.priceInputs.update((inputs) => ({ ...inputs, [id]: raw }));
    this.rows.update((rows) => rows.map((row) => (row.id === id ? { ...row, price } : row)));
    this.commit();
  }

  protected markTouched(): void {
    if (!this.touched()) {
      this.touched.set(true);
      this.onTouched();
    }
  }


  issuesForRow(index: number): readonly TicketTierIssue[] {
    return this.visibleIssues().filter((issue) => issue.rowIndex === index);
  }

  private commit(): void {
    this.onChange(this.rows());
  }
}
