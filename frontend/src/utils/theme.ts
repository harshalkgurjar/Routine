import { useColorScheme } from 'react-native';

export const Colors = {
  light: {
    background: '#FDFDFD',
    surface: '#FFFFFF',
    surfaceHighlight: '#F4F4F5',
    textPrimary: '#09090B',
    textSecondary: '#52525B',
    border: '#E4E4E7',
    primary: '#0047FF',
    primaryForeground: '#FFFFFF',
    destructive: '#EF4444',
    success: '#22C55E',
    warning: '#F59E0B',
  },
  dark: {
    background: '#000000',
    surface: '#09090B',
    surfaceHighlight: '#18181B',
    textPrimary: '#FAFAFA',
    textSecondary: '#A1A1AA',
    border: '#27272A',
    primary: '#3B82F6',
    primaryForeground: '#FFFFFF',
    destructive: '#F87171',
    success: '#4ADE80',
    warning: '#FBBF24',
  },
};

export function useTheme() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  return {
    colors: isDark ? Colors.dark : Colors.light,
    isDark,
  };
}
