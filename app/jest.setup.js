/* eslint-env jest */

// Native modules that have no JS implementation under jest-expo. Each mock is
// deliberately minimal — tests that care about a return value set it per-test.

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// The real SafeAreaProvider waits for a native measurement that never arrives
// under jest, so it renders nothing and every child assertion fails. This mock
// renders children immediately with a fixed notched-device frame.
jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  const React = require('react');
  const insets = { top: 47, right: 0, bottom: 34, left: 0 };
  const frame = { x: 0, y: 0, width: 390, height: 844 };

  // Keep the real contexts — React Navigation's tab bar consumes them directly
  // — and swap only the provider and hooks.
  return {
    ...actual,
    SafeAreaProvider: ({ children }) =>
      React.createElement(
        actual.SafeAreaFrameContext.Provider,
        { value: frame },
        React.createElement(
          actual.SafeAreaInsetsContext.Provider,
          { value: insets },
          children
        )
      ),
    useSafeAreaInsets: () => insets,
    useSafeAreaFrame: () => frame,
    initialWindowMetrics: { insets, frame },
  };
});

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getCurrentPositionAsync: jest.fn(async () => ({
    coords: { latitude: 35.68, longitude: 139.69 },
  })),
  watchPositionAsync: jest.fn(async () => ({ remove: jest.fn() })),
  Accuracy: { Balanced: 3 },
}));

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  scheduleNotificationAsync: jest.fn(async () => 'notification-id'),
}));

jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Stub = (name) => {
    const Component = (props) => React.createElement(View, props, props.children);
    Component.displayName = name;
    return Component;
  };
  const MapView = Stub('MapView');
  MapView.Marker = Stub('Marker');
  MapView.Circle = Stub('Circle');
  MapView.Polyline = Stub('Polyline');
  return {
    __esModule: true,
    default: MapView,
    Marker: MapView.Marker,
    Circle: MapView.Circle,
    Polyline: MapView.Polyline,
  };
});

// `fetch` is stubbed per-test; failing loudly beats a confusing network error.
global.fetch = jest.fn(() =>
  Promise.reject(new Error('fetch was not stubbed for this test'))
);

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch.mockRejectedValue(new Error('fetch was not stubbed for this test'));
});
