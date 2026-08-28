import { render, screen } from '@testing-library/react-native';

import type { PlaceDetails } from '../../types';
import { PlaceFacts } from './PlaceFacts';

const base: PlaceDetails = {
  placeId: 'p1',
  name: 'Indian Accent',
  address: 'The Lodhi, Lodhi Road, New Delhi',
  lat: 28.59,
  lng: 77.23,
  rating: 4.6,
  userRatingCount: 1284,
  priceLevel: 4,
  photoRef: null,
  photoRefs: [],
  hours: {
    periods: [
      { open: { day: 1, hour: 12, minute: 0 }, close: { day: 1, hour: 15, minute: 0 } },
    ],
    weekdayDescriptions: [
      'Monday: 12:00 – 3:00 PM',
      'Tuesday: Closed',
      'Wednesday: Closed',
      'Thursday: Closed',
      'Friday: Closed',
      'Saturday: Closed',
      'Sunday: Closed',
    ],
    utcOffsetMinutes: 330,
  },
  phone: '011 6617 5151',
  website: 'https://indianaccent.com',
};

/** 2026-11-09 is a Monday; 08:00 UTC is 13:30 in Delhi, mid-service. */
const duringService = new Date('2026-11-09T08:00Z');
const afterService = new Date('2026-11-09T12:00Z');

describe('PlaceFacts', () => {
  it('answers open-or-shut from the clock, with what happens next', () => {
    render(<PlaceFacts details={base} currency="INR" now={duringService} />);
    expect(screen.getByText('Open now')).toBeTruthy();
    expect(screen.getByText(/Closes 3:00 pm/)).toBeTruthy();
  });

  it('flips to closed once the place has shut, without a refetch', () => {
    render(<PlaceFacts details={base} currency="INR" now={afterService} />);
    expect(screen.getByText('Closed')).toBeTruthy();
    expect(screen.getByText(/Opens 12:00 pm/)).toBeTruthy();
  });

  it('shows the rating with the weight behind it, and price in the trip currency', () => {
    render(<PlaceFacts details={base} currency="INR" now={duringService} />);
    expect(screen.getByText('4.6 · 1.3k reviews')).toBeTruthy();
    expect(screen.getByText('₹₹₹₹')).toBeTruthy();
  });

  it('uses the trip currency, not a hardcoded rupee', () => {
    render(<PlaceFacts details={base} currency="USD" now={duringService} />);
    expect(screen.getByText('$$$$')).toBeTruthy();
  });

  it('leaves out what Google did not supply rather than showing placeholders', () => {
    render(
      <PlaceFacts
        details={{
          ...base,
          rating: null,
          userRatingCount: null,
          priceLevel: null,
          hours: null,
          phone: null,
          website: null,
        }}
        currency="INR"
        now={duringService}
      />,
    );
    expect(screen.queryByText('Open now')).toBeNull();
    expect(screen.queryByText('Closed')).toBeNull();
    expect(screen.queryByText('Website')).toBeNull();
    // The one fact we do have is still there.
    expect(screen.getByText('The Lodhi, Lodhi Road, New Delhi')).toBeTruthy();
  });
});
