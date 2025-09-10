import React, { useState, useEffect, useCallback } from 'react';
import { Card, Row, Col, Statistic, Typography, Space, Button, List, Avatar, Tag, Progress, Empty, Spin } from 'antd';
import { 
  BookOutlined, 
  CalendarOutlined, 
  CheckCircleOutlined, 
  ClockCircleOutlined,
  UserOutlined,
  BarChartOutlined,
  QrcodeOutlined,
  RightOutlined,
  FireOutlined,
  TrophyOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { apiClient } from '../../services/api';
import styled from 'styled-components';

const { Title, Text } = Typography;

// 스타일드 컴포넌트
const DashboardContainer = styled.div`
  .ant-card {
    border-radius: 12px;
    /* Telegram 스타일: 그림자 제거 */
    border: 1px solid ${({ theme }) => theme.colors.border.light};
  }

  .dashboard-card {
    /* Telegram 스타일: 트랜지션과 애니메이션 제거 */
    cursor: pointer;
  }

  .statistic-card {
    text-align: center;
    
    .ant-statistic-title {
      font-weight: 500;
      color: ${({ theme }) => theme.colors.text.secondary};
    }
    
    .ant-statistic-content {
      color: ${({ theme }) => theme.colors.primary[500]};
    }
  }
`;

const WelcomeSection = styled.div`
  margin-bottom: 24px;
  padding: 16px 20px;
  background: white;
  border: 1px solid rgb(235, 235, 235);
  border-radius: 8px;
  position: relative;
  transition: all 0.2s ease;
  
  @media (max-width: 768px) {
    margin-bottom: 16px;
    padding: 12px 16px;
    border-radius: 6px;
  }
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg, rgb(0, 114, 245), rgb(59, 130, 246));
    border-radius: 8px 8px 0 0;
    transition: all 0.3s ease;
    
    @media (max-width: 768px) {
      border-radius: 6px 6px 0 0;
    }
  }

  &:hover {
    border-color: rgb(0, 114, 245);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 114, 245, 0.08);
    
    @media (max-width: 768px) {
      transform: none;
      box-shadow: none;
    }
    
    &::before {
      height: 4px;
      background: linear-gradient(90deg, rgb(0, 114, 245), rgb(99, 179, 237));
    }
  }
`;

const QuickActionGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 32px;
`;

const QuickActionCard = styled(Card)`
  text-align: center;
  background: white;
  border: 1px solid rgb(235, 235, 235);
  border-radius: 8px;
  cursor: pointer;
  height: clamp(100px, 15vw, 120px);
  transition: all 0.15s ease;

  @media (max-width: 768px) {
    border-radius: 6px;
    min-height: 90px;
  }

  &:hover {
    border-color: rgb(0, 114, 245);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    
    @media (max-width: 768px) {
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    }
  }

  .ant-card-body {
    padding: clamp(12px, 3vw, 20px) clamp(8px, 2vw, 16px);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
  }

  .action-icon {
    font-size: clamp(20px, 5vw, 24px);
    color: rgb(0, 114, 245);
    margin-bottom: clamp(8px, 2vw, 12px);
  }

  .action-title {
    font-weight: 500;
    margin-bottom: 4px;
    font-size: clamp(12px, 3vw, 14px);
    color: rgb(23, 23, 23);
    font-family: 'Geist, Arial, sans-serif';
    line-height: 1.2;
  }
`;

// 출석 통계 차트 컨테이너
const StatsSection = styled.div`
  margin: clamp(20px, 5vw, 32px) 0;
  display: grid;
  grid-template-columns: 1fr;
  gap: clamp(16px, 4vw, 20px);

  @media (max-width: 768px) {
    gap: 12px;
    margin: 16px 0;
  }

  @media (max-width: 480px) {
    margin: 12px 0;
    gap: 8px;
  }
`;

const StatCard = styled.div`
  background: white;
  border: 1px solid rgb(235, 235, 235);
  border-radius: clamp(6px, 2vw, 8px);
  padding: clamp(16px, 4vw, 20px);
  min-height: clamp(160px, 25vw, 200px);
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;

  @media (max-width: 768px) {
    min-height: 180px;
    padding: 14px;
  }

  @media (max-width: 480px) {
    min-height: 160px;
    padding: 12px;
  }

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(90deg, rgb(0, 114, 245), transparent);
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  &:hover {
    border-color: rgb(0, 114, 245);
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0, 114, 245, 0.1);
    
    @media (max-width: 768px) {
      transform: translateY(-1px);
      box-shadow: 0 4px 15px rgba(0, 114, 245, 0.08);
    }
    
    &::before {
      opacity: 1;
    }
  }
