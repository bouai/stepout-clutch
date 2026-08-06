import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import ActiveTrackingScreen from '../screens/ActiveTrackingScreen';
import InventoryScreen from '../screens/InventoryScreen';
import PlannerScreen from '../screens/PlannerScreen';
import TransitScreen from '../screens/TransitScreen';

const Tab = createBottomTabNavigator();

export default function RootNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator>
        <Tab.Screen name="Planner" component={PlannerScreen} />
        <Tab.Screen name="Transit" component={TransitScreen} />
        <Tab.Screen name="Active Tracking" component={ActiveTrackingScreen} />
        <Tab.Screen name="Inventory" component={InventoryScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
