// src/styles/premiumTheme.ts - Premium dark fitness app theme
// Inspired by Apple Fitness+, Whoop, Strava, and award-winning fitness apps

export const premiumTheme = {
  colors: {
    // Core backgrounds - Deep blacks with subtle gradients
    background: '#000000',           // Pure black (OLED-friendly)
    surface: '#1C1C1E',             // Elevated surfaces (iOS dark mode)
    surfaceVariant: '#2C2C2E',      // Cards and containers

    // Primary colors - Vibrant accent (like Apple Fitness rings)
    primary: '#FF375F',             // Vibrant pink/red (Apple Fitness+)
    primaryVariant: '#FF6B8A',      // Lighter variant
    onPrimary: '#FFFFFF',
    primaryContainer: '#FF375F20',  // Translucent container

    // Secondary - Electric cyan (activity tracking)
    secondary: '#00D4FF',           // Bright cyan (Whoop-inspired)
    secondaryVariant: '#5CE1E6',    // Lighter cyan
    onSecondary: '#000000',
    secondaryContainer: '#00D4FF20',

    // Tertiary - Energy yellow (calorie/intensity)
    tertiary: '#FFD60A',            // Apple yellow
    tertiaryVariant: '#FFE55C',
    onTertiary: '#000000',
    tertiaryContainer: '#FFD60A20',

    // Semantic colors with vibrant accents
    success: '#30D158',             // Apple green
    successContainer: '#30D15820',
    warning: '#FF9F0A',             // Apple orange
    warningContainer: '#FF9F0A20',
    error: '#FF453A',               // Apple red
    errorContainer: '#FF453A20',

    // Text colors - High contrast for OLED
    onSurface: '#FFFFFF',           // Primary text
    onSurfaceVariant: '#98989D',    // Secondary text (iOS)
    onBackground: '#FFFFFF',

    // UI elements
    outline: '#38383A',             // Dividers/borders
    outlineVariant: '#48484A',      // Subtle borders
    shadow: '#000000',

    // Gradient colors for premium effects
    gradients: {
      primary: ['#FF375F', '#FF6B8A'],
      secondary: ['#00D4FF', '#5CE1E6'],
      tertiary: ['#FFD60A', '#FFE55C'],
      dark: ['#000000', '#1C1C1E'],
      card: ['#1C1C1E', '#2C2C2E'],
    },

    // Chart colors - Vibrant, distinct
    chart: {
      heartRate: '#FF375F',         // Primary red
      spO2: '#00D4FF',              // Cyan
      battery: '#30D158',           // Green
      accelerometer: '#FFD60A',     // Yellow
      trend: '#BF5AF2',             // Purple (Apple)
    },

    // Zone colors (heart rate zones)
    zones: {
      resting: '#30D158',           // Green
      fatBurn: '#FFD60A',           // Yellow
      cardio: '#FF9F0A',            // Orange
      peak: '#FF375F',              // Red
    },
  },

  // Typography - San Francisco inspired
  typography: {
    // Display (hero numbers, large metrics)
    displayLarge: {
      fontSize: 96,
      fontWeight: '700' as const,
      letterSpacing: -1.5,
    },
    displayMedium: {
      fontSize: 64,
      fontWeight: '700' as const,
      letterSpacing: -0.5,
    },
    displaySmall: {
      fontSize: 48,
      fontWeight: '700' as const,
      letterSpacing: 0,
    },

    // Headings
    headlineLarge: {
      fontSize: 34,
      fontWeight: '700' as const,
      letterSpacing: 0.25,
    },
    headlineMedium: {
      fontSize: 28,
      fontWeight: '600' as const,
      letterSpacing: 0,
    },
    headlineSmall: {
      fontSize: 22,
      fontWeight: '600' as const,
      letterSpacing: 0,
    },

    // Body text
    bodyLarge: {
      fontSize: 17,
      fontWeight: '400' as const,
      letterSpacing: 0.5,
      lineHeight: 24,
    },
    bodyMedium: {
      fontSize: 15,
      fontWeight: '400' as const,
      letterSpacing: 0.25,
      lineHeight: 22,
    },
    bodySmall: {
      fontSize: 13,
      fontWeight: '400' as const,
      letterSpacing: 0.4,
      lineHeight: 18,
    },

    // Labels
    labelLarge: {
      fontSize: 15,
      fontWeight: '600' as const,
      letterSpacing: 0.1,
    },
    labelMedium: {
      fontSize: 13,
      fontWeight: '600' as const,
      letterSpacing: 0.5,
    },
    labelSmall: {
      fontSize: 11,
      fontWeight: '600' as const,
      letterSpacing: 0.5,
    },
  },

  // Spacing system (8pt grid)
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },

  // Border radius
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    round: 999,
  },

  // Shadows and elevation
  elevation: {
    none: {
      elevation: 0,
      shadowOpacity: 0,
    },
    sm: {
      elevation: 2,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.18,
      shadowRadius: 1.5,
    },
    md: {
      elevation: 4,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
    },
    lg: {
      elevation: 8,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.30,
      shadowRadius: 8,
    },
  },

  // Animation durations
  animation: {
    fast: 150,
    normal: 250,
    slow: 350,
  },
};

export type PremiumTheme = typeof premiumTheme;
