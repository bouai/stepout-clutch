import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ActiveTrackingScreen from '../screens/ActiveTrackingScreen';
import HomeScreen from '../screens/HomeScreen';
import InventoryScreen from '../screens/InventoryScreen';
import PlannerScreen from '../screens/PlannerScreen';
import TransitScreen from '../screens/TransitScreen';
import { colors, radius } from '../theme';

const Tab = createBottomTabNavigator();

function TabIcon({ glyph, focused }: { glyph: string; focused: boolean }) {
  return (
    <View style={[styles.iconWrapper, focused && styles.iconWrapperActive]}>
      <Text style={styles.iconGlyph}>{glyph}</Text>
    </View>
  );
}

export default function RootNavigator() {
  const insets = useSafeAreaInsets();

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          // Lift the floating pill clear of the gesture bar; a fixed 24pt
          // offset put it underneath on gesture-navigation devices.
          tabBarStyle: [styles.tabBar, { bottom: insets.bottom + 12 }],
          tabBarActiveTintColor: colors.navIconActive,
          tabBarInactiveTintColor: colors.navIcon,
          tabBarLabelStyle: styles.tabBarLabel,
          tabBarItemStyle: styles.tabBarItem,
        }}
      >
        <Tab.Screen
          name="Home"
          component={HomeScreen}
          options={{
            title: 'Home',
            tabBarIcon: ({ focused }) => <TabIcon glyph="🏠" focused={focused} />,
          }}
        />
        <Tab.Screen
          name="Planner"
          component={PlannerScreen}
          options={{
            title: 'Plan',
            tabBarIcon: ({ focused }) => <TabIcon glyph="📝" focused={focused} />,
          }}
        />
        <Tab.Screen
          name="Transit"
          component={TransitScreen}
          options={{
            title: 'Go',
            tabBarIcon: ({ focused }) => <TabIcon glyph="🧭" focused={focused} />,
          }}
        />
        <Tab.Screen
          name="Active Tracking"
          component={ActiveTrackingScreen}
          options={{
            title: 'Track',
            tabBarIcon: ({ focused }) => <TabIcon glyph="📍" focused={focused} />,
          }}
        />
        <Tab.Screen
          name="Inventory"
          component={InventoryScreen}
          options={{
            title: 'Pack',
            tabBarIcon: ({ focused }) => <TabIcon glyph="🎒" focused={focused} />,
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.navBackground,
    borderTopWidth: 0,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  tabBarItem: {
    paddingTop: 6,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapperActive: {
    backgroundColor: colors.navActiveCircle,
  },
  iconGlyph: {
    fontSize: 16,
  },
});
