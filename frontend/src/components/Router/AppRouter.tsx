import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuth } from '../../store/AuthContext';
import MainLayout from '../Layout/MainLayout';
import LoginPage from '../../pages/Login/LoginPage';
import RegisterPage from '../../pages/Register/RegisterPage';
import DashboardPage from '../../pages/Dashboard/DashboardPage';

// 로딩 컴포넌트
const LoadingSpinner: React.FC = () => (
  <div style={{ 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    height: '100vh' 
  }}>
    <Spin size="large" />
  </div>
);

// 인증이 필요한 라우트를 보호하는 컴포넌트
interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <MainLayout>{children}</MainLayout>;
};

// 인증된 사용자는 접근할 수 없는 라우트 (로그인, 회원가입)
interface PublicOnlyRouteProps {
  children: React.ReactNode;
}

const PublicOnlyRoute: React.FC<PublicOnlyRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

// 역할 기반 라우트 보호 컴포넌트
interface RoleProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: ('student' | 'professor')[];
}

const RoleProtectedRoute: React.FC<RoleProtectedRouteProps> = ({ 
  children, 
  allowedRoles 
}) => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!user || !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <MainLayout>{children}</MainLayout>;
};

// 임시 페이지 컴포넌트들 (나중에 실제 컴포넌트로 교체)
const PlaceholderPage: React.FC<{ title: string; description: string }> = ({ title, description }) => (
  <div style={{ textAlign: 'center', padding: '50px' }}>
    <h2>{title}</h2>
    <p style={{ color: '#666', marginTop: '16px' }}>{description}</p>
    <p style={{ color: '#999', marginTop: '24px' }}>이 페이지는 곧 구현될 예정입니다.</p>
  </div>
);

// 메인 라우터 컴포넌트
const AppRouter: React.FC = () => {
  return (
    <Routes>
      {/* 공용 라우트 (인증 불필요) */}
      <Route 
        path="/login" 
        element={
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        } 
      />
      <Route 
        path="/register" 
        element={
          <PublicOnlyRoute>
            <RegisterPage />
          </PublicOnlyRoute>
        } 
      />

      {/* 인증이 필요한 공통 라우트 */}
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/profile" 
        element={
          <ProtectedRoute>
            <PlaceholderPage title="프로필" description="사용자 프로필 관리 페이지입니다." />
          </ProtectedRoute>
        } 
      />

      {/* 교수 전용 라우트 */}
      <Route 
        path="/courses" 
        element={
          <RoleProtectedRoute allowedRoles={['professor']}>
            <PlaceholderPage title="강의 관리" description="강의를 생성하고 관리하는 페이지입니다." />
          </RoleProtectedRoute>
        } 
      />
      <Route 
        path="/courses/:courseId" 
        element={
          <ProtectedRoute>
            <PlaceholderPage title="강의 상세" description="강의 상세 정보 페이지입니다." />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/attendance/sessions" 
        element={
          <RoleProtectedRoute allowedRoles={['professor']}>
            <PlaceholderPage title="출석 세션 관리" description="출석 세션을 관리하는 페이지입니다." />
          </RoleProtectedRoute>
        } 
      />
      <Route 
        path="/qr-generator" 
        element={
          <RoleProtectedRoute allowedRoles={['professor']}>
            <PlaceholderPage title="QR 코드 생성" description="출석용 QR 코드를 생성하는 페이지입니다." />
          </RoleProtectedRoute>
        } 
      />
      <Route 
        path="/statistics" 
        element={
          <RoleProtectedRoute allowedRoles={['professor']}>
            <PlaceholderPage title="출석 통계" description="강의별 출석 통계를 보는 페이지입니다." />
          </RoleProtectedRoute>
        } 
      />

      {/* 학생 전용 라우트 */}
      <Route 
        path="/my-courses" 
        element={
          <RoleProtectedRoute allowedRoles={['student']}>
            <PlaceholderPage title="수강 강의" description="수강 중인 강의 목록 페이지입니다." />
          </RoleProtectedRoute>
        } 
      />
      <Route 
        path="/attendance/scan" 
        element={
          <RoleProtectedRoute allowedRoles={['student']}>
            <PlaceholderPage title="출석 체크" description="QR 코드를 스캔하여 출석을 체크하는 페이지입니다." />
          </RoleProtectedRoute>
        } 
      />
      <Route 
        path="/attendance/records" 
        element={
          <RoleProtectedRoute allowedRoles={['student']}>
            <PlaceholderPage title="출석 현황" description="나의 출석 기록을 확인하는 페이지입니다." />
          </RoleProtectedRoute>
        } 
      />
      <Route 
        path="/location-test" 
        element={
          <RoleProtectedRoute allowedRoles={['student']}>
            <PlaceholderPage title="위치 테스트" description="GPS 위치를 확인하는 페이지입니다." />
          </RoleProtectedRoute>
        } 
      />

      {/* 404 및 기본 라우트 */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route 
        path="*" 
        element={
          <div style={{ 
            textAlign: 'center', 
            padding: '100px 20px',
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <h1 style={{ fontSize: '48px', marginBottom: '16px' }}>404</h1>
            <h2 style={{ marginBottom: '16px' }}>페이지를 찾을 수 없습니다</h2>
            <p style={{ color: '#666', marginBottom: '32px' }}>
              요청하신 페이지가 존재하지 않거나 이동되었을 수 있습니다.
            </p>
            <button 
              onClick={() => window.location.href = '/dashboard'}
              style={{
                padding: '12px 24px',
                backgroundColor: '#1890ff',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              대시보드로 돌아가기
            </button>
          </div>
        } 
      />
    </Routes>
  );
};

export default AppRouter;