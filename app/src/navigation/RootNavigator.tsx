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
      <Text style={[styles.iconGlyph, focused && styles.iconGlyphActive]}>{glyph}</Text>
    </View>
  );
}

/** A dark translucent fill behind the floating nav pill. */
function NavBackground() {
  return (
    <View style={styles.navBgWrapper} pointerEvents="none">
      <View style={[StyleSheet.absoluteFill, styles.navBgFill]} />
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
          tabBarStyle: [styles.tabBar, { bottom: insets.bottom + 12 }],
          tabBarActiveTintColor: colors.navIconActive,
          tabBarInactiveTintColor: colors.navIcon,
          tabBarLabelStyle: styles.tabBarLabel,
          tabBarItemStyle: styles.tabBarItem,
          tabBarBackground: () => <NavBackground />,
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
            title: 'Planner',
            tabBarIcon: ({ focused }) => <TabIcon glyph="📝" focused={focused} />,
          }}
        />
        <Tab.Screen
          name="Transit"
          component={TransitScreen}
          options={{
            title: 'Map',
            tabBarIcon: ({ focused }) => <TabIcon glyph="🗺" focused={focused} />,
          }}
        />
        <Tab.Screen
          name="Active Tracking"
          component={ActiveTrackingScreen}
          options={{
            title: 'Live',
            tabBarIcon: ({ focused }) => <TabIcon glyph="📍" focused={focused} />,
          }}
        />
        <Tab.Screen
          name="Inventory"
          component={InventoryScreen}
          options={{
            title: 'Inventory',
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
    height: 68,
    borderRadius: radius.lg,
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    borderWidth: 1,
    borderColor: colors.navBorder,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
  },
  navBgWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  navBgFill: {
    backgroundColor: colors.navBackground,
  },
  tabBarItem: {
    paddingTop: 8,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  iconWrapper: {
    width: 40,
    height: 30,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapperActive: {
    backgroundColor: colors.accentSoft,
  },
  iconGlyph: {
    fontSize: 17,
    opacity: 0.7,
  },
  iconGlyphActive: {
    opacity: 1,
  },
});
