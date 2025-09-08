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
  Button,
  Spin,
  Alert,
  Progress,
  Modal,
  Form,
  Input,
  message,
  Dropdown,
  Menu,
  Badge,
  Tooltip,
  Empty
} from 'antd';
import {
  CalendarOutlined,
  UserOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  EyeOutlined,
  EditOutlined,
  MoreOutlined,
  ReloadOutlined,
  PlusOutlined,
  BarChartOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { apiClient } from '../../services/api';
import dayjs from 'dayjs';
import styled from 'styled-components';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;
const { TextArea } = Input;

const SessionsContainer = styled.div`
  .session-card {
    margin-bottom: 16px;
    border-radius: 12px;
    transition: all 0.3s ease;
    
    &:hover {
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
    }
    
    &.active {
      border-color: #52c41a;
      background: #f6ffed;
    }
    
    &.expired {
      border-color: #d9d9d9;
      background: #f5f5f5;
    }
  }

  .session-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .session-stats {
    display: flex;
    gap: 24px;
    margin: 12px 0;
  }

  .stat-item {
    text-align: center;
    flex: 1;
  }

  .attendance-table {
    .ant-table-thead > tr > th {
      background: #f8f9fa;
      font-weight: 600;
    }
  }

  .manual-form {
    .ant-form-item {
      margin-bottom: 16px;
    }
  }
`;

interface AttendanceSession {
  id: string;
  session_date: string;
  auth_code: string;
  is_active: boolean;
  qr_expires_at: string;
  auth_expires_at: string;
  created_at: string;
  courses: {
    id: string;
    name: string;
    course_code: string;
  };
  attendance_records: any[];
  attendanceStats: {
    totalStudents: number;
    presentCount: number;
    lateCount: number;
    absentCount: number;
  };
}

const AttendanceSessionsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  
  // 모달 상태
  const [detailModal, setDetailModal] = useState(false);
  const [manualModal, setManualModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState<AttendanceSession | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [manualForm] = Form.useForm();

  useEffect(() => {
    loadData();
  }, [selectedCourse, dateRange, pagination.current]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // 강의 목록 조회
      const coursesData = await apiClient.getCourses();
      setCourses(coursesData);

      // 출석 세션 조회
      const sessionsData = await apiClient.getProfessorSessions(
        selectedCourse || undefined,
        pagination.pageSize,
        (pagination.current - 1) * pagination.pageSize
      );
      
      setSessions(sessionsData.sessions);
      setPagination(prev => ({ ...prev, total: sessionsData.pagination.total }));

    } catch (error) {
      console.error('데이터 로드 실패:', error);
      message.error('데이터를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 세션 상태 토글
  const toggleSessionStatus = async (sessionId: string, isActive: boolean) => {
    try {
      await apiClient.activateSession(sessionId, isActive);
      message.success(`세션이 ${isActive ? '활성화' : '비활성화'}되었습니다.`);
      loadData();
    } catch (error: any) {
      message.error(error.message || '세션 상태 변경에 실패했습니다.');
    }
  };

  // 수동 출석 처리
  const handleManualAttendance = async (values: any) => {
    if (!selectedSession || !selectedStudent) return;

    try {
      await apiClient.updateManualAttendance(
        selectedSession.id,
        selectedStudent.student_id,
        values.status,
        values.reason
      );
      
      message.success('수동 출석 처리가 완료되었습니다.');
      setManualModal(false);
      manualForm.resetFields();
      loadData();
    } catch (error: any) {
      message.error(error.message || '수동 출석 처리에 실패했습니다.');
    }
  };

  // 세션 상세 보기
  const showSessionDetail = (session: AttendanceSession) => {
    setSelectedSession(session);
    setDetailModal(true);
  };

  // 수동 출석 모달 열기
  const showManualModal = (session: AttendanceSession, student: any) => {
    setSelectedSession(session);
    setSelectedStudent(student);
    manualForm.setFieldsValue({
      status: student.status || 'present',
      reason: ''
    });
    setManualModal(true);
  };

  // 상태별 색상 및 텍스트 반환
  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'present':
        return { color: 'success', text: '출석' };
      case 'late':
        return { color: 'warning', text: '지각' };
      case 'absent':
        return { color: 'error', text: '결석' };
      default:
        return { color: 'default', text: '미정' };
    }
  };

  // 세션 상태 확인
  const getSessionStatus = (session: AttendanceSession) => {
    const now = new Date();
    const expiresAt = new Date(session.qr_expires_at);
    
    if (!session.is_active) return { status: 'inactive', text: '비활성화', color: '#d9d9d9' };
    if (now > expiresAt) return { status: 'expired', text: '만료됨', color: '#ff4d4f' };
    return { status: 'active', text: '활성화', color: '#52c41a' };
  };

  // 테이블 컬럼 정의
  const columns = [
    {
      title: '강의',
      dataIndex: ['courses'],
      key: 'course',
      render: (course: any) => (
        <Space direction="vertical" size={4}>
          <Text strong>{course.name}</Text>
          <Tag color="blue">{course.course_code}</Tag>
        </Space>
      ),
    },
    {
      title: '세션 날짜',
      dataIndex: 'session_date',
      key: 'date',
      render: (date: string) => dayjs(date).format('YYYY-MM-DD'),
      sorter: (a: AttendanceSession, b: AttendanceSession) => 
        dayjs(a.session_date).valueOf() - dayjs(b.session_date).valueOf(),
    },
    {
      title: '상태',
      key: 'status',
      render: (session: AttendanceSession) => {
        const status = getSessionStatus(session);
        return <Tag color={status.color}>{status.text}</Tag>;
      },
    },
    {
      title: '출석 현황',
      key: 'attendance',
      render: (session: AttendanceSession) => {
        const { totalStudents, presentCount, lateCount, absentCount } = session.attendanceStats;
        const attendanceRate = totalStudents > 0 ? Math.round(((presentCount + lateCount) / totalStudents) * 100) : 0;
        
        return (
          <Space direction="vertical" size={4}>
            <Progress 
              percent={attendanceRate} 
              size="small" 
              status={attendanceRate >= 80 ? 'success' : attendanceRate >= 60 ? 'active' : 'exception'}
            />
            <Text type="secondary">
              출석: {presentCount}, 지각: {lateCount}, 결석: {absentCount}
            </Text>
          </Space>
        );
      },
    },
    {
      title: '인증 코드',
      dataIndex: 'auth_code',
      key: 'authCode',
      render: (code: string) => (
        <Tag color="purple" style={{ fontFamily: 'monospace' }}>
          {code}
        </Tag>
      ),
    },
    {
      title: '작업',
      key: 'actions',
      render: (session: AttendanceSession) => (
        <Space>
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => showSessionDetail(session)}
          >
            상세
          </Button>
          <Button
            type="text"
            icon={<BarChartOutlined />}
            onClick={() => navigate(`/courses/${session.courses.id}/stats`)}
          >
            통계
          </Button>
          <Dropdown
            overlay={
              <Menu>
                <Menu.Item
                  key="toggle"
                  onClick={() => toggleSessionStatus(session.id, !session.is_active)}
                >
                  {session.is_active ? '비활성화' : '활성화'}
                </Menu.Item>
                <Menu.Item
                  key="qr"
                  onClick={() => navigate('/qr-generator')}
                >
                  QR 재생성
                </Menu.Item>
              </Menu>
            }
          >
            <Button type="text" icon={<MoreOutlined />} />
          </Dropdown>
        </Space>
      ),
    },
  ];

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
    <SessionsContainer>
      <Row gutter={[24, 24]}>
        <Col span={24}>
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Title level={2} style={{ marginBottom: 8 }}>
                  📊 출석 세션 관리
                </Title>
                <Text type="secondary">
                  생성된 출석 세션을 관리하고 출석 현황을 확인하세요.
                </Text>
              </div>
              <Space>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => navigate('/qr-generator')}
                >
                  새 세션 생성
                </Button>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={loadData}
                  loading={loading}
                >
                  새로고침
                </Button>
              </Space>
            </div>
          </Card>
        </Col>

        {/* 필터 */}
        <Col span={24}>
          <Card>
            <Space wrap>
              <Select
                placeholder="강의 선택"
                allowClear
                style={{ width: 200 }}
                value={selectedCourse}
                onChange={setSelectedCourse}
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
                onChange={setDateRange}
              />
            </Space>
          </Card>
        </Col>

        {/* 세션 테이블 */}
        <Col span={24}>
          <Card>
            {sessions.length > 0 ? (
              <Table
                className="attendance-table"
                dataSource={sessions}
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
              <Empty 
                description="생성된 출석 세션이 없습니다"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              >
                <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/qr-generator')}>
                  첫 번째 세션 생성하기
                </Button>
              </Empty>
            )}
          </Card>
        </Col>
      </Row>

      {/* 세션 상세 모달 */}
      <Modal
        title="출석 세션 상세"
        open={detailModal}
        onCancel={() => setDetailModal(false)}
        width={800}
        footer={null}
      >
        {selectedSession && (
          <div>
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              <Col span={12}>
                <Statistic
                  title="강의명"
                  value={selectedSession.courses.name}
                  valueStyle={{ fontSize: '16px' }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="세션 날짜"
                  value={dayjs(selectedSession.session_date).format('YYYY-MM-DD')}
                  valueStyle={{ fontSize: '16px' }}
                />
              </Col>
            </Row>

            <Table
              dataSource={selectedSession.attendance_records}
              columns={[
                {
                  title: '학생',
                  render: (record: any) => (
                    <Space>
                      <Text strong>{record.users?.name}</Text>
                      <Text type="secondary">({record.users?.student_id})</Text>
                    </Space>
                  ),
                },
                {
                  title: '상태',
                  dataIndex: 'status',
                  render: (status: string) => {
                    const display = getStatusDisplay(status);
                    return <Tag color={display.color}>{display.text}</Tag>;
                  },
                },
                {
                  title: '출석 시간',
                  dataIndex: 'auth_verified_at',
                  render: (time: string) => time ? dayjs(time).format('HH:mm:ss') : '-',
                },
                {
                  title: '작업',
                  render: (record: any) => (
                    <Button
                      type="text"
                      icon={<EditOutlined />}
                      onClick={() => {
                        setDetailModal(false);
                        showManualModal(selectedSession, record);
                      }}
                    >
                      수정
                    </Button>
                  ),
                },
              ]}
              rowKey="id"
              size="small"
              pagination={false}
            />
          </div>
        )}
      </Modal>

      {/* 수동 출석 처리 모달 */}
      <Modal
        title="수동 출석 처리"
        open={manualModal}
        onCancel={() => setManualModal(false)}
        onOk={() => manualForm.submit()}
        okText="저장"
        cancelText="취소"
      >
        {selectedStudent && (
          <Form
            form={manualForm}
            layout="vertical"
            onFinish={handleManualAttendance}
            className="manual-form"
          >
            <Alert
              message={`${selectedStudent.users?.name} (${selectedStudent.users?.student_id}) 학생의 출석을 수동으로 처리합니다.`}
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            
            <Form.Item
              name="status"
              label="출석 상태"
              rules={[{ required: true, message: '출석 상태를 선택해주세요.' }]}
            >
              <Select>
                <Option value="present">출석</Option>
                <Option value="late">지각</Option>
                <Option value="absent">결석</Option>
              </Select>
            </Form.Item>

            <Form.Item
              name="reason"
              label="사유"
              rules={[{ required: true, message: '처리 사유를 입력해주세요.' }]}
            >
              <TextArea
                rows={3}
                placeholder="수동 처리 사유를 입력하세요 (예: 기기 오류로 인한 수동 처리)"
              />
            </Form.Item>
          </Form>
        )}
      </Modal>
    </SessionsContainer>
  );
};

export default AttendanceSessionsPage;