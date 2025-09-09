import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Select,
  Table,
  Typography,
  Space,
  Progress,
  Button,
  Spin,
  Alert,
  Tag,
  Tooltip,
  DatePicker,
  Empty,
  Badge,
  Switch,
  Divider
} from 'antd';
import {
  BarChartOutlined,
  UserOutlined,
  CalendarOutlined,
  TrophyOutlined,
  BookOutlined,
  DownloadOutlined,
  ReloadOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  StarOutlined
} from '@ant-design/icons';
import { useAuth } from '../../store/AuthContext';
import { useParams } from 'react-router-dom';
import { apiClient } from '../../services/api';
import dayjs from 'dayjs';
import styled from 'styled-components';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

const StatisticsContainer = styled.div`
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

  .student-stats-table {
    .ant-table-thead > tr > th {
      background: #f8f9fa;
      font-weight: 600;
    }

    .attendance-rate-cell {
      .rate-excellent { color: #52c41a; font-weight: 600; }
      .rate-good { color: #1890ff; font-weight: 600; }
      .rate-warning { color: #faad14; font-weight: 600; }
      .rate-danger { color: #ff4d4f; font-weight: 600; }
    }
  }

  .session-chart {
    .session-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;

      .session-date {
        min-width: 100px;
        font-weight: 500;
      }

      .session-progress {
        flex: 1;
      }

      .session-stats {
        min-width: 80px;
        font-size: 12px;
        color: #666;
      }
    }
  }

  .export-section {
    text-align: center;
    padding: 24px;
    background: #f8f9fa;
    border-radius: 8px;
    margin-top: 16px;
  }
`;

interface CourseStats {
  courseInfo: any;
  overallStats: {
    totalStudents: number;
    totalRecords: number;
    presentCount: number;
    lateCount: number;
    absentCount: number;
    attendanceRate: number;
  };
  studentStats: Array<{
    studentInfo: any;
    totalSessions: number;
    presentCount: number;
    lateCount: number;
    absentCount: number;
    attendanceRate: number;
  }>;
  sessionStats: Array<{
    sessionId: string;
    sessionDate: string;
    totalRecords: number;
    presentCount: number;
    lateCount: number;
    absentCount: number;
  }>;
}

