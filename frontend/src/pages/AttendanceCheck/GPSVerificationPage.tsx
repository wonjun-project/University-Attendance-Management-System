import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Button, 
  Typography, 
  Alert, 
  Space, 
  Row, 
  Col, 
  Steps,
  Statistic,
  Progress,
  Tag,
  Divider,
  Modal,
  Form,
  Input,
  message,
  Result
} from 'antd';
import { 
  EnvironmentOutlined,
  CheckCircleOutlined,
  LoadingOutlined,
  WarningOutlined,
  ReloadOutlined,
  KeyOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import { useAuth } from '../../store/AuthContext';
import { apiClient } from '../../services/api';
import styled from 'styled-components';

const { Title, Text, Paragraph } = Typography;

// 스타일드 컴포넌트
const GPSContainer = styled.div`
  .location-card {
    text-align: center;
    padding: 32px;
    border: 2px dashed #d9d9d9;
    border-radius: 12px;
    background: #fafafa;
    transition: all 0.3s ease;

    &.checking {
      border-color: #1890ff;
      background: #e6f7ff;
    }

    &.success {
      border-color: #52c41a;
      background: #f6ffed;
    }

    &.error {
      border-color: #ff4d4f;
      background: #fff2f0;
    }
  }

  .accuracy-badge {
    position: relative;
    display: inline-block;
    margin-bottom: 16px;
  }

  .distance-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin: 16px 0;
    padding: 12px;
    background: rgba(24, 144, 255, 0.1);
    border-radius: 8px;
  }

  .final-step-card {
    background: linear-gradient(135deg, #52c41a 0%, #73d13d 100%);
    color: white;
    border: none;

    .ant-card-body {
      text-align: center;
    }

    .ant-input {
      font-size: 24px;
      text-align: center;
      font-weight: bold;
      font-family: monospace;
    }
  }

  .completion-animation {
    animation: celebration 2s ease-in-out;
  }

  @keyframes celebration {
    0%, 100% { transform: scale(1) rotate(0deg); }
    25% { transform: scale(1.1) rotate(5deg); }
    75% { transform: scale(1.1) rotate(-5deg); }
  }
`;

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

interface AttendanceData {
  recordId: string;
  sessionId: string;
  courseInfo: {
    id: string;
    name: string;
  };
  authCode?: string;
  authExpiresAt?: string;
  locationVerification?: {
    distance: number;
    allowedRadius: number;
    accuracy?: number;
    recommendation: string;
  };
}

const GPSVerificationPage: React.FC = () => {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<LocationData | null>(null);
  const [attendanceData, setAttendanceData] = useState<AttendanceData | null>(null);
  const [geoWatchId, setGeoWatchId] = useState<number | null>(null);
  const [authCodeModal, setAuthCodeModal] = useState(false);
  const [authForm] = Form.useForm();
  const [completed, setCompleted] = useState(false);

  // 컴포넌트 언마운트 시 위치 추적 정리
  useEffect(() => {
    return () => {
      if (geoWatchId) {
        navigator.geolocation.clearWatch(geoWatchId);
      }
    };
  }, [geoWatchId]);

  // 위치 수집 시작
  const startLocationTracking = () => {
    if (!navigator.geolocation) {
      message.error('이 브라우저는 GPS 위치 기능을 지원하지 않습니다.');
      return;
    }

    setLoading(true);
    setCurrentStep(0);

    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    };

    const watchId = navigator.geolocation.watchPosition(
      handleLocationSuccess,
      handleLocationError,
      options
    );

    setGeoWatchId(watchId);
  };

  // 위치 수집 성공
  const handleLocationSuccess = (position: GeolocationPosition) => {
    const newLocation = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy
    };

    setLocation(newLocation);
    setLoading(false);
    setCurrentStep(1);
  };

  // 위치 수집 실패
  const handleLocationError = (error: GeolocationPositionError) => {
    setLoading(false);
    let errorMessage = '';

    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage = '위치 정보 접근이 거부되었습니다. 브라우저 설정에서 위치 권한을 허용해주세요.';
        break;
      case error.POSITION_UNAVAILABLE:
        errorMessage = '위치 정보를 사용할 수 없습니다. GPS가 활성화되어 있는지 확인해주세요.';
        break;
      case error.TIMEOUT:
        errorMessage = '위치 정보 요청 시간이 초과되었습니다. 다시 시도해주세요.';
        break;
      default:
        errorMessage = '알 수 없는 위치 오류가 발생했습니다.';
        break;
    }

    message.error(errorMessage);
  };

  // GPS 위치 검증
  const verifyLocation = async () => {
    if (!location || !attendanceData) return;

    try {
      setLoading(true);

      const response = await apiClient.verifyLocation({
        recordId: attendanceData.recordId,
        studentLatitude: location.latitude,
        studentLongitude: location.longitude,
        accuracy: location.accuracy
      });

      setAttendanceData({
        ...attendanceData,
        ...response
      });
      setCurrentStep(2);
      message.success('GPS 위치 인증이 완료되었습니다!');

    } catch (error: any) {
      console.error('GPS 검증 실패:', error);
      const errorData = error.response?.data;
      
      if (errorData?.data) {
        // 거리가 너무 멀어서 실패한 경우 상세 정보 표시
        Modal.error({
          title: 'GPS 위치 인증 실패',
          content: (
            <div>
              <p>{errorData.error.message}</p>
              <Divider />
              <Space direction="vertical">
                <Text><strong>현재 거리:</strong> {errorData.data.distance?.toFixed(1)}m</Text>
                <Text><strong>허용 반경:</strong> {errorData.data.allowedRadius}m</Text>
                {errorData.data.accuracy && (
                  <Text><strong>GPS 정확도:</strong> ±{errorData.data.accuracy}m</Text>
                )}
                <Text type="secondary">{errorData.data.recommendation}</Text>
              </Space>
            </div>
          ),
        });
      } else {
        message.error(errorData?.error?.message || 'GPS 위치 검증에 실패했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  // 인증 코드 제출
  const submitAuthCode = async (values: { authCode: string }) => {
    if (!attendanceData) return;

    try {
      setLoading(true);

      const response = await apiClient.verifyAuthCode({
        recordId: attendanceData.recordId,
        authCode: values.authCode
      });

      setCompleted(true);
      setAuthCodeModal(false);
      setCurrentStep(3);
      
      const status = response.status;
      const isLate = response.isLate;
        
      message.success(
        `출석 체크가 완료되었습니다! (${status === 'present' ? '출석' : '지각'})`
      );

    } catch (error: any) {
      console.error('인증 코드 검증 실패:', error);
      message.error(error.response?.data?.error?.message || '인증 코드 검증에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 정확도 등급별 색상
  const getAccuracyColor = (accuracy?: number) => {
    if (!accuracy) return 'default';
    if (accuracy <= 10) return 'success';
    if (accuracy <= 20) return 'processing';
    if (accuracy <= 50) return 'warning';
    return 'error';
  };

  // 정확도 등급별 텍스트
  const getAccuracyText = (accuracy?: number) => {
    if (!accuracy) return '알 수 없음';
    if (accuracy <= 10) return '매우 좋음';
    if (accuracy <= 20) return '좋음';
    if (accuracy <= 50) return '보통';
    return '나쁨';
  };

  const steps = [
    {
      title: 'GPS 수집',
      description: '현재 위치 정보를 수집합니다.',
      icon: <EnvironmentOutlined />
    },
    {
      title: '위치 확인',
      description: '수집된 위치를 검토합니다.',
      icon: <CheckCircleOutlined />
    },
    {
      title: '위치 인증',
      description: '강의실과의 거리를 검증합니다.',
      icon: <CheckCircleOutlined />
    },
    {
      title: '완료',
      description: '최종 인증 코드를 입력합니다.',
      icon: <KeyOutlined />
    }
  ];

  return (
    <GPSContainer>
      <Row gutter={[24, 24]}>
        <Col xs={24}>
          <Card>
            <Title level={2} style={{ marginBottom: 8 }}>
              🌍 GPS 위치 인증
            </Title>
            <Paragraph type="secondary">
              강의실 내에서 위치를 확인하여 출석을 인증합니다. 정확한 GPS 신호를 위해 창문 근처로 이동해주세요.
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

        <Col xs={24} lg={12}>
          <Card title="📍 위치 수집" loading={loading}>
            {currentStep === 0 && !location && (
              <div className="location-card">
                <EnvironmentOutlined style={{ fontSize: '64px', color: '#1890ff', marginBottom: '16px' }} />
                <br />
                <Title level={4}>GPS 위치 수집 시작</Title>
                <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
                  정확한 위치 측정을 위해 창문 근처로 이동해주세요
                </Text>
                <Button 
                  type="primary" 
                  size="large" 
                  icon={<EnvironmentOutlined />}
                  onClick={startLocationTracking}
                  block
                >
                  위치 수집 시작
                </Button>
              </div>
            )}

            {loading && (
              <div className="location-card checking">
                <LoadingOutlined style={{ fontSize: '64px', color: '#1890ff', marginBottom: '16px' }} />
                <br />
                <Title level={4}>위치 수집 중...</Title>
                <Text type="secondary">GPS 신호를 수집하고 있습니다</Text>
              </div>
            )}

            {location && currentStep === 1 && (
              <div className="location-card success">
                <CheckCircleOutlined style={{ fontSize: '64px', color: '#52c41a', marginBottom: '16px' }} />
                <br />
                <Title level={4}>위치 수집 완료</Title>
                
                <div className="accuracy-badge">
                  <Tag color={getAccuracyColor(location.accuracy)}>
                    정확도: {getAccuracyText(location.accuracy)}
                    {location.accuracy && ` (±${location.accuracy.toFixed(0)}m)`}
                  </Tag>
                </div>

                <Space direction="vertical" style={{ width: '100%', marginTop: 16 }}>
                  <Text type="secondary">위도: {location.latitude.toFixed(6)}</Text>
                  <Text type="secondary">경도: {location.longitude.toFixed(6)}</Text>
                </Space>

                <Button 
                  type="primary" 
                  size="large"
                  onClick={verifyLocation}
                  block
                  style={{ marginTop: 24 }}
                >
                  위치 인증 진행
                </Button>
              </div>
            )}

            {currentStep >= 2 && attendanceData?.locationVerification && (
              <div className="location-card success">
                <CheckCircleOutlined style={{ fontSize: '64px', color: '#52c41a', marginBottom: '16px' }} />
                <br />
                <Title level={4}>위치 인증 완료</Title>
                
                <div className="distance-info">
                  <div>
                    <Text strong>거리</Text>
                    <br />
                    <Text>{attendanceData.locationVerification.distance.toFixed(1)}m</Text>
                  </div>
                  <div>
                    <Text strong>허용반경</Text>
                    <br />
                    <Text>{attendanceData.locationVerification.allowedRadius}m</Text>
                  </div>
                </div>

                <Alert
                  message="위치 인증 성공"
                  description={attendanceData.locationVerification.recommendation}
                  type="success"
                  showIcon
                  style={{ marginTop: 16 }}
                />

                {!completed && (
                  <Button 
                    type="primary" 
                    size="large"
                    icon={<KeyOutlined />}
                    onClick={() => setAuthCodeModal(true)}
                    block
                    style={{ marginTop: 16 }}
                  >
                    인증 코드 입력
                  </Button>
                )}
              </div>
            )}

            {completed && (
              <div className="location-card success completion-animation">
                <CheckCircleOutlined style={{ fontSize: '64px', color: '#52c41a', marginBottom: '16px' }} />
                <br />
                <Title level={4} style={{ color: '#52c41a' }}>
                  출석 완료! 🎉
                </Title>
                <Text>모든 인증 단계가 완료되었습니다</Text>
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="ℹ️ GPS 인증 안내">
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Alert
                message="위치 인증 방법"
                description="강의실 내에서 GPS 위치를 확인하여 출석을 인증합니다"
                type="info"
                showIcon
              />
              
              <div>
                <Title level={5}>📍 정확한 위치 측정 방법</Title>
                <ul style={{ paddingLeft: '20px' }}>
                  <li>창문 근처나 실외로 이동해주세요</li>
                  <li>건물 내부보다는 GPS 신호가 잘 잡히는 곳으로</li>
                  <li>잠시 기다려 정확도가 향상될 때까지 대기</li>
                </ul>
              </div>

              <div>
                <Title level={5}>⚡ GPS 정확도 기준</Title>
                <Space direction="vertical">
                  <Tag color="success">매우 좋음 (±10m 이내)</Tag>
                  <Tag color="processing">좋음 (±20m 이내)</Tag>
                  <Tag color="warning">보통 (±50m 이내)</Tag>
                  <Tag color="error">나쁨 (±50m 초과)</Tag>
                </Space>
              </div>

              <div>
                <Title level={5}>🔧 문제 해결</Title>
                <ul style={{ paddingLeft: '20px' }}>
                  <li>위치 권한이 차단된 경우: 브라우저 설정에서 위치 권한 허용</li>
                  <li>GPS 신호가 약한 경우: 실외로 나가서 잠시 대기</li>
                  <li>정확도가 낮은 경우: 창문 근처로 이동 후 재시도</li>
                </ul>
              </div>
            </Space>
          </Card>

          {attendanceData && (
            <Card 
              title="📚 강의 정보" 
              style={{ marginTop: 16 }}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <Text strong>강의명</Text>
                  <br />
                  <Text>{attendanceData.courseInfo.name}</Text>
                </div>
                
                {attendanceData.authCode && (
                  <div>
                    <Text strong>인증 코드</Text>
                    <br />
                    <Tag color="blue" style={{ fontSize: '16px', padding: '4px 8px' }}>
                      {attendanceData.authCode}
                    </Tag>
                  </div>
                )}

                {attendanceData.authExpiresAt && (
                  <div>
                    <Text strong>코드 만료 시간</Text>
                    <br />
                    <Text type="secondary">
                      {new Date(attendanceData.authExpiresAt).toLocaleString()}
                    </Text>
                  </div>
                )}
              </Space>
            </Card>
          )}
        </Col>
      </Row>

      {/* 인증 코드 입력 모달 */}
      <Modal
        title="🔑 인증 코드 입력"
        open={authCodeModal}
        onCancel={() => setAuthCodeModal(false)}
        footer={null}
        width={400}
      >
        <Card className="final-step-card">
          <Title level={3} style={{ color: 'white', marginBottom: 24 }}>
            최종 인증 단계
          </Title>
          
          <Form
            form={authForm}
            onFinish={submitAuthCode}
            layout="vertical"
          >
            <Form.Item
              name="authCode"
              label={<Text style={{ color: 'white' }}>교수님이 알려주신 4자리 코드</Text>}
              rules={[
                { required: true, message: '인증 코드를 입력해주세요.' },
                { len: 4, message: '4자리 숫자를 입력해주세요.' }
              ]}
            >
              <Input 
                placeholder="1234"
                maxLength={4}
                size="large"
                style={{ textAlign: 'center', fontSize: '24px', fontFamily: 'monospace' }}
              />
            </Form.Item>

            <Form.Item>
              <Button 
                type="primary" 
                htmlType="submit" 
                size="large"
                loading={loading}
                block
                style={{ 
                  background: 'white', 
                  borderColor: 'white',
                  color: '#52c41a',
                  fontWeight: 'bold'
                }}
              >
                출석 완료
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </Modal>
    </GPSContainer>
  );
};

export default GPSVerificationPage;