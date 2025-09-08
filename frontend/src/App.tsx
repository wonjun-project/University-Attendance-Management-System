import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { ConfigProvider, App as AntApp } from 'antd';
import koKR from 'antd/locale/ko_KR';
import { AuthProvider } from './store/AuthContext';
import AppRouter from './components/Router/AppRouter';
import './App.css';

// Ant Design 테마 설정
const theme = {
  token: {
    colorPrimary: '#1890ff',
    colorSuccess: '#52c41a',
    colorWarning: '#faad14',
    colorError: '#f5222d',
    borderRadius: 8,
    fontFamily: `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB',
      'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif, 'Apple Color Emoji',
      'Segoe UI Emoji', 'Segoe UI Symbol'`,
  },
  components: {
    Button: {
      borderRadius: 8,
    },
    Card: {
      borderRadius: 12,
    },
    Input: {
      borderRadius: 8,
    },
    Select: {
      borderRadius: 8,
    },
  },
};

function App() {
  return (
    <ConfigProvider locale={koKR} theme={theme}>
      <AntApp>
        <Router>
          <AuthProvider>
            <div className="App">
              <AppRouter />
            </div>
          </AuthProvider>
        </Router>
      </AntApp>
    </ConfigProvider>
  );
}

export default App;
