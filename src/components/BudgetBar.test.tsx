import { render, screen } from '@testing-library/react-native';

import { BudgetBar } from './BudgetBar';
import { lightPalette } from '../theme';

/**
 * The bar's whole job is to say the right number and show the right colour, so
 * the snapshots are paired with explicit assertions on both — a snapshot alone
 * would happily record a green bar at 150%.
 */

const CAP = 1_000_00; // ₹1000

describe('BudgetBar', () => {
  it('renders green under 80%', () => {
    const tree = render(
      <BudgetBar label="Trip total" actual={50_000} cap={CAP} currency="INR" />,
    );
    expect(screen.getByText('₹500 of ₹1,000')).toBeTruthy();
    expect(tree.toJSON()).toMatchSnapshot();
  });

  it('renders amber from 80% to the cap', () => {
    const tree = render(
      <BudgetBar label="Trip total" actual={80_000} cap={CAP} currency="INR" />,
    );
    expect(screen.getByText('₹800 of ₹1,000')).toBeTruthy();
    expect(tree.toJSON()).toMatchSnapshot();
  });

  it('renders red over the cap, with the overage spelled out', () => {
    const tree = render(
      <BudgetBar label="Trip total" actual={150_000} cap={CAP} currency="INR" />,
    );
    expect(screen.getByText('₹1,500 of ₹1,000')).toBeTruthy();
    expect(screen.getByText('₹500 over budget')).toBeTruthy();
    expect(tree.toJSON()).toMatchSnapshot();
  });

  it('renders the no-budget variant when there is no cap', () => {
    const tree = render(<BudgetBar label="Stop" actual={25_000} cap={null} currency="INR" />);
    expect(screen.getByText('₹250 spent')).toBeTruthy();
    expect(screen.getByText('No budget set for this stop.')).toBeTruthy();
    expect(tree.toJSON()).toMatchSnapshot();
  });

  it('renders compact without the explanatory note', () => {
    const tree = render(<BudgetBar actual={50_000} cap={CAP} currency="INR" compact />);
    expect(screen.queryByText('No budget set for this stop.')).toBeNull();
    expect(tree.toJSON()).toMatchSnapshot();
  });

  describe('status colour', () => {
    const fillColor = (actual: number, cap: number | null): string | undefined => {
      const tree = render(<BudgetBar actual={actual} cap={cap} currency="INR" />);
      // The fill is the only view carrying a percentage width.
      const fills = tree.root.findAll(
        (node) =>
          typeof node.type === 'string' &&
          !!flatten(node.props.style).width &&
          String(flatten(node.props.style).width).endsWith('%'),
      );
      return flatten(fills[0]?.props.style).backgroundColor as string | undefined;
    };

    it('is green below 80%', () => {
      expect(fillColor(79_900, CAP)).toBe(lightPalette.under);
    });

    it('is amber at exactly 80% and at exactly the cap', () => {
      expect(fillColor(80_000, CAP)).toBe(lightPalette.near);
      expect(fillColor(CAP, CAP)).toBe(lightPalette.near);
    });

    it('is red one paisa past the cap', () => {
      expect(fillColor(CAP + 1, CAP)).toBe(lightPalette.over);
    });
  });

  it('reports progress to assistive technology', () => {
    render(<BudgetBar actual={50_000} cap={CAP} currency="INR" />);
    const bar = screen.getByRole('progressbar');
    expect(bar.props.accessibilityValue).toEqual({ now: 50, min: 0, max: 100 });
  });
});

/** RN styles can be an array; flatten to read a single property. */
function flatten(style: unknown): Record<string, unknown> {
  if (!style) return {};
  if (Array.isArray(style)) return Object.assign({}, ...style.map(flatten));
  return style as Record<string, unknown>;
}
