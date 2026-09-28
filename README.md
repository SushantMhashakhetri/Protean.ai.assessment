# Protean.ai.assessment

# Event Setup

A two-tab event form built with Angular signal forms, consuming two custom
controls written as classic `ControlValueAccessor`s.

```
npm install
npm start     # http://localhost:4200
npm test
```

Angular 22. Signal forms are stable there; on 21 they exist but are marked
experimental, so 22 seemed the safer floor for something meant to be read as
shippable code.

## Layout

```
src/app/
  shared/event.model.ts                          domain types, one place
  controls/schedule/
    schedule.rules.ts                            validateSchedule() + scheduleSchema
    schedule-control.component.ts                the CVA
    schedule-control.component.spec.ts
  controls/ticket-tiers/
    ticket-tiers.rules.ts                        validateTicketTiers() + ticketTiersSchema
    ticket-tiers-control.component.ts            the CVA
    ticket-tiers-control.component.spec.ts
  event-setup/
    event-setup.component.ts / .html             the signal form and the tabs
    event-setup.api.ts                           stand-in save()
```

---

## 6. The questions

### 1. How does a value travel from the parent form into the ticket tiers control and back out again? What is the contract between them?

The contract is `TicketTier[]` and nothing else. The parent holds
`ticketTiers: readonly TicketTier[]` in its model signal
(`shared/event.model.ts`), and the template binds
`<app-ticket-tiers-control [formField]="eventForm.ticketTiers" />`.
`FormField` recognises the `NG_VALUE_ACCESSOR` provider on the component and
drives it through the four CVA methods.

Inbound: `writeValue(tiers)` in `ticket-tiers-control.component.ts` copies the
array into the private `rows` signal and rebuilds the `priceInputs` map of raw
text. Outbound: every editing handler — `addRow`, `removeRow`, `setLabel`,
`setPrice` — mutates `rows` and then calls the private `commit()`, which is the
only place `onChange(this.rows())` is ever called. `registerOnTouched` is
fired once, from `markTouched()`, on the first blur or structural edit.

The deliberate part is what is *not* in the contract. Row ids are generated
inside the control and, while they live on `TicketTier` so `@for` can track
them across a `writeValue`, the parent never reads or assigns one. The parent
also never learns the list's length: there is no `FormArray` to keep in sync,
so "add a row" is a change of value rather than a change of form shape.

The cost: the value is replaced wholesale on every keystroke, so anything
downstream — validators, the tab badge — recomputes against the whole array
rather than one row. For ten tiers that is free. For a thousand-row editor it
would be the wrong shape, and I would move the rows into the parent model as a
real array field with `applyEach`, giving up the single-value contract to get
per-row change granularity back.

### 2. How does an invalid row inside a control end up making the parent form invalid?

Through a schema the control publishes, which the parent adopts in one line.

The rules live in `ticket-tiers.rules.ts` as `validateTicketTiers(tiers)`, an
ordinary pure function from the list to a list of issues. That function has two
consumers. The component calls it in the `issues` computed to put a message
under the right row. `ticketTiersSchema`, in the same file, calls it inside
`validate(path, …)` and maps each issue to a signal-forms error. The parent
picks it up in `event-setup.component.ts`:

```ts
apply(path.ticketTiers, ticketTiersSchema);
```

and validity then propagates on its own: `eventForm.ticketTiers().invalid()`
turns the tab badge on, `eventForm().invalid()` blocks the submit action.

The reason it is one pure function rather than two implementations is the
failure mode of the obvious alternative. If the control rendered its own
messages and the parent independently re-stated what a valid tier list is, they
would drift, and the form would eventually show a red message next to a row
while the submit button stayed happily enabled. Here they cannot disagree,
because there is only one answer.

The honest cost: the parent does have to write that `apply` line, so the
control is not *entirely* self-contained. A native signal-forms control would
not need it (see Q4). I took the view that shipping the rules *with* the
control and asking the host for one line of opt-in is a better trade than a
control that silently smuggles validators into its parent — and it means a form
that wants tiers without the price ceiling can apply its own schema instead.

### 3. How does the surrounding form's state reach the inside of the controls?

Two channels, and the gap between them is the most interesting thing about
this pairing.

The one the framework gives me is `setDisabledState`. `event-setup.component.ts`
declares

```ts
disabled(path.ticketTiers, {
  when: ({ valueOf }) => (valueOf(path.freeEvent) ? FREE_EVENT_REASON : false),
});
```

and when the "free event" checkbox flips, `setDisabledState(true)` arrives at
the control, lands in the `isDisabled` signal, and the template's
`<fieldset [disabled]>` takes every input and both buttons out of play. Signal
forms also stops counting a disabled field toward the parent's validity, so an
empty tier list correctly stops blocking submission for a free event. That is
covered by the last spec in `ticket-tiers-control.component.spec.ts`.

The one the framework does not give me is everything else. A CVA has no inbound
channel for `touched`, `dirty`, `invalid`, `errors`, or "the user pressed
Submit". That last one matters, because a form that shows "Give this tier a
name" on an empty row the moment it is created is obnoxious, and a form that
hides the reason submission failed is worse. So both controls declare an
explicit input:

```ts
readonly revealErrors = input(false, { alias: 'showErrors' });
```

fed from `submitAttempted()` in the parent, and each derives its own visibility:

```ts
protected readonly visibleIssues = computed(() =>
  this.touched() || this.revealErrors() ? this.issues() : [],
);
```

`disabledReason` is the same idea — `disabled({ when })` can return a string,
but a CVA has no `disabledReasons` input to receive it, so the parent passes
the text down itself.

