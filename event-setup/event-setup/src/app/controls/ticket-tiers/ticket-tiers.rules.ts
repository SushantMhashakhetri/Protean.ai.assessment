import { schema, validate } from '@angular/forms/signals';
import type { TicketTier } from '../../shared/event.model';

export interface TicketTierIssue {
  /** Index of the offending row, or `null` for a rule about the list itself. */
  readonly rowIndex: number | null;
  readonly field: 'label' | 'price' | 'list';
  readonly kind: string;
  readonly message: string;
}

export const MAX_LABEL_LENGTH = 40;
export const MAX_PRICE = 100_000;
export const MAX_TIERS = 10;

/**
 * Same pattern as schedule.rules.ts: one pure function, consumed both by the
 * control (to put a message next to the right row) and by the schema below
 * (to make the parent form invalid).
 *
 * Note it validates the list as a whole, not row by row. The duplicate-label
 * rule below cannot be expressed per row, and that is the point of shipping
 * the list as one control value rather than as N sibling fields.
 */
export function validateTicketTiers(
  tiers: readonly TicketTier[] | null | undefined,
): TicketTierIssue[] {
  const rows = tiers ?? [];
  const issues: TicketTierIssue[] = [];

  if (rows.length === 0) {
    issues.push({
      rowIndex: null,
      field: 'list',
      kind: 'empty',
      message: 'Add at least one ticket tier.',
    });
    return issues;
  }

  if (rows.length > MAX_TIERS) {
    issues.push({
      rowIndex: null,
      field: 'list',
      kind: 'maxTiers',
      message: `A maximum of ${MAX_TIERS} tiers is allowed.`,
    });
  }

  const seenLabels = new Map<string, number>();

  rows.forEach((tier, index) => {
    const label = tier.label.trim();

    if (label === '') {
      issues.push({
        rowIndex: index,
        field: 'label',
        kind: 'required',
        message: 'Give this tier a name.',
      });
    } else if (label.length > MAX_LABEL_LENGTH) {
      issues.push({
        rowIndex: index,
        field: 'label',
        kind: 'maxLength',
        message: `Keep the name under ${MAX_LABEL_LENGTH} characters.`,
      });
    } else {
      const key = label.toLowerCase();
      const firstSeenAt = seenLabels.get(key);
      if (firstSeenAt === undefined) {
        seenLabels.set(key, index);
      } else {
        issues.push({
          rowIndex: index,
          field: 'label',
          kind: 'duplicate',
          message: `"${label}" is already used by tier ${firstSeenAt + 1}.`,
        });
      }
    }

    if (Number.isNaN(tier.price)) {
      issues.push({
        rowIndex: index,
        field: 'price',
        kind: 'required',
        message: 'Enter a price (use 0 for free).',
      });
    } else if (tier.price < 0) {
      issues.push({
        rowIndex: index,
        field: 'price',
        kind: 'min',
        message: 'Price cannot be negative.',
      });
    } else if (tier.price > MAX_PRICE) {
      issues.push({
        rowIndex: index,
        field: 'price',
        kind: 'max',
        message: 'That price looks like a typo.',
      });
    }
  });

  return issues;
}

/**
 * Adopted by the parent with `apply(path.ticketTiers, ticketTiersSchema)`.
 *
 * `validate()` is attached to the array path itself rather than to each
 * element, which matches the control's own contract: the parent holds one
 * value, so it holds one set of errors about that value.
 */
export const ticketTiersSchema = schema<readonly TicketTier[]>((path) => {
  validate(path, ({ value }) => {
    const issues = validateTicketTiers(value());
    if (issues.length === 0) {
      return null;
    }
    return issues.map((issue) => ({
      kind: `ticketTiers.${issue.kind}`,
      message:
        issue.rowIndex === null ? issue.message : `Tier ${issue.rowIndex + 1}: ${issue.message}`,
    }));
  });
});
