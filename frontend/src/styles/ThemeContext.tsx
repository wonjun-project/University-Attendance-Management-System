import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { ThemeProvider as StyledThemeProvider } from 'styled-components';
import { Theme, ThemeMode, getTheme, lightTheme } from './theme';
import GlobalStyle from './GlobalStyle';

interface ThemeContextType {
  theme: Theme;
  mode: ThemeMode;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [mode, setMode] = useState<ThemeMode>(() => {
    // 로컬 스토리지에서 저장된 테마 모드 확인
    const savedMode = localStorage.getItem('theme-mode') as ThemeMode;
    
    // 저장된 테마가 있으면 사용, 없으면 시스템 설정 확인
    if (savedMode === 'light' || savedMode === 'dark') {
      return savedMode;
    }
    
    // 시스템 다크모드 설정 확인
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    
    return 'light';
  });

  const [theme, setCurrentTheme] = useState<Theme>(() => getTheme(mode));

  // 테마 모드가 변경될 때마다 테마 업데이트
  useEffect(() => {
    setCurrentTheme(getTheme(mode));
    localStorage.setItem('theme-mode', mode);
    
    // body에 테마 모드 클래스 추가 (Ant Design 다크모드 지원용)
    document.body.className = document.body.className.replace(/(light|dark)-theme/g, '');
    document.body.classList.add(`${mode}-theme`);
  }, [mode]);

  // 시스템 테마 변경 감지
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      const savedMode = localStorage.getItem('theme-mode');
      
      // 사용자가 명시적으로 설정한 테마가 없을 때만 시스템 테마 따라가기
      if (!savedMode) {
        setMode(e.matches ? 'dark' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const toggleTheme = () => {
    setMode(prev => prev === 'light' ? 'dark' : 'light');
  };

  const setTheme = (newMode: ThemeMode) => {
    setMode(newMode);
  };

  const value: ThemeContextType = {
    theme,
    mode,
    toggleTheme,
    setTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      <StyledThemeProvider theme={theme}>
        <GlobalStyle theme={theme} />
        {children}
      </StyledThemeProvider>
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export default ThemeProvider;