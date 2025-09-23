#!/usr/bin/env node

/**
 * 현재 세션 상태 확인 스크립트
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ 환경변수가 설정되지 않았습니다.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkSessions() {
  console.log('🔍 세션 상태 확인 중...\n');

  // 모든 활성 세션 조회
  const { data: sessions, error } = await supabase
    .from('class_sessions')
    .select('id, status, qr_code, created_at, qr_code_expires_at')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('❌ 세션 조회 실패:', error);
    return;
  }

  console.log(`📊 총 ${sessions?.length || 0}개의 활성 세션 발견\n`);

  sessions?.forEach((session, index) => {
    console.log(`\n세션 ${index + 1}:`);
    console.log(`  ID: ${session.id}`);
    console.log(`  상태: ${session.status}`);
    console.log(`  만료시간: ${session.qr_code_expires_at}`);

    // QR 코드 타입 분석
    const qrCode = session.qr_code;
    if (!qrCode) {
      console.log(`  QR 타입: 없음`);
    } else if (qrCode.startsWith('{')) {
      console.log(`  QR 타입: ✅ JSON`);
      try {
        const parsed = JSON.parse(qrCode);
        console.log(`  - sessionId: ${parsed.sessionId}`);
        console.log(`  - courseId: ${parsed.courseId}`);
        console.log(`  - type: ${parsed.type}`);
        console.log(`  - baseUrl: ${parsed.baseUrl}`);
      } catch (e) {
        console.log(`  - JSON 파싱 실패:`, e.message);
      }
    } else if (qrCode.startsWith('http')) {
      console.log(`  QR 타입: ⚠️ URL`);
      console.log(`  - URL: ${qrCode.substring(0, 60)}...`);
    } else {
      console.log(`  QR 타입: ❓ 알 수 없음`);
      console.log(`  - 데이터: ${qrCode.substring(0, 60)}...`);
    }
  });

  // 세션 ID 테스트
  const testSessionId = sessions?.[0]?.id;
  if (testSessionId) {
    console.log('\n\n🧪 첫 번째 세션으로 조회 테스트...');

    const { data: testSession, error: testError } = await supabase
      .from('class_sessions')
      .select('id, status')
      .eq('id', testSessionId)
      .eq('status', 'active')
      .single();

    if (testError) {
      console.error('❌ 테스트 조회 실패:', testError);
    } else {
      console.log('✅ 테스트 조회 성공:', testSession?.id);
    }
  }
}

checkSessions().catch(console.error);