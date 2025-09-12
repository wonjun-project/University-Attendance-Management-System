import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { HomeOutlined } from '@ant-design/icons';
import styled from 'styled-components';
import { useAuth } from '../../store/AuthContext';

interface NavItem {
  key: string;
  icon: React.ReactNode;
  label: string;
  path: string;
  roles: ('student' | 'professor')[];
}

// 간소화된 하단 네비게이션 (대시보드만)
const navItems: NavItem[] = [
  {
    key: 'dashboard',
    icon: <HomeOutlined />,
    label: '홈',
    path: '/dashboard',
    roles: ['student', 'professor'],
  },
];

const BottomNavContainer = styled.div`
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: ${({ theme }) => theme.colors.background.elevated};
  border-top: 1px solid ${({ theme }) => theme.colors.border.light};
  backdrop-filter: blur(20px);
  z-index: ${({ theme }) => theme.zIndex.fixed};
  padding: env(safe-area-inset-bottom) ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.xs};
  
  @media (min-width: ${({ theme }) => theme.breakpoints.tablet}) {
    display: none;
  }
`;

const NavGrid = styled.div<{ itemCount: number }>`
  display: grid;
  grid-template-columns: repeat(${({ itemCount }) => Math.min(itemCount, 4)}, 1fr);
  gap: ${({ theme }) => theme.spacing.xs};
  max-width: 500px;
  margin: 0 auto;
`;

const StyledNavItem = styled.button<{ $active: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.xs};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all ${({ theme }) => theme.transitions.fast};
  min-height: 64px;
  position: relative;
  overflow: hidden;
  flex: 1;

  ${({ $active, theme }) => $active && `
    background: ${theme.colors.primary[50]};
    color: ${theme.colors.primary[600]};
    
    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 24px;
      height: 3px;
      background: ${theme.colors.primary[500]};
      border-radius: 0 0 ${theme.borderRadius.sm} ${theme.borderRadius.sm};
    }
  `}

  &:hover:not(:disabled) {
    background: ${({ theme, $active }) => 
      $active ? theme.colors.primary[100] : theme.colors.background.secondary};
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }
`;

const NavIcon = styled.div<{ $active: boolean }>`
  font-size: 20px;
  color: ${({ $active, theme }) => 
    $active ? theme.colors.primary[600] : theme.colors.text.secondary};
  margin-bottom: 4px;
  transition: all ${({ theme }) => theme.transitions.fast};
  
  ${({ $active }) => $active && `
    transform: scale(1.1);
  `}
`;

const NavLabel = styled.span<{ $active: boolean }>`
  font-size: 10px;
  font-weight: ${({ theme, $active }) => 
    $active ? theme.typography.fontWeight.semibold : theme.typography.fontWeight.medium};
  color: ${({ $active, theme }) => 
    $active ? theme.colors.primary[600] : theme.colors.text.secondary};
  line-height: 1.1;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 70px;
`;

const BottomNavigation: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  if (!user) return null;

  const userNavItems = navItems.filter(item => 
    item.roles.includes(user.role)
  );

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  return (
    <BottomNavContainer>
      <NavGrid itemCount={userNavItems.length}>
        {userNavItems.map((item) => (
          <StyledNavItem
            key={item.key}
            $active={isActive(item.path)}
            onClick={() => handleNavigation(item.path)}
            type="button"
          >
            <NavIcon $active={isActive(item.path)}>
              {item.icon}
            </NavIcon>
            <NavLabel $active={isActive(item.path)}>
              {item.label}
            </NavLabel>
          </StyledNavItem>
        ))}
      </NavGrid>
    </BottomNavContainer>
  );
};

export default BottomNavigation;