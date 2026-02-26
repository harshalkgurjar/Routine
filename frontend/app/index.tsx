import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { useTheme } from '../src/utils/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function LoginScreen() {
  const { login, loading, user } = useAuth();
  const { colors } = useTheme();

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator testID="loading-indicator" size="large" color={colors.primary} />
      </View>
    );
  }

  if (user) {
    return <Redirect href="/(tabs)/today" />;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <View style={styles.heroSection}>
          <View style={[styles.iconCircle, { backgroundColor: colors.primary }]}>
            <Ionicons name="checkmark-done" size={48} color={colors.primaryForeground} />
          </View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            RoutineTrack
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Build habits. Track progress.{'\n'}Achieve your goals.
          </Text>
        </View>

        <View style={styles.featureList}>
          {[
            { icon: 'today-outline' as const, label: 'Daily habit tracking' },
            { icon: 'analytics-outline' as const, label: 'Smart analytics & streaks' },
            { icon: 'notifications-outline' as const, label: 'Reminders & templates' },
          ].map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <Ionicons name={f.icon} size={22} color={colors.primary} />
              <Text style={[styles.featureText, { color: colors.textPrimary }]}>{f.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.buttonSection}>
          <TouchableOpacity
            testID="google-login-btn"
            style={[styles.googleButton, { backgroundColor: colors.primary }]}
            onPress={login}
            activeOpacity={0.8}
          >
            <Ionicons name="logo-google" size={20} color={colors.primaryForeground} />
            <Text style={[styles.googleButtonText, { color: colors.primaryForeground }]}>
              Continue with Google
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 32, paddingBottom: 32 },
  heroSection: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  iconCircle: {
    width: 100, height: 100, borderRadius: 50,
    justifyContent: 'center', alignItems: 'center', marginBottom: 28,
  },
  title: { fontSize: 38, fontWeight: '800', letterSpacing: -1.5, marginBottom: 12 },
  subtitle: { fontSize: 17, textAlign: 'center', lineHeight: 26, opacity: 0.8 },
  featureList: { gap: 16, marginBottom: 40 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  featureText: { fontSize: 16, fontWeight: '500' },
  buttonSection: { paddingBottom: 8 },
  googleButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 18, borderRadius: 14, gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 8, elevation: 4,
  },
  googleButtonText: { fontSize: 17, fontWeight: '700' },
});
