import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Alert, Space, Typography } from 'antd';
import { UserOutlined, LockOutlined, MoonOutlined, SunOutlined } from '@ant-design/icons';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { useTheme } from '../../styles/ThemeContext';
import styled from 'styled-components';

const { Title, Text } = Typography;

// 모바일 퍼스트 스타일드 컴포넌트
const LoginContainer = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: ${({ theme }) => theme.colors.background.primary};
  position: relative;
  
  @media (min-width: ${({ theme }) => theme.breakpoints.tablet}) {
    align-items: center;
    justify-content: center;
    padding: ${({ theme }) => theme.spacing.lg};
  }
`;

const ThemeToggle = styled.button`
  position: absolute;
  top: ${({ theme }) => theme.spacing.lg};
  right: ${({ theme }) => theme.spacing.lg};
  width: 48px;
  height: 48px;
  border-radius: ${({ theme }) => theme.borderRadius.full};
  background: ${({ theme }) => theme.colors.background.elevated};
  border: 1px solid ${({ theme }) => theme.colors.border.light};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
  color: ${({ theme }) => theme.colors.text.secondary};
  box-shadow: ${({ theme }) => theme.shadows.sm};
  transition: all ${({ theme }) => theme.transitions.fast};
  z-index: 10;
  
  &:hover {
    background: ${({ theme }) => theme.colors.primary[50]};
    color: ${({ theme }) => theme.colors.primary[500]};
    transform: translateY(-1px);
    box-shadow: ${({ theme }) => theme.shadows.md};
  }
  
  &:active {
    transform: translateY(0);
  }
`;

const LoginContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.spacing.lg};
  max-width: 100%;
  
  @media (min-width: ${({ theme }) => theme.breakpoints.tablet}) {
    max-width: 400px;
    background: ${({ theme }) => theme.colors.background.elevated};
    border-radius: ${({ theme }) => theme.borderRadius.xl};
    box-shadow: ${({ theme }) => theme.shadows.lg};
    border: 1px solid ${({ theme }) => theme.colors.border.light};
  }
`;

const LogoSection = styled.div`
  text-align: center;
  margin-bottom: ${({ theme }) => theme.spacing['2xl']};
`;

const LogoText = styled.div`
  font-size: ${({ theme }) => theme.typography.fontSize['2xl']};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  color: ${({ theme }) => theme.colors.primary[500]};
  margin-bottom: ${({ theme }) => theme.spacing.sm};
  
  @media (min-width: ${({ theme }) => theme.breakpoints.tablet}) {
    font-size: ${({ theme }) => theme.typography.fontSize['3xl']};
  }
`;

const LogoSubtext = styled.div`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.text.secondary};
  line-height: ${({ theme }) => theme.typography.lineHeight.relaxed};
`;

const StyledForm = styled(Form)`
  .ant-form-item {
    margin-bottom: ${({ theme }) => theme.spacing.lg};
  }
  
  .ant-form-item-label > label {
    font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
    color: ${({ theme }) => theme.colors.text.primary};
    font-size: ${({ theme }) => theme.typography.fontSize.sm};
  }
  
  .ant-input, .ant-input-password {
    height: 52px;
    border-radius: ${({ theme }) => theme.borderRadius.lg};
    border: 1px solid ${({ theme }) => theme.colors.border.medium};
    font-size: ${({ theme }) => theme.typography.fontSize.base};
    
    &:focus, &:focus-within {
      border-color: ${({ theme }) => theme.colors.primary[500]};
      box-shadow: 0 0 0 3px ${({ theme }) => theme.colors.primary[500]}20;
    }
  }
  
  .ant-input-prefix {
    color: ${({ theme }) => theme.colors.text.secondary};
    margin-right: ${({ theme }) => theme.spacing.sm};
  }
`;

const LoginButton = styled(Button)`
  width: 100%;
  height: 52px;
  font-size: ${({ theme }) => theme.typography.fontSize.base};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  background: ${({ theme }) => theme.colors.primary[500]};
  border: none;
  box-shadow: ${({ theme }) => theme.shadows.sm};
  transition: all ${({ theme }) => theme.transitions.fast};
  
  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.primary[600]} !important;
    transform: translateY(-1px);
    box-shadow: ${({ theme }) => theme.shadows.md};
  }
  
  &:active {
    transform: translateY(0);
  }
`;

const DemoSection = styled.div`
  margin-top: ${({ theme }) => theme.spacing.xl};
  padding: ${({ theme }) => theme.spacing.lg};
  background: ${({ theme }) => theme.colors.background.secondary};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  border: 1px solid ${({ theme }) => theme.colors.border.light};
`;

const DemoGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-top: ${({ theme }) => theme.spacing.sm};
`;

const DemoButton = styled(Button)`
  height: 40px;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  border: 1px solid ${({ theme }) => theme.colors.border.medium};
  transition: all ${({ theme }) => theme.transitions.fast};
  
  &:hover {
    border-color: ${({ theme }) => theme.colors.primary[500]};
    color: ${({ theme }) => theme.colors.primary[500]};
  }
`;

const RegisterLink = styled.div`
  text-align: center;
  margin-top: ${({ theme }) => theme.spacing.xl};
  padding-top: ${({ theme }) => theme.spacing.lg};
  border-top: 1px solid ${({ theme }) => theme.colors.border.light};
  
  a {
    color: ${({ theme }) => theme.colors.primary[500]};
    font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
    text-decoration: none;
    
    &:hover {
      color: ${({ theme }) => theme.colors.primary[600]};
      text-decoration: underline;
    }
  }
`;

interface LoginFormValues {
  email: string;
  password: string;
}

const LoginPage: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { login, isAuthenticated, error, clearError } = useAuth();
  const { mode, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  // 이미 로그인된 경우 대시보드로 리다이렉트 - 무한 루프 방지
  useEffect(() => {
    if (isAuthenticated) {
      const from = (location.state as any)?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated]); // navigate, location 의존성 제거

  // 에러 클리어 (컴포넌트 마운트 시) - 무한 루프 방지
  useEffect(() => {
    clearError();
    // cleanup 제거로 무한 루프 방지
  }, []); // clearError 의존성 제거

  // 로그인 처리
  const handleLogin = async (values: LoginFormValues) => {
    try {
      setLoading(true);
      await login(values.email, values.password);
      // 인증 성공 시 useEffect에서 리다이렉트 처리
    } catch (error) {
      // 에러는 AuthContext에서 처리됨
      console.error('로그인 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  // 데모 계정 로그인
  const handleDemoLogin = (role: 'student' | 'professor') => {
    const demoCredentials = {
      student: { email: 'student1@university.ac.kr', password: 'password123' },
      professor: { email: 'professor1@university.ac.kr', password: 'password123' }
    };

    form.setFieldsValue(demoCredentials[role]);
  };

  return (
    <LoginContainer>
      <ThemeToggle onClick={toggleTheme} type="button">
        {mode === 'light' ? <MoonOutlined /> : <SunOutlined />}
      </ThemeToggle>
      
      <LoginContent>
        <LogoSection>
          <LogoText>
            출결체크
          </LogoText>
          <LogoSubtext>
            스마트 출석 관리 시스템
          </LogoSubtext>
        </LogoSection>

        {error && (
          <Alert
            message="로그인 실패"
            description={error}
            type="error"
            showIcon
            closable
            onClose={clearError}
            style={{ 
              marginBottom: '24px',
              borderRadius: '12px',
              border: 'none'
            }}
          />
        )}

        <StyledForm
          form={form}
          name="login"
          onFinish={handleLogin as any}
          autoComplete="off"
          size="large"
        >
          <Form.Item
            name="email"
            label="이메일"
            rules={[
              { required: true, message: '이메일을 입력해주세요.' },
              { type: 'email', message: '올바른 이메일 형식을 입력해주세요.' }
            ]}
          >
            <Input 
              prefix={<UserOutlined />} 
              placeholder="student@university.ac.kr"
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="password"
            label="비밀번호"
            rules={[
              { required: true, message: '비밀번호를 입력해주세요.' },
              { min: 8, message: '비밀번호는 8자 이상이어야 합니다.' }
            ]}
          >
            <Input.Password 
              prefix={<LockOutlined />} 
              placeholder="비밀번호를 입력하세요"
              size="large"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <LoginButton type="primary" htmlType="submit" loading={loading}>
              로그인
            </LoginButton>
          </Form.Item>
        </StyledForm>

        <DemoSection>
          <Text strong style={{ 
            display: 'block', 
            marginBottom: '12px', 
            fontSize: '14px',
            textAlign: 'center'
          }}>
            🎯 데모 계정으로 체험하기
          </Text>
          <DemoGrid>
            <DemoButton 
              onClick={() => handleDemoLogin('student')}
            >
              학생 계정
            </DemoButton>
            <DemoButton 
              onClick={() => handleDemoLogin('professor')}
            >
              교수 계정
            </DemoButton>
          </DemoGrid>
          <Text 
            type="secondary" 
            style={{ 
              fontSize: '12px', 
              display: 'block', 
              textAlign: 'center', 
              marginTop: '12px',
              lineHeight: '1.4'
            }}
          >
            데모용 계정으로 모든 기능을 체험할 수 있습니다.
          </Text>
        </DemoSection>

        <RegisterLink>
          <Text type="secondary">
            계정이 없으신가요?{' '}
            <Link to="/register">
              회원가입
            </Link>
          </Text>
        </RegisterLink>
      </LoginContent>
    </LoginContainer>
  );
};

export default LoginPage;