const AttendanceStatisticsPage: React.FC = () => {
  const { user } = useAuth();
  const { courseId } = useParams<{ courseId: string }>();
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [courseStats, setCourseStats] = useState<CourseStats | null>(null);
  const [showSessionChart, setShowSessionChart] = useState(true);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

  const loadCourses = useCallback(async () => {
    try {
      const coursesData = await apiClient.getCourses();
      setCourses(coursesData);
      
      if (coursesData.length > 0) {
        setSelectedCourse(coursesData[0].id);
      }
    } catch (error) {
      console.error('강의 목록 로드 실패:', error);
    }
  }, []);

  const loadCourseStats = useCallback(async () => {
    if (!selectedCourse) return;

    try {
      setLoading(true);
      const stats = await apiClient.getCourseAttendanceStats(selectedCourse);
      setCourseStats(stats);
    } catch (error) {
      console.error('통계 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedCourse]);

  useEffect(() => {
    loadCourses();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (courseId) {
      setSelectedCourse(courseId);
    }
  }, [courseId]);

  useEffect(() => {
    if (selectedCourse) {
      loadCourseStats();
    }
  }, [selectedCourse]); // eslint-disable-line react-hooks/exhaustive-deps

  // 출석률에 따른 등급 및 색상
  const getAttendanceGrade = (rate: number) => {
    if (rate >= 95) return { grade: 'S', color: '#722ed1', class: 'rate-excellent' };
    if (rate >= 90) return { grade: 'A+', color: '#52c41a', class: 'rate-excellent' };
    if (rate >= 85) return { grade: 'A', color: '#52c41a', class: 'rate-excellent' };
    if (rate >= 80) return { grade: 'B+', color: '#1890ff', class: 'rate-good' };
    if (rate >= 75) return { grade: 'B', color: '#1890ff', class: 'rate-good' };
    if (rate >= 70) return { grade: 'C+', color: '#faad14', class: 'rate-warning' };
    if (rate >= 65) return { grade: 'C', color: '#faad14', class: 'rate-warning' };
    return { grade: 'F', color: '#ff4d4f', class: 'rate-danger' };
  };

  // 학생 통계 테이블 컬럼
  const studentColumns = [
    {
      title: '순위',
      key: 'rank',
      width: 80,
      render: (_: any, __: any, index: number) => (
        <Space>
          {index === 0 && <StarOutlined style={{ color: '#faad14' }} />}
          <Text strong>{index + 1}</Text>
        </Space>
      ),
    },
    {
      title: '학생 정보',
      key: 'student',
      render: (student: any) => (
        <Space direction="vertical" size={4}>
          <Text strong>{student.studentInfo.name}</Text>
          <Text type="secondary">{student.studentInfo.student_id}</Text>
        </Space>
      ),
    },
    {
      title: '출석률',
      dataIndex: 'attendanceRate',
      key: 'attendanceRate',
      sorter: (a: any, b: any) => a.attendanceRate - b.attendanceRate,
      defaultSortOrder: 'descend' as const,
      render: (rate: number) => {
        const grade = getAttendanceGrade(rate);
        return (
          <Space direction="vertical" size={4}>
            <div className="attendance-rate-cell">
              <span className={grade.class}>{rate.toFixed(1)}%</span>
              <Tag color={grade.color} style={{ marginLeft: 8 }}>
                {grade.grade}
              </Tag>
            </div>
            <Progress 
              percent={rate} 
              size="small" 
              strokeColor={grade.color}
              showInfo={false}
            />
          </Space>
        );
      },
    },
    {
      title: '출석',
      dataIndex: 'presentCount',
      key: 'present',
      sorter: (a: any, b: any) => a.presentCount - b.presentCount,
      render: (count: number) => (
        <Space>
          <CheckCircleOutlined style={{ color: '#52c41a' }} />
          <Text>{count}</Text>
        </Space>
      ),
    },
    {
      title: '지각',
      dataIndex: 'lateCount',
      key: 'late',
      sorter: (a: any, b: any) => a.lateCount - b.lateCount,
      render: (count: number) => (
        <Space>
          <ClockCircleOutlined style={{ color: '#faad14' }} />
          <Text>{count}</Text>
        </Space>
      ),
    },
    {
      title: '결석',
      dataIndex: 'absentCount',
      key: 'absent',
      sorter: (a: any, b: any) => a.absentCount - b.absentCount,
      render: (count: number) => (
        <Space>
          <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
          <Text>{count}</Text>
        </Space>
      ),
    },
    {
      title: '총 세션',
      dataIndex: 'totalSessions',
      key: 'totalSessions',
      render: (count: number) => <Text>{count}</Text>,
    },
  ];

  // 데이터 내보내기
  const exportData = () => {
    if (!courseStats) return;

    const csvContent = [
      // 헤더
      ['학번', '이름', '출석률', '출석', '지각', '결석', '총세션'],
      // 데이터
      ...courseStats.studentStats.map(student => [
        student.studentInfo.student_id,
        student.studentInfo.name,
        student.attendanceRate.toFixed(1) + '%',
        student.presentCount,
        student.lateCount,
        student.absentCount,
        student.totalSessions
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([`\ufeff${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `출석통계_${courseStats.courseInfo.name}_${dayjs().format('YYYY-MM-DD')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <StatisticsContainer>
      <Row gutter={[24, 24]}>
        <Col span={24}>
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Title level={2} style={{ marginBottom: 8 }}>
                  📈 출석 통계 분석
                </Title>
                <Text type="secondary">
                  강의별 출석 현황을 분석하고 학생들의 출석 패턴을 파악하세요.
                </Text>
              </div>
              <Space>
                <Button
                  icon={<DownloadOutlined />}
                  onClick={exportData}
                  disabled={!courseStats}
                >
                  CSV 내보내기
                </Button>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={loadCourseStats}
                  loading={loading}
                >
                  새로고침
                </Button>
              </Space>
            </div>
          </Card>
        </Col>

        {/* 강의 선택 */}
        <Col span={24}>
          <Card>
            <Space wrap>
              <Select
                placeholder="강의를 선택하세요"
                value={selectedCourse}
                onChange={setSelectedCourse}
                style={{ width: 300 }}
              >
                {courses.map((course) => (
                  <Option key={course.id} value={course.id}>
                    <Space>
                      <Tag color="blue">{course.course_code}</Tag>
                      {course.name}
                    </Space>
                  </Option>
                ))}
              </Select>
              
              <RangePicker
                placeholder={['시작일', '종료일']}
                value={dateRange}
                onChange={setDateRange as any}
              />

              <Switch
                checked={showSessionChart}
                onChange={setShowSessionChart}
                checkedChildren="세션별 차트"
                unCheckedChildren="세션별 차트"
              />
            </Space>
          </Card>
        </Col>

        {courseStats && (
          <>
            {/* 전체 통계 */}
            <Col span={24}>
              <Card className="stats-overview">
                <Row gutter={[24, 24]}>
                  <Col xs={24} sm={6}>
                    <Statistic
                      title="총 학생 수"
                      value={courseStats.overallStats.totalStudents}
                      suffix="명"
                      prefix={<UserOutlined />}
                    />
                  </Col>
                  <Col xs={24} sm={6}>
                    <Statistic
                      title="전체 출석률"
                      value={courseStats.overallStats.attendanceRate}
                      suffix="%"
                      prefix={<TrophyOutlined />}
                      precision={1}
                    />
                  </Col>
                  <Col xs={24} sm={6}>
                    <Statistic
                      title="총 세션 수"
                      value={courseStats.sessionStats.length}
                      suffix="회"
                      prefix={<CalendarOutlined />}
                    />
                  </Col>
                  <Col xs={24} sm={6}>
                    <Statistic
                      title="총 출석 기록"
                      value={courseStats.overallStats.totalRecords}
                      suffix="건"
                      prefix={<BarChartOutlined />}
                    />
                  </Col>
                </Row>

                <Divider style={{ borderColor: 'rgba(255,255,255,0.3)', margin: '24px 0' }} />

                <Row gutter={[24, 24]}>
                  <Col xs={24} sm={8}>
                    <Statistic
                      title="출석"
                      value={courseStats.overallStats.presentCount}
                      suffix="건"
                      valueStyle={{ color: '#52c41a' }}
                    />
                  </Col>
                  <Col xs={24} sm={8}>
                    <Statistic
                      title="지각"
                      value={courseStats.overallStats.lateCount}
                      suffix="건"
                      valueStyle={{ color: '#faad14' }}
                    />
                  </Col>
                  <Col xs={24} sm={8}>
                    <Statistic
                      title="결석"
                      value={courseStats.overallStats.absentCount}
                      suffix="건"
                      valueStyle={{ color: '#ff4d4f' }}
                    />
                  </Col>
                </Row>
              </Card>
            </Col>

            <Row gutter={[24, 24]}>
              {/* 학생별 통계 */}
              <Col xs={24} lg={showSessionChart ? 16 : 24}>
                <Card
                  title={
                    <Space>
                      <UserOutlined />
                      학생별 출석 현황
                      <Badge count={courseStats.studentStats.length} style={{ backgroundColor: '#1890ff' }} />
                    </Space>
                  }
                >
                  {courseStats.studentStats.length > 0 ? (
                    <Table
                      className="student-stats-table"
                      dataSource={courseStats.studentStats}
                      columns={studentColumns}
                      rowKey={(record) => record.studentInfo.id}
                      pagination={{ pageSize: 10 }}
                      size="middle"
                    />
                  ) : (
                    <Empty description="출석 데이터가 없습니다" />
                  )}
                </Card>
              </Col>

              {/* 세션별 차트 */}
              {showSessionChart && (
                <Col xs={24} lg={8}>
                  <Card
                    title={
                      <Space>
                        <CalendarOutlined />
                        세션별 출석률
                      </Space>
                    }
                  >
                    <div className="session-chart">
                      {courseStats.sessionStats.map((session) => {
                        const attendanceRate = session.totalRecords > 0
                          ? Math.round(((session.presentCount + session.lateCount) / session.totalRecords) * 100)
                          : 0;
                        
                        return (
                          <div key={session.sessionId} className="session-bar">
                            <div className="session-date">
                              {dayjs(session.sessionDate).format('MM/DD')}
                            </div>
                            <div className="session-progress">
                              <Progress
                                percent={attendanceRate}
                                size="small"
                                status={attendanceRate >= 80 ? 'success' : attendanceRate >= 60 ? 'active' : 'exception'}
                              />
                            </div>
                            <div className="session-stats">
                              {attendanceRate}%
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                </Col>
              )}
            </Row>

            {/* 경고 알림 */}
            {courseStats.overallStats.attendanceRate < 70 && (
              <Col span={24}>
                <Alert
                  message="출석률 주의"
                  description={`전체 출석률이 ${courseStats.overallStats.attendanceRate.toFixed(1)}%로 낮습니다. 학생들의 출석을 독려하거나 출석 체크 방식을 점검해보세요.`}
                  type="warning"
                  showIcon
                  banner
                />
              </Col>
            )}

            {/* 우수 학생 */}
            {courseStats.studentStats.some(s => s.attendanceRate >= 95) && (
              <Col span={24}>
                <Alert
                  message="우수 출석 학생"
                  description={
                    <div>
                      출석률 95% 이상 달성 학생: {' '}
                      {courseStats.studentStats
                        .filter(s => s.attendanceRate >= 95)
                        .map(s => s.studentInfo.name)
                        .join(', ')}
                    </div>
                  }
                  type="success"
                  showIcon
                />
              </Col>
            )}
          </>
        )}

        {!courseStats && !loading && (
          <Col span={24}>
            <Empty
              description="강의를 선택하여 출석 통계를 확인하세요"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          </Col>
        )}
      </Row>
    </StatisticsContainer>
  );
};

export default AttendanceStatisticsPage;