// Simple navigation types for the current mock navigation setup

export interface SimpleNavigation {
  navigate: (routeName: string) => void;
  goBack: () => void;
  canGoBack: () => boolean;
}

export interface SimpleRoute {
  name: string;
  key: string;
  params?: any;
}

export interface SimpleNavigationProps {
  navigation: SimpleNavigation;
  route: SimpleRoute;
}

// Specific screen props types
export interface HeartRateScreenProps extends SimpleNavigationProps {}

export interface TrendsScreenProps extends SimpleNavigationProps {}