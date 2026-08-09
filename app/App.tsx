import { TripProvider } from './src/context/TripContext';
import RootNavigator from './src/navigation/RootNavigator';

export default function App() {
  return (
    <TripProvider>
      <RootNavigator />
    </TripProvider>
  );
}
