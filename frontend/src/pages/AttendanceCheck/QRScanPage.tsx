import React, { useState, useEffect, useRef } from 'react';
import { 
  Card, 
  Button, 
  Typography, 
  Alert, 
  Space, 
  Row, 
  Col, 
  Steps,
  Input,
  Form,
  Modal,
  message,
  Tag,
  Divider,
  Progress
} from 'antd';
import { 
  QrcodeOutlined,
  CameraOutlined,
  CheckCircleOutlined,
  EnvironmentOutlined,
  KeyOutlined,
  ReloadOutlined,
  StopOutlined
} from '@ant-design/icons';
import QrScanner from 'qr-scanner';
import { useAuth } from '../../store/AuthContext';
import { apiClient } from '../../services/api';
import styled from 'styled-components';

const { Title, Text, Paragraph } = Typography;

// 스타일드 컴포넌트
const QRScanContainer = styled.div`
  .qr-reader-container {
    width: 100%;
    max-width: 400px;
    margin: 0 auto;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  }

  .scan-overlay {
    position: relative;
    
    &::before {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: 200px;
      height: 200px;
      margin: -100px 0 0 -100px;
      border: 2px solid #1890ff;
      border-radius: 12px;
      z-index: 10;
      pointer-events: none;
    }

    &::after {
      content: 'QR 코드를 스캔 영역에 맞춰주세요';
      position: absolute;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 12px;
      z-index: 10;
      white-space: nowrap;
    }
  }

  .step-content {
    text-align: center;
    padding: 24px;
  }

  .manual-input-section {
    margin-top: 24px;
    padding: 16px;
    background: #f8f9fa;
    border-radius: 8px;
    text-align: center;
  }

  .success-animation {
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.05); }
    100% { transform: scale(1); }
  }

  .course-info-card {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    margin-bottom: 24px;

    .ant-card-body {
      text-align: center;
    }
  }
`;

interface AttendanceCheckData {
  recordId: string;
  sessionId: string;
  courseInfo: {
    id: string;
    name: string;
    gpsLocation?: {
      latitude: number;
      longitude: number;
      radius: number;
    };
  };
  authCode: string;
  authExpiresAt: string;
  nextStep: string;
}

