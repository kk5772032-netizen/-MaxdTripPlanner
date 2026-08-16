import { act, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import TripsScreen from '../app/(tabs)/trips';
import NewTripScreen from '../app/new-trip';
import TripDetailScreen from '../app/trip/[tripId]/index';
import NewPlaceScreen from '../app/trip/[tripId]/new-place';
import StopDetailScreen from '../app/trip/[tripId]/place/[placeId]';
import ExpensesScreen from '../app/trip/[tripId]/expenses';
import DashboardScreen from '../app/trip/[tripId]/dashboard';
import { type Db, openTestDb, setDbForTesting } from './db/client';
import * as activitiesRepo from './db/repositories/activities';
import * as expensesRepo from './db/repositories/expenses';
import * as stopsRepo from './db/repositories/stops';
import * as tripsRepo from './db/repositories/trips';
import { useTripStore } from './state/tripStore';
import { useTripsStore } from './state/tripsStore';

/**
 * Smoke tests: every screen mounts against a real (in-memory) database with
 * real data and gets to a stable state without throwing.
 *
 * These don't assert much about behaviour — they exist because unit tests over
 * pure functions say nothing about whether a screen actually renders. A broken
 * import, a hook called conditionally, or a component that's undefined at
 * runtime all show up here and nowhere else.
 */

let db: Db;
let tripId: string;
let stopId: string;

// expo-router is a navigation container these screens only touch through a
// handful of hooks; stubbing those lets each screen render standalone.
const mockParams: Record<string, string> = {};
jest.mock('expo-router', () => {
  const React = require('react');
  return {
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
    useLocalSearchParams: () => mockParams,
    useFocusEffect: (cb: () => void | (() => void)) => React.useEffect(cb, [cb]),
    Stack: { Screen: () => null },
    Redirect: () => null,
    Tabs: Object.assign(() => null, { Screen: () => null }),
  };
});

beforeEach(async () => {
  db = await openTestDb();
  setDbForTesting(db);

  const trip = await tripsRepo.createTrip({
    name: 'Delhi weekend',
    startDate: '2025-11-01',
    endDate: '2025-11-03',
    currency: 'INR',
    totalBudgetMinor: 10_000_00,
  });
  tripId = trip.id;

  const stop = await stopsRepo.createStop({
    tripId,
    googlePlaceId: null,
    name: 'India Gate',
    address: 'Kartavya Path, New Delhi',
    lat: 28.6129,
    lng: 77.2295,
    rating: 4.6,
    photoRef: null,
    plannedBudgetMinor: 1_000_00,
    notes: 'Best at sunset',
  });
  stopId = stop.id;

  await activitiesRepo.createActivity({
    stopId,
    title: 'Walk the memorial',
    estimatedCostMinor: 200_00,
    done: false,
  });
  await expensesRepo.createExpense({
    tripId,
    stopId,
    category: 'food',
    amountMinor: 450_00,
    note: 'Lunch',
    spentAt: '2025-11-01',
  });

  Object.keys(mockParams).forEach((key) => delete mockParams[key]);
  mockParams.tripId = tripId;
  mockParams.placeId = stopId;
});

afterEach(async () => {
  // Zustand stores are module singletons; reset them so one screen's load
  // doesn't leak into the next test's assertions.
  useTripStore.getState().clear();
  useTripsStore.setState({ trips: [], actualByTrip: {} });
  setDbForTesting(null);
  await db.closeAsync();
});

/**
 * Metrics for a phone with a gesture bar, so screens that inset for the safe
 * area are exercised with a non-zero bottom inset rather than zeros.
 */
const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** Mounts a screen and waits for its initial SQLite load to settle. */
async function mountAndSettle(ui: React.ReactElement) {
  const result = render(
    <SafeAreaProvider initialMetrics={METRICS}>{ui}</SafeAreaProvider>,
  );
  // Screens load on focus; let those promises flush before asserting.
  await act(async () => {
    await Promise.resolve();
  });
  return result;
}

describe('screen smoke tests', () => {
  it('renders the trip list with a real trip', async () => {
    await mountAndSettle(<TripsScreen />);
    await waitFor(() => expect(screen.getByText('Delhi weekend')).toBeTruthy());
    // The budget ring: ₹450 of ₹10,000 is 5%.
    expect(screen.getByText('5%')).toBeTruthy();
  });

  it('renders the trip list empty state with no trips', async () => {
    await tripsRepo.deleteTrip(tripId);
    await mountAndSettle(<TripsScreen />);
    await waitFor(() => expect(screen.getByText('No trips yet')).toBeTruthy());
  });

  it('renders the new-trip form', async () => {
    delete mockParams.tripId;
    delete mockParams.placeId;
    await mountAndSettle(<NewTripScreen />);
    expect(screen.getByText('Create trip')).toBeTruthy();
    expect(screen.getByText('INR')).toBeTruthy();
  });

  it('renders the new-trip form in edit mode with the trip loaded', async () => {
    delete mockParams.placeId;
    await mountAndSettle(<NewTripScreen />);
    await waitFor(() => expect(screen.getByDisplayValue('Delhi weekend')).toBeTruthy());
    expect(screen.getByText('Save changes')).toBeTruthy();
    expect(screen.getByText('Delete trip')).toBeTruthy();
  });

  it('renders trip detail with the itinerary and trip total', async () => {
    await mountAndSettle(<TripDetailScreen />);
    await waitFor(() => expect(screen.getByText('India Gate')).toBeTruthy());
    expect(screen.getByText('Itinerary')).toBeTruthy();
    expect(screen.getByText('Map')).toBeTruthy();
    // Trip footer: ₹450 spent of a ₹10,000 budget.
    expect(screen.getByText('₹450 of ₹10,000')).toBeTruthy();
  });

  it('renders trip detail empty state with no stops', async () => {
    await stopsRepo.deleteStop(stopId);
    await mountAndSettle(<TripDetailScreen />);
    await waitFor(() => expect(screen.getByText('No stops yet')).toBeTruthy());
  });

  it('renders the add-stop screen', async () => {
    await mountAndSettle(<NewPlaceScreen />);
    // No API key in the test environment, so it degrades to manual entry.
    expect(screen.getByText('Place search is off')).toBeTruthy();
    expect(screen.getByText('Add manually instead')).toBeTruthy();
  });

  it('renders stop detail with its activities and notes', async () => {
    await mountAndSettle(<StopDetailScreen />);
    await waitFor(() => expect(screen.getByText('Walk the memorial')).toBeTruthy());
    expect(screen.getByDisplayValue('Best at sunset')).toBeTruthy();
    expect(screen.getByText('To do 1')).toBeTruthy();
  });

  it('renders the expense log', async () => {
    await mountAndSettle(<ExpensesScreen />);
    await waitFor(() => expect(screen.getByText('Lunch')).toBeTruthy());
    // Once on the row and once in the filtered total.
    expect(screen.getAllByText('₹450.00')).toHaveLength(2);
  });

  it('renders the dashboard with both charts', async () => {
    await mountAndSettle(<DashboardScreen />);
    await waitFor(() => expect(screen.getByText('Remaining budget')).toBeTruthy());
    expect(screen.getByText('₹9,550')).toBeTruthy();
    expect(screen.getByText('Planned vs actual per stop')).toBeTruthy();
    expect(screen.getByText('Where the money went')).toBeTruthy();
    // The pie's direct label for the one category with spend.
    expect(screen.getByText('Food')).toBeTruthy();
  });

  it('renders the dashboard for a trip with nothing logged', async () => {
    await expensesRepo.deleteExpense(
      (await expensesRepo.listExpenses(tripId))[0].id,
    );
    await mountAndSettle(<DashboardScreen />);
    await waitFor(() =>
      expect(
        screen.getByText(
          'Nothing logged yet — the breakdown appears once you add expenses.',
        ),
      ).toBeTruthy(),
    );
  });
});
