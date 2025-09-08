import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Row,
  Col,
  Statistic,
  Select,
  DatePicker,
  Space,
  Tag,
  Typography,
  Spin,
  Alert,
  Progress,
  Button,
  Empty,
  Tooltip,
  Badge
} from 'antd';
import {
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  TrophyOutlined,
  BookOutlined,
  ReloadOutlined,
  BarChartOutlined
} from '@ant-design/icons';
import { useAuth } from '../../store/AuthContext';
import { apiClient } from '../../services/api';
import dayjs from 'dayjs';
import styled from 'styled-components';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

const AttendanceContainer = styled.div`
  .stats-card {
    text-align: center;
    border-radius: 12px;
    transition: all 0.3s ease;

    &:hover {
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
    }

    .ant-statistic-title {
      font-weight: 500;
      color: #666;
      margin-bottom: 8px;
    }

    &.present-card .ant-statistic-content {
      color: #52c41a;
    }
    
    &.late-card .ant-statistic-content {
      color: #faad14;
    }

    &.absent-card .ant-statistic-content {
      color: #ff4d4f;
    }

    &.rate-card .ant-statistic-content {
      color: #1890ff;
    }
  }

  .course-stats-card {
    margin-bottom: 16px;
    
    .course-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .course-progress {
      margin-bottom: 8px;
    }
  }

  .attendance-table {
    .ant-table-thead > tr > th {
      background: #f8f9fa;
      font-weight: 600;
    }
  }
`;

interface AttendanceRecord {
  id: string;
  status: 'present' | 'late' | 'absent';
  qr_scanned_at: string;
  gps_verified_at: string;
  auth_verified_at: string;
  created_at: string;
  attendance_sessions: {
    id: string;
    session_date: string;
    auth_code: string;
    courses: {
      id: string;
      name: string;
      course_code: string;
    };
  };
}

interface CourseStats {
  courseId: string;
  courseName: string;
  courseCode: string;
  totalSessions: number;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  attendanceRate: number;
}

