import { directionsUrl, legUrl, placeUrl, routeUrl, type MapPlace } from './maps';

const fromPlaces: MapPlace = {
  name: 'India Gate',
  address: 'Kartavya Path, New Delhi',
  lat: 28.6129,
  lng: 77.2295,
  googlePlaceId: 'ChIJC03rqdriDDkRXQTJXtsq1S8',
};

const typedByHand: MapPlace = {
  name: 'Central Park',
  address: 'New York',
  lat: null,
  lng: null,
  googlePlaceId: null,
};

describe('placeUrl', () => {
  it('pins the exact place when Google gave us an id', () => {
    const url = placeUrl(fromPlaces);
    expect(url).toContain('query=28.6129%2C77.2295');
    expect(url).toContain('query_place_id=ChIJC03rqdriDDkRXQTJXtsq1S8');
  });

  it('searches by name and address when a stop was typed by hand', () => {
    const url = placeUrl(typedByHand);
    expect(url).toContain('query=Central+Park%2C+New+York');
    expect(url).not.toContain('query_place_id');
  });
});

describe('directionsUrl', () => {
  it('routes to the place, leaving the origin to the phone', () => {
    const url = directionsUrl(fromPlaces);
    expect(url).toContain('/maps/dir/');
    expect(url).toContain('destination=28.6129%2C77.2295');
    expect(url).toContain('destination_place_id=ChIJC03rqdriDDkRXQTJXtsq1S8');
    expect(url).not.toContain('origin=');
  });

  it('still works for a stop with nothing but a name', () => {
    expect(directionsUrl({ ...typedByHand, address: null })).toContain(
      'destination=Central+Park',
    );
  });
});

describe('legUrl', () => {
  it('routes between two stops', () => {
    const url = legUrl(fromPlaces, typedByHand);
    expect(url).toContain('origin=28.6129%2C77.2295');
    expect(url).toContain('destination=Central+Park%2C+New+York');
    expect(url).toContain('origin_place_id=ChIJC03rqdriDDkRXQTJXtsq1S8');
  });

  it('falls back to plain directions for the first stop of a day', () => {
    expect(legUrl(null, fromPlaces)).toBe(directionsUrl(fromPlaces));
  });
});

describe('routeUrl', () => {
  const stop = (name: string): MapPlace => ({
    name,
    address: null,
    lat: null,
    lng: null,
    googlePlaceId: null,
  });

  it('needs somewhere to go from', () => {
    expect(routeUrl([])).toBeNull();
    expect(routeUrl([stop('India Gate')])).toBeNull();
  });

  it('threads the middle stops through as waypoints', () => {
    const url = routeUrl([stop('A'), stop('B'), stop('C')])!;
    expect(url).toContain('origin=A');
    expect(url).toContain('destination=C');
    expect(url).toContain('waypoints=B');
  });

  it('truncates rather than refusing a trip Maps cannot fit', () => {
    const many = Array.from({ length: 15 }, (_, i) => stop(`S${i}`));
    const url = routeUrl(many)!;
    expect(url).toContain('destination=S10');
    expect(url).not.toContain('S11');
  });
});
