/* eslint-env jest */

// expo-crypto is a native module; row ids only need to be unique within a test
// run, so a counter is enough and keeps tests deterministic.
// The `mock` prefix is what lets jest.mock's factory close over this.
let mockIdCounter = 0;
jest.mock('expo-crypto', () => ({
  randomUUID: () => `test-id-${String(++mockIdCounter).padStart(6, '0')}`,
}));

// expo-sqlite has no implementation outside a native runtime. Swap in a real
// SQLite (Node's built-in) so repository tests exercise foreign keys, cascades
// and CHECK constraints for real rather than against a fake.
// See src/db/testSqlite.ts.
jest.mock('expo-sqlite', () => require('./src/db/testSqlite'));

// react-native-maps pulls in native views that jsdom can't render. Nothing
// under test asserts on the map, so a stub keeps the import graph resolvable.
jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Stub = (props) => React.createElement(View, props, props.children);
  return {
    __esModule: true,
    default: Stub,
    Marker: Stub,
    Polyline: Stub,
    PROVIDER_GOOGLE: 'google',
  };
});