const AttendanceRecordsPage: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [totalStats, setTotalStats] = useState<any>(null);
  const [courseStats, setCourseStats] = useState<CourseStats[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });

  useEffect(() => {
    loadAttendanceData();
  }, [selectedCourse, dateRange, pagination.current]);

  const loadAttendanceData = async () => {
    try {
      setLoading(true);

      // 출석 기록 조회
      const recordsData = await apiClient.getMyAttendanceRecords(
        selectedCourse || undefined,
        pagination.pageSize,
        (pagination.current - 1) * pagination.pageSize
      );
      
      setRecords(recordsData.records);
      setPagination(prev => ({ ...prev, total: recordsData.pagination.total }));

      // 출석 통계 조회
      const statsData = await apiClient.getMyAttendanceStats();
      setTotalStats(statsData.totalStats);
      setCourseStats(statsData.courseStats);

    } catch (error) {
      console.error('출석 데이터 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  // 상태별 색상 및 아이콘 반환
  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'present':
        return { color: 'success', icon: <CheckCircleOutlined />, text: '출석' };
      case 'late':
        return { color: 'warning', icon: <ClockCircleOutlined />, text: '지각' };
      case 'absent':
        return { color: 'error', icon: <CloseCircleOutlined />, text: '결석' };
      default:
        return { color: 'default', icon: <CloseCircleOutlined />, text: '미정' };
    }
  };

  // 테이블 컬럼 정의
  const columns = [
    {
      title: '강의',
      dataIndex: ['attendance_sessions', 'courses'],
      key: 'course',
      render: (course: any) => (
        <Space direction="vertical" size={4}>
          <Text strong>{course.name}</Text>
          <Tag color="blue">{course.course_code}</Tag>
        </Space>
      ),
    },
    {
      title: '날짜',
      dataIndex: ['attendance_sessions', 'session_date'],
      key: 'date',
      render: (date: string) => dayjs(date).format('YYYY-MM-DD'),
    },
    {
      title: '출석 상태',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const display = getStatusDisplay(status);
        return (
          <Tag icon={display.icon} color={display.color}>
            {display.text}
          </Tag>
        );
      },
    },
    {
      title: '체크 시간',
      dataIndex: 'auth_verified_at',
      key: 'checkTime',
      render: (time: string) => time ? dayjs(time).format('HH:mm:ss') : '-',
    },
    {
      title: '인증 과정',
      key: 'verification',
      render: (record: AttendanceRecord) => (
        <Space>
          <Tooltip title="QR 스캔">
            <Badge
              status={record.qr_scanned_at ? 'success' : 'default'}
              text="QR"
            />
          </Tooltip>
          <Tooltip title="GPS 인증">
            <Badge
              status={record.gps_verified_at ? 'success' : 'default'}
              text="GPS"
            />
          </Tooltip>
          <Tooltip title="코드 인증">
            <Badge
              status={record.auth_verified_at ? 'success' : 'default'}
              text="코드"
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  // 테이블 페이지네이션 핸들러
  const handleTableChange = (paginationInfo: any) => {
    setPagination(prev => ({
      ...prev,
      current: paginationInfo.current,
      pageSize: paginationInfo.pageSize,
    }));
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <AttendanceContainer>
      <Row gutter={[24, 24]}>
        <Col span={24}>
          <Card>
            <Title level={2} style={{ marginBottom: 8 }}>
              📊 나의 출석 현황
            </Title>
            <Text type="secondary">
              출석 기록과 통계를 확인하고 관리하세요.
            </Text>
          </Card>
        </Col>

        {/* 전체 통계 카드 */}
        {totalStats && (
          <>
            <Col xs={24} sm={12} lg={6}>
              <Card className="stats-card present-card">
                <Statistic
                  title="출석"
                  value={totalStats.presentCount}
                  suffix="회"
                  prefix={<CheckCircleOutlined />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card className="stats-card late-card">
                <Statistic
                  title="지각"
                  value={totalStats.lateCount}
                  suffix="회"
                  prefix={<ClockCircleOutlined />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card className="stats-card absent-card">
                <Statistic
                  title="결석"
                  value={totalStats.absentCount}
                  suffix="회"
                  prefix={<CloseCircleOutlined />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card className="stats-card rate-card">
                <Statistic
                  title="출석률"
                  value={totalStats.attendanceRate}
                  suffix="%"
                  prefix={<TrophyOutlined />}
                  precision={1}
                />
              </Card>
            </Col>
          </>
        )}

        {/* 과목별 통계 */}
        <Col xs={24} lg={8}>
          <Card
            title={
              <Space>
                <BarChartOutlined />
                과목별 출석률
              </Space>
            }
            extra={
              <Button
                type="text"
                icon={<ReloadOutlined />}
                onClick={loadAttendanceData}
                loading={loading}
              >
                새로고침
              </Button>
            }
          >
            {courseStats.length > 0 ? (
              courseStats.map((course) => (
                <Card key={course.courseId} className="course-stats-card" size="small">
                  <div className="course-header">
                    <Space>
                      <BookOutlined />
                      <Text strong>{course.courseName}</Text>
                      <Tag color="blue">{course.courseCode}</Tag>
                    </Space>
                    <Text type="secondary">{course.attendanceRate}%</Text>
                  </div>
                  <div className="course-progress">
                    <Progress
                      percent={course.attendanceRate}
                      size="small"
                      status={course.attendanceRate >= 80 ? 'success' : course.attendanceRate >= 70 ? 'normal' : 'exception'}
                      showInfo={false}
                    />
                  </div>
                  <Row gutter={16}>
                    <Col span={8}>
                      <Text type="secondary">출석: {course.presentCount}</Text>
                    </Col>
                    <Col span={8}>
                      <Text type="secondary">지각: {course.lateCount}</Text>
                    </Col>
                    <Col span={8}>
                      <Text type="secondary">결석: {course.absentCount}</Text>
                    </Col>
                  </Row>
                </Card>
              ))
            ) : (
              <Empty description="출석 통계가 없습니다" />
            )}
          </Card>
        </Col>

        {/* 출석 기록 테이블 */}
        <Col xs={24} lg={16}>
          <Card
            title={
              <Space>
                <CalendarOutlined />
                출석 기록
              </Space>
            }
            extra={
              <Space>
                <Select
                  placeholder="과목 선택"
                  allowClear
                  style={{ width: 200 }}
                  value={selectedCourse}
                  onChange={setSelectedCourse}
                >
                  {courseStats.map((course) => (
                    <Option key={course.courseId} value={course.courseId}>
                      {course.courseName}
                    </Option>
                  ))}
                </Select>
                <RangePicker
                  placeholder={['시작일', '종료일']}
                  value={dateRange}
                  onChange={setDateRange}
                />
              </Space>
            }
          >
            {records.length > 0 ? (
              <Table
                className="attendance-table"
                dataSource={records}
                columns={columns}
                rowKey="id"
                pagination={{
                  current: pagination.current,
                  pageSize: pagination.pageSize,
                  total: pagination.total,
                  showSizeChanger: true,
                  showQuickJumper: true,
                  showTotal: (total, range) =>
                    `${range[0]}-${range[1]} / 총 ${total}개`,
                }}
                onChange={handleTableChange}
                size="middle"
              />
            ) : (
              <Empty description="출석 기록이 없습니다" />
            )}
          </Card>
        </Col>
      </Row>

      {/* 출석률 알림 */}
      {totalStats && totalStats.attendanceRate < 70 && (
        <Row style={{ marginTop: 24 }}>
          <Col span={24}>
            <Alert
              message="출석률 주의"
              description={`현재 출석률이 ${totalStats.attendanceRate}%입니다. 출석률 향상을 위해 꾸준히 출석해주세요.`}
              type="warning"
              showIcon
            />
          </Col>
        </Row>
      )}
    </AttendanceContainer>
  );
};

export default AttendanceRecordsPage;