import { globSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Every text input has a name a screen reader can read.
 *
 * React Native has no `<label for>`, so nothing connects a visible label to
 * the box beneath it. An input with neither an `accessibilityLabel` nor an
 * enclosing `Field` announces its *placeholder* as its name — and once you
 * type, it announces your own text, which tells a blind user nothing about
 * what they are filling in.
 *
 * This is checked over the source rather than by rendering because the failure
 * is one of omission: a rendering test only covers the screens somebody
 * remembered to write a test for, and the next unlabelled input will be on a
 * screen nobody did.
 */

const ROOT = join(__dirname, '..', '..');

function sources(): string[] {
  return globSync(['src/**/*.tsx', 'app/**/*.tsx'], { cwd: ROOT })
    .filter((f) => !f.includes('.test.'))
    .sort();
}

/**
 * Walks a file's JSX looking for `<Input`, tracking how deep inside a `<Field`
 * it is. Crude next to a real parser, and enough: these are the three tags it
 * has to tell apart, and it errs towards reporting rather than excusing.
 */
function unlabelledInputs(source: string): { line: number; snippet: string }[] {
  const token = /<Field\b|<\/Field>|<Input\b/g;
  const found: { line: number; snippet: string }[] = [];
  let fieldDepth = 0;
  let m: RegExpExecArray | null;

  while ((m = token.exec(source))) {
    if (m[0] === '<Field') {
      // A self-closing Field has no children, so it never wraps an input.
      const end = source.indexOf('>', m.index);
      if (!source.slice(m.index, end).trimEnd().endsWith('/')) fieldDepth++;
      continue;
    }
    if (m[0] === '</Field>') {
      fieldDepth = Math.max(0, fieldDepth - 1);
      continue;
    }

    // `<Input ... />` — the props run to the first `/>` that closes it.
    const close = source.indexOf('/>', m.index);
    const props = source.slice(m.index, close === -1 ? m.index + 400 : close);
    if (fieldDepth > 0 || props.includes('accessibilityLabel')) continue;

    found.push({
      line: source.slice(0, m.index).split('\n').length,
      snippet: props.replace(/\s+/g, ' ').slice(0, 90),
    });
  }
  return found;
}

describe('every input can be named out loud', () => {
  it('finds the files it is supposed to be checking', () => {
    // A glob that quietly matches nothing would make this whole suite pass.
    const files = sources();
    expect(files.length).toBeGreaterThan(20);
    expect(files.some((f) => f.startsWith('app/'))).toBe(true);
  });

  it('leaves no Input without a label or a Field around it', () => {
    const offenders = sources().flatMap((file) => {
      const source = readFileSync(join(ROOT, file), 'utf8');
      return unlabelledInputs(source).map((h) => `${file}:${h.line}  ${h.snippet}`);
    });
    expect(offenders).toEqual([]);
  });

  it('still catches one when it is there', () => {
    // The check earning its keep: if the walk stopped working, the test above
    // would pass by finding nothing at all.
    expect(unlabelledInputs('<Input value={x} placeholder="Hi" />')).toHaveLength(1);
    expect(
      unlabelledInputs('<Input value={x} accessibilityLabel="Hi" />'),
    ).toHaveLength(0);
    expect(
      unlabelledInputs('<Field label="Name"><Input value={x} /></Field>'),
    ).toHaveLength(0);
    // Closing a Field puts the next input back out in the open.
    expect(
      unlabelledInputs('<Field label="Name"><Input value={x} /></Field><Input value={y} />'),
    ).toHaveLength(1);
  });
});
