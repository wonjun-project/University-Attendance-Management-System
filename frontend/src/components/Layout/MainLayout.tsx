import React, { useState } from 'react';
import { Layout, Menu, Avatar, Dropdown, Space, Button, message, theme } from 'antd';
import type { MenuProps } from 'antd';
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  DashboardOutlined,
  BookOutlined,
  CalendarOutlined,
  BarChartOutlined,
  UserOutlined,
  LogoutOutlined,
  QrcodeOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import styled from 'styled-components';

const { Header, Sider, Content } = Layout;

// 스타일드 컴포넌트
const StyledLayout = styled(Layout)`
  min-height: 100vh;
`;

const StyledHeader = styled(Header)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
`;

const LogoArea = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 18px;
  font-weight: 600;
  color: #1890ff;
`;

const UserArea = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
`;

const StyledContent = styled(Content)`
  margin: 24px;
  padding: 24px;
  background: #fff;
  border-radius: 8px;
  min-height: 360px;
`;

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = theme.useToken();

  // 메뉴 아이템 정의 (역할별 분기)
  const getMenuItems = (): MenuProps['items'] => {
    const commonItems = [
      {
        key: '/dashboard',
        icon: <DashboardOutlined />,
        label: '대시보드',
      },
    ];

    if (user?.role === 'professor') {
      return [
        ...commonItems,
        {
          key: '/courses',
          icon: <BookOutlined />,
          label: '강의 관리',
        },
        {
          key: '/attendance/sessions',
          icon: <CalendarOutlined />,
          label: '출석 관리',
        },
        {
          key: '/qr-generator',
          icon: <QrcodeOutlined />,
          label: 'QR 생성',
        },
        {
          key: '/statistics',
          icon: <BarChartOutlined />,
          label: '출석 통계',
        },
      ];
    } else {
      return [
        ...commonItems,
        {
          key: '/my-courses',
          icon: <BookOutlined />,
          label: '수강 강의',
        },
        {
          key: '/attendance/scan',
          icon: <QrcodeOutlined />,
          label: '출석 체크',
        },
        {
          key: '/attendance/records',
          icon: <CalendarOutlined />,
          label: '출석 현황',
        },
        {
          key: '/location-test',
          icon: <EnvironmentOutlined />,
          label: '위치 테스트',
        },
      ];
    }
  };

  // 메뉴 클릭 핸들러
  const handleMenuClick: MenuProps['onClick'] = (e) => {
    navigate(e.key);
  };

  // 로그아웃 처리
  const handleLogout = async () => {
    try {
      await logout();
      message.success('로그아웃되었습니다.');
      navigate('/login');
    } catch (error) {
      console.error('로그아웃 오류:', error);
      message.error('로그아웃 중 오류가 발생했습니다.');
    }
  };

  // 사용자 드롭다운 메뉴
  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '프로필',
      onClick: () => navigate('/profile'),
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '로그아웃',
      onClick: handleLogout,
    },
  ];

  return (
    <StyledLayout>
      <Sider 
        trigger={null} 
        collapsible 
        collapsed={collapsed}
        style={{
          background: token.colorBgContainer,
          borderRight: `1px solid ${token.colorBorder}`,
        }}
      >
        <LogoArea style={{ 
          padding: collapsed ? '16px 12px' : '16px 24px',
          borderBottom: `1px solid ${token.colorBorder}`,
          marginBottom: '8px'
        }}>
          {!collapsed && '📚 출결시스템'}
        </LogoArea>
        
        <Menu
          theme="light"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={getMenuItems()}
          onClick={handleMenuClick}
          style={{ borderRight: 'none' }}
        />
      </Sider>

      <Layout>
        <StyledHeader>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{ fontSize: '16px' }}
          />

          <UserArea>
            <Space>
              <span style={{ color: token.colorTextSecondary }}>
                {user?.role === 'professor' ? '교수' : '학생'}
              </span>
              <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
                <Space style={{ cursor: 'pointer' }}>
                  <Avatar icon={<UserOutlined />} />
                  <span>{user?.name}</span>
                </Space>
              </Dropdown>
            </Space>
          </UserArea>
        </StyledHeader>

        <StyledContent>
          {children}
        </StyledContent>
      </Layout>
    </StyledLayout>
  );
};

export default MainLayout;