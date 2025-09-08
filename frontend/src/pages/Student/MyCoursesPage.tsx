import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  List,
  Avatar,
  Tag,
  Typography,
  Space,
  Button,
  Progress,
  Statistic,
  Badge,
  Empty,
  Spin,
  Alert,
  Divider
} from 'antd';
import {
  BookOutlined,
  UserOutlined,
  CalendarOutlined,
  EnvironmentOutlined,
  TrophyOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  QrcodeOutlined,
  RightOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { apiClient } from '../../services/api';
import styled from 'styled-components';

const { Title, Text, Paragraph } = Typography;

const CoursesContainer = styled.div`
  .course-card {
    margin-bottom: 16px;
    border-radius: 12px;
    transition: all 0.3s ease;
    
    &:hover {
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
      transform: translateY(-2px);
    }
    
    .course-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 16px;
    }
    
    .course-info {
      flex: 1;
    }
    
    .course-actions {
      display: flex;
      gap: 8px;
    }
    
    .attendance-progress {
      margin: 16px 0;
    }
    
    .course-stats {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 16px;
      margin-top: 16px;
    }
  }

  .stats-overview {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    margin-bottom: 24px;

    .ant-card-body {
      padding: 24px;
    }

    .ant-statistic-title {
      color: rgba(255, 255, 255, 0.8) !important;
      font-weight: 500;
    }

    .ant-statistic-content {
      color: white !important;
    }
  }

  .quick-action-card {
    text-align: center;
    border: 2px dashed #d9d9d9;
    transition: all 0.3s ease;
    cursor: pointer;

    &:hover {
      border-color: #1890ff;
      background: #f0f8ff;
    }

    .action-icon {
      font-size: 32px;
      color: #1890ff;
      margin-bottom: 12px;
    }
  }
`;

interface Course {
  id: string;
  name: string;
  course_code: string;
  description: string;
  professor_name: string;
  room: string;
  schedule: string;
  gps_latitude?: number;
  gps_longitude?: number;
  gps_radius?: number;
  attendanceStats?: {
    totalSessions: number;
    presentCount: number;
    lateCount: number;
    absentCount: number;
    attendanceRate: number;
  };
}

const MyCoursesPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<Course[]>([]);
  const [totalStats, setTotalStats] = useState<any>(null);

  useEffect(() => {
    loadMyCoursesData();
  }, []);

  const loadMyCoursesData = async () => {
    try {
      setLoading(true);
      
      // 수강 강의 목록 조회
      const coursesData = await apiClient.getCourses();
      
      // 출석 통계 조회
      const statsData = await apiClient.getMyAttendanceStats();
      setTotalStats(statsData.totalStats);

      // 강의별 출석 통계 매핑
      const coursesWithStats = coursesData.map((course: any) => {
        const courseStats = statsData.courseStats.find((stat: any) => stat.courseId === course.id);
        return {
          ...course,
          attendanceStats: courseStats || {
            totalSessions: 0,
            presentCount: 0,
            lateCount: 0,
            absentCount: 0,
            attendanceRate: 0
          }
        };
      });

      setCourses(coursesWithStats);
    } catch (error) {
      console.error('수강 강의 데이터 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  // 출석률에 따른 상태 및 색상 반환
  const getAttendanceStatus = (rate: number) => {
    if (rate >= 90) return { status: 'success', text: '우수', color: '#52c41a' };
    if (rate >= 80) return { status: 'normal', text: '양호', color: '#1890ff' };
    if (rate >= 70) return { status: 'active', text: '보통', color: '#faad14' };
    return { status: 'exception', text: '주의', color: '#ff4d4f' };
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <CoursesContainer>
      <Row gutter={[24, 24]}>
        <Col span={24}>
          <Card>
            <Title level={2} style={{ marginBottom: 8 }}>
              📚 나의 수강 강의
            </Title>
            <Text type="secondary">
              수강 중인 강의 목록과 출석 현황을 확인하세요.
            </Text>
          </Card>
        </Col>

        {/* 전체 통계 개요 */}
        {totalStats && (
          <Col span={24}>
            <Card className="stats-overview">
              <Row gutter={[24, 24]}>
                <Col xs={24} sm={8}>
                  <Statistic
                    title="총 수강 과목"
                    value={courses.length}
                    suffix="과목"
                    prefix={<BookOutlined />}
                  />
                </Col>
                <Col xs={24} sm={8}>
                  <Statistic
                    title="전체 세션 수"
                    value={totalStats.totalSessions}
                    suffix="회"
                    prefix={<CalendarOutlined />}
                  />
                </Col>
                <Col xs={24} sm={8}>
                  <Statistic
                    title="전체 출석률"
                    value={totalStats.attendanceRate}
                    suffix="%"
                    prefix={<TrophyOutlined />}
                    precision={1}
                  />
                </Col>
              </Row>
            </Card>
          </Col>
        )}

        {/* 빠른 액션 */}
        <Col xs={24} sm={12} lg={8}>
          <Card className="quick-action-card" onClick={() => navigate('/attendance/scan')}>
            <div className="action-icon">
              <QrcodeOutlined />
            </div>
            <Title level={4}>출석 체크</Title>
            <Text type="secondary">QR 코드를 스캔하여 출석을 체크하세요</Text>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={8}>
          <Card className="quick-action-card" onClick={() => navigate('/attendance/records')}>
            <div className="action-icon">
              <CalendarOutlined />
            </div>
            <Title level={4}>출석 기록</Title>
            <Text type="secondary">나의 출석 기록을 자세히 확인하세요</Text>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={8}>
          <Card className="quick-action-card" onClick={() => navigate('/location-test')}>
            <div className="action-icon">
              <EnvironmentOutlined />
            </div>
            <Title level={4}>위치 테스트</Title>
            <Text type="secondary">GPS 위치 정확도를 미리 확인하세요</Text>
          </Card>
        </Col>

        {/* 강의 목록 */}
        <Col span={24}>
          <Card
            title={
              <Space>
                <BookOutlined />
                수강 강의 ({courses.length}개)
              </Space>
            }
          >
            {courses.length > 0 ? (
              <List
                grid={{ gutter: 16, xs: 1, sm: 1, md: 1, lg: 1, xl: 1 }}
                dataSource={courses}
                renderItem={(course) => {
                  const attendanceStatus = getAttendanceStatus(course.attendanceStats?.attendanceRate || 0);
                  
                  return (
                    <List.Item>
                      <Card className="course-card">
                        <div className="course-header">
                          <div className="course-info">
                            <Space align="start">
                              <Avatar
                                size={48}
                                icon={<BookOutlined />}
                                style={{ backgroundColor: '#1890ff' }}
                              />
                              <div>
                                <Title level={4} style={{ margin: 0 }}>
                                  {course.name}
                                </Title>
                                <Space wrap style={{ marginTop: 4 }}>
                                  <Tag color="blue">{course.course_code}</Tag>
                                  <Tag color="green" icon={<UserOutlined />}>
                                    {course.professor_name}
                                  </Tag>
                                  {course.room && (
                                    <Tag icon={<EnvironmentOutlined />}>
                                      {course.room}
                                    </Tag>
                                  )}
                                </Space>
                              </div>
                            </Space>
                          </div>
                          <div className="course-actions">
                            <Button
                              type="primary"
                              icon={<QrcodeOutlined />}
                              onClick={() => navigate('/attendance/scan')}
                            >
                              출석 체크
                            </Button>
                            <Button
                              icon={<RightOutlined />}
                              onClick={() => navigate(`/courses/${course.id}`)}
                            >
                              상세보기
                            </Button>
                          </div>
                        </div>

                        {course.description && (
                          <Paragraph type="secondary" ellipsis={{ rows: 2 }}>
                            {course.description}
                          </Paragraph>
                        )}

                        <div className="attendance-progress">
                          <Space style={{ width: '100%' }} direction="vertical" size={8}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Text strong>출석률</Text>
                              <Space>
                                <Badge status={attendanceStatus.status as any} text={attendanceStatus.text} />
                                <Text style={{ color: attendanceStatus.color, fontWeight: 600 }}>
                                  {course.attendanceStats?.attendanceRate.toFixed(1)}%
                                </Text>
                              </Space>
                            </div>
                            <Progress
                              percent={course.attendanceStats?.attendanceRate}
                              status={attendanceStatus.status as any}
                              strokeColor={attendanceStatus.color}
                              size="small"
                            />
                          </Space>
                        </div>

                        <div className="course-stats">
                          <Row gutter={16}>
                            <Col span={6}>
                              <Statistic
                                title="총 세션"
                                value={course.attendanceStats?.totalSessions}
                                valueStyle={{ fontSize: '16px' }}
                              />
                            </Col>
                            <Col span={6}>
                              <Statistic
                                title="출석"
                                value={course.attendanceStats?.presentCount}
                                valueStyle={{ fontSize: '16px', color: '#52c41a' }}
                                prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                              />
                            </Col>
                            <Col span={6}>
                              <Statistic
                                title="지각"
                                value={course.attendanceStats?.lateCount}
                                valueStyle={{ fontSize: '16px', color: '#faad14' }}
                                prefix={<ClockCircleOutlined style={{ color: '#faad14' }} />}
                              />
                            </Col>
                            <Col span={6}>
                              <Statistic
                                title="결석"
                                value={course.attendanceStats?.absentCount}
                                valueStyle={{ fontSize: '16px', color: '#ff4d4f' }}
                              />
                            </Col>
                          </Row>
                        </div>

                        {course.schedule && (
                          <>
                            <Divider style={{ margin: '16px 0' }} />
                            <Space>
                              <CalendarOutlined />
                              <Text type="secondary">수업 시간: {course.schedule}</Text>
                            </Space>
                          </>
                        )}

                        {/* GPS 설정 정보 */}
                        {course.gps_latitude && course.gps_longitude && (
                          <Space style={{ marginTop: 8 }}>
                            <EnvironmentOutlined style={{ color: '#52c41a' }} />
                            <Text type="secondary" style={{ color: '#52c41a' }}>
                              GPS 위치 인증 설정됨 (반경 {course.gps_radius || 50}m)
                            </Text>
                          </Space>
                        )}
                      </Card>
                    </List.Item>
                  );
                }}
              />
            ) : (
              <Empty
                description="수강 중인 강의가 없습니다"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* 출석률 경고 */}
      {totalStats && totalStats.attendanceRate < 70 && (
        <Row style={{ marginTop: 24 }}>
          <Col span={24}>
            <Alert
              message="출석률 주의 알림"
              description={`전체 출석률이 ${totalStats.attendanceRate.toFixed(1)}%로 낮습니다. 꾸준한 출석으로 출석률을 향상시켜주세요.`}
              type="warning"
              showIcon
              banner
            />
          </Col>
        </Row>
      )}
    </CoursesContainer>
  );
};

export default MyCoursesPage;