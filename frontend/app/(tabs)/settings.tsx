import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Switch, Alert, Share, Platform, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { useTheme } from '../../src/utils/theme';
import { useAuth } from '../../src/context/AuthContext';
import { apiCall } from '../../src/utils/api';

type Template = {
  template_id: string;
  name: string;
  description: string | null;
  tasks: { title: string; priority?: string; estimated_minutes?: number; category?: string }[];
  is_default: boolean;
};

export default function SettingsScreen() {
  const { colors } = useTheme();
  const { user, logout } = useAuth();
  const [dailySummaryEnabled, setDailySummaryEnabled] = useState(true);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [applyingTemplate, setApplyingTemplate] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
    fetchTemplates();
  }, []);

  async function fetchSettings() {
    try {
      const data = await apiCall('/settings');
      setDailySummaryEnabled(data.daily_summary_enabled ?? true);
    } catch {}
  }

  async function fetchTemplates() {
    try {
      const data = await apiCall('/templates');
      setTemplates(data);
    } catch {}
    setLoadingTemplates(false);
  }

  async function toggleDailySummary(value: boolean) {
    setDailySummaryEnabled(value);
    try {
      await apiCall('/settings', {
        method: 'PUT',
        body: JSON.stringify({ daily_summary_enabled: value, daily_summary_time: '21:00' }),
      });

      if (value) {
        // Schedule 9 PM daily notification
        if (Platform.OS !== 'web') {
          const { status } = await Notifications.requestPermissionsAsync();
          if (status === 'granted') {
            await Notifications.cancelAllScheduledNotificationsAsync();
            await Notifications.scheduleNotificationAsync({
              content: {
                title: 'RoutineTrack Daily Summary',
                body: 'Time to review your daily progress!',
                sound: true,
              },
              trigger: { hour: 21, minute: 0, repeats: true },
            });
          }
        }
      } else {
        if (Platform.OS !== 'web') {
          await Notifications.cancelAllScheduledNotificationsAsync();
        }
      }
    } catch {}
  }

  async function applyTemplate(templateId: string) {
    setApplyingTemplate(templateId);
    try {
      const result = await apiCall(`/templates/${templateId}/apply`, { method: 'POST' });
      Alert.alert('Template Applied', result.message || 'Tasks created from template');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to apply template');
    }
    setApplyingTemplate(null);
  }

  async function shareWeeklySummary() {
    const today = new Date().toISOString().split('T')[0];
    try {
      const data = await apiCall(`/export/weekly?date=${today}`);
      await Share.share({ message: data.text });
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to export summary');
    }
  }

  async function handleLogout() {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: logout },
    ]);
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.screenTitle, { color: colors.textPrimary }]}>Settings</Text>

        {/* Profile */}
        <View style={[styles.profileCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.avatarCircle, { backgroundColor: colors.primary }]}>
            <Text style={[styles.avatarText, { color: colors.primaryForeground }]}>
              {(user?.name || '?')[0].toUpperCase()}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: colors.textPrimary }]}>{user?.name}</Text>
            <Text style={[styles.profileEmail, { color: colors.textSecondary }]}>{user?.email}</Text>
          </View>
        </View>

        {/* Notifications */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Notifications</Text>
          <View style={[styles.settingRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Daily Summary at 9 PM</Text>
              <Text style={[styles.settingDesc, { color: colors.textSecondary }]}>
                Get a reminder to review your progress
              </Text>
            </View>
            <Switch
              testID="daily-summary-switch"
              value={dailySummaryEnabled}
              onValueChange={toggleDailySummary}
              trackColor={{ false: colors.surfaceHighlight, true: colors.primary + '60' }}
              thumbColor={dailySummaryEnabled ? colors.primary : colors.textSecondary}
            />
          </View>
        </View>

        {/* Templates */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Templates</Text>
          {loadingTemplates ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
          ) : templates.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No templates available. They will appear after your first login.
            </Text>
          ) : (
            templates.map(t => (
              <View
                key={t.template_id}
                style={[styles.templateCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <View style={styles.templateHeader}>
                  <View style={styles.templateInfo}>
                    <Text style={[styles.templateName, { color: colors.textPrimary }]}>{t.name}</Text>
                    {t.description ? (
                      <Text style={[styles.templateDesc, { color: colors.textSecondary }]}>{t.description}</Text>
                    ) : null}
                  </View>
                  <TouchableOpacity
                    testID={`apply-template-${t.template_id}`}
                    style={[styles.applyBtn, { backgroundColor: colors.primary }]}
                    onPress={() => applyTemplate(t.template_id)}
                    disabled={applyingTemplate === t.template_id}
                  >
                    {applyingTemplate === t.template_id ? (
                      <ActivityIndicator size="small" color={colors.primaryForeground} />
                    ) : (
                      <Text style={[styles.applyBtnText, { color: colors.primaryForeground }]}>Apply</Text>
                    )}
                  </TouchableOpacity>
                </View>
                <View style={styles.templateTasks}>
                  {t.tasks.map((task, i) => (
                    <View key={i} style={styles.templateTaskRow}>
                      <Ionicons name="checkmark-circle-outline" size={16} color={colors.textSecondary} />
                      <Text style={[styles.templateTaskText, { color: colors.textSecondary }]}>
                        {task.title}
                        {task.estimated_minutes ? ` (${task.estimated_minutes}m)` : ''}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ))
          )}
        </View>

        {/* Export */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Export & Share</Text>
          <TouchableOpacity
            testID="share-weekly-btn"
            style={[styles.actionRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={shareWeeklySummary}
          >
            <Ionicons name="share-outline" size={22} color={colors.primary} />
            <Text style={[styles.actionLabel, { color: colors.textPrimary }]}>Share Weekly Summary</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity
          testID="logout-btn"
          style={[styles.logoutButton, { borderColor: colors.destructive }]}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.destructive} />
          <Text style={[styles.logoutText, { color: colors.destructive }]}>Logout</Text>
        </TouchableOpacity>

        {/* About */}
        <View style={[styles.aboutCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="information-circle-outline" size={22} color={colors.primary} />
          <View style={styles.aboutInfo}>
            <Text style={[styles.aboutTitle, { color: colors.textPrimary }]}>RoutineTrack</Text>
            <Text style={[styles.aboutSub, { color: colors.textSecondary }]}>
              Created by Harshal G
            </Text>
            <Text style={[styles.aboutVersion, { color: colors.textSecondary }]}>
              Version 1.0.0
            </Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 24 },
  screenTitle: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5, paddingTop: 16, marginBottom: 24 },
  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    padding: 20, borderRadius: 16, borderWidth: 1, marginBottom: 8,
  },
  avatarCircle: {
    width: 52, height: 52, borderRadius: 26,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 22, fontWeight: '800' },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: '700' },
  profileEmail: { fontSize: 14, marginTop: 2 },
  section: { marginTop: 28 },
  sectionTitle: { fontSize: 16, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderRadius: 14, borderWidth: 1,
  },
  settingInfo: { flex: 1, marginRight: 12 },
  settingLabel: { fontSize: 15, fontWeight: '600' },
  settingDesc: { fontSize: 12, marginTop: 2 },
  templateCard: { padding: 16, borderRadius: 14, borderWidth: 1, marginBottom: 12 },
  templateHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  templateInfo: { flex: 1 },
  templateName: { fontSize: 16, fontWeight: '700' },
  templateDesc: { fontSize: 13, marginTop: 2 },
  applyBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  applyBtnText: { fontSize: 13, fontWeight: '700' },
  templateTasks: { marginTop: 12, gap: 6 },
  templateTaskRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  templateTaskText: { fontSize: 13, fontWeight: '500' },
  emptyText: { fontSize: 14, paddingVertical: 12 },
  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 16, borderRadius: 14, borderWidth: 1,
  },
  actionLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
  logoutButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    padding: 16, borderRadius: 14, borderWidth: 1.5, marginTop: 32,
  },
  logoutText: { fontSize: 16, fontWeight: '700' },
});
