import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/utils/theme';
import { apiCall } from '../../src/utils/api';

type DailySummary = {
  date: string;
  total_tasks: number;
  completed_tasks: number;
  completion_percentage: number;
  total_minutes: number;
  completed_minutes: number;
};

type WeeklyDay = {
  date: string;
  day_name: string;
  total: number;
  completed: number;
  percentage: number;
};

type StreakItem = { task_id: string; title: string; current_streak: number };
type MissedItem = { task_id: string; title: string; missed_count: number; completion_rate: number };
type DayStats = { day: string; day_index: number; percentage: number };
type TrendItem = { date: string; day: string; percentage: number };

export default function SummaryScreen() {
  const { colors } = useTheme();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [daily, setDaily] = useState<DailySummary | null>(null);
  const [weekly, setWeekly] = useState<WeeklyDay[]>([]);
  const [streaks, setStreaks] = useState<StreakItem[]>([]);
  const [missed, setMissed] = useState<MissedItem[]>([]);
  const [bestDays, setBestDays] = useState<DayStats[]>([]);
  const [trend, setTrend] = useState<TrendItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  async function fetchData() {
    setLoading(true);
    try {
      const [dailyRes, weeklyRes, analyticsRes] = await Promise.all([
        apiCall(`/summary/daily?date=${selectedDate}`),
        apiCall(`/summary/weekly?date=${selectedDate}`),
        apiCall('/summary/analytics'),
      ]);
      setDaily(dailyRes);
      setWeekly(weeklyRes.days);
      setStreaks(analyticsRes.streaks || []);
      setMissed(analyticsRes.most_missed || []);
      setBestDays(analyticsRes.best_days || []);
      setTrend(analyticsRes.trend || []);
    } catch (e) {
      console.error('Summary fetch failed:', e);
    }
    setLoading(false);
  }

  const changeDate = (offset: number) => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + offset);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const formattedDate = new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });

  if (loading && !daily) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator testID="summary-loading" size="large" color={colors.primary} style={{ marginTop: 100 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.screenTitle, { color: colors.textPrimary }]}>Summary</Text>

        {/* Date selector */}
        <View style={styles.dateSelector}>
          <TouchableOpacity testID="summary-prev-day" onPress={() => changeDate(-1)} style={styles.dateNavBtn}>
            <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.dateText, { color: colors.textPrimary }]}>{formattedDate}</Text>
          <TouchableOpacity testID="summary-next-day" onPress={() => changeDate(1)} style={styles.dateNavBtn}>
            <Ionicons name="chevron-forward" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Daily stats cards */}
        {daily && (
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.statValue, { color: colors.primary }]}>{daily.completion_percentage}%</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Completion</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>{daily.completed_tasks}/{daily.total_tasks}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Tasks Done</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.statValue, { color: colors.success }]}>{daily.completed_minutes}m</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Time Done</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>{daily.total_minutes}m</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Planned</Text>
            </View>
          </View>
        )}

        {/* Weekly overview */}
        {weekly.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>This Week</Text>
            <View style={styles.weeklyGrid}>
              {weekly.map(day => {
                const isSelected = day.date === selectedDate;
                return (
                  <TouchableOpacity
                    key={day.date}
                    testID={`weekly-day-${day.day_name}`}
                    style={styles.weeklyCol}
                    onPress={() => setSelectedDate(day.date)}
                  >
                    <View style={styles.barContainer}>
                      <View
                        style={[
                          styles.bar,
                          {
                            backgroundColor: isSelected ? colors.primary : colors.primary + '40',
                            height: `${Math.max(day.percentage, 4)}%`,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.weeklyPercent, { color: isSelected ? colors.primary : colors.textSecondary }]}>
                      {day.percentage}%
                    </Text>
                    <Text style={[
                      styles.weeklyDay,
                      { color: isSelected ? colors.primary : colors.textSecondary },
                      isSelected && { fontWeight: '700' },
                    ]}>
                      {day.day_name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Streaks */}
        {streaks.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Streaks</Text>
            {streaks.slice(0, 5).map(s => (
              <View
                key={s.task_id}
                style={[styles.streakRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <Ionicons name="flame" size={20} color={s.current_streak > 0 ? '#F59E0B' : colors.textSecondary} />
                <Text style={[styles.streakTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                  {s.title}
                </Text>
                <Text style={[styles.streakCount, { color: s.current_streak > 0 ? colors.primary : colors.textSecondary }]}>
                  {s.current_streak}d
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Completion Trend */}
        {trend.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>7-Day Trend</Text>
            <View style={styles.trendRow}>
              {trend.map(t => (
                <View key={t.date} style={styles.trendCol}>
                  <View style={[styles.trendBarBg, { backgroundColor: colors.surfaceHighlight }]}>
                    <View
                      style={[
                        styles.trendBarFill,
                        { backgroundColor: colors.primary, height: `${Math.max(t.percentage, 3)}%` },
                      ]}
                    />
                  </View>
                  <Text style={[styles.trendLabel, { color: colors.textSecondary }]}>{t.day}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Most Missed */}
        {missed.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Most Missed</Text>
            {missed.slice(0, 3).map(m => (
              <View
                key={m.task_id}
                style={[styles.missedRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <View style={styles.missedInfo}>
                  <Text style={[styles.missedTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                    {m.title}
                  </Text>
                  <Text style={[styles.missedSub, { color: colors.textSecondary }]}>
                    {m.completion_rate}% completion rate
                  </Text>
                </View>
                <View style={[styles.missedBadge, { backgroundColor: colors.destructive + '20' }]}>
                  <Text style={[styles.missedBadgeText, { color: colors.destructive }]}>
                    {m.missed_count} missed
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Best Days */}
        {bestDays.length > 0 && (
          <View style={[styles.section, { paddingBottom: 32 }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Best Days</Text>
            {bestDays.slice(0, 3).map((d, i) => (
              <View
                key={d.day}
                style={[styles.bestDayRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <Text style={[styles.bestDayRank, { color: colors.primary }]}>#{i + 1}</Text>
                <Text style={[styles.bestDayName, { color: colors.textPrimary }]}>{d.day}</Text>
                <Text style={[styles.bestDayPercent, { color: colors.primary }]}>{d.percentage}%</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 24 },
  screenTitle: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5, paddingTop: 16, marginBottom: 16 },
  dateSelector: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginBottom: 20, gap: 16,
  },
  dateNavBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  dateText: { fontSize: 17, fontWeight: '600' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    width: '48%', paddingVertical: 20, paddingHorizontal: 16,
    borderRadius: 14, borderWidth: 1, flexGrow: 1,
  },
  statValue: { fontSize: 28, fontWeight: '800', marginBottom: 4 },
  statLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  section: { marginTop: 28 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 14 },
  weeklyGrid: { flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
  weeklyCol: { flex: 1, alignItems: 'center' },
  barContainer: { height: 80, width: 24, justifyContent: 'flex-end', borderRadius: 6, overflow: 'hidden' },
  bar: { width: '100%', borderRadius: 6, minHeight: 3 },
  weeklyPercent: { fontSize: 10, fontWeight: '600', marginTop: 6 },
  weeklyDay: { fontSize: 11, fontWeight: '500', marginTop: 2 },
  streakRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 8,
  },
  streakTitle: { flex: 1, fontSize: 15, fontWeight: '500' },
  streakCount: { fontSize: 16, fontWeight: '800' },
  trendRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  trendCol: { flex: 1, alignItems: 'center' },
  trendBarBg: { height: 60, width: 20, borderRadius: 6, justifyContent: 'flex-end', overflow: 'hidden' },
  trendBarFill: { width: '100%', borderRadius: 6, minHeight: 2 },
  trendLabel: { fontSize: 10, fontWeight: '600', marginTop: 6 },
  missedRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 8,
  },
  missedInfo: { flex: 1 },
  missedTitle: { fontSize: 15, fontWeight: '600' },
  missedSub: { fontSize: 12, marginTop: 2 },
  missedBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  missedBadgeText: { fontSize: 12, fontWeight: '700' },
  bestDayRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 8,
  },
  bestDayRank: { fontSize: 16, fontWeight: '800', width: 30 },
  bestDayName: { flex: 1, fontSize: 15, fontWeight: '600' },
  bestDayPercent: { fontSize: 16, fontWeight: '800' },
});
