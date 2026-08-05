import { StyleSheet, Text, View } from 'react-native';

export default function PlannerScreen() {
  return (
    <View style={styles.container}>
      <Text>Planner</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
