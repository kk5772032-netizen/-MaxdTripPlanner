import {
  balances,
  isSettled,
  settle,
  splitEvenly,
  type Shareable,
  type Traveller,
} from './settle';

const people: Traveller[] = [
  { id: 'a', name: 'Ravi' },
  { id: 'b', name: 'Meera' },
  { id: 'c', name: 'Sam' },
];

const spend = (o: Partial<Shareable> & { amountMinor: number }): Shareable => ({
  id: 'e1',
  paidBy: 'a',
  sharedWith: null,
  ...o,
});

const netOf = (bs: ReturnType<typeof balances>, id: string) =>
  bs.find((b) => b.travellerId === id)!.netMinor;

describe('splitEvenly', () => {
  it('divides cleanly when it can', () => {
    expect(splitEvenly(90_00, 3)).toEqual([30_00, 30_00, 30_00]);
  });

  it('sums back to exactly the amount when it cannot', () => {
    // ₹100 three ways is 33.34 + 33.33 + 33.33. Rounding each share on its own
    // would lose or invent a paisa, and a settle-up a penny out is one somebody
    // argues with.
    const shares = splitEvenly(100_00, 3);
    expect(shares).toEqual([3_334, 3_333, 3_333]);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(100_00);
  });

  it('never differs by more than one minor unit between people', () => {
    for (const [amount, n] of [[100_00, 3], [1, 7], [999, 4], [123_45, 6]] as const) {
      const shares = splitEvenly(amount, n);
      expect(shares.reduce((a, b) => a + b, 0)).toBe(amount);
      expect(Math.max(...shares) - Math.min(...shares)).toBeLessThanOrEqual(1);
    }
  });

  it('handles a single person and nobody at all', () => {
    expect(splitEvenly(500, 1)).toEqual([500]);
    expect(splitEvenly(500, 0)).toEqual([]);
  });

  it('keeps a refund a refund', () => {
    const shares = splitEvenly(-90_00, 3);
    expect(shares).toEqual([-30_00, -30_00, -30_00]);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(-90_00);
  });
});

describe('balances', () => {
  it('always sums to zero across the trip', () => {
    // The invariant everything else rests on: money moves between people, it
    // does not appear or vanish.
    const bs = balances(people, [
      spend({ id: 'e1', amountMinor: 100_00, paidBy: 'a' }),
      spend({ id: 'e2', amountMinor: 45_00, paidBy: 'b' }),
      spend({ id: 'e3', amountMinor: 7_77, paidBy: 'c' }),
    ]);
    expect(bs.reduce((sum, b) => sum + b.netMinor, 0)).toBe(0);
  });

  it('credits the payer and debits everybody equally', () => {
    const bs = balances(people, [spend({ amountMinor: 90_00, paidBy: 'a' })]);
    expect(netOf(bs, 'a')).toBe(60_00);
    expect(netOf(bs, 'b')).toBe(-30_00);
    expect(netOf(bs, 'c')).toBe(-30_00);
  });

  it('splits only between the people it was for', () => {
    const bs = balances(people, [
      spend({ amountMinor: 60_00, paidBy: 'a', sharedWith: ['a', 'b'] }),
    ]);
    expect(netOf(bs, 'a')).toBe(30_00);
    expect(netOf(bs, 'b')).toBe(-30_00);
    expect(netOf(bs, 'c')).toBe(0);
  });

  it('treats an expense paid for and shared by one person as settling nothing', () => {
    const bs = balances(people, [
      spend({ amountMinor: 20_00, paidBy: 'a', sharedWith: ['a'] }),
    ]);
    expect(bs.every((b) => b.netMinor === 0)).toBe(true);
  });

  it('leaves an expense with no payer out of the settle-up', () => {
    // It is still trip spending and still in the budget; it simply cannot move
    // money between people when nobody has said whose money it was.
    const bs = balances(people, [spend({ amountMinor: 90_00, paidBy: null })]);
    expect(bs.every((b) => b.netMinor === 0)).toBe(true);
  });

  it('ignores a payer who is not on the trip any more', () => {
    const bs = balances(people, [spend({ amountMinor: 90_00, paidBy: 'gone' })]);
    expect(bs.every((b) => b.netMinor === 0)).toBe(true);
  });

  it('falls back to everyone when the named sharers have all left', () => {
    const bs = balances(people, [
      spend({ amountMinor: 90_00, paidBy: 'a', sharedWith: ['long-gone'] }),
    ]);
    expect(netOf(bs, 'a')).toBe(60_00);
    expect(netOf(bs, 'c')).toBe(-30_00);
  });

  it('reports what each person paid and consumed, not just the net', () => {
    const bs = balances(people, [
      spend({ id: 'e1', amountMinor: 90_00, paidBy: 'a' }),
      spend({ id: 'e2', amountMinor: 30_00, paidBy: 'b' }),
    ]);
    const a = bs.find((b) => b.travellerId === 'a')!;
    expect(a.paidMinor).toBe(90_00);
    expect(a.oweMinor).toBe(40_00);
  });
});

