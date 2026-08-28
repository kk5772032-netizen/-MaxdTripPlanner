import { render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { usePlaceContent } from './usePlaceContent';

jest.mock('../api/places', () => {
  const actual = jest.requireActual('../api/places');
  return { ...actual, placeDetails: jest.fn(), hasApiKey: jest.fn() };
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
const places = require('../api/places') as {
  placeDetails: jest.Mock;
  hasApiKey: jest.Mock;
};

function Probe({ placeId }: { placeId: string | null }) {
  const content = usePlaceContent(placeId);
  return <Text>{`status:${content.status}`}</Text>;
}

describe('usePlaceContent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    places.hasApiKey.mockReturnValue(true);
  });

  it('asks for nothing when the build has no Places key', async () => {
    places.hasApiKey.mockReturnValue(false);
    render(<Probe placeId="p1" />);
    expect(screen.getByText('status:none')).toBeTruthy();
    expect(places.placeDetails).not.toHaveBeenCalled();
  });

  it('asks for nothing for a stop that was typed by hand', () => {
    render(<Probe placeId={null} />);
    expect(screen.getByText('status:none')).toBeTruthy();
    expect(places.placeDetails).not.toHaveBeenCalled();
  });

  it('loads details for a stop that came from Places', async () => {
    places.placeDetails.mockResolvedValue({ placeId: 'p1', name: 'India Gate' });
    render(<Probe placeId="p1" />);
    expect(screen.getByText('status:loading')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('status:ready')).toBeTruthy());
  });

  it('surfaces a real failure so it can be retried', async () => {
    places.placeDetails.mockRejectedValue(new Error('offline'));
    render(<Probe placeId="p1" />);
    await waitFor(() => expect(screen.getByText('status:error')).toBeTruthy());
  });
});
