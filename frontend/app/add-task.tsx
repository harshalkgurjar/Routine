import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, KeyboardAvoidingView, Platform, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../src/utils/theme';
import { apiCall } from '../src/utils/api';

const CATEGORIES = ['Health', 'Fitness', 'Work', 'Learning', 'Self-care', 'Productivity', 'Wellness', 'Other'];
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function AddTaskScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'daily' | 'one_off' | 'specific_days'>('daily');
  const [date, setDate] = useState('');
  const [repeatDays, setRepeatDays] = useState<number[]>([]);
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [estimatedMinutes, setEstimatedMinutes] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState('09:00');
  const [saving, setSaving] = useState(false);

  const toggleDay = (dayIndex: number) => {
    setRepeatDays(prev =>
      prev.includes(dayIndex) ? prev.filter(d => d !== dayIndex) : [...prev, dayIndex]
    );
  };

  const saveTask = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Task title is required');
      return;
    }
    if (type === 'one_off' && !date) {
      Alert.alert('Error', 'Please enter a date for one-off task (YYYY-MM-DD)');
      return;
    }
    if (type === 'specific_days' && repeatDays.length === 0) {
      Alert.alert('Error', 'Select at least one day');
      return;
    }

    setSaving(true);
    try {
      await apiCall('/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          type,
          date: type === 'one_off' ? date : null,
          repeat_days: type === 'specific_days' ? repeatDays : type === 'daily' ? [0,1,2,3,4,5,6] : null,
          priority,
          estimated_minutes: estimatedMinutes ? parseInt(estimatedMinutes) : null,
          category,
          notes: notes.trim() || null,
          reminder_enabled: reminderEnabled,
          reminder_time: reminderEnabled ? reminderTime : null,
        }),
      });
      try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to create task');
    }
    setSaving(false);
  };

  const TypeButton = ({ label, value }: { label: string; value: typeof type }) => (
    <TouchableOpacity
      testID={`type-btn-${value}`}
      style={[
        styles.typeBtn,
        { borderColor: type === value ? colors.primary : colors.border },
        type === value && { backgroundColor: colors.primary },
      ]}
      onPress={() => setType(value)}
    >
      <Text style={[
        styles.typeBtnText,
        { color: type === value ? colors.primaryForeground : colors.textSecondary },
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const PriorityButton = ({ label, value, color }: { label: string; value: typeof priority; color: string }) => (
    <TouchableOpacity
      testID={`priority-btn-${value}`}
      style={[
        styles.priorityBtn,
        { borderColor: priority === value ? color : colors.border },
        priority === value && { backgroundColor: color + '15' },
      ]}
      onPress={() => setPriority(value)}
    >
      <View style={[styles.priorityDot, { backgroundColor: color }]} />
      <Text style={[
        styles.priorityBtnText,
        { color: priority === value ? color : colors.textSecondary },
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex1}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity testID="close-add-task" onPress={() => router.back()} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>New Task</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.formContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Title */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>TITLE</Text>
            <TextInput
              testID="task-title-input"
              style={[styles.titleInput, { color: colors.textPrimary, borderBottomColor: colors.border }]}
              placeholder="What do you need to do?"
              placeholderTextColor={colors.textSecondary + '80'}
              value={title}
              onChangeText={setTitle}
              autoFocus
            />
          </View>

          {/* Type */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>TYPE</Text>
            <View style={styles.typeRow}>
              <TypeButton label="Daily" value="daily" />
              <TypeButton label="One-off" value="one_off" />
              <TypeButton label="Specific Days" value="specific_days" />
            </View>
          </View>

          {/* Date (one-off) */}
          {type === 'one_off' && (
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>DATE</Text>
              <TextInput
                testID="task-date-input"
                style={[styles.textInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface }]}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textSecondary + '80'}
                value={date}
                onChangeText={setDate}
                keyboardType="default"
              />
            </View>
          )}

          {/* Day selector (specific days) */}
          {type === 'specific_days' && (
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>REPEAT ON</Text>
              <View style={styles.daysRow}>
                {DAY_LABELS.map((label, i) => {
                  const selected = repeatDays.includes(i);
                  return (
                    <TouchableOpacity
                      key={i}
                      testID={`day-toggle-${i}`}
                      style={[
                        styles.dayToggle,
                        { borderColor: selected ? colors.primary : colors.border },
                        selected && { backgroundColor: colors.primary },
                      ]}
                      onPress={() => toggleDay(i)}
                    >
                      <Text style={[
                        styles.dayToggleText,
                        { color: selected ? colors.primaryForeground : colors.textSecondary },
                      ]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Priority */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>PRIORITY</Text>
            <View style={styles.priorityRow}>
              <PriorityButton label="Low" value="low" color={colors.success} />
              <PriorityButton label="Medium" value="medium" color={colors.warning} />
              <PriorityButton label="High" value="high" color={colors.destructive} />
            </View>
          </View>

          {/* Time estimate */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>TIME ESTIMATE (MINUTES)</Text>
            <TextInput
              testID="task-minutes-input"
              style={[styles.textInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface }]}
              placeholder="e.g. 30"
              placeholderTextColor={colors.textSecondary + '80'}
              value={estimatedMinutes}
              onChangeText={setEstimatedMinutes}
              keyboardType="number-pad"
            />
          </View>

          {/* Category */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>CATEGORY</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
              {CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat}
                  testID={`category-${cat}`}
                  style={[
                    styles.categoryChip,
                    { borderColor: category === cat ? colors.primary : colors.border },
                    category === cat && { backgroundColor: colors.primary + '15' },
                  ]}
                  onPress={() => setCategory(category === cat ? null : cat)}
                >
                  <Text style={[
                    styles.categoryText,
                    { color: category === cat ? colors.primary : colors.textSecondary },
                  ]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Notes */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>NOTES</Text>
            <TextInput
              testID="task-notes-input"
              style={[styles.notesInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface }]}
              placeholder="Any additional details..."
              placeholderTextColor={colors.textSecondary + '80'}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Reminder */}
          <View style={styles.field}>
            <TouchableOpacity
              testID="reminder-toggle"
              style={[styles.reminderToggle, { borderColor: colors.border }]}
              onPress={() => setReminderEnabled(!reminderEnabled)}
            >
              <Ionicons
                name={reminderEnabled ? 'notifications' : 'notifications-outline'}
                size={20}
                color={reminderEnabled ? colors.primary : colors.textSecondary}
              />
              <Text style={[
                styles.reminderLabel,
                { color: reminderEnabled ? colors.primary : colors.textSecondary },
              ]}>
                Set Reminder
              </Text>
              <View style={[
                styles.reminderCheck,
                { borderColor: reminderEnabled ? colors.primary : colors.border },
                reminderEnabled && { backgroundColor: colors.primary },
              ]}>
                {reminderEnabled && <Ionicons name="checkmark" size={14} color={colors.primaryForeground} />}
              </View>
            </TouchableOpacity>

            {reminderEnabled && (
              <TextInput
                testID="reminder-time-input"
                style={[styles.textInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface, marginTop: 8 }]}
                placeholder="HH:MM (24h format)"
                placeholderTextColor={colors.textSecondary + '80'}
                value={reminderTime}
                onChangeText={setReminderTime}
              />
            )}
          </View>
        </ScrollView>

        {/* Save button */}
        <View style={styles.footer}>
          <TouchableOpacity
            testID="save-task-btn"
            style={[styles.saveButton, { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }]}
            onPress={saveTask}
            disabled={saving}
          >
            <Text style={[styles.saveText, { color: colors.primaryForeground }]}>
              {saving ? 'Saving...' : 'Save Task'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex1: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  closeBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  formContent: { paddingHorizontal: 24, paddingBottom: 24 },
  field: { marginBottom: 24 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  titleInput: {
    fontSize: 22, fontWeight: '600', borderBottomWidth: 2,
    paddingVertical: 8, paddingHorizontal: 0,
  },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5,
    alignItems: 'center',
  },
  typeBtnText: { fontSize: 13, fontWeight: '600' },
  textInput: {
    fontSize: 16, fontWeight: '500', padding: 14,
    borderRadius: 10, borderWidth: 1,
  },
  daysRow: { flexDirection: 'row', gap: 6 },
  dayToggle: {
    flex: 1, aspectRatio: 1, maxWidth: 44,
    borderRadius: 22, borderWidth: 1.5,
    justifyContent: 'center', alignItems: 'center',
  },
  dayToggleText: { fontSize: 11, fontWeight: '700' },
  priorityRow: { flexDirection: 'row', gap: 8 },
  priorityBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5,
  },
  priorityDot: { width: 8, height: 8, borderRadius: 4 },
  priorityBtnText: { fontSize: 13, fontWeight: '600' },
  categoryScroll: { gap: 8 },
  categoryChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1,
  },
  categoryText: { fontSize: 13, fontWeight: '600' },
  notesInput: {
    fontSize: 15, padding: 14, borderRadius: 10, borderWidth: 1,
    minHeight: 80, textAlignVertical: 'top',
  },
  reminderToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14, borderRadius: 10, borderWidth: 1,
  },
  reminderLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
  reminderCheck: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2,
    justifyContent: 'center', alignItems: 'center',
  },
  footer: { paddingHorizontal: 24, paddingBottom: 24 },
  saveButton: {
    paddingVertical: 18, borderRadius: 14, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 8, elevation: 4,
  },
  saveText: { fontSize: 17, fontWeight: '700' },
});
