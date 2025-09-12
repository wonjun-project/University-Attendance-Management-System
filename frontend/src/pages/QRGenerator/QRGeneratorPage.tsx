import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Form, 
  Select, 
  DatePicker, 
  Input, 
  Button, 
  Space, 
  Typography, 
  Alert, 
  Spin, 
  Row, 
  Col,
  Tag,
  Divider,
  Steps,
  Modal,
  message,
  Switch,
  Statistic,
  Progress
} from 'antd';
import { 
  QrcodeOutlined, 
  ClockCircleOutlined, 
  CheckCircleOutlined,
  WarningOutlined,
  CopyOutlined,
  DownloadOutlined,
  EyeOutlined
} from '@ant-design/icons';
import { useAuth } from '../../store/AuthContext';
import { apiClient } from '../../services/api';
import dayjs from 'dayjs';
import styled from 'styled-components';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

// 스타일드 컴포넌트
const QRGeneratorContainer = styled.div`
  .qr-display-card {
    text-align: center;
    padding: 32px;
    border: 2px dashed #d9d9d9;
    border-radius: 12px;
    background: #fafafa;
    transition: all 0.3s ease;

    &.active {
      border-color: #52c41a;
      background: #f6ffed;
    }

    &.expired {
      border-color: #ff4d4f;
      background: #fff2f0;
    }
  }

  .qr-code-image {
    max-width: 100%;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .session-info-card {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;

    .ant-card-body {
      padding: 24px;
    }

    .ant-statistic-title {
      color: rgba(255, 255, 255, 0.8) !important;
    }

    .ant-statistic-content {
      color: white !important;
    }
  }

  .step-container {
    margin-bottom: 32px;
  }

  .action-buttons {
    display: flex;
    gap: 12px;
    justify-content: center;
    flex-wrap: wrap;
    margin-top: 24px;
  }
`;

interface Course {
  id: string;
  name: string;
  course_code: string;
}

interface SessionData {
  id: string;
  courseName: string;
  sessionDate: string;
  authCode: string;
  expiresAt: string;
  isActive: boolean;
}

