import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuth } from '../../store/AuthContext';
import MainLayout from '../Layout/MainLayout';
import LoginPage from '../../pages/Login/LoginPage';
import RegisterPage from '../../pages/Register/RegisterPage';
import DashboardPage from '../../pages/Dashboard/DashboardPage';
import QRGeneratorPage from '../../pages/QRGenerator/QRGeneratorPage';
import QRScanPage from '../../pages/AttendanceCheck/QRScanPage';
import GPSVerificationPage from '../../pages/AttendanceCheck/GPSVerificationPage';
import AttendanceRecordsPage from '../../pages/Student/AttendanceRecordsPage';
import MyCoursesPage from '../../pages/Student/MyCoursesPage';
import LocationTestPage from '../../pages/Student/LocationTestPage';
import AttendanceSessionsPage from '../../pages/Professor/AttendanceSessionsPage';
import AttendanceStatisticsPage from '../../pages/Professor/AttendanceStatisticsPage';
import CoursesManagePage from '../../pages/Professor/CoursesManagePage';
import MyPage from '../../pages/MyPage/MyPage';

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
  const { isAuthenticated, isLoading, user } = useAuth();

  // 무한 루프 방지: 로딩 상태에서는 스피너만 표시
  if (isLoading) {
    return <LoadingSpinner />;
  }

  // 무한 루프 방지: 인증되지 않은 사용자만 리디렉션
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  return <MainLayout>{children}</MainLayout>;
};

// 인증된 사용자는 접근할 수 없는 라우트 (로그인, 회원가입)
interface PublicOnlyRouteProps {
  children: React.ReactNode;
}

const PublicOnlyRoute: React.FC<PublicOnlyRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading, user } = useAuth();

  // 무한 루프 방지: 로딩 상태에서는 스피너만 표시
  if (isLoading) {
    return <LoadingSpinner />;
  }

  // 무한 루프 방지: 완전히 인증된 사용자만 리디렉션
  if (isAuthenticated && user) {
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

  // 무한 루프 방지: 로딩 상태에서는 스피너만 표시
  if (isLoading) {
    return <LoadingSpinner />;
  }

  // 무한 루프 방지: 인증되지 않은 사용자 체크
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // 무한 루프 방지: 권한이 없는 사용자만 리디렉션
  if (!allowedRoles.includes(user.role)) {
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

// 메인 라우터 컴포넌트 - 임시로 단순화
const AppRouter: React.FC = () => {
  return (
    <Routes>
      {/* 단계적 테스트: 실제 LoginPage 활성화 */}
      <Route 
        path="/login" 
        element={
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        }
      />
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/my-page" 
        element={
          <ProtectedRoute>
            <MyPage />
          </ProtectedRoute>
        } 
      />

      {/* 학생용 라우트 */}
      <Route 
        path="/attendance/scan" 
        element={
          <RoleProtectedRoute allowedRoles={['student']}>
            <QRScanPage />
          </RoleProtectedRoute>
        } 
      />
      <Route 
        path="/attendance/records" 
        element={
          <RoleProtectedRoute allowedRoles={['student']}>
            <AttendanceRecordsPage />
          </RoleProtectedRoute>
        } 
      />
      <Route 
        path="/my-courses" 
        element={
          <RoleProtectedRoute allowedRoles={['student']}>
            <MyCoursesPage />
          </RoleProtectedRoute>
        } 
      />
      <Route 
        path="/location-test" 
        element={
          <RoleProtectedRoute allowedRoles={['student']}>
            <LocationTestPage />
          </RoleProtectedRoute>
        } 
      />

      {/* 교수용 라우트 */}
      <Route 
        path="/qr-generator" 
        element={
          <RoleProtectedRoute allowedRoles={['professor']}>
            <QRGeneratorPage />
          </RoleProtectedRoute>
        } 
      />
      <Route 
        path="/attendance/sessions" 
        element={
          <RoleProtectedRoute allowedRoles={['professor']}>
            <AttendanceSessionsPage />
          </RoleProtectedRoute>
        } 
      />
      <Route 
        path="/statistics" 
        element={
          <RoleProtectedRoute allowedRoles={['professor']}>
            <AttendanceStatisticsPage />
          </RoleProtectedRoute>
        } 
      />
      <Route 
        path="/courses" 
        element={
          <RoleProtectedRoute allowedRoles={['professor']}>
            <CoursesManagePage />
          </RoleProtectedRoute>
        } 
      />

      {/* 회원가입 라우트 */}
      <Route 
        path="/register" 
        element={
          <PublicOnlyRoute>
            <RegisterPage />
          </PublicOnlyRoute>
        } 
      />
      
      {/* 기본 라우트 */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route 
        path="*" 
        element={
          <div style={{ padding: '50px', textAlign: 'center' }}>
            <h1>❌ 404 - 페이지를 찾을 수 없습니다</h1>
            <p>무한 루프 테스트 중...</p>
          </div>
        } 
      />
    </Routes>
  );
};

export default AppRouter;