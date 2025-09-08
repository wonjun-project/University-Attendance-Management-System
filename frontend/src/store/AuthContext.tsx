import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { apiClient, UserProfile } from '../services/api';

// 상태 타입 정의
interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// 액션 타입 정의
type AuthAction =
  | { type: 'AUTH_START' }
  | { type: 'AUTH_SUCCESS'; payload: UserProfile }
  | { type: 'AUTH_FAILURE'; payload: string }
  | { type: 'LOGOUT' }
  | { type: 'CLEAR_ERROR' }
  | { type: 'UPDATE_USER'; payload: Partial<UserProfile> };

// 초기 상태
const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: true, // 앱 시작 시 토큰 확인을 위해 true로 시작
  error: null,
};

// 리듀서 함수
const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'AUTH_START':
      return {
        ...state,
        isLoading: true,
        error: null,
      };
    case 'AUTH_SUCCESS':
      return {
        ...state,
        user: action.payload,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };
    case 'AUTH_FAILURE':
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: action.payload,
      };
    case 'LOGOUT':
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      };
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };
    case 'UPDATE_USER':
      return {
        ...state,
        user: state.user ? { ...state.user, ...action.payload } : null,
      };
    default:
      return state;
  }
};

// Context 타입 정의
interface AuthContextType {
  // 상태
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // 액션
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    confirmPassword: string;
    name: string;
    role: 'student' | 'professor';
    studentId?: string;
    phone?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  checkAuth: () => Promise<void>;
}

// Context 생성
const AuthContext = createContext<AuthContextType | null>(null);

// Provider 컴포넌트
interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // 앱 시작 시 인증 상태 확인
  useEffect(() => {
    checkAuth();
  }, []);

  // 인증 상태 확인
  const checkAuth = async (): Promise<void> => {
    try {
      dispatch({ type: 'AUTH_START' });

      // 로컬 스토리지에서 저장된 사용자 정보 확인
      const storedUser = apiClient.getStoredUserProfile();
      
      if (storedUser && apiClient.isAuthenticated()) {
        // 서버에서 최신 사용자 정보 가져오기
        try {
          const currentUser = await apiClient.getCurrentUser();
          dispatch({ type: 'AUTH_SUCCESS', payload: currentUser });
        } catch (error) {
          // 토큰이 만료되었거나 유효하지 않은 경우
          console.warn('사용자 정보 가져오기 실패:', error);
          dispatch({ type: 'LOGOUT' });
        }
      } else {
        dispatch({ type: 'LOGOUT' });
      }
    } catch (error) {
      console.error('인증 상태 확인 중 오류:', error);
      dispatch({ type: 'LOGOUT' });
    }
  };

  // 로그인
  const login = async (email: string, password: string): Promise<void> => {
    try {
      dispatch({ type: 'AUTH_START' });
      const result = await apiClient.login({ email, password });
      dispatch({ type: 'AUTH_SUCCESS', payload: result.user });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '로그인에 실패했습니다.';
      dispatch({ type: 'AUTH_FAILURE', payload: errorMessage });
      throw error;
    }
  };

  // 회원가입
  const register = async (data: {
    email: string;
    password: string;
    confirmPassword: string;
    name: string;
    role: 'student' | 'professor';
    studentId?: string;
    phone?: string;
  }): Promise<void> => {
    try {
      dispatch({ type: 'AUTH_START' });
      const result = await apiClient.register(data);
      dispatch({ type: 'AUTH_SUCCESS', payload: result.user });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '회원가입에 실패했습니다.';
      dispatch({ type: 'AUTH_FAILURE', payload: errorMessage });
      throw error;
    }
  };

  // 로그아웃
  const logout = async (): Promise<void> => {
    try {
      await apiClient.logout();
    } catch (error) {
      console.error('로그아웃 중 오류:', error);
    } finally {
      dispatch({ type: 'LOGOUT' });
    }
  };

  // 에러 클리어
  const clearError = (): void => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  const value: AuthContextType = {
    user: state.user,
    isAuthenticated: state.isAuthenticated,
    isLoading: state.isLoading,
    error: state.error,
    login,
    register,
    logout,
    clearError,
    checkAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Hook for using auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};