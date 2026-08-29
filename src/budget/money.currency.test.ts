import { convertMinor, formatConverted, formatRate, parseRate } from './money';

/**
 * A trip is spent in one currency and thought about in another. Everything here
 * is integer arithmetic for the same reason the rest of the money code is: a
 * rate of 2.34 is not a number a computer holds exactly, and neither is ₹0.10.
 */
describe('a second currency', () => {
  /** 1 THB = 2.34 INR, as someone would read it off a board. */
  const THB_TO_INR = 2_340_000;

  describe('parseRate', () => {
    it('reads what someone types', () => {
      expect(parseRate('2.34')).toBe(2_340_000);
      expect(parseRate('83')).toBe(83_000_000);
      expect(parseRate('0.011')).toBe(11_000);
      expect(parseRate(' 1,234.5 ')).toBe(1_234_500_000);
    });

    it('refuses anything that is not a positive number', () => {
      expect(parseRate('')).toBeNull();
      expect(parseRate('.')).toBeNull();
      expect(parseRate('0')).toBeNull();
      expect(parseRate('-2')).toBeNull();
      expect(parseRate('two')).toBeNull();
    });
  });

  describe('formatRate', () => {
    it('reads back without trailing zeros — a rate is not money', () => {
      expect(formatRate(2_340_000)).toBe('2.34');
      expect(formatRate(83_000_000)).toBe('83');
      expect(formatRate(null)).toBe('');
    });

    it('survives a round trip', () => {
      for (const text of ['2.34', '83', '0.011', '1.5']) {
        expect(formatRate(parseRate(text))).toBe(text);
      }
    });
  });

  describe('convertMinor', () => {
    it('applies the rate in minor units', () => {
      // ฿1,200.00 is 120000 satang; at 2.34 that is ₹2,808.00, or 280800 paise.
      expect(convertMinor(120_000, 'THB', 'INR', THB_TO_INR)).toBe(280_800);
    });

    it('shifts the scale when the currencies differ in decimal places', () => {
      // Yen has no minor unit: ¥1,000 is 1000, not 100000. Converting it has to
      // add two decimal places as well as apply the rate.
      expect(convertMinor(1_000, 'JPY', 'INR', 560_000)).toBe(56_000);
      // And drop them going the other way.
      expect(convertMinor(56_000, 'INR', 'JPY', 1_785_714)).toBe(1_000);
    });

    it('has nothing to say when the trip has one currency', () => {
      expect(convertMinor(120_000, 'THB', null, THB_TO_INR)).toBeNull();
      expect(convertMinor(120_000, 'THB', 'INR', null)).toBeNull();
      expect(convertMinor(null, 'THB', 'INR', THB_TO_INR)).toBeNull();
    });

    it('refuses a rate that cannot be a rate', () => {
      expect(convertMinor(120_000, 'THB', 'INR', 0)).toBeNull();
      expect(convertMinor(120_000, 'THB', 'INR', -5)).toBeNull();
    });

    it('always lands on a whole minor unit', () => {
      expect(convertMinor(1, 'THB', 'INR', THB_TO_INR)).toBe(2);
      expect(Number.isInteger(convertMinor(12_345, 'THB', 'INR', 1_234_567))).toBe(true);
    });
  });

  describe('formatConverted', () => {
    it('marks itself as an approximation, because it is one', () => {
      expect(formatConverted(120_000, 'THB', 'INR', THB_TO_INR)).toBe('≈ ₹2,808.00');
    });

    it('says nothing at all when there is no second currency', () => {
      expect(formatConverted(120_000, 'THB', null, THB_TO_INR)).toBeNull();
    });
  });
});
