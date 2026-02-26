import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/utils/theme';
import { apiCall } from '../../src/utils/api';

type Task = {
  task_id: string;
  title: string;
  type: string;
  priority: string;
  estimated_minutes: number | null;
  category: string | null;
  completed: boolean;
};

export default function CalendarScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completionMap, setCompletionMap] = useState<Record<string, number>>({});
  const [loadingTasks, setLoadingTasks] = useState(false);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  useEffect(() => {
    fetchMonthCompletions();
  }, [year, month]);

  useEffect(() => {
    fetchTasksForDate(selectedDate);
  }, [selectedDate]);

  async function fetchMonthCompletions() {
    const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const end = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    try {
      const data = await apiCall(`/completions/range?start=${start}&end=${end}`);
      const map: Record<string, number> = {};
      data.forEach((c: any) => {
        if (c.completed) map[c.date] = (map[c.date] || 0) + 1;
      });
      setCompletionMap(map);
    } catch {}
  }

  async function fetchTasksForDate(date: string) {
    setLoadingTasks(true);
    try {
      const data = await apiCall(`/tasks/for-date?date=${date}`);
      setTasks(data);
    } catch {}
    setLoadingTasks(false);
  }

  const toggleTask = async (taskId: string) => {
    try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    setTasks(prev => prev.map(t =>
      t.task_id === taskId ? { ...t, completed: !t.completed } : t
    ));
    try {
      await apiCall('/completions/toggle', {
        method: 'POST',
        body: JSON.stringify({ task_id: taskId, date: selectedDate }),
      });
    } catch {
      setTasks(prev => prev.map(t =>
        t.task_id === taskId ? { ...t, completed: !t.completed } : t
      ));
    }
  };

  // Calendar math
  const firstDayOfWeek = (new Date(year, month, 1).getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);
  while (calendarDays.length % 7 !== 0) calendarDays.push(null);

  const getDateStr = (day: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const todayStr = new Date().toISOString().split('T')[0];
  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const dayLabels = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

  const priorityColor = (p: string) => {
    if (p === 'high') return colors.destructive;
    if (p === 'medium') return colors.warning;
    return colors.success;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Month header */}
        <View style={styles.monthHeader}>
          <TouchableOpacity
            testID="prev-month-btn"
            onPress={() => setCurrentMonth(new Date(year, month - 1, 1))}
            style={styles.navBtn}
          >
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.monthTitle, { color: colors.textPrimary }]}>{monthName}</Text>
          <TouchableOpacity
            testID="next-month-btn"
            onPress={() => setCurrentMonth(new Date(year, month + 1, 1))}
            style={styles.navBtn}
          >
            <Ionicons name="chevron-forward" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Day labels */}
        <View style={styles.dayLabelsRow}>
          {dayLabels.map(d => (
            <View key={d} style={styles.dayLabelCell}>
              <Text style={[styles.dayLabelText, { color: colors.textSecondary }]}>{d}</Text>
            </View>
          ))}
        </View>

        {/* Calendar grid */}
        <View style={styles.calendarGrid}>
          {calendarDays.map((day, i) => {
            const dateStr = day ? getDateStr(day) : '';
            const isSelected = dateStr === selectedDate;
            const isToday = dateStr === todayStr;
            const hasCompletions = dateStr ? (completionMap[dateStr] || 0) > 0 : false;

            return (
              <TouchableOpacity
                key={i}
                testID={day ? `cal-day-${day}` : undefined}
                style={[
                  styles.dayCell,
                  isSelected && { backgroundColor: colors.primary, borderRadius: 10 },
                  isToday && !isSelected && { borderWidth: 2, borderColor: colors.primary, borderRadius: 10 },
                ]}
                onPress={() => day && setSelectedDate(getDateStr(day))}
                disabled={!day}
              >
                {day ? (
                  <>
                    <Text style={[
                      styles.dayText,
                      { color: isSelected ? colors.primaryForeground : colors.textPrimary },
                    ]}>
                      {day}
                    </Text>
                    {hasCompletions && (
                      <View style={[
                        styles.completionDot,
                        { backgroundColor: isSelected ? colors.primaryForeground : colors.success },
                      ]} />
                    )}
                  </>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Selected date tasks */}
        <View style={styles.tasksSection}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
              weekday: 'long', month: 'short', day: 'numeric',
            })}
          </Text>

          {loadingTasks ? (
            <ActivityIndicator style={{ marginTop: 24 }} color={colors.primary} />
          ) : tasks.length === 0 ? (
            <View style={styles.emptySection}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No tasks for this date
              </Text>
            </View>
          ) : (
            tasks.map(task => (
              <TouchableOpacity
                key={task.task_id}
                testID={`cal-task-${task.task_id}`}
                style={[styles.taskRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => toggleTask(task.task_id)}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.checkbox,
                  { borderColor: task.completed ? colors.primary : colors.textSecondary },
                  task.completed && { backgroundColor: colors.primary },
                ]}>
                  {task.completed && (
                    <Ionicons name="checkmark" size={14} color={colors.primaryForeground} />
                  )}
                </View>
                <View style={styles.taskInfo}>
                  <Text style={[
                    styles.taskTitle,
                    { color: colors.textPrimary },
                    task.completed && { textDecorationLine: 'line-through', opacity: 0.5 },
                  ]} numberOfLines={1}>
                    {task.title}
                  </Text>
                  {(task.category || task.estimated_minutes) ? (
                    <View style={styles.taskMetaRow}>
                      {task.category ? (
                        <Text style={[styles.metaChip, { color: colors.textSecondary }]}>{task.category}</Text>
                      ) : null}
                      {task.estimated_minutes ? (
                        <Text style={[styles.metaChip, { color: colors.textSecondary }]}>{task.estimated_minutes}m</Text>
                      ) : null}
                    </View>
                  ) : null}
                </View>
                <View style={[styles.priorityDot, { backgroundColor: priorityColor(task.priority) }]} />
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      <TouchableOpacity
        testID="cal-add-task-fab"
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => router.push('/add-task')}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color={colors.primaryForeground} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  monthHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingTop: 16, paddingBottom: 12,
  },
  navBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  monthTitle: { fontSize: 22, fontWeight: '700' },
  dayLabelsRow: { flexDirection: 'row', paddingHorizontal: 16 },
  dayLabelCell: { flex: 1, alignItems: 'center', paddingVertical: 6 },
  dayLabelText: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16 },
  dayCell: {
    width: '14.28%', aspectRatio: 1,
    justifyContent: 'center', alignItems: 'center',
  },
  dayText: { fontSize: 15, fontWeight: '500' },
  completionDot: { width: 5, height: 5, borderRadius: 3, marginTop: 3 },
  tasksSection: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 100 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  emptySection: { paddingVertical: 32, alignItems: 'center' },
  emptyText: { fontSize: 15 },
  taskRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 8,
  },
  checkbox: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 2,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  taskInfo: { flex: 1 },
  taskTitle: { fontSize: 15, fontWeight: '600' },
  taskMetaRow: { flexDirection: 'row', gap: 8, marginTop: 2 },
  metaChip: { fontSize: 11, fontWeight: '500' },
  priorityDot: { width: 8, height: 8, borderRadius: 4, marginLeft: 8 },
  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 58, height: 58, borderRadius: 29,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 12, elevation: 8,
  },
});
