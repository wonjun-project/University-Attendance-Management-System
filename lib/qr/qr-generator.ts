import QRCode from 'qrcode'

export interface QRCodeOptions {
  width?: number
  margin?: number
  color?: {
    dark?: string
    light?: string
  }
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H'
}

export interface QRCodeData {
  sessionId: string
  courseId: string
  expiresAt: string
  type: 'attendance'
  baseUrl?: string
}

export class QRCodeGenerator {
  private static defaultOptions: QRCodeOptions = {
    width: 400,
    margin: 2,
    color: {
      dark: '#0369a1', // primary-700
      light: '#ffffff'
    },
    errorCorrectionLevel: 'H'
  }

  static async generateDataURL(
    data: QRCodeData,
    options: QRCodeOptions = {}
  ): Promise<string> {
    const mergedOptions = { ...this.defaultOptions, ...options }
    const jsonString = JSON.stringify(data)
    console.log('🔑 [QRCodeGenerator] QR에 인코딩되는 문자열:', jsonString)
    
    try {
      const dataURL = await QRCode.toDataURL(jsonString, {
        width: mergedOptions.width,
        margin: mergedOptions.margin,
        color: mergedOptions.color,
        errorCorrectionLevel: mergedOptions.errorCorrectionLevel
      })
      
      return dataURL
    } catch (error) {
      console.error('QR code generation failed:', error)
      throw new Error('QR코드 생성에 실패했습니다.')
    }
  }

  static async generateSVG(
    data: QRCodeData, 
    options: QRCodeOptions = {}
  ): Promise<string> {
    const mergedOptions = { ...this.defaultOptions, ...options }
    const jsonString = JSON.stringify(data)
    
    try {
      const svg = await QRCode.toString(jsonString, {
        type: 'svg',
        width: mergedOptions.width,
        margin: mergedOptions.margin,
        color: mergedOptions.color,
        errorCorrectionLevel: mergedOptions.errorCorrectionLevel
      })
      
      return svg
    } catch (error) {
      console.error('QR code SVG generation failed:', error)
      throw new Error('QR코드 SVG 생성에 실패했습니다.')
    }
  }

  static parseQRData(qrString: string): QRCodeData | null {
    try {
      const data = JSON.parse(qrString)
      
      // Validate required fields
      if (!data.sessionId || !data.courseId || !data.expiresAt || data.type !== 'attendance') {
        return null
      }
      
      return data as QRCodeData
    } catch (error) {
      console.error('QR code parsing failed:', error)
      return null
    }
  }

  static isExpired(qrData: QRCodeData): boolean {
    const expirationDate = new Date(qrData.expiresAt)
    return expirationDate < new Date()
  }

  static getTimeRemaining(qrData: QRCodeData): number {
    const expirationDate = new Date(qrData.expiresAt)
    const now = new Date()
    return Math.max(0, expirationDate.getTime() - now.getTime())
  }

  static formatTimeRemaining(milliseconds: number): string {
    const minutes = Math.floor(milliseconds / (1000 * 60))
    const seconds = Math.floor((milliseconds % (1000 * 60)) / 1000)
    
    if (minutes > 0) {
      return `${minutes}분 ${seconds}초`
    }
    return `${seconds}초`
  }
}