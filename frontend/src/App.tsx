import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { ConfigProvider, App as AntApp, theme as antdTheme } from 'antd';
import koKR from 'antd/locale/ko_KR';
import { AuthProvider } from './store/AuthContext';
import { ThemeProvider, useTheme } from './styles/ThemeContext';
import AppRouter from './components/Router/AppRouter';
import './App.css';

// Ant Design 테마 생성 함수
const createAntdTheme = (mode: 'light' | 'dark', customTheme: any) => ({
  algorithm: mode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
  token: {
    colorPrimary: customTheme.colors.primary[500],
    colorSuccess: customTheme.colors.semantic.success,
    colorWarning: customTheme.colors.semantic.warning,
    colorError: customTheme.colors.semantic.error,
    colorInfo: customTheme.colors.semantic.info,
    borderRadius: parseInt(customTheme.borderRadius.md),
    fontFamily: customTheme.typography.fontFamily.sans,
    fontSize: parseInt(customTheme.typography.fontSize.base),
    // 다크모드 배경 색상 커스텀
    colorBgContainer: mode === 'dark' ? customTheme.colors.background.elevated : customTheme.colors.background.primary,
    colorBgElevated: mode === 'dark' ? customTheme.colors.background.primary : customTheme.colors.background.elevated,
  },
  components: {
    Button: {
      borderRadius: parseInt(customTheme.borderRadius.lg),
      controlHeight: 48,
      fontSize: parseInt(customTheme.typography.fontSize.base),
      fontWeight: customTheme.typography.fontWeight.medium,
    },
    Card: {
      borderRadius: parseInt(customTheme.borderRadius.xl),
      boxShadow: customTheme.shadows.md,
    },
    Input: {
      borderRadius: parseInt(customTheme.borderRadius.lg),
      controlHeight: 52,
      fontSize: parseInt(customTheme.typography.fontSize.base),
    },
    Select: {
      borderRadius: parseInt(customTheme.borderRadius.lg),
      controlHeight: 52,
    },
    Form: {
      itemMarginBottom: parseInt(customTheme.spacing.lg),
      labelFontSize: parseInt(customTheme.typography.fontSize.sm),
      labelColor: mode === 'dark' ? customTheme.colors.text.primary : customTheme.colors.text.primary,
    },
    Alert: {
      borderRadius: parseInt(customTheme.borderRadius.lg),
    },
    Drawer: {
      borderRadius: parseInt(customTheme.borderRadius.lg),
    },
  },
});

// AppContent 컴포넌트 (테마 컨텍스트 사용)
const AppContent: React.FC = () => {
  const { theme, mode } = useTheme();
  const antdThemeConfig = createAntdTheme(mode, theme);

  return (
    <ConfigProvider locale={koKR} theme={antdThemeConfig}>
      <AntApp>
        <Router>
          <AuthProvider>
            <div className="App">
              <AppRouter />
            </div>
          </AuthProvider>
        </Router>
      </AntApp>
    </ConfigProvider>
  );
};

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;
