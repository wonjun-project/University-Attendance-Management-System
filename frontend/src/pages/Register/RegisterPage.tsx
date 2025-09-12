import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Card, Typography, Radio, Alert, Space, Steps } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined, PhoneOutlined, IdcardOutlined, BookOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import styled from 'styled-components';

const { Title, Text } = Typography;

// 스타일드 컴포넌트
const RegisterContainer = styled.div`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
`;

const RegisterCard = styled(Card)`
  width: 100%;
  max-width: 500px;
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

const RegisterButton = styled(Button)`
  width: 100%;
  height: 48px;
  font-size: 16px;
  font-weight: 500;
  border-radius: 8px;
`;

const LoginLink = styled.div`
  text-align: center;
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid #f0f0f0;
`;

const RoleSection = styled.div`
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 24px;
`;

interface RegisterFormValues {
  email: string;
  password: string;
  confirmPassword: string;
  name: string;
  role: 'student' | 'professor';
  studentId?: string;
  phone?: string;
}

const RegisterPage: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'student' | 'professor'>('student');
  const { register, isAuthenticated, error, clearError } = useAuth();
  const navigate = useNavigate();

  // 이미 로그인된 경우 대시보드로 리다이렉트
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated]); // navigate 의존성 제거

  // 에러 클리어 (컴포넌트 마운트 시)
  useEffect(() => {
    clearError();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 역할 변경 핸들러
  const handleRoleChange = (role: 'student' | 'professor') => {
    setSelectedRole(role);
    // 학번 필드 클리어
    if (role === 'professor') {
      form.setFieldValue('studentId', undefined);
    }
  };

  // 회원가입 처리
  const handleRegister = async (values: RegisterFormValues) => {
    try {
      setLoading(true);
      await register(values);
      // 가입 성공 시 useEffect에서 리다이렉트 처리
    } catch (error) {
      console.error('회원가입 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <RegisterContainer>
      <RegisterCard>
        <LogoSection>
          <LogoIcon>
            <BookOutlined />
          </LogoIcon>
          <Title level={2} style={{ marginBottom: 8, color: '#1890ff' }}>
            회원가입
          </Title>
          <Text type="secondary">
            대학 출결관리시스템에 오신 것을 환영합니다
          </Text>
        </LogoSection>

        {error && (
          <Alert
            message="회원가입 실패"
            description={error}
            type="error"
            showIcon
            closable
            onClose={clearError}
            style={{ marginBottom: 24 }}
          />
        )}

        <RoleSection>
          <Text strong style={{ display: 'block', marginBottom: 12 }}>
            계정 유형을 선택해주세요
          </Text>
          <Radio.Group
            value={selectedRole}
            onChange={(e) => handleRoleChange(e.target.value)}
            size="large"
          >
            <Space direction="vertical">
              <Radio value="student">
                <Space>
                  <UserOutlined />
                  <span>
                    <strong>학생</strong> - 출석 체크 및 출석 현황 조회
                  </span>
                </Space>
              </Radio>
              <Radio value="professor">
                <Space>
                  <BookOutlined />
                  <span>
                    <strong>교수</strong> - 강의 관리 및 출석 관리
                  </span>
                </Space>
              </Radio>
            </Space>
          </Radio.Group>
        </RoleSection>

        <StyledForm
          form={form}
          name="register"
          onFinish={handleRegister as any}
          autoComplete="off"
          size="large"
          scrollToFirstError
        >
          <Form.Item
            name="role"
            initialValue={selectedRole}
            hidden
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="name"
            label="이름"
            rules={[
              { required: true, message: '이름을 입력해주세요.' },
              { min: 2, message: '이름은 2자 이상이어야 합니다.' },
              { pattern: /^[가-힣a-zA-Z\s]+$/, message: '이름은 한글, 영문만 입력 가능합니다.' }
            ]}
          >
            <Input 
              prefix={<UserOutlined />} 
              placeholder="이름을 입력하세요"
              style={{ borderRadius: '8px' }}
            />
          </Form.Item>

          <Form.Item
            name="email"
            label="대학 이메일"
            rules={[
              { required: true, message: '이메일을 입력해주세요.' },
              { type: 'email', message: '올바른 이메일 형식을 입력해주세요.' },
              { 
                pattern: /@university\.ac\.kr$|@univ\.ac\.kr$/, 
                message: '대학 이메일 주소만 사용 가능합니다. (@university.ac.kr 또는 @univ.ac.kr)' 
              }
            ]}
          >
            <Input 
              prefix={<MailOutlined />} 
              placeholder="예: student@university.ac.kr"
              style={{ borderRadius: '8px' }}
            />
          </Form.Item>

          {selectedRole === 'student' && (
            <Form.Item
              name="studentId"
              label="학번"
              rules={[
                { required: true, message: '학번을 입력해주세요.' },
                { pattern: /^\d{7}$/, message: '학번은 7자리 숫자여야 합니다.' }
              ]}
            >
              <Input 
                prefix={<IdcardOutlined />} 
                placeholder="예: 2024001"
                maxLength={7}
                style={{ borderRadius: '8px' }}
              />
            </Form.Item>
          )}

          <Form.Item
            name="phone"
            label="휴대폰 번호 (선택)"
            rules={[
              { pattern: /^010-\d{4}-\d{4}$/, message: '휴대폰 번호는 010-0000-0000 형식으로 입력해주세요.' }
            ]}
          >
            <Input 
              prefix={<PhoneOutlined />} 
              placeholder="010-0000-0000"
              style={{ borderRadius: '8px' }}
            />
          </Form.Item>

          <Form.Item
            name="password"
            label="비밀번호"
            rules={[
              { required: true, message: '비밀번호를 입력해주세요.' },
              { min: 8, message: '비밀번호는 최소 8자 이상이어야 합니다.' },
              { 
                pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
                message: '비밀번호는 대문자, 소문자, 숫자, 특수문자를 포함해야 합니다.' 
              }
            ]}
            hasFeedback
          >
            <Input.Password 
              prefix={<LockOutlined />} 
              placeholder="비밀번호를 입력하세요"
              style={{ borderRadius: '8px' }}
            />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label="비밀번호 확인"
            dependencies={['password']}
            rules={[
              { required: true, message: '비밀번호 확인을 입력해주세요.' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('비밀번호가 일치하지 않습니다.'));
                },
              }),
            ]}
            hasFeedback
          >
            <Input.Password 
              prefix={<LockOutlined />} 
              placeholder="비밀번호를 다시 입력하세요"
              style={{ borderRadius: '8px' }}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 16 }}>
            <RegisterButton type="primary" htmlType="submit" loading={loading}>
              계정 생성
            </RegisterButton>
          </Form.Item>
        </StyledForm>

        <LoginLink>
          <Text type="secondary">
            이미 계정이 있으신가요?{' '}
            <Link to="/login" style={{ color: '#1890ff', fontWeight: 500 }}>
              로그인
            </Link>
          </Text>
        </LoginLink>
      </RegisterCard>
    </RegisterContainer>
  );
};

export default RegisterPage;