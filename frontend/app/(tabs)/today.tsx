import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/utils/theme';
import { useAuth } from '../../src/context/AuthContext';
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

export default function TodayScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [focusMode, setFocusMode] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const fetchTasks = useCallback(async () => {
    try {
      const data = await apiCall(`/tasks/for-date?date=${today}`);
      setTasks(data);
    } catch (e) {
      console.error('Failed to fetch tasks:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [today]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const toggleTask = async (taskId: string) => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    setTasks(prev =>
      prev.map(t => (t.task_id === taskId ? { ...t, completed: !t.completed } : t))
    );

    try {
      await apiCall('/completions/toggle', {
        method: 'POST',
        body: JSON.stringify({ task_id: taskId, date: today }),
      });
    } catch {
      setTasks(prev =>
        prev.map(t => (t.task_id === taskId ? { ...t, completed: !t.completed } : t))
      );
    }
  };

  const completedCount = tasks.filter(t => t.completed).length;
  const totalCount = tasks.length;
  const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const displayTasks = focusMode
    ? tasks.filter(t => !t.completed).slice(0, 3)
    : tasks;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const formatDate = () =>
    new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });

  const priorityColor = (p: string) => {
    if (p === 'high') return colors.destructive;
    if (p === 'medium') return colors.warning;
    return colors.success;
  };

  const renderTask = ({ item }: { item: Task }) => (
    <TouchableOpacity
      testID={`task-item-${item.task_id}`}
      style={[
        styles.taskCard,
        { backgroundColor: colors.surface, borderColor: colors.border, opacity: item.completed ? 0.65 : 1 },
      ]}
      onPress={() => toggleTask(item.task_id)}
      activeOpacity={0.7}
    >
      <View
        style={[
          styles.checkbox,
          { borderColor: item.completed ? colors.primary : colors.textSecondary },
          item.completed && { backgroundColor: colors.primary },
        ]}
      >
        {item.completed && (
          <Ionicons name="checkmark" size={16} color={colors.primaryForeground} />
        )}
      </View>

      <View style={styles.taskContent}>
        <Text
          style={[
            styles.taskTitle,
            { color: colors.textPrimary },
            item.completed && styles.taskTitleDone,
          ]}
          numberOfLines={1}
        >
          {item.title}
        </Text>
        <View style={styles.taskMeta}>
          {item.category ? (
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>
              {item.category}
            </Text>
          ) : null}
          {item.estimated_minutes ? (
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>
              {item.estimated_minutes}m
            </Text>
          ) : null}
        </View>
      </View>

      <View style={[styles.priorityDot, { backgroundColor: priorityColor(item.priority) }]} />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator testID="today-loading" size="large" color={colors.primary} style={{ marginTop: 100 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.greeting, { color: colors.textSecondary }]}>
            {getGreeting()}, {user?.name?.split(' ')[0]}
          </Text>
          <Text style={[styles.date, { color: colors.textPrimary }]}>
            {formatDate()}
          </Text>
        </View>
        <TouchableOpacity
          testID="focus-mode-btn"
          style={[
            styles.focusButton,
            { backgroundColor: focusMode ? colors.primary : colors.surfaceHighlight },
          ]}
          onPress={() => setFocusMode(!focusMode)}
        >
          <Ionicons
            name="flash"
            size={18}
            color={focusMode ? colors.primaryForeground : colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.progressSection}>
        <View style={styles.progressHeader}>
          <Text style={[styles.progressLabel, { color: colors.textPrimary }]}>
            {completedCount} of {totalCount} tasks
          </Text>
          <Text style={[styles.progressPercent, { color: colors.primary }]}>
            {percentage}%
          </Text>
        </View>
        <View style={[styles.progressBar, { backgroundColor: colors.surfaceHighlight }]}>
          <View
            style={[
              styles.progressFill,
              { backgroundColor: colors.primary, width: `${percentage}%` },
            ]}
          />
        </View>
      </View>

      {focusMode && (
        <View style={[styles.focusBanner, { backgroundColor: colors.primary + '15' }]}>
          <Ionicons name="flash" size={16} color={colors.primary} />
          <Text style={[styles.focusText, { color: colors.primary }]}>
            Focus Mode — Next {Math.min(3, displayTasks.length)} tasks
          </Text>
        </View>
      )}

      <FlatList
        data={displayTasks}
        keyExtractor={item => item.task_id}
        renderItem={renderTask}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchTasks();
            }}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-done-circle" size={64} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
              {tasks.length === 0 ? 'No tasks yet' : 'All done!'}
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              {tasks.length === 0
                ? 'Tap + to add your first task'
                : 'Great job completing everything today!'}
            </Text>
          </View>
        }
      />

      <TouchableOpacity
        testID="add-task-fab"
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
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8,
  },
  headerLeft: { flex: 1 },
  greeting: { fontSize: 15, fontWeight: '500', marginBottom: 4 },
  date: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  focusButton: {
    width: 42, height: 42, borderRadius: 21,
    justifyContent: 'center', alignItems: 'center', marginLeft: 12,
  },
  progressSection: { paddingHorizontal: 24, paddingVertical: 12 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressLabel: { fontSize: 14, fontWeight: '600' },
  progressPercent: { fontSize: 14, fontWeight: '700' },
  progressBar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  focusBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 24, padding: 12, borderRadius: 10, marginBottom: 4,
  },
  focusText: { fontSize: 13, fontWeight: '600' },
  listContent: { paddingHorizontal: 24, paddingBottom: 100, paddingTop: 8 },
  taskCard: {
    flexDirection: 'row', alignItems: 'center',
    padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 8,
  },
  checkbox: {
    width: 26, height: 26, borderRadius: 13, borderWidth: 2,
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  taskContent: { flex: 1 },
  taskTitle: { fontSize: 16, fontWeight: '600', marginBottom: 3 },
  taskTitleDone: { textDecorationLine: 'line-through', opacity: 0.5 },
  taskMeta: { flexDirection: 'row', gap: 10 },
  metaText: { fontSize: 12, fontWeight: '500' },
  priorityDot: { width: 10, height: 10, borderRadius: 5, marginLeft: 8 },
  emptyState: { alignItems: 'center', paddingTop: 80 },
  emptyTitle: { fontSize: 20, fontWeight: '700', marginTop: 16 },
  emptySubtitle: { fontSize: 15, marginTop: 8, textAlign: 'center' },
  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 58, height: 58, borderRadius: 29,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 12, elevation: 8,
  },
});
