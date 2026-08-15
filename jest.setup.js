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

// react-native-reorderable-list pulls in Reanimated, whose worklets runtime
// can't initialize outside a native runtime. Swap in a plain FlatList: dragging
// is native gesture behaviour that can't be tested here anyway, but this keeps
// the rows themselves really rendering so screen tests still exercise StopCard.
jest.mock('react-native-reorderable-list', () => {
  const React = require('react');
  const { FlatList } = require('react-native');
  return {
    __esModule: true,
    default: (props) => React.createElement(FlatList, props),
    useReorderableDrag: () => () => {},
    useIsActive: () => false,
    reorderItems: (items, from, to) => {
      const next = [...items];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    },
  };
});

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
