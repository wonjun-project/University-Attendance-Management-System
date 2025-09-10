import React, { useState, useEffect } from 'react';
import { Layout, Menu, Avatar, Dropdown, Space, Button, message, theme, Drawer } from 'antd';
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
import { useTheme } from '../../styles/ThemeContext';
import BottomNavigation from '../Navigation/BottomNavigation';
import styled from 'styled-components';

const { Header, Sider, Content } = Layout;

// 스타일드 컴포넌트
const StyledLayout = styled(Layout)`
  min-height: 100vh;
  background: ${({ theme }) => theme.colors.background.secondary};
`;

const StyledHeader = styled(Header)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 ${({ theme }) => theme.spacing.md};
  /* Telegram 스타일: 파란색 헤더 */
  background: ${({ theme }) => theme.colors.primary[500]};
  border-bottom: 1px solid ${({ theme }) => theme.colors.primary[600]};
  /* 그림자 제거 */
  height: 56px;
  color: white;
  
  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    padding: 0 ${({ theme }) => theme.spacing.md};
  }
`;

const LogoArea = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  font-size: 18px;
  font-weight: 600;
  color: white;
`;

const UserArea = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
`;

const StyledContent = styled(Content)`
  /* Telegram 스타일: 단순한 콘텐츠 레이아웃 */
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  background: ${({ theme }) => theme.colors.background.primary};
  min-height: calc(100vh - 56px);
  
  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    padding: 16px;
    padding-bottom: 80px; /* 하단 네비게이션 공간 */
  }
`;

const MobileDrawer = styled(Drawer)`
  .ant-drawer-body {
    padding: 0;
    background: ${({ theme }) => theme.colors.background.primary};
  }
  
  .ant-drawer-header {
    background: ${({ theme }) => theme.colors.primary[500]};
    color: ${({ theme }) => theme.colors.text.inverse};
    border-bottom: none;
  }
  
  .ant-drawer-close {
    color: ${({ theme }) => theme.colors.text.inverse};
    
    &:hover {
      background: ${({ theme }) => theme.colors.primary[600]};
    }
  }
`;

const ResponsiveLayout = styled(Layout)`
  /* 모바일에서는 사이드바 완전 숨김 */
  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    .ant-layout-sider {
      display: none !important;
    }
    
    /* 헤더에서 햄버거 메뉴 버튼도 숨김 */
    .mobile-menu-button {
      display: none !important;
    }
  }
  
  /* 데스크톱에서는 하단 네비게이션 숨김 */
  @media (min-width: ${({ theme }) => theme.breakpoints.mobile}) {
    .bottom-navigation {
      display: none !important;
    }
  }
`;

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const { user, logout } = useAuth();
  const { theme: currentTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = theme.useToken();

  // 화면 크기 감지
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  // 무한 루프 방지를 위한 useEffect 안정화
  const currentPath = location.pathname;

  // 데스크톱용 간소화된 메뉴 (대시보드만)
  const getMenuItems = (): MenuProps['items'] => {
    return [
      {
        key: '/dashboard',
        icon: <DashboardOutlined />,
        label: '대시보드',
      },
    ];
  };

  // 메뉴 클릭 핸들러
  const handleMenuClick: MenuProps['onClick'] = (e) => {
    navigate(e.key);
    if (isMobile) {
      setMobileDrawerOpen(false);
    }
  };

  // 햄버거 메뉴 클릭 핸들러
  const handleMenuToggle = () => {
    if (isMobile) {
      setMobileDrawerOpen(!mobileDrawerOpen);
    } else {
      setCollapsed(!collapsed);
    }
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
      key: 'my-page',
      icon: <UserOutlined />,
      label: '마이페이지',
      onClick: () => navigate('/my-page'),
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

  const menuContent = (
    <div>
      <LogoArea style={{ 
        padding: '16px 24px',
        borderBottom: `1px solid ${token.colorBorder}`,
        marginBottom: '8px'
      }}>
        📚 출결체크
      </LogoArea>
      
      <Menu
        theme="light"
        mode="inline"
        selectedKeys={[currentPath]}
        items={getMenuItems()}
        onClick={handleMenuClick}
        style={{ borderRight: 'none' }}
      />
    </div>
  );

  return (
    <ResponsiveLayout>
      {/* 데스크톱 사이드바 */}
      {!isMobile && (
        <Sider 
          trigger={null} 
          collapsible 
          collapsed={collapsed}
          style={{
            background: token.colorBgContainer,
            borderRight: `1px solid ${token.colorBorder}`,
          }}
        >
          {menuContent}
        </Sider>
      )}

      {/* 모바일 드로어 */}
      <MobileDrawer
        title="📚 출결체크"
        placement="left"
        open={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        width={280}
        style={{ display: isMobile ? 'block' : 'none' }}
      >
        <Menu
          theme="light"
          mode="inline"
          selectedKeys={[currentPath]}
          items={getMenuItems()}
          onClick={handleMenuClick}
          style={{ 
            borderRight: 'none',
            background: 'transparent'
          }}
        />
      </MobileDrawer>

      <Layout>
        <StyledHeader>
          <Button
            type="text"
            icon={isMobile ? <MenuUnfoldOutlined /> : (collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />)}
            onClick={handleMenuToggle}
            className="mobile-menu-button"
            style={{ fontSize: '16px' }}
          />

          <UserArea>
            <Space>
              {!isMobile && (
                <span style={{ color: token.colorTextSecondary }}>
                  {user?.role === 'professor' ? '교수' : '학생'}
                </span>
              )}
              <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
                <Space style={{ cursor: 'pointer' }}>
                  <Avatar icon={<UserOutlined />} />
                  {!isMobile && <span>{user?.name}</span>}
                </Space>
              </Dropdown>
            </Space>
          </UserArea>
        </StyledHeader>

        <StyledContent>
          {children}
        </StyledContent>
        
        {/* 모바일 하단 네비게이션 */}
        <div className="bottom-navigation">
          <BottomNavigation />
        </div>
      </Layout>
    </ResponsiveLayout>
  );
};

export default MainLayout;