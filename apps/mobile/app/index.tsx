import { View, Text, StyleSheet } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Adore</Text>
      <Text style={styles.subtitle}>Your Style Intelligence</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fafafa',
  },
  title: {
    fontSize: 48,
    fontWeight: '300',
    letterSpacing: 8,
    color: '#1a1a1a',
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '400',
    letterSpacing: 2,
    color: '#888',
    marginTop: 8,
  },
});
