import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormField, apply, disabled, form } from '@angular/forms/signals';
import { TicketTiersControlComponent } from './ticket-tiers-control.component';
import { ticketTiersSchema, validateTicketTiers } from './ticket-tiers.rules';
import type { TicketTier } from '../../shared/event.model';

@Component({
  imports: [FormField, TicketTiersControlComponent],
  template: `<app-ticket-tiers-control [formField]="testForm.ticketTiers" [showErrors]="reveal()" />`,
})
class HostComponent {
  readonly reveal = signal(false);
  readonly free = signal(false);

  readonly model = signal<{ ticketTiers: readonly TicketTier[] }>({ ticketTiers: [] });

  readonly testForm = form(this.model, (path) => {
    apply(path.ticketTiers, ticketTiersSchema);
    disabled(path.ticketTiers, { when: () => this.free() });
  });
}

function tier(label: string, price: number, id = label): TicketTier {
  return { id, label, price };
}

describe('validateTicketTiers', () => {
  it('requires at least one tier', () => {
    const issues = validateTicketTiers([]);
    expect(issues.length).toBe(1);
    expect(issues[0].kind).toBe('empty');
  });

  it('accepts a well-formed list', () => {
    expect(validateTicketTiers([tier('Early bird', 20), tier('Standard', 35)])).toEqual([]);
  });

  it('flags the later of two tiers sharing a name, ignoring case', () => {
    const issues = validateTicketTiers([tier('Standard', 35, 'a'), tier('standard', 40, 'b')]);
    expect(issues.length).toBe(1);
    expect(issues[0].rowIndex).toBe(1);
    expect(issues[0].kind).toBe('duplicate');
  });

  it('accepts a price of zero but not a negative one', () => {
    expect(validateTicketTiers([tier('Free', 0)])).toEqual([]);
    expect(validateTicketTiers([tier('Refund', -5)])[0].kind).toBe('min');
  });

  it('reports an unparseable price rather than dropping the row', () => {
    const issues = validateTicketTiers([tier('Standard', Number.NaN)]);
    expect(issues.length).toBe(1);
    expect(issues[0].field).toBe('price');
  });
});

describe('TicketTiersControlComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  function buttonWithText(text: string): HTMLButtonElement {
    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ) as HTMLButtonElement[];
    const match = buttons.find((button) => button.textContent?.trim() === text);
    if (!match) {
      throw new Error(`No button labelled "${text}"`);
    }
    return match;
  }

  function labelInputs(): HTMLInputElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('input[type="text"]'));
  }

  function type(el: HTMLInputElement, value: string): void {
    el.value = value;
    el.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders rows written in by the parent', () => {
    host.model.set({ ticketTiers: [tier('Early bird', 20, 'a'), tier('Standard', 35, 'b')] });
    fixture.detectChanges();

    expect(labelInputs().length).toBe(2);
    expect(labelInputs()[0].value).toBe('Early bird');
  });

  it('publishes the whole list as one value when a row is added', () => {
    buttonWithText('Add tier').click();
    fixture.detectChanges();

    const value = host.testForm.ticketTiers().value();
    expect(value.length).toBe(1);
    expect(value[0].label).toBe('');
  });

  it('publishes the shortened list when a row is removed', () => {
    host.model.set({ ticketTiers: [tier('Early bird', 20, 'a'), tier('Standard', 35, 'b')] });
    fixture.detectChanges();

    buttonWithText('Remove').click();
    fixture.detectChanges();

    expect(host.testForm.ticketTiers().value().map((row) => row.label)).toEqual(['Standard']);
  });

  it('carries a row-level error up to the parent form', () => {
    expect(host.testForm().invalid()).toBeTrue(); // empty list

    buttonWithText('Add tier').click();
    fixture.detectChanges();
    type(labelInputs()[0], 'Standard');

    // Still invalid: the new row has no price yet.
    expect(host.testForm().invalid()).toBeTrue();

    const price = fixture.nativeElement.querySelector('input[type="number"]') as HTMLInputElement;
    type(price, '35');

    expect(host.testForm().invalid()).toBeFalse();
  });

  it('stops contributing errors once the parent disables it', () => {
    expect(host.testForm().invalid()).toBeTrue();

    host.free.set(true);
    fixture.detectChanges();

    // A disabled field is skipped when the parent computes its own validity,
    // so an empty tier list no longer blocks a free event.
    expect(host.testForm().invalid()).toBeFalse();
    expect(buttonWithText('Add tier').matches(':disabled')).toBeTrue();
  });

  it('hides its messages until revealed', () => {
    expect(fixture.nativeElement.querySelectorAll('.errors li').length).toBe(0);

    host.reveal.set(true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.errors li').length).toBe(1);
  });
});
