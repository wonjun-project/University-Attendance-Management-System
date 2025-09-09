import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Button,
  Result,
  Alert,
  Typography,
  Space,
  Statistic,
  Progress,
  Row,
  Col,
  Spin,
  Tag,
  Divider,
  Steps,
  Badge
} from 'antd';
import {
  EnvironmentOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { useAuth } from '../../store/AuthContext';
import { apiClient } from '../../services/api';
import styled from 'styled-components';

const { Title, Text, Paragraph } = Typography;

const LocationTestContainer = styled.div`
  .location-card {
    text-align: center;
    border-radius: 12px;
    
    &.excellent {
      border: 2px solid #52c41a;
      background: #f6ffed;
    }
    
    &.good {
      border: 2px solid #1890ff;
      background: #f0f8ff;
    }
    
    &.fair {
      border: 2px solid #faad14;
      background: #fffbe6;
    }
    
    &.poor {
      border: 2px solid #ff7a45;
      background: #fff2e8;
    }
    
    &.very_poor {
      border: 2px solid #ff4d4f;
      background: #fff1f0;
    }
  }

  .location-icon {
    font-size: 64px;
    margin-bottom: 16px;
    
    &.excellent { color: #52c41a; }
    &.good { color: #1890ff; }
    &.fair { color: #faad14; }
    &.poor { color: #ff7a45; }
    &.very_poor { color: #ff4d4f; }
  }

  .accuracy-circle {
    display: inline-block;
    width: 100px;
    height: 100px;
    border-radius: 50%;
    position: relative;
    margin: 16px 0;
    
    .accuracy-text {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-weight: bold;
      font-size: 18px;
    }
  }

  .status-steps {
    margin: 24px 0;
  }

  .location-details {
    background: #f8f9fa;
    border-radius: 8px;
    padding: 16px;
    margin: 16px 0;
    text-align: left;
  }
`;

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

const LocationTestPage: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [locationData, setLocationData] = useState<LocationData | null>(null);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'requesting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [recommendation, setRecommendation] = useState<string>('');
  const [watchId, setWatchId] = useState<number | null>(null);
  const [accuracyHistory, setAccuracyHistory] = useState<number[]>([]);

  // 컴포넌트 언마운트 시 위치 감시 중지
  useEffect(() => {
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [watchId]);

  // GPS 정확도 등급 계산
  const getAccuracyGrade = (accuracy: number) => {
    if (accuracy <= 5) return { grade: 'excellent', text: '최고', color: '#52c41a', percent: 100 };
    if (accuracy <= 10) return { grade: 'good', text: '우수', color: '#1890ff', percent: 85 };
    if (accuracy <= 20) return { grade: 'fair', text: '보통', color: '#faad14', percent: 65 };
    if (accuracy <= 50) return { grade: 'poor', text: '낮음', color: '#ff7a45', percent: 40 };
    return { grade: 'very_poor', text: '매우 낮음', color: '#ff4d4f', percent: 20 };
  };

  // 위치 정보 요청
  const requestLocation = () => {
    setLoading(true);
    setLocationStatus('requesting');
    setErrorMessage('');
    setAccuracyHistory([]);

    if (!navigator.geolocation) {
      setLocationStatus('error');
      setErrorMessage('이 브라우저는 위치 서비스를 지원하지 않습니다.');
      setLoading(false);
      return;
    }

    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    };

    const handleSuccess = async (position: GeolocationPosition) => {
      const { latitude, longitude, accuracy } = position.coords;
      const locationInfo: LocationData = {
        latitude,
        longitude,
        accuracy,
        timestamp: Date.now(),
      };

      setLocationData(locationInfo);
      setLocationStatus('success');

      // 정확도 히스토리 업데이트
      setAccuracyHistory(prev => [...prev.slice(-9), accuracy]);

      try {
        // 백엔드 위치 테스트 API 호출
        const baseURL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
        const testResponse = await fetch(
          `${baseURL}/api/attendance/test-location?latitude=${latitude}&longitude=${longitude}&accuracy=${accuracy}`,
          { 
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        if (testResponse.ok) {
          const testData = await testResponse.json();
          setRecommendation(testData.data.recommendation);
        }
      } catch (error) {
        console.error('위치 테스트 API 호출 실패:', error);
        setRecommendation('위치 테스트 API 호출에 실패했습니다.');
      }

      setLoading(false);
    };

    const handleError = (error: GeolocationPositionError) => {
      setLocationStatus('error');
      setLoading(false);

      switch (error.code) {
        case error.PERMISSION_DENIED:
          setErrorMessage('위치 접근 권한이 거부되었습니다. 브라우저 설정에서 위치 권한을 허용해주세요.');
          break;
        case error.POSITION_UNAVAILABLE:
          setErrorMessage('위치 정보를 사용할 수 없습니다. GPS나 네트워크 연결을 확인해주세요.');
          break;
        case error.TIMEOUT:
          setErrorMessage('위치 정보 요청이 시간 초과되었습니다. 다시 시도해주세요.');
          break;
        default:
          setErrorMessage('위치 정보를 가져오는 중 오류가 발생했습니다.');
          break;
      }
    };

    // 실시간 위치 감시 시작
    const id = navigator.geolocation.watchPosition(handleSuccess, handleError, options);
    setWatchId(id);
  };

  // 위치 감시 중지
  const stopLocationWatch = () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
      setLoading(false);
      setLocationStatus('idle');
    }
  };

  // 평균 정확도 계산 (useMemo로 최적화)
  const averageAccuracy = useMemo(() => {
    if (accuracyHistory.length === 0) return 0;
    return accuracyHistory.reduce((sum, acc) => sum + acc, 0) / accuracyHistory.length;
  }, [accuracyHistory]);

  const renderLocationResult = () => {
    if (!locationData) return null;

    const accuracyInfo = getAccuracyGrade(locationData.accuracy);
    // averageAccuracy는 이미 useMemo로 계산됨

    return (
      <Card className={`location-card ${accuracyInfo.grade}`}>
        <div className={`location-icon ${accuracyInfo.grade}`}>
          <EnvironmentOutlined />
        </div>
        
        <Title level={3}>GPS 위치 테스트 결과</Title>
        
        <Row gutter={[24, 24]} style={{ margin: '24px 0' }}>
          <Col xs={24} md={8}>
            <Statistic
              title="정확도"
              value={locationData.accuracy}
              suffix="m"
              precision={1}
              valueStyle={{ color: accuracyInfo.color }}
            />
            <Tag color={accuracyInfo.color} style={{ marginTop: 8 }}>
              {accuracyInfo.text}
            </Tag>
          </Col>
          
          <Col xs={24} md={8}>
            <Statistic
              title="평균 정확도"
              value={averageAccuracy}
              suffix="m"
              precision={1}
              valueStyle={{ color: '#666' }}
            />
            <Text type="secondary">({accuracyHistory.length}회 측정)</Text>
          </Col>
          
          <Col xs={24} md={8}>
            <Progress
              type="circle"
              percent={accuracyInfo.percent}
              strokeColor={accuracyInfo.color}
              size={80}
              format={() => (
                <span style={{ color: accuracyInfo.color, fontSize: '12px', fontWeight: 'bold' }}>
                  {accuracyInfo.text}
                </span>
              )}
            />
          </Col>
        </Row>

        <div className="location-details">
          <Row gutter={16}>
            <Col span={12}>
              <Text strong>위도: </Text>
              <Text code>{locationData.latitude.toFixed(6)}</Text>
            </Col>
            <Col span={12}>
              <Text strong>경도: </Text>
              <Text code>{locationData.longitude.toFixed(6)}</Text>
            </Col>
          </Row>
          <Divider style={{ margin: '12px 0' }} />
          <Text strong>측정 시간: </Text>
          <Text>{new Date(locationData.timestamp).toLocaleString()}</Text>
        </div>

        {recommendation && (
          <Alert
            message="권장 사항"
            description={recommendation}
            type={accuracyInfo.grade === 'excellent' || accuracyInfo.grade === 'good' ? 'success' : 'warning'}
            showIcon
            style={{ marginTop: 16, textAlign: 'left' }}
          />
        )}

        <Space style={{ marginTop: 24 }}>
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            onClick={requestLocation}
            loading={loading}
          >
            다시 테스트
          </Button>
          <Button onClick={stopLocationWatch}>
            측정 중지
          </Button>
        </Space>
      </Card>
    );
  };

  const renderLocationSteps = () => {
    const steps = [
      {
        title: '위치 권한 요청',
        description: '브라우저에서 위치 접근을 허용합니다',
        status: (locationStatus === 'idle' ? 'wait' : 'finish') as 'wait' | 'finish',
        icon: <InfoCircleOutlined />
      },
      {
        title: 'GPS 신호 수신',
        description: '정확한 위치 정보를 수집합니다',
        status: (locationStatus === 'requesting' ? 'process' : locationStatus === 'success' ? 'finish' : 'wait') as 'process' | 'finish' | 'wait',
        icon: <EnvironmentOutlined />
      },
      {
        title: '정확도 분석',
        description: '위치 정확도를 분석하고 평가합니다',
        status: (locationStatus === 'success' ? 'finish' : 'wait') as 'finish' | 'wait',
        icon: <CheckCircleOutlined />
      }
    ];

    return (
      <div className="status-steps">
        <Steps
          current={locationStatus === 'idle' ? 0 : locationStatus === 'requesting' ? 1 : 2}
          items={steps as any}
        />
      </div>
    );
  };

  return (
    <LocationTestContainer>
      <Row gutter={[24, 24]}>
        <Col span={24}>
          <Card>
            <Title level={2} style={{ marginBottom: 8 }}>
              🧭 GPS 위치 테스트
            </Title>
            <Paragraph type="secondary">
              출석 체크 전에 GPS 정확도를 미리 확인해보세요. 
              정확도가 높을수록 출석 인증이 원활하게 진행됩니다.
            </Paragraph>
          </Card>
        </Col>

        <Col span={24}>
          {renderLocationSteps()}
        </Col>

        <Col span={24}>
          {locationStatus === 'idle' && (
            <Card style={{ textAlign: 'center', padding: '40px 20px' }}>
              <EnvironmentOutlined style={{ fontSize: '64px', color: '#d9d9d9', marginBottom: '16px' }} />
              <Title level={3}>GPS 위치 테스트 시작</Title>
              <Paragraph>
                현재 위치의 GPS 정확도를 테스트합니다.
                <br />
                정확한 결과를 위해 창문 근처나 실외에서 테스트해주세요.
              </Paragraph>
              <Button
                type="primary"
                size="large"
                icon={<EnvironmentOutlined />}
                onClick={requestLocation}
                loading={loading}
              >
                위치 테스트 시작
              </Button>
            </Card>
          )}

          {locationStatus === 'requesting' && (
            <Card style={{ textAlign: 'center', padding: '40px 20px' }}>
              <Spin size="large" />
              <Title level={3} style={{ marginTop: 16 }}>
                위치 정보 수집 중...
              </Title>
              <Paragraph>
                정확한 위치 정보를 위해 잠시만 기다려주세요.
                <br />
                측정이 완료되면 실시간으로 정확도가 업데이트됩니다.
              </Paragraph>
              {accuracyHistory.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <Text>현재까지 {accuracyHistory.length}회 측정됨</Text>
                  <br />
                  <Text type="secondary">
                    최근 정확도: {accuracyHistory[accuracyHistory.length - 1].toFixed(1)}m
                  </Text>
                </div>
              )}
              <div style={{ marginTop: 24 }}>
                <Button onClick={stopLocationWatch}>측정 중지</Button>
              </div>
            </Card>
          )}

          {locationStatus === 'success' && renderLocationResult()}

          {locationStatus === 'error' && (
            <Result
              status="error"
              title="위치 정보 수집 실패"
              subTitle={errorMessage}
              extra={[
                <Button type="primary" key="retry" onClick={requestLocation}>
                  다시 시도
                </Button>,
              ]}
            />
          )}
        </Col>

        {/* 도움말 정보 */}
        <Col span={24}>
          <Card title="GPS 정확도 가이드">
            <Row gutter={[16, 16]}>
              <Col xs={24} md={12}>
                <Alert
                  message="높은 정확도를 위한 팁"
                  description={
                    <ul style={{ paddingLeft: '20px', marginBottom: 0 }}>
                      <li>창문 근처나 실외에서 테스트하세요</li>
                      <li>건물 내부보다는 하늘이 보이는 곳이 좋습니다</li>
                      <li>Wi-Fi와 데이터를 모두 켜두세요</li>
                      <li>몇 분 정도 기다려주면 정확도가 향상됩니다</li>
                    </ul>
                  }
                  type="info"
                  showIcon
                />
              </Col>
              <Col xs={24} md={12}>
                <Alert
                  message="정확도 기준"
                  description={
                    <div>
                      <Badge status="success" text="5m 이하: 최고 (출석 체크 원활)" />
                      <br />
                      <Badge status="processing" text="10m 이하: 우수 (출석 체크 가능)" />
                      <br />
                      <Badge status="warning" text="20m 이하: 보통 (출석 체크 가능)" />
                      <br />
                      <Badge status="error" text="20m 초과: 낮음 (위치 이동 권장)" />
                    </div>
                  }
                  type="success"
                  showIcon
                />
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </LocationTestContainer>
  );
};

export default LocationTestPage;