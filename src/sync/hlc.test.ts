import { MAX_DRIFT_MS, compare, decode, encode, receive, tick, zero } from './hlc';

const A = 'device-a';
const B = 'device-b';

describe('encode and decode', () => {
  it('round-trips', () => {
    const hlc = { millis: 1_762_000_000_000, counter: 7, node: A };
    expect(decode(encode(hlc))).toEqual(hlc);
  });

  it('sorts lexicographically in chronological order', () => {
    // The whole point of the padding: a plain string sort has to be right,
    // because that is what SQLite and a JSON merge will both do.
    const stamps = [
      encode({ millis: 900, counter: 0, node: A }),
      encode({ millis: 1_000, counter: 0, node: A }),
      encode({ millis: 1_000, counter: 1, node: A }),
      encode({ millis: 10_000, counter: 0, node: A }),
    ];
    expect([...stamps].sort()).toEqual(stamps);
  });

  it('refuses anything that is not a stamp', () => {
    expect(decode('nonsense')).toBeNull();
    expect(decode('1:2')).toBeNull();
    expect(decode('a:b:c')).toBeNull();
    expect(decode('1:2:')).toBeNull();
  });
});

describe('tick', () => {
  it('follows the wall clock when it moves', () => {
    expect(tick({ millis: 100, counter: 3, node: A }, 200, A)).toEqual({
      millis: 200, counter: 0, node: A,
    });
  });

  it('counts within a millisecond', () => {
    expect(tick({ millis: 100, counter: 0, node: A }, 100, A)).toEqual({
      millis: 100, counter: 1, node: A,
    });
  });

  it('still rises when the clock goes backwards', () => {
    // A phone that changes timezone, or loses power and comes back wrong,
    // must not start writing edits that sort before ones it already made.
    const next = tick({ millis: 5_000, counter: 0, node: A }, 1_000, A);
    expect(next.millis).toBe(5_000);
    expect(next.counter).toBe(1);
  });

  it('never produces a stamp that sorts before the last one', () => {
    let hlc = zero(A);
    const clocks = [10, 10, 10, 5, 200, 199, 1_000];
    for (const now of clocks) {
      const next = tick(hlc, now, A);
      expect(compare(next, hlc)).toBeGreaterThan(0);
      hlc = next;
    }
  });
});

describe('receive', () => {
  it('moves past a stamp from another device', () => {
    // This is what makes ordering causal: after seeing B's edit, everything A
    // writes sorts after it, whatever A's own clock says.
    const result = receive({ millis: 100, counter: 0, node: A }, { millis: 500, counter: 2, node: B }, 100, A);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.hlc.millis).toBe(500);
      expect(result.hlc.counter).toBe(3);
      expect(result.hlc.node).toBe(A);
    }
  });

  it('breaks a same-millisecond tie by taking the higher counter and adding one', () => {
    const result = receive({ millis: 100, counter: 4, node: A }, { millis: 100, counter: 9, node: B }, 100, A);
    expect(result.ok && result.hlc.counter).toBe(10);
  });

  it('resets the counter when real time has overtaken both', () => {
    const result = receive({ millis: 100, counter: 4, node: A }, { millis: 200, counter: 9, node: B }, 900, A);
    expect(result.ok && result.hlc).toEqual({ millis: 900, counter: 0, node: A });
  });

  it('refuses a stamp from a device that thinks it is next year', () => {
    // Accepting it would poison this device's clock permanently, and every
    // device that later syncs with it.
    const result = receive(zero(A), { millis: MAX_DRIFT_MS * 400, counter: 0, node: B }, 1_000, A);
    expect(result).toEqual({ ok: false, reason: 'drift' });
  });

  it('tolerates a device that is merely a bit fast', () => {
    const result = receive(zero(A), { millis: 60_000, counter: 0, node: B }, 1_000, A);
    expect(result.ok).toBe(true);
  });
});

describe('compare', () => {
  it('orders by time, then counter, then device', () => {
    expect(compare({ millis: 1, counter: 0, node: A }, { millis: 2, counter: 0, node: A })).toBeLessThan(0);
    expect(compare({ millis: 1, counter: 0, node: A }, { millis: 1, counter: 1, node: A })).toBeLessThan(0);
    expect(compare({ millis: 1, counter: 0, node: A }, { millis: 1, counter: 0, node: B })).toBeLessThan(0);
  });

  it('is total, so two devices reach the same answer without talking', () => {
    const x = { millis: 1, counter: 0, node: A };
    const y = { millis: 1, counter: 0, node: B };
    expect(Math.sign(compare(x, y))).toBe(-Math.sign(compare(y, x)));
    expect(compare(x, { ...x })).toBe(0);
  });
});