describe('settle', () => {
  it('says nothing when everyone is square', () => {
    const bs = balances(people, [
      spend({ id: 'e1', amountMinor: 30_00, paidBy: 'a' }),
      spend({ id: 'e2', amountMinor: 30_00, paidBy: 'b' }),
      spend({ id: 'e3', amountMinor: 30_00, paidBy: 'c' }),
    ]);
    expect(isSettled(settle(bs))).toBe(true);
  });

  it('moves exactly what is owed, and no more', () => {
    const bs = balances(people, [spend({ amountMinor: 90_00, paidBy: 'a' })]);
    const transfers = settle(bs);
    expect(transfers).toHaveLength(2);
    expect(transfers.every((t) => t.toId === 'a')).toBe(true);
    expect(transfers.reduce((sum, t) => sum + t.amountMinor, 0)).toBe(60_00);
  });

  it('clears every balance it is given', () => {
    // The property that matters: after the transfers, nobody owes anything.
    const bs = balances(people, [
      spend({ id: 'e1', amountMinor: 100_00, paidBy: 'a' }),
      spend({ id: 'e2', amountMinor: 45_50, paidBy: 'b', sharedWith: ['b', 'c'] }),
      spend({ id: 'e3', amountMinor: 7_77, paidBy: 'c' }),
    ]);
    const after = new Map(bs.map((b) => [b.travellerId, b.netMinor]));
    for (const t of settle(bs)) {
      after.set(t.fromId, after.get(t.fromId)! + t.amountMinor);
      after.set(t.toId, after.get(t.toId)! - t.amountMinor);
    }
    expect([...after.values()].every((n) => n === 0)).toBe(true);
  });

  it('never asks anyone to pay twice over', () => {
    const bs = balances(people, [
      spend({ id: 'e1', amountMinor: 300_00, paidBy: 'a' }),
      spend({ id: 'e2', amountMinor: 60_00, paidBy: 'b' }),
    ]);
    const owedBy = new Map<string, number>();
    for (const t of settle(bs)) {
      owedBy.set(t.fromId, (owedBy.get(t.fromId) ?? 0) + t.amountMinor);
    }
    for (const [id, total] of owedBy) {
      expect(total).toBe(-netOf(bs, id));
    }
  });

  it('keeps the payment count low for a lopsided trip', () => {
    // One person paying for everything should produce one payment each, not a
    // chain of people passing money along.
    const four = [...people, { id: 'd', name: 'Priya' }];
    const bs = balances(four, [spend({ amountMinor: 400_00, paidBy: 'a' })]);
    expect(settle(bs)).toHaveLength(3);
  });

  it('has nothing to say about a trip with nobody on it', () => {
    expect(settle(balances([], [spend({ amountMinor: 90_00 })]))).toEqual([]);
  });
});
