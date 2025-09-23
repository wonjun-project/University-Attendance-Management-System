#!/usr/bin/env node

/**
 * 세션 접근 테스트 스크립트
 * QR 스캔 문제가 해결되었는지 확인
 *
 * 사용법: node scripts/test-session-access.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL이 설정되지 않았습니다.');
  process.exit(1);
}

console.log('🧪 세션 접근 테스트 시작...\n');

async function testWithServiceRole() {
  if (!serviceRoleKey) {
    console.log('⚠️  Service role 키가 설정되지 않았습니다. 이 테스트를 건너뜁니다.');
    return false;
  }

  console.log('1️⃣  Service Role 키로 테스트 (RLS 우회)');
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // 최근 세션 조회
    const { data: sessions, error } = await supabase
      .from('class_sessions')
      .select('id, course_id, status, qr_code_expires_at')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('   ❌ 오류:', error.message);
      return false;
    }

    console.log(`   ✅ ${sessions?.length || 0}개의 활성 세션 조회 성공`);

    if (sessions && sessions.length > 0) {
      console.log('   📋 활성 세션 목록:');
      sessions.forEach(s => {
        const expires = new Date(s.qr_code_expires_at);
        const isExpired = expires < new Date();
        console.log(`      - ${s.id.substring(0, 8)}... (${isExpired ? '만료됨' : '활성'})`);
      });
    }
    return true;
  } catch (err) {
    console.error('   ❌ 예외 발생:', err);
    return false;
  }
}

async function testWithAnonKey() {
  if (!anonKey) {
    console.log('⚠️  Anon 키가 설정되지 않았습니다. 이 테스트를 건너뜁니다.');
    return false;
  }

  console.log('\n2️⃣  Anon 키로 테스트 (RLS 적용)');
  const supabase = createClient(supabaseUrl, anonKey);

  try {
    // 활성 세션 조회 (새 정책이 적용되었다면 조회 가능해야 함)
    const { data: sessions, error } = await supabase
      .from('class_sessions')
      .select('id, course_id, status, qr_code_expires_at')
      .eq('status', 'active')
      .gt('qr_code_expires_at', new Date().toISOString())
      .limit(5);

    if (error) {
      console.error('   ❌ 오류:', error.message);
      console.log('   ℹ️  RLS 정책 마이그레이션이 필요할 수 있습니다.');
      return false;
    }

    console.log(`   ✅ ${sessions?.length || 0}개의 활성 세션 조회 성공`);
    console.log('   ✨ RLS 정책이 올바르게 설정되었습니다!');
    return true;
  } catch (err) {
    console.error('   ❌ 예외 발생:', err);
    return false;
  }
}

async function createTestSession() {
  if (!serviceRoleKey) {
    console.log('⚠️  Service role 키가 없어 테스트 세션을 생성할 수 없습니다.');
    return null;
  }

  console.log('\n3️⃣  테스트 세션 생성');
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // 테스트 과목 찾기 또는 생성
    const { data: courses } = await supabase
      .from('courses')
      .select('id, name')
      .eq('course_code', 'DEMO101')
      .limit(1);

    let courseId;
    if (courses && courses.length > 0) {
      courseId = courses[0].id;
      console.log(`   📚 기존 데모 과목 사용: ${courses[0].name}`);
    } else {
      // 교수 찾기
      const { data: professors } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('role', 'professor')
        .limit(1);

      if (!professors || professors.length === 0) {
        console.log('   ⚠️  교수 계정이 없어 테스트 과목을 생성할 수 없습니다.');
        return null;
      }

      // 데모 과목 생성
      const { data: newCourse, error: courseError } = await supabase
        .from('courses')
        .insert({
          name: '테스트 데모 강의',
          course_code: 'DEMO101',
          professor_id: professors[0].id
        })
        .select('id, name')
        .single();

      if (courseError) {
        console.error('   ❌ 과목 생성 실패:', courseError.message);
        return null;
      }

      courseId = newCourse.id;
      console.log(`   📚 새 데모 과목 생성: ${newCourse.name}`);
    }

    // 테스트 세션 생성
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30분 후
    const { data: session, error: sessionError } = await supabase
      .from('class_sessions')
      .insert({
        course_id: courseId,
        status: 'active',
        date: new Date().toISOString().split('T')[0],
        qr_code: `test-qr-${Date.now()}`,
        qr_code_expires_at: expiresAt.toISOString()
      })
      .select('id')
      .single();

    if (sessionError) {
      console.error('   ❌ 세션 생성 실패:', sessionError.message);
      return null;
    }

    console.log(`   ✅ 테스트 세션 생성 성공: ${session.id}`);
    return session.id;
  } catch (err) {
    console.error('   ❌ 예외 발생:', err);
    return null;
  }
}

async function testSessionAccess(sessionId) {
  if (!sessionId) return;

  console.log('\n4️⃣  세션 접근 테스트');

  // Anon 키로 세션 조회 시도
  if (anonKey) {
    const supabase = createClient(supabaseUrl, anonKey);
    const { data, error } = await supabase
      .from('class_sessions')
      .select('id, status')
      .eq('id', sessionId)
      .single();

    if (error) {
      console.log('   ❌ Anon 키로 세션 조회 실패:', error.message);
      console.log('   ℹ️  RLS 정책 업데이트가 필요합니다.');
    } else {
      console.log('   ✅ Anon 키로 세션 조회 성공!');
      console.log('   🎉 QR 스캔이 정상 작동할 것입니다!');
    }
  }
}

// 테스트 실행
async function runTests() {
  const serviceRoleSuccess = await testWithServiceRole();
  const anonKeySuccess = await testWithAnonKey();

  if (serviceRoleSuccess) {
    const testSessionId = await createTestSession();
    if (testSessionId) {
      await testSessionAccess(testSessionId);
    }
  }

  console.log('\n📊 테스트 결과 요약:');
  console.log('─'.repeat(40));

  if (!serviceRoleKey) {
    console.log('⚠️  Service role 키가 설정되지 않았습니다.');
    console.log('   → .env.local에 SUPABASE_SERVICE_ROLE_KEY 추가 필요');
  } else if (serviceRoleSuccess) {
    console.log('✅ Service role 키가 올바르게 설정됨');
  }

  if (anonKeySuccess) {
    console.log('✅ RLS 정책이 QR 스캔을 허용함');
  } else {
    console.log('❌ RLS 정책 업데이트 필요');
    console.log('   → database/migrations/009_fix_session_access.sql 실행');
  }

  console.log('─'.repeat(40));
  console.log('\n테스트 완료! 👋');
}

runTests().catch(console.error);