`;

// 출석 스트릭 위젯
const StreakWidget = styled.div`
  .streak-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: clamp(12px, 3vw, 20px);
    
    h3 {
      margin: 0;
      color: rgb(23, 23, 23);
      font-family: 'Geist, Arial, sans-serif';
      font-size: clamp(14px, 3.5vw, 16px);
      font-weight: 600;
    }
  }

  .streak-display {
    display: flex;
    align-items: center;
    gap: clamp(12px, 3vw, 16px);
    flex-wrap: wrap;
    
    .streak-number {
      font-size: clamp(28px, 7vw, 36px);
      font-weight: 700;
      color: rgb(255, 125, 25);
      font-family: 'ui-monospace, SFMono-Regular, monospace';
    }
    
    .streak-icon {
      font-size: clamp(22px, 5.5vw, 28px);
      color: rgb(255, 125, 25);
    }
    
    .streak-label {
      color: rgb(136, 136, 136);
      font-size: clamp(12px, 3vw, 14px);
      font-weight: 500;
      font-family: 'Geist, Arial, sans-serif';
    }
  }

  .streak-dots {
    display: flex;
    gap: 4px;
    margin-top: 16px;
    flex-wrap: wrap;
    
    .dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: rgb(250, 250, 250);
      border: 1px solid rgb(235, 235, 235);
      transition: all 0.2s ease;
      cursor: pointer;
      position: relative;
      
      &:hover {
        transform: scale(1.3);
        z-index: 1;
      }
      
      &.attended {
        background: rgb(34, 197, 94);
        border-color: rgb(34, 197, 94);
        
        &:hover {
          box-shadow: 0 0 12px rgba(34, 197, 94, 0.4);
        }
      }
      
      &.late {
        background: rgb(245, 166, 35);
        border-color: rgb(245, 166, 35);
        
        &:hover {
          box-shadow: 0 0 12px rgba(245, 166, 35, 0.4);
        }
      }
      
      &.absent {
        background: rgb(239, 68, 68);
        border-color: rgb(239, 68, 68);
        
        &:hover {
          box-shadow: 0 0 12px rgba(239, 68, 68, 0.4);
        }
      }
    }
  }
