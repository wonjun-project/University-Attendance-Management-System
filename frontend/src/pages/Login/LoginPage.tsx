import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Card, Typography, Divider, Alert, Space } from 'antd';
import { UserOutlined, LockOutlined, BookOutlined } from '@ant-design/icons';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import styled from 'styled-components';

const { Title, Text } = Typography;

// 스타일드 컴포넌트
const LoginContainer = styled.div`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
`;

const LoginCard = styled(Card)`
  width: 100%;
  max-width: 400px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  border-radius: 12px;
  border: none;
`;

const LogoSection = styled.div`
  text-align: center;
  margin-bottom: 32px;
`;

const LogoIcon = styled.div`
  font-size: 48px;
  color: #1890ff;
  margin-bottom: 16px;
`;

const StyledForm = styled(Form)`
  .ant-form-item-label > label {
    font-weight: 500;
  }
`;

const LoginButton = styled(Button)`
  width: 100%;
  height: 48px;
  font-size: 16px;
  font-weight: 500;
  border-radius: 8px;
`;

const RegisterLink = styled.div`
  text-align: center;
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid #f0f0f0;
`;

const DemoSection = styled.div`
  margin-top: 24px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
`;

interface LoginFormValues {
  email: string;
  password: string;
}

const LoginPage: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { login, isAuthenticated, error, clearError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // 이미 로그인된 경우 대시보드로 리다이렉트
  useEffect(() => {
    if (isAuthenticated) {
      const from = (location.state as any)?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location]);

  // 에러 클리어 (컴포넌트 마운트 시)
  useEffect(() => {
    clearError();
    return () => clearError(); // cleanup
  }, [clearError]);

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
      <LoginCard>
        <LogoSection>
          <LogoIcon>
            <BookOutlined />
          </LogoIcon>
          <Title level={2} style={{ marginBottom: 8, color: '#1890ff' }}>
            대학 출결관리시스템
          </Title>
          <Text type="secondary">
            QR 코드와 GPS를 활용한 스마트 출석 체크
          </Text>
        </LogoSection>

        {error && (
          <Alert
            message="로그인 실패"
            description={error}
            type="error"
            showIcon
            closable
            onClose={clearError}
            style={{ marginBottom: 24 }}
          />
        )}

        <StyledForm
          form={form}
          name="login"
          onFinish={handleLogin}
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
              placeholder="이메일을 입력하세요"
              style={{ borderRadius: '8px' }}
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
              style={{ borderRadius: '8px' }}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 16 }}>
            <LoginButton type="primary" htmlType="submit" loading={loading}>
              로그인
            </LoginButton>
          </Form.Item>
        </StyledForm>

        {/* 데모 계정 섹션 */}
        <DemoSection>
          <Text strong style={{ display: 'block', marginBottom: 12, color: '#666' }}>
            🎯 데모 계정으로 체험하기
          </Text>
          <Space size="middle" style={{ width: '100%', justifyContent: 'center' }}>
            <Button 
              size="small" 
              onClick={() => handleDemoLogin('student')}
              style={{ borderRadius: '6px' }}
            >
              학생 계정
            </Button>
            <Button 
              size="small" 
              onClick={() => handleDemoLogin('professor')}
              style={{ borderRadius: '6px' }}
            >
              교수 계정
            </Button>
          </Space>
          <Text type="secondary" style={{ fontSize: '12px', display: 'block', textAlign: 'center', marginTop: '8px' }}>
            * 데모용 계정으로 모든 기능을 체험할 수 있습니다.
          </Text>
        </DemoSection>

        <RegisterLink>
          <Text type="secondary">
            계정이 없으신가요?{' '}
            <Link to="/register" style={{ color: '#1890ff', fontWeight: 500 }}>
              회원가입
            </Link>
          </Text>
        </RegisterLink>
      </LoginCard>
    </LoginContainer>
  );
};

export default LoginPage;