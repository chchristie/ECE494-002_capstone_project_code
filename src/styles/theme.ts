// Themes to be used across all screen to allow for unifromity
export const theme = {
  colors: {
    // Core backgrounds 
    background: '#000000',           // Pure black
    backgroundGradient: ['#0A0A0F', '#000000', '#0F0A0A'], // Dark gradient
    onBackground: '#FFFFFF',
    surface: '#1C1C1E',             // Elevated surfaces (iOS dark) Attempt
    onSurface: '#FFFFFF',
    surfaceVariant: '#2C2C2E',      // Cards and containers
    onSurfaceVariant: '#98989D',    // Secondary text

    // Glassmorphism colors
    glass: 'rgba(28, 28, 30, 0.7)',
    glassBorder: 'rgba(255, 255, 255, 0.1)',
    glassHighlight: 'rgba(255, 255, 255, 0.05)',

    // Primary colors 
    primary: '#FF375F',
    primaryGradient: ['#FF375F', '#FF6B8A', '#FF9F9F'], // Pink
    onPrimary: '#FFFFFF',
    primaryContainer: '#FF375F20',  // Translucent
    onPrimaryContainer: '#FF6B8A',

    // Secondary - cyan gradient 
    secondary: '#00D4FF',
    secondaryGradient: ['#00D4FF', '#5CE1E6', '#7FE7F0'], // Cyan gradient
    onSecondary: '#000000',
    secondaryContainer: '#00D4FF20',
    onSecondaryContainer: '#5CE1E6',

    // Tertiary - yellow gradient 
    tertiary: '#FFD60A',
    tertiaryGradient: ['#FFD60A', '#FFE55C', '#FFF099'], // Yellow gradient
    onTertiary: '#000000',
    tertiaryContainer: '#FFD60A20',
    onTertiaryContainer: '#FFE55C',

    // Heart rate zone colors with gradients
    zoneResting: '#30D158',
    zoneRestingGradient: ['#30D158', '#64D988', '#8BE5A8'],
    zoneFatBurn: '#FFD60A',
    zoneFatBurnGradient: ['#FFD60A', '#FFE55C', '#FFF099'],
    zoneCardio: '#FF9F0A',
    zoneCardioGradient: ['#FF9F0A', '#FFB340', '#FFC870'],
    zonePeak: '#FF453A',
    zonePeakGradient: ['#FF453A', '#FF6B63', '#FF9691'],

    // Error colors
    error: '#FF453A',               // Red
    onError: '#FFFFFF',
    errorContainer: '#FF453A20',
    onErrorContainer: '#FF6B63',

    // Success colors
    success: '#30D158',             // Green
    onSuccess: '#000000',
    successContainer: '#30D15820',
    onSuccessContainer: '#64D988',

    // Warning colors
    warning: '#FF9F0A',             // Orange
    onWarning: '#000000',
    warningContainer: '#FF9F0A20',
    onWarningContainer: '#FFB340',

    // Outline and divider colors
    outline: '#38383A',
    outlineVariant: '#48484A',

    // Additional utility colors
    shadow: '#000000',
    inactive: '#636366',

    // Neumorphic colors
    neumorphLight: '#2C2C2E',
    neumorphDark: '#121214',
    neumorphShadow: 'rgba(0, 0, 0, 0.5)',
    neumorphHighlight: 'rgba(255, 255, 255, 0.05)',

    // Legacy colors for backward compatibility
    text: '#FFFFFF',
    textSecondary: '#98989D',
    border: '#38383A',
    accent: '#FF375F',
  },
  
  // Spacing scale
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  
  // Typography scale
  typography: {
    h1: {
      fontSize: 32,
      fontWeight: '700' as const,
      lineHeight: 40,
    },
    h2: {
      fontSize: 24,
      fontWeight: '600' as const,
      lineHeight: 32,
    },
    h3: {
      fontSize: 20,
      fontWeight: '600' as const,
      lineHeight: 28,
    },
    body1: {
      fontSize: 16,
      fontWeight: '400' as const,
      lineHeight: 24,
    },
    body2: {
      fontSize: 14,
      fontWeight: '400' as const,
      lineHeight: 20,
    },
    caption: {
      fontSize: 12,
      fontWeight: '400' as const,
      lineHeight: 16,
    },
  },
  
  // Border radius scale
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
  },
  
  // Elevation (shadow) scale
  elevation: {
    none: {
      elevation: 0,
      shadowOpacity: 0,
    },
    low: {
      elevation: 1,
      shadowOpacity: 0.05,
      shadowRadius: 1,
      shadowOffset: { width: 0, height: 1 },
    },
    medium: {
      elevation: 2,
      shadowOpacity: 0.1,
      shadowRadius: 2,
      shadowOffset: { width: 0, height: 2 },
    },
    high: {
      elevation: 4,
      shadowOpacity: 0.15,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 4 },
    },
  },

  // Animation durations
  animation: {
    fast: 150,
    normal: 300,
    slow: 600,
    heartbeat: 1000,
  },

  // Glassmorphism effect
  glassmorphism: {
    backgroundColor: 'rgba(28, 28, 30, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(20px)', // Note: Not supported in RN, use BlurView
  },

  // Neumorphism effect
  neumorphism: {
    light: {
      backgroundColor: '#2C2C2E',
      shadowColor: 'rgba(255, 255, 255, 0.05)',
      shadowOffset: { width: -4, height: -4 },
      shadowOpacity: 1,
      shadowRadius: 8,
    },
    dark: {
      shadowColor: 'rgba(0, 0, 0, 0.5)',
      shadowOffset: { width: 4, height: 4 },
      shadowOpacity: 1,
      shadowRadius: 8,
    },
  },
};

// Type definitions for theme
export type Theme = typeof theme;
export type ThemeColors = typeof theme.colors;
export type ThemeSpacing = typeof theme.spacing;
export type ThemeTypography = typeof theme.typography;

// Functions for theme usage
export const getSpacing = (spacingKey: keyof ThemeSpacing): number => {
  return theme.spacing[spacingKey];
};

// Color utility functions
export const withOpacity = (color: string, opacity: number): string => {
  // Convert opacity (0-1) to hex (00-FF)
  const hex = Math.round(opacity * 255).toString(16).padStart(2, '0');
  return `${color}${hex}`;
};

export const lighten = (color: string, amount: number): string => {
  // Simple color lightening - in production you'd use a proper color library
  return `${color}${Math.round((1 - amount) * 255).toString(16).padStart(2, '0')}`;
};


export default theme;
