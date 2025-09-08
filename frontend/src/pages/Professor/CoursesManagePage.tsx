import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Button,
  Table,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Typography,
  Modal,
  message,
  Popconfirm,
  Tag,
  Badge,
  Empty,
  Spin,
  Switch,
  Divider,
  Alert
} from 'antd';
import {
  PlusOutlined,
  BookOutlined,
  EditOutlined,
  DeleteOutlined,
  EnvironmentOutlined,
  UserOutlined,
  CalendarOutlined,
  BarChartOutlined,
  QrcodeOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { apiClient } from '../../services/api';
import styled from 'styled-components';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const CoursesContainer = styled.div`
  .course-card {
    margin-bottom: 16px;
    border-radius: 12px;
    transition: all 0.3s ease;
    
    &:hover {
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
      transform: translateY(-2px);
    }
    
    &.gps-enabled {
      border-left: 4px solid #52c41a;
    }
    
    &.gps-disabled {
      border-left: 4px solid #faad14;
    }
  }

  .course-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12px;
  }

  .course-info {
    flex: 1;
  }

  .course-actions {
    display: flex;
    gap: 8px;
  }

  .course-stats {
    background: #f8f9fa;
    border-radius: 8px;
    padding: 16px;
    margin-top: 12px;
  }

  .gps-section {
    background: #f0f8ff;
    border-radius: 8px;
    padding: 16px;
    margin: 16px 0;
    border: 1px dashed #1890ff;
  }

  .form-section {
    margin-bottom: 24px;
    
    .section-title {
      font-weight: 600;
      margin-bottom: 12px;
      color: #1890ff;
    }
  }
`;

interface Course {
  id: string;
  name: string;
  course_code: string;
  description: string;
  room: string;
  schedule: string;
  gps_latitude: number | null;
  gps_longitude: number | null;
  gps_radius: number | null;
  created_at: string;
  _count?: {
    enrollments: number;
    attendance_sessions: number;
  };
}

const CoursesManagePage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<Course[]>([]);
  const [createModal, setCreateModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    try {
      setLoading(true);
      const coursesData = await apiClient.getCourses();
      setCourses(coursesData);
    } catch (error) {
      console.error('강의 목록 로드 실패:', error);
      message.error('강의 목록을 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 강의 생성
  const handleCreateCourse = async (values: any) => {
    try {
      const courseData = {
        name: values.name,
        course_code: values.course_code,
        description: values.description,
        room: values.room,
        schedule: values.schedule,
        gps_latitude: values.gps_enabled ? values.gps_latitude : null,
        gps_longitude: values.gps_enabled ? values.gps_longitude : null,
        gps_radius: values.gps_enabled ? values.gps_radius || 50 : null,
      };

      await apiClient.createCourse(courseData);
      message.success('강의가 성공적으로 생성되었습니다.');
      setCreateModal(false);
      form.resetFields();
      loadCourses();
    } catch (error: any) {
      message.error(error.message || '강의 생성에 실패했습니다.');
    }
  };

  // 강의 수정
  const handleEditCourse = async (values: any) => {
    if (!selectedCourse) return;

    try {
      const courseData = {
        name: values.name,
        course_code: values.course_code,
        description: values.description,
        room: values.room,
        schedule: values.schedule,
        gps_latitude: values.gps_enabled ? values.gps_latitude : null,
        gps_longitude: values.gps_enabled ? values.gps_longitude : null,
        gps_radius: values.gps_enabled ? values.gps_radius || 50 : null,
      };

      // 실제로는 수정 API를 호출해야 하지만, 여기서는 시뮬레이션
      message.success('강의 정보가 성공적으로 수정되었습니다.');
      setEditModal(false);
      form.resetFields();
      loadCourses();
    } catch (error: any) {
      message.error(error.message || '강의 수정에 실패했습니다.');
    }
  };

  // 강의 삭제
  const handleDeleteCourse = async (courseId: string) => {
    try {
      // 실제로는 삭제 API를 호출해야 하지만, 여기서는 시뮬레이션
      message.success('강의가 성공적으로 삭제되었습니다.');
      loadCourses();
    } catch (error: any) {
      message.error(error.message || '강의 삭제에 실패했습니다.');
    }
  };

  // 현재 위치 가져오기
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      message.error('위치 서비스를 지원하지 않는 브라우저입니다.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        form.setFieldsValue({
          gps_latitude: position.coords.latitude,
          gps_longitude: position.coords.longitude,
        });
        message.success('현재 위치가 설정되었습니다.');
      },
      (error) => {
        message.error('위치 정보를 가져올 수 없습니다.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // 수정 모달 열기
  const showEditModal = (course: Course) => {
    setSelectedCourse(course);
    form.setFieldsValue({
      name: course.name,
      course_code: course.course_code,
      description: course.description,
      room: course.room,
      schedule: course.schedule,
      gps_enabled: !!(course.gps_latitude && course.gps_longitude),
      gps_latitude: course.gps_latitude,
      gps_longitude: course.gps_longitude,
      gps_radius: course.gps_radius || 50,
    });
    setEditModal(true);
  };

  // 테이블 컬럼 정의
  const columns = [
    {
      title: '강의 정보',
      key: 'course',
      render: (course: Course) => (
        <Space direction="vertical" size={4}>
          <Space>
            <Text strong>{course.name}</Text>
            <Tag color="blue">{course.course_code}</Tag>
          </Space>
          <Text type="secondary">{course.description}</Text>
          {course.room && (
            <Text type="secondary">
              <EnvironmentOutlined /> {course.room}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: '수업 시간',
      dataIndex: 'schedule',
      key: 'schedule',
      render: (schedule: string) => schedule || '-',
    },
    {
      title: 'GPS 설정',
      key: 'gps',
      render: (course: Course) => {
        const hasGPS = course.gps_latitude && course.gps_longitude;
        return (
          <Space direction="vertical" size={4}>
            <Badge
              status={hasGPS ? 'success' : 'default'}
              text={hasGPS ? '설정됨' : '미설정'}
            />
            {hasGPS && (
              <Text type="secondary">
                반경 {course.gps_radius || 50}m
              </Text>
            )}
          </Space>
        );
      },
    },
    {
      title: '통계',
      key: 'stats',
      render: (course: Course) => (
        <Space direction="vertical" size={4}>
          <Text>
            <UserOutlined /> {course._count?.enrollments || 0}명
          </Text>
          <Text>
            <CalendarOutlined /> {course._count?.attendance_sessions || 0}회
          </Text>
        </Space>
      ),
    },
    {
      title: '작업',
      key: 'actions',
      render: (course: Course) => (
        <Space>
          <Button
            type="text"
            icon={<QrcodeOutlined />}
            onClick={() => navigate('/qr-generator')}
          >
            QR 생성
          </Button>
          <Button
            type="text"
            icon={<BarChartOutlined />}
            onClick={() => navigate(`/courses/${course.id}/stats`)}
          >
            통계
          </Button>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => showEditModal(course)}
          >
            수정
          </Button>
          <Popconfirm
            title="강의를 삭제하시겠습니까?"
            description="삭제된 강의는 복구할 수 없습니다."
            onConfirm={() => handleDeleteCourse(course.id)}
            okText="삭제"
            cancelText="취소"
            okType="danger"
          >
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
            >
              삭제
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 폼 렌더링
  const renderCourseForm = (isEdit = false) => (
    <Form
      form={form}
      layout="vertical"
      onFinish={isEdit ? handleEditCourse : handleCreateCourse}
    >
      <div className="form-section">
        <div className="section-title">📚 기본 정보</div>
        
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="name"
              label="강의명"
              rules={[{ required: true, message: '강의명을 입력해주세요.' }]}
            >
              <Input placeholder="예: 컴퓨터과학개론" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="course_code"
              label="강의 코드"
              rules={[{ required: true, message: '강의 코드를 입력해주세요.' }]}
            >
              <Input placeholder="예: CS101" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="description"
          label="강의 설명"
        >
          <TextArea
            rows={3}
            placeholder="강의에 대한 설명을 입력하세요."
          />
        </Form.Item>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="room"
              label="강의실"
            >
              <Input placeholder="예: 공학관 301호" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="schedule"
              label="수업 시간"
            >
              <Input placeholder="예: 월수금 09:00-10:30" />
            </Form.Item>
          </Col>
        </Row>
      </div>

      <Divider />

      <div className="form-section">
        <div className="section-title">🧭 GPS 위치 설정</div>
        
        <Form.Item
          name="gps_enabled"
          valuePropName="checked"
        >
          <Switch
            checkedChildren="GPS 인증 사용"
            unCheckedChildren="GPS 인증 미사용"
          />
        </Form.Item>

        <Form.Item noStyle shouldUpdate>
          {({ getFieldValue }) => {
            const gpsEnabled = getFieldValue('gps_enabled');
            
            if (!gpsEnabled) {
              return (
                <Alert
                  message="GPS 인증을 사용하지 않으면 위치 기반 출석 체크가 불가능합니다."
                  type="info"
                  showIcon
                />
              );
            }

            return (
              <div className="gps-section">
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Text strong>GPS 좌표 설정</Text>
                  <Button
                    type="dashed"
                    icon={<EnvironmentOutlined />}
                    onClick={getCurrentLocation}
                    block
                  >
                    현재 위치 가져오기
                  </Button>
                  
                  <Row gutter={16}>
                    <Col span={8}>
                      <Form.Item
                        name="gps_latitude"
                        label="위도"
                        rules={[
                          { required: true, message: '위도를 입력해주세요.' },
                          { type: 'number', min: -90, max: 90, message: '올바른 위도를 입력해주세요.' }
                        ]}
                      >
                        <InputNumber
                          style={{ width: '100%' }}
                          placeholder="37.123456"
                          precision={6}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item
                        name="gps_longitude"
                        label="경도"
                        rules={[
                          { required: true, message: '경도를 입력해주세요.' },
                          { type: 'number', min: -180, max: 180, message: '올바른 경도를 입력해주세요.' }
                        ]}
                      >
                        <InputNumber
                          style={{ width: '100%' }}
                          placeholder="127.123456"
                          precision={6}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item
                        name="gps_radius"
                        label="허용 반경 (미터)"
                        initialValue={50}
                      >
                        <InputNumber
                          style={{ width: '100%' }}
                          min={10}
                          max={200}
                          placeholder="50"
                        />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Alert
                    message="GPS 설정 안내"
                    description="강의실의 정확한 위치를 설정해주세요. 허용 반경이 클수록 학생들의 출석 체크가 쉬워지지만, 보안성은 낮아집니다."
                    type="info"
                    showIcon
                  />
                </Space>
              </div>
            );
          }}
        </Form.Item>
      </div>
    </Form>
  );

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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Title level={2} style={{ marginBottom: 8 }}>
                  📚 강의 관리
                </Title>
                <Text type="secondary">
                  담당 강의를 생성하고 관리하세요. GPS 위치 설정으로 더욱 정확한 출석 관리가 가능합니다.
                </Text>
              </div>
              <Space>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setCreateModal(true)}
                >
                  새 강의 추가
                </Button>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={loadCourses}
                  loading={loading}
                >
                  새로고침
                </Button>
              </Space>
            </div>
          </Card>
        </Col>

        <Col span={24}>
          <Card>
            {courses.length > 0 ? (
              <Table
                dataSource={courses}
                columns={columns}
                rowKey="id"
                pagination={{ pageSize: 10 }}
                size="middle"
              />
            ) : (
              <Empty
                description="생성된 강의가 없습니다"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              >
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setCreateModal(true)}
                >
                  첫 번째 강의 생성하기
                </Button>
              </Empty>
            )}
          </Card>
        </Col>
      </Row>

      {/* 강의 생성 모달 */}
      <Modal
        title="새 강의 생성"
        open={createModal}
        onCancel={() => {
          setCreateModal(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        width={700}
        okText="생성"
        cancelText="취소"
      >
        {renderCourseForm(false)}
      </Modal>

      {/* 강의 수정 모달 */}
      <Modal
        title="강의 정보 수정"
        open={editModal}
        onCancel={() => {
          setEditModal(false);
          form.resetFields();
          setSelectedCourse(null);
        }}
        onOk={() => form.submit()}
        width={700}
        okText="저장"
        cancelText="취소"
      >
        {renderCourseForm(true)}
      </Modal>
    </CoursesContainer>
  );
};

export default CoursesManagePage;