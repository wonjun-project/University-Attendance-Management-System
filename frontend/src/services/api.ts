import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';

// API 응답 타입 정의
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    details?: any;
    statusCode: number;
  };
  message?: string;
  timestamp: string;
}

// 사용자 관련 타입
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  confirmPassword: string;
  name: string;
  role: 'student' | 'professor';
  studentId?: string;
  phone?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: 'student' | 'professor';
  studentId?: string;
  phone?: string;
}

// API 클라이언트 생성
class ApiClient {
  private client: AxiosInstance;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // 로컬 스토리지에서 토큰 복원
    this.loadTokensFromStorage();

    // 요청 인터셉터: Authorization 헤더 추가
    this.client.interceptors.request.use(
      (config) => {
        if (this.accessToken) {
          config.headers.Authorization = `Bearer ${this.accessToken}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // 응답 인터셉터: 토큰 만료 처리
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as any;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            await this.refreshAccessToken();
            // 원래 요청 재시도
            if (this.accessToken) {
              originalRequest.headers.Authorization = `Bearer ${this.accessToken}`;
            }
            return this.client.request(originalRequest);
          } catch (refreshError) {
            // 리프레시 토큰도 만료된 경우 로그아웃 처리
            this.clearTokens();
            window.location.href = '/login';
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  // 로컬 스토리지에서 토큰 로드
  private loadTokensFromStorage(): void {
    this.accessToken = localStorage.getItem('accessToken');
    this.refreshToken = localStorage.getItem('refreshToken');
  }

  // 토큰 저장
  private saveTokensToStorage(tokens: AuthTokens): void {
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
    this.accessToken = tokens.accessToken;
    this.refreshToken = tokens.refreshToken;
  }

  // 토큰 삭제
  private clearTokens(): void {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userProfile');
    this.accessToken = null;
    this.refreshToken = null;
  }

  // 토큰 갱신
  private async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken) {
      throw new Error('리프레시 토큰이 없습니다.');
    }

    const response: AxiosResponse<ApiResponse<{ tokens: AuthTokens }>> = await axios.post(
      `${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'}/api/auth/refresh`,
      { refreshToken: this.refreshToken }
    );

    if (response.data.success && response.data.data?.tokens) {
      this.saveTokensToStorage(response.data.data.tokens);
    } else {
      throw new Error('토큰 갱신에 실패했습니다.');
    }
  }

  // 인증 API
  async login(credentials: LoginCredentials): Promise<{ user: UserProfile; tokens: AuthTokens }> {
    console.log('🚀 실제 백엔드 로그인 API 호출:', credentials.email);
    
    try {
      const response: AxiosResponse<ApiResponse<{ user: UserProfile; tokens: AuthTokens }>> = 
        await this.client.post('/api/auth/login', credentials);

      if (response.data.success && response.data.data) {
        this.saveTokensToStorage(response.data.data.tokens);
        localStorage.setItem('userProfile', JSON.stringify(response.data.data.user));
        console.log('✅ 백엔드 로그인 성공:', response.data.data.user);
        return response.data.data;
      }

      throw new Error(response.data.error?.message || '로그인에 실패했습니다.');
    } catch (error: any) {
      console.error('❌ 백엔드 로그인 실패:', error);
      
      // 네트워크 오류일 경우 상세 메시지 제공
      if (error.code === 'ECONNREFUSED' || error.message.includes('Network Error')) {
        throw new Error('서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.');
      }
      
      throw new Error(error.response?.data?.error?.message || error.message || '로그인 중 오류가 발생했습니다.');
    }
  }

  async register(data: RegisterData): Promise<{ user: UserProfile; tokens: AuthTokens }> {
    const response: AxiosResponse<ApiResponse<{ user: UserProfile; tokens: AuthTokens }>> = 
      await this.client.post('/api/auth/register', data);

    if (response.data.success && response.data.data) {
      this.saveTokensToStorage(response.data.data.tokens);
      localStorage.setItem('userProfile', JSON.stringify(response.data.data.user));
      return response.data.data;
    }

    throw new Error(response.data.error?.message || '회원가입에 실패했습니다.');
  }

  async logout(): Promise<void> {
    try {
      await this.client.post('/api/auth/logout');
    } catch (error) {
      console.warn('로그아웃 API 호출 실패:', error);
    } finally {
      this.clearTokens();
    }
  }

  async getCurrentUser(): Promise<UserProfile> {
    const response: AxiosResponse<ApiResponse<{ user: UserProfile }>> = 
      await this.client.get('/api/auth/me');

    if (response.data.success && response.data.data?.user) {
      return response.data.data.user;
    }

    throw new Error(response.data.error?.message || '사용자 정보를 가져올 수 없습니다.');
  }

  // 강의 API
  async getCourses(): Promise<any[]> {
    try {
      const response: AxiosResponse<ApiResponse<{ courses: any[] }>> = 
        await this.client.get('/api/courses');

      if (response.data.success && response.data.data?.courses) {
        return response.data.data.courses;
      }

      throw new Error(response.data.error?.message || '강의 목록을 가져올 수 없습니다.');
    } catch (error) {
      console.warn('백엔드 연결 실패로 빈 강의 목록 반환:', error);
      return [];
    }
  }

  async getCourse(courseId: string): Promise<any> {
    const response: AxiosResponse<ApiResponse<{ course: any }>> = 
      await this.client.get(`/api/courses/${courseId}`);

    if (response.data.success && response.data.data?.course) {
      return response.data.data.course;
    }

    throw new Error(response.data.error?.message || '강의 정보를 가져올 수 없습니다.');
  }

  async createCourse(courseData: any): Promise<any> {
    const response: AxiosResponse<ApiResponse<{ course: any }>> = 
      await this.client.post('/api/courses', courseData);

    if (response.data.success && response.data.data?.course) {
      return response.data.data.course;
    }

    throw new Error(response.data.error?.message || '강의 생성에 실패했습니다.');
  }

  // 출석 API
  async getAttendanceSessions(courseId: string): Promise<any[]> {
    const response: AxiosResponse<ApiResponse<{ sessions: any[] }>> = 
      await this.client.get(`/api/attendance/sessions/${courseId}`);

    if (response.data.success && response.data.data?.sessions) {
      return response.data.data.sessions;
    }

    throw new Error(response.data.error?.message || '출석 세션을 가져올 수 없습니다.');
  }

  async createAttendanceSession(sessionData: {
    courseId: string;
    sessionDate: string;
    authCode?: string;
  }): Promise<any> {
    const response: AxiosResponse<ApiResponse<{ session: any }>> = 
      await this.client.post('/api/attendance/sessions', sessionData);

    if (response.data.success && response.data.data?.session) {
      return response.data.data.session;
    }

    throw new Error(response.data.error?.message || '출석 세션 생성에 실패했습니다.');
  }

  async generateQRCode(sessionId: string, options?: { width?: number; height?: number }): Promise<{
    qrCodeImage: string;
    sessionInfo: any;
  }> {
    const response: AxiosResponse<ApiResponse<{
      qrCodeImage: string;
      sessionInfo: any;
    }>> = await this.client.post(`/api/attendance/sessions/${sessionId}/generate-qr`, options || {});

    if (response.data.success && response.data.data) {
      return response.data.data;
    }

    throw new Error(response.data.error?.message || 'QR 코드 생성에 실패했습니다.');
  }

  async activateSession(sessionId: string, isActive: boolean): Promise<any> {
    const response: AxiosResponse<ApiResponse<{ session: any }>> = 
      await this.client.put(`/api/attendance/sessions/${sessionId}/activate`, { isActive });

    if (response.data.success && response.data.data?.session) {
      return response.data.data.session;
    }

    throw new Error(response.data.error?.message || '세션 상태 변경에 실패했습니다.');
  }

  async checkAttendance(qrCode: string): Promise<any> {
    const response: AxiosResponse<ApiResponse<any>> = 
      await this.client.post('/api/attendance/check', { qrCode });

    if (response.data.success && response.data.data) {
      return response.data.data;
    }

    throw new Error(response.data.error?.message || '출석 체크에 실패했습니다.');
  }

  async getAttendanceRecords(courseId: string): Promise<any[]> {
    const response: AxiosResponse<ApiResponse<{ records: any[] }>> = 
      await this.client.get(`/api/attendance/records/${courseId}`);

    if (response.data.success && response.data.data?.records) {
      return response.data.data.records;
    }

    throw new Error(response.data.error?.message || '출석 기록을 가져올 수 없습니다.');
  }

  async getAttendanceStats(courseId: string): Promise<any> {
    const response: AxiosResponse<ApiResponse<{ stats: any }>> = 
      await this.client.get(`/api/attendance/stats/${courseId}`);

    if (response.data.success && response.data.data?.stats) {
      return response.data.data.stats;
    }

    throw new Error(response.data.error?.message || '출석 통계를 가져올 수 없습니다.');
  }

  async getMyAttendanceRecords(courseId?: string, limit = 50, offset = 0): Promise<{
    records: any[];
    stats: any;
    pagination: any;
  }> {
    const params: any = { limit, offset };
    if (courseId) params.courseId = courseId;

    const response: AxiosResponse<ApiResponse<{
      records: any[];
      stats: any;
      pagination: any;
    }>> = await this.client.get('/api/attendance/my-records', { params });

    if (response.data.success && response.data.data) {
      return response.data.data;
    }

    throw new Error(response.data.error?.message || '출석 기록을 가져올 수 없습니다.');
  }

  async getMyAttendanceStats(): Promise<{
    courseStats: any[];
    totalStats: any;
  }> {
    const response: AxiosResponse<ApiResponse<{
      courseStats: any[];
      totalStats: any;
    }>> = await this.client.get('/api/attendance/my-stats');

    if (response.data.success && response.data.data) {
      return response.data.data;
    }

    throw new Error(response.data.error?.message || '출석 통계를 가져올 수 없습니다.');
  }

  async getProfessorSessions(courseId?: string, limit = 20, offset = 0): Promise<{
    sessions: any[];
    pagination: any;
  }> {
    const params: any = { limit, offset };
    if (courseId) params.courseId = courseId;

    const response: AxiosResponse<ApiResponse<{
      sessions: any[];
      pagination: any;
    }>> = await this.client.get('/api/attendance/professor/sessions', { params });

    if (response.data.success && response.data.data) {
      return response.data.data;
    }

    throw new Error(response.data.error?.message || '출석 세션을 가져올 수 없습니다.');
  }

  async getCourseAttendanceStats(courseId: string): Promise<{
    courseInfo: any;
    overallStats: any;
    studentStats: any[];
    sessionStats: any[];
  }> {
    const response: AxiosResponse<ApiResponse<{
      courseInfo: any;
      overallStats: any;
      studentStats: any[];
      sessionStats: any[];
    }>> = await this.client.get(`/api/attendance/professor/course-stats/${courseId}`);

    if (response.data.success && response.data.data) {
      return response.data.data;
    }

    throw new Error(response.data.error?.message || '강의 출석 통계를 가져올 수 없습니다.');
  }

  async updateManualAttendance(sessionId: string, studentId: string, status: string, reason?: string): Promise<any> {
    const response: AxiosResponse<ApiResponse<any>> = await this.client.put('/api/attendance/professor/manual-attendance', {
      sessionId,
      studentId,
      status,
      reason
    });

    if (response.data.success && response.data.data) {
      return response.data.data;
    }

    throw new Error(response.data.error?.message || '수동 출석 처리에 실패했습니다.');
  }

  // GPS 위치 검증 API
  async verifyLocation(locationData: {
    recordId: string;
    studentLatitude: number;
    studentLongitude: number;
    accuracy?: number;
  }): Promise<any> {
    const response: AxiosResponse<ApiResponse<any>> = 
      await this.client.post('/api/attendance/verify-location', locationData);

    if (response.data.success && response.data.data) {
      return response.data.data;
    }

    throw new Error(response.data.error?.message || 'GPS 위치 검증에 실패했습니다.');
  }

  // 인증코드 검증 API
  async verifyAuthCode(authData: {
    recordId: string;
    authCode: string;
  }): Promise<any> {
    const response: AxiosResponse<ApiResponse<any>> = 
      await this.client.post('/api/attendance/verify-auth-code', authData);

    if (response.data.success && response.data.data) {
      return response.data.data;
    }

    throw new Error(response.data.error?.message || '인증코드 검증에 실패했습니다.');
  }

  // 범용 POST 메서드 (필요시 사용)
  async post<T = any>(url: string, data?: any): Promise<T> {
    const response: AxiosResponse<ApiResponse<T>> = 
      await this.client.post(url, data);

    if (response.data.success && response.data.data) {
      return response.data.data;
    }

    throw new Error(response.data.error?.message || 'API 요청에 실패했습니다.');
  }

  // 현재 로그인 상태 확인
  isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  // 저장된 사용자 프로필 가져오기
  getStoredUserProfile(): UserProfile | null {
    const stored = localStorage.getItem('userProfile');
    return stored ? JSON.parse(stored) : null;
  }
}

// 전역 API 클라이언트 인스턴스
export const apiClient = new ApiClient();