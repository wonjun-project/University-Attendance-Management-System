import React from 'react';
import { Card, Typography } from 'antd';
import { useAuth } from '../../store/AuthContext';

const { Title } = Typography;

const MyPage: React.FC = () => {
  const { user } = useAuth();

  return (
    <div style={{ padding: '20px' }}>
      <Card>
        <Title level={2}>마이페이지</Title>
        <p>안녕하세요, {user?.name}님!</p>
        <p>역할: {user?.role === 'professor' ? '교수' : '학생'}</p>
        <p>이메일: {user?.email}</p>
        {user?.studentId && <p>학번: {user.studentId}</p>}
      </Card>
    </div>
  );
};

export default MyPage;