`;


interface Course {
  id: string;
  name: string;
  course_code: string;
  room?: string;
  professorName?: string;
}

interface RecentActivity {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
}

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [courses, setCourses] = useState<Course[]>([]);
  const [stats, setStats] = useState({
    totalCourses: 0,
    totalSessions: 0,
    attendanceRate: 0,
    todaySessions: 0,
  });
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  
  // 출석 스트릭 데이터 (최근 14일)
  const [streakData] = useState({
    currentStreak: 7,
    longestStreak: 12,
    attendancePattern: [
      { status: 'attended' }, { status: 'attended' }, { status: 'late' }, 
      { status: 'attended' }, { status: 'attended' }, { status: 'absent' }, 
      { status: 'attended' }, { status: 'attended' }, { status: 'attended' }, 
      { status: 'attended' }, { status: 'attended' }, { status: 'attended' }, 
      { status: 'attended' }, { status: 'attended' }
    ]
  });


  // 실시간 시간 업데이트
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);

  // 데이터 로드
  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      
      // 강의 목록 가져오기
      const coursesData = await apiClient.getCourses();
      setCourses(coursesData.slice(0, 5)); // 최근 5개만 표시
      
      // 통계 데이터 설정 (실제로는 API에서 가져와야 함)
      setStats({
        totalCourses: coursesData.length,
        totalSessions: user?.role === 'professor' ? 24 : 18,
        attendanceRate: user?.role === 'professor' ? 88.5 : 92.3,
        todaySessions: 3,
      });

      // 최근 활동 설정 (실제로는 API에서 가져와야 함)
      setRecentActivities([
        {
          id: '1',
          type: 'attendance',
          title: '컴퓨터과학개론 출석 완료',
          description: 'QR 코드 스캔 및 GPS 인증 완료',
          timestamp: '2024-09-08 09:15',
        },
        {
          id: '2',
          type: 'session',
          title: '데이터베이스 출석 세션 생성',
          description: 'QR 코드 생성 및 활성화 완료',
          timestamp: '2024-09-08 13:00',
        },
      ]);
    } catch (error) {
      console.error('대시보드 데이터 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  }, []); // user.role은 고정값이므로 의존성에서 제거

  useEffect(() => {
    loadDashboardData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 빠른 액션 정의
  const getQuickActions = () => {
    if (user?.role === 'professor') {
      return [
        {
          key: 'qr-generator',
          icon: <QrcodeOutlined />,
          title: 'QR 코드 생성',
          description: '출석 세션 QR 생성',
          onClick: () => navigate('/qr-generator'),
        },
        {
          key: 'attendance-management',
          icon: <CalendarOutlined />,
          title: '출석 관리',
          description: '출석 세션 관리',
          onClick: () => navigate('/attendance/sessions'),
        },
        {
          key: 'statistics',
          icon: <BarChartOutlined />,
          title: '출석 통계',
          description: '강의별 출석률 분석',
          onClick: () => navigate('/statistics'),
        },
        {
          key: 'courses',
          icon: <BookOutlined />,
          title: '강의 관리',
          description: '강의 생성 및 관리',
          onClick: () => navigate('/courses'),
        },
      ];
    } else {
      return [
        {
          key: 'attendance-scan',
          icon: <QrcodeOutlined />,
          title: '출석 체크',
          description: 'QR 코드 스캔',
          onClick: () => navigate('/attendance/scan'),
        },
        {
          key: 'attendance-records',
          icon: <CalendarOutlined />,
          title: '출석 현황',
          description: '나의 출석 기록',
          onClick: () => navigate('/attendance/records'),
        },
        {
          key: 'my-courses',
          icon: <BookOutlined />,
          title: '수강 강의',
          description: '수강 중인 강의 목록',
          onClick: () => navigate('/my-courses'),
        },
        {
          key: 'location-test',
          icon: <CheckCircleOutlined />,
          title: '위치 테스트',
          description: 'GPS 위치 확인',
          onClick: () => navigate('/location-test'),
        },
      ];
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <DashboardContainer>
      {/* Vercel 스타일 헤더 위젯 */}
      <WelcomeSection>
        <Row align="middle" justify="space-between" style={{ flexWrap: 'wrap', gap: '12px 0' }}>
          <Col xs={24} sm={12} md={14} lg={16}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <Title level={2} style={{ 
                  color: 'rgb(23, 23, 23)', 
                  marginBottom: 4, 
                  fontFamily: 'Geist, Arial, sans-serif', 
                  fontWeight: 600,
                  fontSize: 'clamp(20px, 4vw, 24px)'
                }}>
                  대시보드
                </Title>
                <div style={{ 
                  fontSize: 'clamp(12px, 2.5vw, 14px)', 
                  color: 'rgb(136, 136, 136)', 
                  fontFamily: 'Geist, Arial, sans-serif'
                }}>
                  {currentTime.toLocaleDateString('ko-KR', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </div>
              </div>
              
              {/* 실시간 시간 위젯 - 모바일에서는 작게 */}
              <div style={{
                background: 'rgb(250, 250, 250)',
                padding: 'clamp(8px, 2vw, 12px) clamp(12px, 3vw, 16px)',
                borderRadius: '6px',
                border: '1px solid rgb(235, 235, 235)',
                fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                transition: 'all 0.2s ease',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                if (window.innerWidth > 768) {
                  e.currentTarget.style.background = 'rgb(245, 245, 245)';
                  e.currentTarget.style.borderColor = 'rgb(0, 114, 245)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 114, 245, 0.1)';
                }
              }}
              onMouseLeave={(e) => {
                if (window.innerWidth > 768) {
                  e.currentTarget.style.background = 'rgb(250, 250, 250)';
                  e.currentTarget.style.borderColor = 'rgb(235, 235, 235)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }
              }}
              >
                <div style={{ 
                  fontSize: 'clamp(16px, 4vw, 20px)', 
                  fontWeight: '600', 
                  color: 'rgb(23, 23, 23)',
                  lineHeight: 1
                }}>
                  {currentTime.toLocaleTimeString('ko-KR', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    hour12: false 
                  })}
                </div>
              </div>
            </div>
          </Col>
          
          <Col xs={24} sm={12} md={10} lg={8} style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              {/* 오늘의 출석 현황 */}
              <div style={{ 
                background: 'rgb(250, 250, 250)', 
                padding: 'clamp(6px, 1.5vw, 8px) clamp(10px, 2.5vw, 12px)', 
                borderRadius: '6px',
                border: '1px solid rgb(235, 235, 235)',
                transition: 'all 0.2s ease',
                cursor: 'pointer',
                width: '100%'
              }}
              onMouseEnter={(e) => {
                if (window.innerWidth > 768) {
                  e.currentTarget.style.background = 'rgb(245, 245, 245)';
                  e.currentTarget.style.borderColor = 'rgb(34, 197, 94)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(34, 197, 94, 0.1)';
                }
              }}
              onMouseLeave={(e) => {
                if (window.innerWidth > 768) {
                  e.currentTarget.style.background = 'rgb(250, 250, 250)';
                  e.currentTarget.style.borderColor = 'rgb(235, 235, 235)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }
              }}
              >
                <Space size="small" style={{ width: '100%', justifyContent: 'center' }}>
                  <span style={{ color: 'rgb(0, 114, 245)', fontSize: 'clamp(10px, 2.5vw, 12px)', fontWeight: '500' }}>
                    출석: 3
                  </span>
                  <span style={{ color: 'rgb(245, 166, 35)', fontSize: 'clamp(10px, 2.5vw, 12px)', fontWeight: '500' }}>
                    지각: 1
                  </span>
                  <span style={{ color: 'rgb(245, 101, 101)', fontSize: 'clamp(10px, 2.5vw, 12px)', fontWeight: '500' }}>
                    결석: 0
                  </span>
                </Space>
              </div>
              
              <Space style={{ width: '100%', justifyContent: 'center' }}>
                <Tag style={{ 
                  background: 'white', 
                  color: 'rgb(0, 114, 245)', 
                  border: '1px solid rgb(235, 235, 235)',
                  fontWeight: 500,
                  borderRadius: '4px',
                  fontSize: 'clamp(10px, 2.5vw, 12px)'
                }}>
                  {user?.role === 'professor' ? '교수' : '학생'}
                </Tag>
                {user?.studentId && (
                  <Tag style={{ 
                    background: 'white', 
                    color: 'rgb(136, 136, 136)', 
                    border: '1px solid rgb(235, 235, 235)',
                    fontWeight: 500,
                    borderRadius: '4px',
                    fontSize: 'clamp(10px, 2.5vw, 12px)'
                  }}>
                    {user.studentId}
                  </Tag>
                )}
              </Space>
            </Space>
          </Col>
        </Row>
      </WelcomeSection>

      {/* 빠른 액션 */}
      <div>
        <Row gutter={[8, 8]} style={{ marginBottom: 'clamp(16px, 4vw, 32px)' }}>
          {getQuickActions().map((action) => (
            <Col xs={12} sm={6} md={6} lg={6} key={action.key}>
              <QuickActionCard onClick={action.onClick}>
                <div className="action-icon">{action.icon}</div>
                <div className="action-title">{action.title}</div>
                <Text 
                  type="secondary" 
                  style={{ 
                    fontSize: 'clamp(10px, 2.5vw, 12px)', 
                    textAlign: 'center',
                    display: 'block',
                    lineHeight: 1.2
                  }}
                >
                  {action.description}
                </Text>
              </QuickActionCard>
            </Col>
          ))}
        </Row>
      </div>

      {/* 출석 통계 섹션 */}
      <StatsSection>
        {/* 출석 스트릭 */}
        <StatCard>
          <StreakWidget>
            <div className="streak-header">
              <h3>출석 스트릭</h3>
              <TrophyOutlined style={{ color: 'rgb(245, 166, 35)' }} />
            </div>
            
            <div className="streak-display">
              <FireOutlined className="streak-icon" />
              <div>
                <div className="streak-number">{streakData.currentStreak}</div>
                <div className="streak-label">연속 출석</div>
              </div>
            </div>

            <div className="streak-dots">
              {streakData.attendancePattern.map((day, index) => (
                <div
                  key={index}
                  className={`dot ${day.status}`}
                  title={`${14 - index}일 전: ${
                    day.status === 'attended' ? '출석' : 
                    day.status === 'late' ? '지각' : '결석'
                  }`}
                />
              ))}
            </div>

            <div style={{ 
              marginTop: 'clamp(12px, 3vw, 16px)', 
              fontSize: 'clamp(10px, 2.5vw, 12px)', 
              color: 'rgb(136, 136, 136)',
              fontFamily: 'Geist, Arial, sans-serif'
            }}>
              최장 기록: {streakData.longestStreak}일
            </div>
          </StreakWidget>
        </StatCard>

      </StatsSection>

    </DashboardContainer>
  );
};

export default DashboardPage;