const QRGeneratorPage: React.FC = () => {
  const { user } = useAuth();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [currentSession, setCurrentSession] = useState<SessionData | null>(null);
  const [qrCodeImage, setQrCodeImage] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [previewModal, setPreviewModal] = useState(false);

  // 강의 목록 로드
  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    try {
      const coursesData = await apiClient.getCourses();
      setCourses(coursesData);
    } catch (error) {
      console.error('강의 목록 로드 실패:', error);
      message.error('강의 목록을 불러올 수 없습니다.');
    }
  };

  // 세션 생성
  const createSession = async (values: any) => {
    try {
      setLoading(true);
      
      const sessionData = {
        courseId: values.courseId,
        sessionDate: values.sessionDate.format('YYYY-MM-DD'),
        authCode: values.authCode
      };

      const session = await apiClient.createAttendanceSession(sessionData);
      
      setCurrentSession({
        id: session.id,
        courseName: courses.find(c => c.id === values.courseId)?.name || '',
        sessionDate: session.session_date,
        authCode: session.auth_code,
        expiresAt: session.qr_expires_at,
        isActive: session.is_active
      });
      setCurrentStep(1);
      message.success('출석 세션이 생성되었습니다.');
    } catch (error: any) {
      console.error('세션 생성 실패:', error);
      message.error(error.response?.data?.error?.message || '세션 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // QR 코드 생성
  const generateQRCode = async () => {
    if (!currentSession) return;

    try {
      setLoading(true);
      
      const result = await apiClient.generateQRCode(currentSession.id, { width: 300, height: 300 });
      
      setQrCodeImage(result.qrCodeImage);
      setCurrentStep(2);
      message.success('QR 코드가 생성되었습니다.');
    } catch (error: any) {
      console.error('QR 코드 생성 실패:', error);
      message.error(error.response?.data?.error?.message || 'QR 코드 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 세션 활성화/비활성화
  const toggleSession = async () => {
    if (!currentSession) return;

    try {
      setLoading(true);
      
      await apiClient.activateSession(currentSession.id, !currentSession.isActive);
      
      setCurrentSession({
        ...currentSession,
        isActive: !currentSession.isActive
      });
      message.success(`세션이 ${!currentSession.isActive ? '활성화' : '비활성화'}되었습니다.`);
    } catch (error: any) {
      console.error('세션 상태 변경 실패:', error);
      message.error('세션 상태 변경에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // QR 코드 다운로드
  const downloadQRCode = () => {
    if (!qrCodeImage) return;

    const link = document.createElement('a');
    link.href = qrCodeImage;
    link.download = `QR_${currentSession?.courseName}_${currentSession?.sessionDate}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 인증 코드 복사
  const copyAuthCode = () => {
    if (!currentSession) return;

    navigator.clipboard.writeText(currentSession.authCode);
    message.success('인증 코드가 클립보드에 복사되었습니다.');
  };

  // 만료 시간까지 남은 시간 계산
  const getTimeRemaining = () => {
    if (!currentSession) return 0;
    
    const now = new Date();
    const expires = new Date(currentSession.expiresAt);
    const diff = expires.getTime() - now.getTime();
    
    return Math.max(0, Math.floor(diff / (1000 * 60))); // 분 단위
  };

  // 진행 단계 정의
  const steps = [
    {
      title: '세션 생성',
      description: '강의와 날짜를 선택하여 출석 세션을 생성합니다.',
      icon: <ClockCircleOutlined />
    },
    {
      title: 'QR 코드 생성',
      description: 'QR 코드를 생성하고 화면에 표시합니다.',
      icon: <QrcodeOutlined />
    },
    {
      title: '출석 관리',
      description: '세션을 활성화하고 학생들의 출석을 관리합니다.',
      icon: <CheckCircleOutlined />
    }
  ];

  const timeRemaining = getTimeRemaining();
  const progressPercent = currentSession ? Math.max(0, (timeRemaining / 40) * 100) : 0;

  return (
    <QRGeneratorContainer>
      <Row gutter={[24, 24]}>
        <Col xs={24}>
          <Card>
            <Title level={2} style={{ marginBottom: 8 }}>
              📱 QR 코드 생성기
            </Title>
            <Paragraph type="secondary">
              출석용 QR 코드를 생성하고 관리하세요. 생성된 QR 코드는 40분간 유효합니다.
            </Paragraph>
            
            <div className="step-container">
              <Steps current={currentStep} size="small">
                {steps.map((step, index) => (
                  <Steps.Step
                    key={index}
                    title={step.title}
                    description={step.description}
                    icon={step.icon}
                  />
                ))}
              </Steps>
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="📝 세션 생성" loading={loading}>
            {currentStep === 0 && (
              <Form
                form={form}
                layout="vertical"
                onFinish={createSession}
                initialValues={{
                  sessionDate: dayjs(),
                  authCode: Math.floor(1000 + Math.random() * 9000).toString()
                }}
              >
                <Form.Item
                  name="courseId"
                  label="강의 선택"
                  rules={[{ required: true, message: '강의를 선택해주세요.' }]}
                >
                  <Select placeholder="강의를 선택하세요" size="large">
                    {courses.map(course => (
                      <Option key={course.id} value={course.id}>
                        <Space>
                          <Tag color="blue">{course.course_code}</Tag>
                          {course.name}
                        </Space>
                      </Option>
                    ))}
                  </Select>
                </Form.Item>

                <Form.Item
                  name="sessionDate"
                  label="세션 날짜"
                  rules={[{ required: true, message: '날짜를 선택해주세요.' }]}
                >
                  <DatePicker 
                    style={{ width: '100%' }} 
                    size="large"
                    format="YYYY-MM-DD"
                  />
                </Form.Item>

                <Form.Item
                  name="authCode"
                  label="인증 코드 (선택)"
                  extra="비워두면 자동으로 생성됩니다"
                >
                  <Input 
                    placeholder="4자리 숫자" 
                    maxLength={4} 
                    size="large"
                  />
                </Form.Item>

                <Form.Item>
                  <Button 
                    type="primary" 
                    htmlType="submit" 
                    size="large" 
                    block
                    icon={<ClockCircleOutlined />}
                  >
                    세션 생성
                  </Button>
                </Form.Item>
              </Form>
            )}

            {currentStep >= 1 && currentSession && (
              <div>
                <Alert
                  message="세션이 생성되었습니다!"
                  description={`${currentSession.courseName} - ${currentSession.sessionDate}`}
                  type="success"
                  showIcon
                  style={{ marginBottom: 16 }}
                />

                <Space direction="vertical" style={{ width: '100%' }}>
                  <div>
                    <Text strong>인증 코드: </Text>
                    <Tag color="blue" style={{ fontSize: '16px', padding: '4px 8px' }}>
                      {currentSession.authCode}
                    </Tag>
                    <Button 
                      type="text" 
                      icon={<CopyOutlined />} 
                      onClick={copyAuthCode}
                      size="small"
                    />
                  </div>

                  <div>
                    <Text strong>만료 시간: </Text>
                    <Text type={timeRemaining < 10 ? 'danger' : 'secondary'}>
                      {timeRemaining}분 남음
                    </Text>
                  </div>

                  <Progress 
                    percent={progressPercent}
                    status={timeRemaining < 10 ? 'exception' : 'active'}
                    showInfo={false}
                    strokeColor={timeRemaining < 10 ? '#ff4d4f' : '#52c41a'}
                  />
                </Space>

                {currentStep === 1 && (
                  <Button 
                    type="primary" 
                    onClick={generateQRCode}
                    size="large" 
                    block
                    icon={<QrcodeOutlined />}
                    style={{ marginTop: 16 }}
                  >
                    QR 코드 생성
                  </Button>
                )}
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="📱 QR 코드 표시" loading={loading}>
            {!qrCodeImage ? (
              <div className="qr-display-card">
                <QrcodeOutlined style={{ fontSize: '64px', color: '#d9d9d9', marginBottom: '16px' }} />
                <Text type="secondary">QR 코드가 여기에 표시됩니다</Text>
              </div>
            ) : (
              <div className={`qr-display-card ${currentSession?.isActive ? 'active' : ''}`}>
                <img 
                  src={qrCodeImage} 
                  alt="QR Code" 
                  className="qr-code-image"
                />
                
                <div className="action-buttons">
                  <Button 
                    icon={<EyeOutlined />} 
                    onClick={() => setPreviewModal(true)}
                  >
                    미리보기
                  </Button>
                  <Button 
                    icon={<DownloadOutlined />} 
                    onClick={downloadQRCode}
                  >
                    다운로드
                  </Button>
                </div>

                {currentSession && (
                  <div style={{ marginTop: '16px' }}>
                    <Space>
                      <Switch 
                        checked={currentSession.isActive}
                        onChange={toggleSession}
                        loading={loading}
                      />
                      <Text strong>
                        {currentSession.isActive ? '활성화됨' : '비활성화됨'}
                      </Text>
                      {currentSession.isActive ? (
                        <CheckCircleOutlined style={{ color: '#52c41a' }} />
                      ) : (
                        <WarningOutlined style={{ color: '#faad14' }} />
                      )}
                    </Space>
                  </div>
                )}
              </div>
            )}
          </Card>
        </Col>

        {currentSession && timeRemaining > 0 && (
          <Col xs={24}>
            <Card className="session-info-card">
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={8}>
                  <Statistic
                    title="현재 세션"
                    value={currentSession.courseName}
                    valueStyle={{ color: 'white' }}
                  />
                </Col>
                <Col xs={24} sm={8}>
                  <Statistic
                    title="인증 코드"
                    value={currentSession.authCode}
                    valueStyle={{ color: 'white', fontFamily: 'monospace' }}
                  />
                </Col>
                <Col xs={24} sm={8}>
                  <Statistic
                    title="남은 시간"
                    value={timeRemaining}
                    suffix="분"
                    valueStyle={{ color: timeRemaining < 10 ? '#ff7875' : 'white' }}
                  />
                </Col>
              </Row>
            </Card>
          </Col>
        )}
      </Row>

      {/* QR 코드 미리보기 모달 */}
      <Modal
        title="QR 코드 미리보기"
        open={previewModal}
        onCancel={() => setPreviewModal(false)}
        footer={[
          <Button key="download" icon={<DownloadOutlined />} onClick={downloadQRCode}>
            다운로드
          </Button>,
          <Button key="close" onClick={() => setPreviewModal(false)}>
            닫기
          </Button>
        ]}
        width={400}
      >
        {qrCodeImage && (
          <div style={{ textAlign: 'center' }}>
            <img 
              src={qrCodeImage} 
              alt="QR Code Preview" 
              style={{ maxWidth: '100%', borderRadius: '8px' }}
            />
            {currentSession && (
              <div style={{ marginTop: '16px' }}>
                <Text strong>{currentSession.courseName}</Text>
                <br />
                <Text type="secondary">{currentSession.sessionDate}</Text>
                <br />
                <Tag color="blue">인증코드: {currentSession.authCode}</Tag>
              </div>
            )}
          </div>
        )}
      </Modal>
    </QRGeneratorContainer>
  );
};

export default QRGeneratorPage;