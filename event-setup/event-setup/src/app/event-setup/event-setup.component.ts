import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  FormField,
  FormRoot,
  apply,
  disabled,
  form,
  maxLength,
  minLength,
  required,
} from '@angular/forms/signals';
import { ScheduleControlComponent } from '../controls/schedule/schedule-control.component';
import { scheduleSchema } from '../controls/schedule/schedule.rules';
import { TicketTiersControlComponent } from '../controls/ticket-tiers/ticket-tiers-control.component';
import { ticketTiersSchema } from '../controls/ticket-tiers/ticket-tiers.rules';
import { EventSetup, emptyEventSetup } from '../shared/event.model';
import { EventSetupApi } from './event-setup.api';

type TabId = 'general' | 'tickets';

const FREE_EVENT_REASON = 'Free events do not sell tickets.';

@Component({
  selector: 'app-event-setup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [JsonPipe, FormField, FormRoot, ScheduleControlComponent, TicketTiersControlComponent],
  templateUrl: './event-setup.component.html',
  styles: `
    .tabs {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1rem;
      border-bottom: 1px solid GrayText;
    }
    .tabs button {
      border: none;
      border-bottom: 2px solid transparent;
      border-radius: 0;
      background: none;
    }
    .tabs button[aria-selected='true'] {
      border-bottom-color: currentColor;
      font-weight: 600;
    }
    .badge {
      color: #c0392b;
      margin-left: 0.35rem;
    }
    form {
      max-width: 48rem;
    }
    .actions {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-top: 1.5rem;
    }
    pre {
      background: rgba(127, 127, 127, 0.12);
      padding: 0.75rem;
      border-radius: 6px;
      overflow-x: auto;
      font-size: 0.8rem;
    }
  `,
})
export class EventSetupComponent {
  private readonly api = inject(EventSetupApi);

  /**
   * The model is the source of truth. The form is derived from it, and both
   */
  private readonly model = signal<EventSetup>(emptyEventSetup());

  protected readonly activeTab = signal<TabId>('general');


  protected readonly submitAttempted = signal(false);
  protected readonly savedValue = signal<EventSetup | null>(null);

  protected readonly eventForm = form(
    this.model,
    (path) => {
      required(path.name, { message: 'Event name is required.' });
      minLength(path.name, 3, { message: 'Use at least 3 characters.' });
      maxLength(path.name, 80, { message: 'Keep the name under 80 characters.' });
      maxLength(path.description, 500, { message: 'Keep the description under 500 characters.' });

  
      apply(path.schedule, scheduleSchema);
      apply(path.ticketTiers, ticketTiersSchema);

    
      disabled(path.ticketTiers, {
        when: ({ valueOf }) => (valueOf(path.freeEvent) ? FREE_EVENT_REASON : false),
      });
    },
    {
      submission: {
        ignoreValidators: 'none',
        action: async (field) => {
          this.submitAttempted.set(true);
          const value = field().value();
          await this.api.save(value);
          this.savedValue.set(value);
          return undefined;
        },
        onInvalid: (field) => {
          this.submitAttempted.set(true);
          // Send the user to the tab that actually has the problem.
          if (this.generalInvalid()) {
            this.activeTab.set('general');
          } else if (this.ticketsInvalid()) {
            this.activeTab.set('tickets');
          }
          field().errorSummary()[0]?.fieldTree().focusBoundControl();
        },
      },
    },
  );


  protected readonly generalInvalid = computed(
    () =>
      this.eventForm.name().invalid() ||
      this.eventForm.description().invalid() ||
      this.eventForm.schedule().invalid(),
  );

  protected readonly ticketsInvalid = computed(() => this.eventForm.ticketTiers().invalid());

  protected readonly ticketsDisabledReason = computed(() =>
    this.eventForm.ticketTiers().disabled() ? FREE_EVENT_REASON : null,
  );

  protected select(tab: TabId): void {
    this.activeTab.set(tab);
  }

  protected reset(): void {
    this.submitAttempted.set(false);
    this.savedValue.set(null);
    this.model.set(emptyEventSetup());
    this.eventForm().reset();
  }
}
