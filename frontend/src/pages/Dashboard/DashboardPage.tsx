import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Typography, Space, Button, List, Avatar, Tag, Progress, Empty, Spin } from 'antd';
import { 
  BookOutlined, 
  CalendarOutlined, 
  CheckCircleOutlined, 
  ClockCircleOutlined,
  UserOutlined,
  BarChartOutlined,
  QrcodeOutlined,
  RightOutlined
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
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  }

  .dashboard-card {
    transition: all 0.3s ease;
    cursor: pointer;
    
    &:hover {
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
      transform: translateY(-2px);
    }
  }

  .statistic-card {
    text-align: center;
    
    .ant-statistic-title {
      font-weight: 500;
      color: #666;
    }
    
    .ant-statistic-content {
      color: #1890ff;
    }
  }
`;

const WelcomeSection = styled.div`
  margin-bottom: 32px;
  padding: 24px;
  background: linear-gradient(135deg, #1890ff 0%, #722ed1 100%);
  border-radius: 12px;
  color: white;
`;

const QuickActionGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 32px;
`;

const QuickActionCard = styled(Card)`
  text-align: center;
  border: 2px solid transparent;
  transition: all 0.3s ease;
  cursor: pointer;

  &:hover {
    border-color: #1890ff;
    box-shadow: 0 4px 16px rgba(24, 144, 255, 0.2);
  }

  .ant-card-body {
    padding: 24px 16px;
  }

  .action-icon {
    font-size: 32px;
    color: #1890ff;
    margin-bottom: 12px;
  }

  .action-title {
    font-weight: 600;
    margin-bottom: 8px;
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
  const [courses, setCourses] = useState<Course[]>([]);
  const [stats, setStats] = useState({
    totalCourses: 0,
    totalSessions: 0,
    attendanceRate: 0,
    todaySessions: 0,
  });
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);

  // 데이터 로드
  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
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
  };

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
      {/* 환영 섹션 */}
      <WelcomeSection>
        <Row align="middle" justify="space-between">
          <Col>
            <Title level={2} style={{ color: 'white', marginBottom: 8 }}>
              안녕하세요, {user?.name}님! 👋
            </Title>
            <Text style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '16px' }}>
              {user?.role === 'professor' ? '오늘도 강의 준비 화이팅!' : '오늘도 출석 체크 화이팅!'}
            </Text>
          </Col>
          <Col>
            <Space>
              <Tag color="white" style={{ color: '#1890ff', fontWeight: 500 }}>
                {user?.role === 'professor' ? '교수' : '학생'}
              </Tag>
              {user?.studentId && (
                <Tag color="white" style={{ color: '#722ed1', fontWeight: 500 }}>
                  {user.studentId}
                </Tag>
              )}
            </Space>
          </Col>
        </Row>
      </WelcomeSection>

      {/* 통계 카드 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card className="statistic-card">
            <Statistic
              title={user?.role === 'professor' ? '담당 강의' : '수강 강의'}
              value={stats.totalCourses}
              suffix="개"
              prefix={<BookOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="statistic-card">
            <Statistic
              title="총 세션 수"
              value={stats.totalSessions}
              suffix="회"
              prefix={<CalendarOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="statistic-card">
            <Statistic
              title="출석률"
              value={stats.attendanceRate}
              suffix="%"
              prefix={<CheckCircleOutlined />}
              precision={1}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="statistic-card">
            <Statistic
              title="오늘 일정"
              value={stats.todaySessions}
              suffix="개"
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 빠른 액션 */}
      <div style={{ marginBottom: 32 }}>
        <Title level={4} style={{ marginBottom: 16 }}>
          빠른 액션
        </Title>
        <QuickActionGrid>
          {getQuickActions().map((action) => (
            <QuickActionCard key={action.key} onClick={action.onClick}>
              <div className="action-icon">{action.icon}</div>
              <div className="action-title">{action.title}</div>
              <Text type="secondary">{action.description}</Text>
            </QuickActionCard>
          ))}
        </QuickActionGrid>
      </div>

      <Row gutter={[16, 16]}>
        {/* 강의 목록 */}
        <Col xs={24} lg={12}>
          <Card
            title={user?.role === 'professor' ? '담당 강의' : '수강 강의'}
            extra={
              <Button 
                type="text" 
                icon={<RightOutlined />}
                onClick={() => navigate(user?.role === 'professor' ? '/courses' : '/my-courses')}
              >
                전체 보기
              </Button>
            }
          >
            {courses.length > 0 ? (
              <List
                dataSource={courses}
                renderItem={(course) => (
                  <List.Item
                    key={course.id}
                    onClick={() => navigate(`/courses/${course.id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <List.Item.Meta
                      avatar={<Avatar icon={<BookOutlined />} style={{ backgroundColor: '#1890ff' }} />}
                      title={
                        <Space>
                          <Text strong>{course.name}</Text>
                          <Tag color="blue">{course.course_code}</Tag>
                        </Space>
                      }
                      description={
                        <Text type="secondary">
                          {course.room && `${course.room} | `}
                          {course.professorName && user?.role === 'student' && course.professorName}
                        </Text>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Empty description="강의가 없습니다" />
            )}
          </Card>
        </Col>

        {/* 최근 활동 */}
        <Col xs={24} lg={12}>
          <Card title="최근 활동">
            {recentActivities.length > 0 ? (
              <List
                dataSource={recentActivities}
                renderItem={(activity) => (
                  <List.Item key={activity.id}>
                    <List.Item.Meta
                      avatar={
                        <Avatar 
                          icon={activity.type === 'attendance' ? <CheckCircleOutlined /> : <CalendarOutlined />}
                          style={{ 
                            backgroundColor: activity.type === 'attendance' ? '#52c41a' : '#1890ff' 
                          }} 
                        />
                      }
                      title={activity.title}
                      description={
                        <Space direction="vertical" size={4}>
                          <Text type="secondary">{activity.description}</Text>
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            {activity.timestamp}
                          </Text>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Empty description="최근 활동이 없습니다" />
            )}
          </Card>
        </Col>
      </Row>
    </DashboardContainer>
  );
};

export default DashboardPage;