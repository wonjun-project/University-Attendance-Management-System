export interface Theme {
  colors: {
    primary: {
      50: string;
      100: string;
      500: string;
      600: string;
      900: string;
    };
    gray: {
      50: string;
      100: string;
      200: string;
      300: string;
      400: string;
      500: string;
      600: string;
      700: string;
      800: string;
      900: string;
    };
    semantic: {
      success: string;
      warning: string;
      error: string;
      info: string;
    };
    background: {
      primary: string;
      secondary: string;
      elevated: string;
    };
    text: {
      primary: string;
      secondary: string;
      disabled: string;
      inverse: string;
    };
    border: {
      light: string;
      medium: string;
      strong: string;
    };
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    '2xl': string;
    '3xl': string;
  };
  borderRadius: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
    full: string;
  };
  typography: {
    fontFamily: {
      sans: string;
      mono: string;
    };
    fontSize: {
      xs: string;
      sm: string;
      base: string;
      lg: string;
      xl: string;
      '2xl': string;
      '3xl': string;
    };
    fontWeight: {
      normal: number;
      medium: number;
      semibold: number;
      bold: number;
    };
    lineHeight: {
      tight: number;
      normal: number;
      relaxed: number;
    };
  };
  shadows: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  transitions: {
    fast: string;
    normal: string;
    slow: string;
  };
  zIndex: {
    dropdown: number;
    sticky: number;
    fixed: number;
    modal: number;
    popover: number;
    tooltip: number;
  };
  breakpoints: {
    mobile: string;
    tablet: string;
    desktop: string;
  };
}

export const lightTheme: Theme = {
  colors: {
    // Telegram 스타일 블루 팔레트
    primary: {
      50: '#E3F2FD',
      100: '#BBDEFB', 
      500: '#2196F3', // Telegram 메인 블루
      600: '#1976D2',
      900: '#0D47A1',
    },
    // 그레이스케일 단순화 (Telegram 스타일)
    gray: {
      50: '#FAFAFA',
      100: '#F5F5F5',
      200: '#EEEEEE',
      300: '#E0E0E0',
      400: '#BDBDBD',
      500: '#9E9E9E',
      600: '#757575',
      700: '#616161',
      800: '#424242',
      900: '#212121',
    },
    // 시맨틱 컬러 단순화
    semantic: {
      success: '#4CAF50', // 연한 초록
      warning: '#FF9800', // 오렌지
      error: '#F44336',   // 빨강
      info: '#2196F3',    // 블루
    },
    // 배경 단순화
    background: {
      primary: '#FFFFFF',
      secondary: '#FAFAFA',
      elevated: '#FFFFFF',
    },
    // 텍스트 컬러 단순화
    text: {
      primary: '#212121',
      secondary: '#757575',
      disabled: '#BDBDBD',
      inverse: '#FFFFFF',
    },
    // 보더 단순화
    border: {
      light: '#F5F5F5',
      medium: '#E0E0E0',
      strong: '#BDBDBD',
    },
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    '2xl': '48px',
    '3xl': '64px',
  },
  // Telegram 스타일: 둥근 모서리 단순화
  borderRadius: {
    sm: '6px',    // 작은 요소
    md: '8px',    // 기본 요소
    lg: '12px',   // 카드
    xl: '16px',   // 큰 카드
    full: '50px', // 원형 (아바타 등)
  },
  typography: {
    fontFamily: {
      // Telegram 스타일 폰트 (시스템 폰트 우선)
      sans: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Roboto, "Noto Sans KR", sans-serif',
      mono: 'SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace',
    },
    // 폰트 사이즈 단순화 (Telegram 스타일)
    fontSize: {
      xs: '12px',   // 캡션
      sm: '14px',   // 보조 텍스트
      base: '16px', // 기본 텍스트
      lg: '17px',   // 제목
      xl: '20px',   // 큰 제목
      '2xl': '24px', // 페이지 제목
      '3xl': '28px', // 로고
    },
    // 폰트 굵기 단순화
    fontWeight: {
      normal: 400,    // 일반 텍스트
      medium: 500,    // 강조 텍스트
      semibold: 600,  // 제목
      bold: 700,      // 중요 제목
    },
    // 행간 단순화
    lineHeight: {
      tight: 1.3,   // 제목용
      normal: 1.5,  // 본문용
      relaxed: 1.6, // 긴 텍스트용
    },
  },
  // Telegram 스타일: 그림자 최소화
  shadows: {
    sm: 'none',
    md: '0 1px 3px rgba(0, 0, 0, 0.12)', // 아주 미묘한 그림자만
    lg: '0 2px 8px rgba(0, 0, 0, 0.15)', // 모달용 그림자만
    xl: '0 4px 16px rgba(0, 0, 0, 0.15)', // 중요한 요소만
  },
  transitions: {
    fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
    normal: '250ms cubic-bezier(0.4, 0, 0.2, 1)',
    slow: '350ms cubic-bezier(0.4, 0, 0.2, 1)',
  },
  zIndex: {
    dropdown: 1000,
    sticky: 1020,
    fixed: 1030,
    modal: 1050,
    popover: 1060,
    tooltip: 1070,
  },
  breakpoints: {
    mobile: '768px',
    tablet: '1024px',
    desktop: '1280px',
  },
};

export const darkTheme: Theme = {
  ...lightTheme,
  colors: {
    primary: {
      50: '#1E1B3A',
      100: '#2D2A4A',
      500: '#7C6EF7',
      600: '#8B7EF8',
      900: '#E0D9FF',
    },
    gray: {
      50: '#0A0A0B',
      100: '#171717',
      200: '#262626',
      300: '#404040',
      400: '#525252',
      500: '#737373',
      600: '#A3A3A3',
      700: '#D4D4D4',
      800: '#E5E5E5',
      900: '#F5F5F5',
    },
    semantic: {
      success: '#34D399',
      warning: '#FBBF24',
      error: '#F87171',
      info: '#60A5FA',
    },
    background: {
      primary: '#0A0A0B',
      secondary: '#171717',
      elevated: '#262626',
    },
    text: {
      primary: '#F5F5F5',
      secondary: '#A3A3A3',
      disabled: '#525252',
      inverse: '#0A0A0B',
    },
    border: {
      light: '#262626',
      medium: '#404040',
      strong: '#525252',
    },
  },
};

export type ThemeMode = 'light' | 'dark';

export const getTheme = (mode: ThemeMode): Theme => {
  return mode === 'dark' ? darkTheme : lightTheme;
};

export default lightTheme;