This is hand-wiring that a native control would get for free, and I would call
it the real cost of the CVA constraint rather than a design choice I would
defend on its own merits.

### 4. The controls are `ControlValueAccessor`s but the form is a signal form. How do the two fit together, and what would you do differently natively?

They fit because `FormField` includes a compatibility path: it detects
`NG_VALUE_ACCESSOR` and drives the component through `writeValue` /
`registerOnChange` / `registerOnTouched` / `setDisabledState` instead of the
signal-based contract. Nothing in either control imports from
`@angular/forms/signals` for the binding itself — only the two rule files do,
and only to publish a schema. Both components would bind with
`formControlName` in a `FormGroup` unchanged.

What the seam costs, concretely:

- **State only flows one way.** Covered in Q3: `disabled` in, nothing else.
- **Validation needs a side channel.** Covered in Q2: the parent applies a
  schema because the CVA cannot carry its errors across.
- **Duplicated raw-input handling.** Both controls keep a shadow copy of what
  the user has literally typed (`durationInput`, `priceInputs`) so that
  clearing a number box does not snap back to the last good value. Signal
  forms has a first-class answer for this — `transformedValue()` with
  `format`/`parse`, where a failed parse simply does not write to the model
  and surfaces as a parse error.
- **`focusBoundControl()` does nothing.** `onInvalid` calls it, and on a
  native input it works; on a custom control Angular will not guess which of
  three inputs to focus. A native control opts in with a `focus()` method.

Written natively, both would implement `FormValueControl<T>`: one
`value = model<T>()`, plus declared `disabled`, `touched`, `errors`, `invalid`,
`required` inputs and a `touch` output. That deletes the provider, the
`forwardRef`, the four methods, the two callback fields, and — the substantial
one — the `revealErrors` input and the local `issues` computed, because
`errors` and `touched` would arrive from the field itself. The rules would move
out of the component entirely and live only in the schema, so
`validateTicketTiers` would stop having two consumers and would just be the
validator. Roughly a third of each component is there to bridge the gap.

The one thing I would keep either way is the shape of the value. `TicketTier[]`
as a single control value is a decision about the form's boundary, not about
which forms API is underneath.

### 5. One reactivity decision, and what the opposite choice would break

**The decision:** neither control pushes to the parent from an `effect`. Both
have a derived value — `value` in the schedule control is a `computed` over
three signals — and the tempting move is:

```ts
// not what I did
effect(() => this.onChange(this.value()));
```

It is one line, it never misses an update, and it is what the signal-first
instinct reaches for. Instead every push goes through a private `commit()`
called only from a user-driven handler, and `writeValue` deliberately does not
call it.

**What the opposite breaks:** an effect cannot tell *why* the value changed. It
fires identically for "the user typed" and for "the form just wrote a value
into me via `writeValue`". So a programmatic `model.set(...)` from the parent
would round-trip straight back out as `onChange` — the control reporting the
parent's own value to it as a user edit.

Classic reactive forms absorb this: `onChange` updates the `FormControl`'s
value without calling `writeValue` back. Signal forms has no concept of value
origin, so it pushes the new value back into `writeValue` on the control that
just sent it — there is a filed Angular issue on exactly this
([angular/angular#67847](https://github.com/angular/angular/issues/67847),
against 21.2). With an effect in the loop that becomes an echo: write → effect
→ change → write. In the mild case the field is marked dirty and touched the
instant the form loads a draft, so the user is told about errors in a form they
have not opened yet. In the bad case it does not settle.

The spec `does not echo the parent value back on writeValue` pins this down: it
sets the parent model and asserts the field is still not dirty.

The price of the manual approach is that `commit()` is a thing I have to
remember to call. `setPrice` that forgets it produces a control whose display
is right and whose value is stale — a genuinely confusing bug. I contained it
by making `commit()` private and calling it from exactly four places in each
control, all of them adjacent, but "you must remember" is a real weakness of
the design and an effect would not have it.

---

## Assumptions

Ambiguities I resolved rather than asked about:

- **Data source.** `EventSetupApi.save()` is a stub with a delay. Nothing about
  either control assumes a transport, so swapping in `HttpClient` is one file.
- **Schedule representation.** `date` is `YYYY-MM-DD` and `startTime` is
  `HH:mm` — what the native pickers emit. No `Date`, so no timezone question.
  Duration is minutes, 15 to 1440.
- **Past dates are allowed.** Backdating an event record is a reasonable thing
  to want, and blocking it is the kind of rule that should come from the
  product, not from me.
- **Unparseable price is `NaN`, not a dropped edit.** A row keeps whatever the
  user typed and the validator reports it. The alternative — discarding the
  keystroke — makes the field feel broken.
- **At least one tier is required, unless the event is free.** This is what the
  "free event" checkbox is for; it also gives the `disabled` channel in Q3
  something real to do.
- **Duplicate tier names are rejected**, case-insensitively, flagged on the
  later row.
- **Tabs are `@if`, not `hidden`.** Switching tabs destroys and recreates the
  control. That is safe precisely because the model owns the state — the
  control is rebuilt from `writeValue` — and it is a small live demonstration
  that the value contract is the only thing holding the form together.
- **Errors appear after touch or after a submit attempt**, never before.
- **Styling is deliberately minimal**, using system colours so it is legible in
  both light and dark.

## What I would add next

Per-row error placement inside the ticket tiers control currently keys off the
row index. That is fine while rows are only appended and removed, but reordering
(which I would expect to be the next feature request) would need issues keyed
by row id instead.