const QRScanPage: React.FC = () => {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [attendanceData, setAttendanceData] = useState<AttendanceCheckData | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // QR 코드 스캔 성공
  const handleScan = async (result: any) => {
    if (result && !loading) {
      await processQRCode(result.text);
    }
  };

  // QR 코드 스캔 에러
  const handleError = (error: any) => {
    console.error('QR 스캔 에러:', error);
    setCameraError('카메라에 접근할 수 없습니다. 수동 입력을 사용해주세요.');
    setShowManualInput(true);
  };

  // QR 코드 처리
  const processQRCode = async (qrCode: string) => {
    try {
      setLoading(true);
      setScanning(false);

      const response = await apiClient.checkAttendance(qrCode);
      
      setAttendanceData(response);
      setCurrentStep(1);
      message.success('QR 코드 스캔이 완료되었습니다!');
      
      // GPS 인증이 필요한 경우 자동으로 다음 단계로
      if (response.nextStep === 'gps_verification') {
        setTimeout(() => {
          setCurrentStep(2);
        }, 1000);
      }

    } catch (error: any) {
      console.error('QR 코드 처리 실패:', error);
      const errorMessage = error.response?.data?.error?.message || 'QR 코드 처리에 실패했습니다.';
      message.error(errorMessage);
      
      // 실패 시 다시 스캔할 수 있도록
      setTimeout(() => {
        setScanning(true);
      }, 2000);
    } finally {
      setLoading(false);
    }
  };

  // 수동 QR 코드 입력
  const handleManualSubmit = async () => {
    if (!manualCode.trim()) {
      message.error('QR 코드를 입력해주세요.');
      return;
    }

    await processQRCode(manualCode.trim());
  };

  // 카메라 시작
  const startCamera = () => {
    setScanning(true);
    setCameraError(null);
    setShowManualInput(false);
  };

  // 카메라 중지
  const stopCamera = () => {
    setScanning(false);
  };

  // 초기화
  const resetScan = () => {
    setCurrentStep(0);
    setAttendanceData(null);
    setManualCode('');
    setScanning(false);
    setCameraError(null);
    setShowManualInput(false);
  };

  const steps = [
    {
      title: 'QR 스캔',
      description: 'QR 코드를 스캔하거나 수동으로 입력하세요.',
      icon: <QrcodeOutlined />
    },
    {
      title: '스캔 완료',
      description: 'QR 코드 스캔이 완료되었습니다.',
      icon: <CheckCircleOutlined />
    },
    {
      title: 'GPS 인증',
      description: 'GPS 위치 인증이 필요합니다.',
      icon: <EnvironmentOutlined />
    }
  ];

  return (
    <QRScanContainer>
      <Row gutter={[24, 24]}>
        <Col xs={24}>
          <Card>
            <Title level={2} style={{ marginBottom: 8 }}>
              📱 출석 체크
            </Title>
            <Paragraph type="secondary">
              QR 코드를 스캔하여 출석을 체크하세요. GPS 인증과 인증 코드 입력이 추가로 필요합니다.
            </Paragraph>
            
            <Steps current={currentStep} size="small" style={{ marginBottom: 24 }}>
              {steps.map((step, index) => (
                <Steps.Step
                  key={index}
                  title={step.title}
                  description={step.description}
                  icon={step.icon}
                />
              ))}
            </Steps>
          </Card>
        </Col>

        {attendanceData && (
          <Col xs={24}>
            <Card className="course-info-card">
              <Title level={3} style={{ color: 'white', marginBottom: 16 }}>
                {attendanceData.courseInfo.name}
              </Title>
              <Space size="large">
                <div>
                  <Text style={{ color: 'rgba(255,255,255,0.8)' }}>인증 코드</Text>
                  <br />
                  <Tag color="gold" style={{ fontSize: '18px', padding: '4px 12px' }}>
                    {attendanceData.authCode}
                  </Tag>
                </div>
                <div>
                  <Text style={{ color: 'rgba(255,255,255,0.8)' }}>다음 단계</Text>
                  <br />
                  <Text style={{ color: 'white', fontSize: '16px' }}>
                    {attendanceData.nextStep === 'gps_verification' ? 'GPS 인증' : '인증 완료'}
                  </Text>
                </div>
              </Space>
            </Card>
          </Col>
        )}

        <Col xs={24} lg={12}>
          <Card title="📷 QR 코드 스캔" loading={loading}>
            {currentStep === 0 && (
              <div className="step-content">
                {!scanning && !cameraError ? (
                  <div>
                    <QrcodeOutlined style={{ fontSize: '64px', color: '#1890ff', marginBottom: '16px' }} />
                    <br />
                    <Button 
                      type="primary" 
                      size="large" 
                      icon={<CameraOutlined />}
                      onClick={startCamera}
                      block
                    >
                      카메라 시작
                    </Button>
                  </div>
                ) : scanning && !cameraError ? (
                  <div>
                    <div className="qr-reader-container">
                      <div style={{ padding: '20px', textAlign: 'center' }}>
                        <video
                          ref={videoRef}
                          style={{ width: '100%', height: '300px', border: '1px solid #d9d9d9' }}
                          autoPlay
                          playsInline
                        />
                        <div style={{ marginTop: '16px' }}>
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                // QR 코드 파일 처리 로직 (임시)
                                handleScan({ text: 'demo-qr-code' });
                              }
                            }}
                            style={{ display: 'none' }}
                            id="qr-upload"
                          />
                          <label htmlFor="qr-upload">
                            <Button icon={<CameraOutlined />}>
                              QR 코드 스캔
                            </Button>
                          </label>
                        </div>
                      </div>
                    </div>
                    <Space style={{ marginTop: 16 }}>
                      <Button 
                        icon={<StopOutlined />} 
                        onClick={stopCamera}
                      >
                        중지
                      </Button>
                      <Button 
                        icon={<KeyOutlined />}
                        onClick={() => setShowManualInput(true)}
                      >
                        수동 입력
                      </Button>
                    </Space>
                  </div>
                ) : (
                  <div>
                    <Alert
                      message="카메라 오류"
                      description={cameraError}
                      type="warning"
                      showIcon
                      style={{ marginBottom: 16 }}
                    />
                    <Button 
                      type="primary" 
                      icon={<ReloadOutlined />}
                      onClick={startCamera}
                      style={{ marginRight: 8 }}
                    >
                      다시 시도
                    </Button>
                    <Button 
                      icon={<KeyOutlined />}
                      onClick={() => setShowManualInput(true)}
                    >
                      수동 입력
                    </Button>
                  </div>
                )}

                {/* 수동 입력 섹션 */}
                {showManualInput && (
                  <div className="manual-input-section">
                    <Divider>수동 입력</Divider>
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Text type="secondary">
                        QR 코드 내용을 직접 입력하거나 붙여넣기 하세요
                      </Text>
                      <Input.TextArea
                        placeholder="QR 코드 내용을 입력하세요"
                        value={manualCode}
                        onChange={(e) => setManualCode(e.target.value)}
                        rows={3}
                      />
                      <Button 
                        type="primary" 
                        onClick={handleManualSubmit}
                        disabled={!manualCode.trim()}
                        block
                      >
                        확인
                      </Button>
                    </Space>
                  </div>
                )}
              </div>
            )}

            {currentStep === 1 && (
              <div className="step-content success-animation">
                <CheckCircleOutlined 
                  style={{ 
                    fontSize: '64px', 
                    color: '#52c41a', 
                    marginBottom: '16px' 
                  }} 
                />
                <br />
                <Title level={4} style={{ color: '#52c41a' }}>
                  QR 코드 스캔 완료!
                </Title>
                <Text>GPS 인증을 진행합니다...</Text>
              </div>
            )}

            {currentStep >= 2 && (
              <div className="step-content">
                <EnvironmentOutlined 
                  style={{ 
                    fontSize: '64px', 
                    color: '#1890ff', 
                    marginBottom: '16px' 
                  }} 
                />
                <br />
                <Title level={4}>GPS 위치 인증</Title>
                <Text type="secondary">
                  GPS 위치 확인이 필요합니다. 다음 단계에서 위치 인증을 진행해주세요.
                </Text>
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="ℹ️ 출석 체크 안내">
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Alert
                message="출석 체크 3단계"
                description="QR 스캔 → GPS 인증 → 인증 코드 입력"
                type="info"
                showIcon
              />
              
              <div>
                <Title level={5}>📱 QR 스캔 방법</Title>
                <ul style={{ paddingLeft: '20px' }}>
                  <li>강의실 화면의 QR 코드에 카메라를 맞춰주세요</li>
                  <li>QR 코드가 스캔 영역에 들어오도록 조정하세요</li>
                  <li>스캔이 안 될 경우 수동 입력을 사용하세요</li>
                </ul>
              </div>

              <div>
                <Title level={5}>🌍 GPS 인증</Title>
                <ul style={{ paddingLeft: '20px' }}>
                  <li>강의실 내에서만 출석 체크가 가능합니다</li>
                  <li>위치 정보 권한을 허용해주세요</li>
                  <li>실내에서는 GPS 정확도가 떨어질 수 있습니다</li>
                </ul>
              </div>

              <div>
                <Title level={5}>🔑 인증 코드</Title>
                <ul style={{ paddingLeft: '20px' }}>
                  <li>교수님이 칠판에 적어주신 4자리 코드를 입력하세요</li>
                  <li>수업 시작 후 70분 이내에 입력해야 합니다</li>
                  <li>잘못된 코드 입력 시 출석이 인정되지 않습니다</li>
                </ul>
              </div>

              {currentStep > 0 && (
                <Button 
                  type="default" 
                  icon={<ReloadOutlined />}
                  onClick={resetScan}
                  block
                >
                  처음부터 다시 시작
                </Button>
              )}
            </Space>
          </Card>
        </Col>
      </Row>
    </QRScanContainer>
  );
};

export default QRScanPage;