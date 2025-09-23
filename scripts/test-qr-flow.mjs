#!/usr/bin/env node

/**
 * QR 코드 생성 및 스캔 전체 플로우 테스트
 *
 * 실행: node scripts/test-qr-flow.mjs
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

console.log('🧪 QR 코드 플로우 테스트 시작...\n');

async function testQRFlow() {
  try {
    // 1. 교수 계정 찾기
    console.log('1️⃣ 교수 계정 조회...');
    const { data: professors } = await supabase
      .from('user_profiles')
      .select('id, name, email')
      .eq('role', 'professor')
      .limit(1);

    if (!professors || professors.length === 0) {
      console.error('❌ 교수 계정이 없습니다.');
      return;
    }

    const professor = professors[0];
    console.log(`✅ 교수 찾음: ${professor.name} (${professor.id})`);

    // 2. 테스트용 강의 생성 또는 조회
    console.log('\n2️⃣ 테스트 강의 준비...');
    let courseId;

    const { data: existingCourses } = await supabase
      .from('courses')
      .select('id, name, course_code')
      .eq('professor_id', professor.id)
      .eq('course_code', 'TEST-QR-001')
      .limit(1);

    if (existingCourses && existingCourses.length > 0) {
      courseId = existingCourses[0].id;
      console.log(`✅ 기존 테스트 강의 사용: ${existingCourses[0].name}`);
    } else {
      const { data: newCourse, error: courseError } = await supabase
        .from('courses')
        .insert({
          name: 'QR 테스트 강의',
          course_code: 'TEST-QR-001',
          professor_id: professor.id
        })
        .select('id')
        .single();

      if (courseError) {
        console.error('❌ 강의 생성 실패:', courseError);
        return;
      }

      courseId = newCourse.id;
      console.log(`✅ 테스트 강의 생성: ${courseId}`);
    }

    // 3. 세션 생성
    console.log('\n3️⃣ 세션 생성...');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000);

    const { data: session, error: sessionError } = await supabase
      .from('class_sessions')
      .insert({
        course_id: courseId,
        status: 'active',
        date: now.toISOString().split('T')[0],
        qr_code: 'placeholder-will-update',
        qr_code_expires_at: expiresAt.toISOString(),
        classroom_latitude: 37.5665,
        classroom_longitude: 126.9780,
        classroom_radius: 100
      })
      .select('id, course_id, qr_code_expires_at')
      .single();

    if (sessionError) {
      console.error('❌ 세션 생성 실패:', sessionError);
      return;
    }

    console.log(`✅ 세션 생성 성공: ${session.id}`);

    // 4. QR 데이터 생성
    console.log('\n4️⃣ QR 데이터 생성...');
    const qrData = {
      sessionId: session.id,
      courseId: session.course_id,
      expiresAt: session.qr_code_expires_at,
      type: 'attendance',
      baseUrl: 'http://localhost:3000'
    };

    console.log('📊 QR 데이터:', qrData);

    // 5. QR 코드 문자열 생성
    const qrString = JSON.stringify(qrData);
    console.log('\n5️⃣ QR 코드 문자열 (JSON):', qrString.substring(0, 100) + '...');

    // 6. QR 업데이트 (URL 형태와 비교)
    const qrUrl = `http://localhost:3000/student/attendance/${session.id}`;
    console.log('📌 URL 형태 (비교용):', qrUrl);

    const { error: updateError } = await supabase
      .from('class_sessions')
      .update({ qr_code: qrUrl })
      .eq('id', session.id);

    if (updateError) {
      console.error('❌ QR 코드 업데이트 실패:', updateError);
    } else {
      console.log('✅ DB에 URL 형태로 저장됨');
    }

    // 7. 세션 재조회 테스트
    console.log('\n6️⃣ 세션 조회 테스트...');

    // 7-1. ID로 직접 조회
    const { data: directLookup, error: directError } = await supabase
      .from('class_sessions')
      .select('id, status, qr_code')
      .eq('id', session.id)
      .single();

    if (directError || !directLookup) {
      console.error('❌ ID로 직접 조회 실패:', directError);
    } else {
      console.log('✅ ID로 직접 조회 성공');
    }

    // 7-2. 활성 세션 + ID 조회
    const { data: activeLookup, error: activeError } = await supabase
      .from('class_sessions')
      .select('id, status')
      .eq('id', session.id)
      .eq('status', 'active')
      .single();

    if (activeError || !activeLookup) {
      console.error('❌ 활성 세션 조건 조회 실패:', activeError);
    } else {
      console.log('✅ 활성 세션 조건 조회 성공');
    }

    // 8. QR 파싱 테스트
    console.log('\n7️⃣ QR 데이터 파싱 테스트...');

    // JSON 형태 파싱
    let parsed;
    try {
      parsed = JSON.parse(qrString);
      console.log('✅ JSON 파싱 성공:', {
        sessionId: parsed.sessionId,
        courseId: parsed.courseId,
        sessionIdMatch: parsed.sessionId === session.id
      });
    } catch (e) {
      console.error('❌ JSON 파싱 실패:', e.message);
    }

    // 9. 세션 ID 매칭 테스트
    console.log('\n8️⃣ 세션 ID 매칭 테스트...');
    console.log('원본 세션 ID:', session.id);
    console.log('파싱된 세션 ID:', parsed?.sessionId);
    console.log('타입 체크:', {
      원본타입: typeof session.id,
      파싱타입: typeof parsed?.sessionId,
      일치여부: session.id === parsed?.sessionId
    });

    // 10. 정리
    console.log('\n9️⃣ 테스트 세션 정리...');
    const { error: deleteError } = await supabase
      .from('class_sessions')
      .delete()
      .eq('id', session.id);

    if (deleteError) {
      console.error('⚠️ 세션 삭제 실패:', deleteError);
    } else {
      console.log('✅ 테스트 세션 삭제됨');
    }

  } catch (error) {
    console.error('❌ 테스트 실패:', error);
  }
}

async function analyzeProblem() {
  console.log('\n\n🔍 문제 분석...');
  console.log('=' .repeat(50));

  // 최근 세션들 확인
  const { data: recentSessions } = await supabase
    .from('class_sessions')
    .select('id, status, created_at, qr_code')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('\n📋 최근 생성된 세션들:');
  recentSessions?.forEach(s => {
    const isUrl = s.qr_code?.startsWith('http');
    const isJson = s.qr_code?.startsWith('{');
    console.log(`- ${s.id.substring(0, 8)}... | ${s.status} | QR타입: ${isUrl ? 'URL' : isJson ? 'JSON' : '기타'}`);
  });

  console.log('\n💡 발견된 문제:');
  console.log('1. QR 생성 API는 qrData를 JSON으로 반환하지만');
  console.log('   DB에는 URL 형태로 저장하고 있음');
  console.log('2. 프론트엔드 QRCodeDisplay는 JSON 형태로 QR을 생성');
  console.log('3. 스캐너는 JSON을 파싱하지만, DB의 URL과 불일치');

  console.log('\n✅ 해결 방법:');
  console.log('1. QR 생성 API에서 DB에도 JSON 형태로 저장');
  console.log('2. 또는 프론트엔드에서 qrCode 필드 사용');
  console.log('3. QR 스캐너의 폴백 로직 개선');
}

// 테스트 실행
async function runTests() {
  await testQRFlow();
  await analyzeProblem();

  console.log('\n' + '=' .repeat(50));
  console.log('테스트 완료! 👋');
}

runTests().catch(console.error);