import { createGlobalStyle } from 'styled-components';
import { Theme } from './theme';

interface GlobalStyleProps {
  theme: Theme;
}

export const GlobalStyle = createGlobalStyle<GlobalStyleProps>`
  /* CSS Reset */
  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  html {
    font-size: 16px;
    line-height: 1.5;
    -webkit-text-size-adjust: 100%;
    -webkit-tap-highlight-color: transparent;
  }

  body {
    font-family: ${({ theme }) => theme.typography.fontFamily.sans};
    font-size: ${({ theme }) => theme.typography.fontSize.base};
    font-weight: ${({ theme }) => theme.typography.fontWeight.normal};
    line-height: ${({ theme }) => theme.typography.lineHeight.normal};
    color: ${({ theme }) => theme.colors.text.primary};
    background-color: ${({ theme }) => theme.colors.background.primary};
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    overflow-x: hidden;
  }

  /* 모바일 최적화 */
  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    body {
      font-size: ${({ theme }) => theme.typography.fontSize.sm};
    }
  }

  /* Telegram 스타일 링크 */
  a {
    color: ${({ theme }) => theme.colors.primary[500]};
    text-decoration: none;
    transition: none; /* 트랜지션 제거 */

    &:hover, &:focus {
      color: ${({ theme }) => theme.colors.primary[600]};
      /* 언더라인 제거 */
    }

    &:focus-visible {
      outline: 1px solid ${({ theme }) => theme.colors.primary[500]};
      outline-offset: 1px;
    }
  }

  /* Telegram 스타일 버튼 */
  button {
    font-family: inherit;
    font-size: inherit;
    line-height: inherit;
    color: inherit;
    background: none;
    border: none;
    cursor: pointer;
    transition: none; /* 트랜지션 제거 */

    &:focus-visible {
      outline: 1px solid ${({ theme }) => theme.colors.primary[500]};
      outline-offset: 1px;
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.5; /* 더 뚜렷한 비활성화 */
    }
  }

  /* Telegram 스타일 입력 필드 */
  input, textarea, select {
    font-family: inherit;
    font-size: inherit;
    line-height: inherit;
    color: inherit;
    background-color: ${({ theme }) => theme.colors.background.primary};
    border: 1px solid ${({ theme }) => theme.colors.border.medium};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    transition: none; /* 트랜지션 제거 */

    &:focus {
      outline: none;
      border-color: ${({ theme }) => theme.colors.primary[500]};
      /* 그림자 제거 */
    }

    &::placeholder {
      color: ${({ theme }) => theme.colors.text.disabled};
    }

    &:disabled {
      background-color: ${({ theme }) => theme.colors.background.secondary};
      color: ${({ theme }) => theme.colors.text.disabled};
      cursor: not-allowed;
    }
  }

  /* 스크롤바 스타일링 */
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  ::-webkit-scrollbar-track {
    background: ${({ theme }) => theme.colors.background.secondary};
  }

  ::-webkit-scrollbar-thumb {
    background-color: ${({ theme }) => theme.colors.gray[400]};
    border-radius: ${({ theme }) => theme.borderRadius.full};
    border: 2px solid ${({ theme }) => theme.colors.background.primary};

    &:hover {
      background-color: ${({ theme }) => theme.colors.gray[500]};
    }
  }

  /* 선택 영역 스타일 */
  ::selection {
    background-color: ${({ theme }) => theme.colors.primary[100]};
    color: ${({ theme }) => theme.colors.primary[900]};
  }

  /* 이미지 최적화 */
  img, picture, video, canvas, svg {
    display: block;
    max-width: 100%;
    height: auto;
  }

  /* 제목 태그 스타일 */
  h1, h2, h3, h4, h5, h6 {
    font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
    line-height: ${({ theme }) => theme.typography.lineHeight.tight};
    color: ${({ theme }) => theme.colors.text.primary};
  }

  h1 {
    font-size: ${({ theme }) => theme.typography.fontSize['3xl']};
    font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  }

  h2 {
    font-size: ${({ theme }) => theme.typography.fontSize['2xl']};
  }

  h3 {
    font-size: ${({ theme }) => theme.typography.fontSize.xl};
  }

  h4 {
    font-size: ${({ theme }) => theme.typography.fontSize.lg};
  }

  h5, h6 {
    font-size: ${({ theme }) => theme.typography.fontSize.base};
  }

  /* 문단 스타일 */
  p {
    margin-bottom: ${({ theme }) => theme.spacing.md};
    color: ${({ theme }) => theme.colors.text.secondary};
    line-height: ${({ theme }) => theme.typography.lineHeight.relaxed};
  }

  /* 리스트 스타일 */
  ul, ol {
    padding-left: ${({ theme }) => theme.spacing.lg};
    margin-bottom: ${({ theme }) => theme.spacing.md};
  }

  li {
    margin-bottom: ${({ theme }) => theme.spacing.xs};
    color: ${({ theme }) => theme.colors.text.secondary};
  }

  /* 코드 스타일 */
  code {
    font-family: ${({ theme }) => theme.typography.fontFamily.mono};
    font-size: 0.875em;
    background-color: ${({ theme }) => theme.colors.background.secondary};
    color: ${({ theme }) => theme.colors.primary[600]};
    padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
    border-radius: ${({ theme }) => theme.borderRadius.sm};
  }

  pre {
    font-family: ${({ theme }) => theme.typography.fontFamily.mono};
    background-color: ${({ theme }) => theme.colors.background.secondary};
    color: ${({ theme }) => theme.colors.text.primary};
    padding: ${({ theme }) => theme.spacing.md};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    overflow-x: auto;
    margin-bottom: ${({ theme }) => theme.spacing.md};
  }

  /* 구분선 */
  hr {
    border: none;
    height: 1px;
    background-color: ${({ theme }) => theme.colors.border.medium};
    margin: ${({ theme }) => theme.spacing.lg} 0;
  }

  /* 테이블 스타일 */
  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: ${({ theme }) => theme.spacing.lg};
  }

  th, td {
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
    text-align: left;
    border-bottom: 1px solid ${({ theme }) => theme.colors.border.light};
  }

  th {
    font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
    color: ${({ theme }) => theme.colors.text.primary};
    background-color: ${({ theme }) => theme.colors.background.secondary};
  }

  /* 모바일 터치 최적화 */
  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    button, input, select, textarea, a {
      min-height: 44px; /* iOS 권장 최소 터치 영역 */
    }
    
    /* 모바일에서 스크롤 부드럽게 */
    html {
      -webkit-overflow-scrolling: touch;
    }
  }

  /* 접근성 개선 */
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }

  /* 고대비 모드 지원 */
  @media (prefers-contrast: high) {
    button, input, select, textarea {
      border-width: 2px;
    }
  }
`;

export default GlobalStyle;