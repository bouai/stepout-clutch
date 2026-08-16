import { registerRootComponent } from 'expo';

// Imported for its side effect: TaskManager.defineTask must run before the JS
// bundle finishes evaluating, because the OS can relaunch this process purely
// to deliver a geofence event, with no UI and no navigation ever mounting.
import './src/geofencing';
import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
