#!/usr/bin/env node
/**
 * RPC 함수 및 스키마 수정 스크립트
 * Supabase에서 누락된 RPC 함수와 테이블 컬럼을 생성합니다.
 */

// import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// .env.local 파일 로드
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// 환경 변수 체크 (선택사항)
// const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Supabase 클라이언트는 직접 DDL 실행이 제한되므로 사용하지 않음
// const supabase = createClient(supabaseUrl, supabaseServiceKey, {
//   auth: {
//     autoRefreshToken: false,
//     persistSession: false
//   }
// });

async function fixDatabase() {
  console.log('🚀 데이터베이스 수정 시작...\n');

  // 1. courses 테이블에 누락된 컬럼 추가
  const addColumnsSQL = `
    -- courses 테이블에 classroom_location 컬럼이 없으면 추가
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'courses'
        AND column_name = 'classroom_location'
      ) THEN
        ALTER TABLE courses
        ADD COLUMN classroom_location JSONB DEFAULT '{"latitude": 37.5665, "longitude": 126.9780, "radius": 50}'::jsonb;
      END IF;
    END $$;

    -- courses 테이블에 schedule 컬럼이 없으면 추가
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'courses'
        AND column_name = 'schedule'
      ) THEN
        ALTER TABLE courses
        ADD COLUMN schedule JSONB DEFAULT '[]'::jsonb;
      END IF;
    END $$;
  `;

  // 2. predefined_locations 테이블이 없으면 생성
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS predefined_locations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      building_name TEXT NOT NULL,
      room_number TEXT,
      display_name TEXT NOT NULL,
      latitude DECIMAL(10, 8) NOT NULL,
      longitude DECIMAL(11, 8) NOT NULL,
      radius INTEGER DEFAULT 50,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_predefined_locations_building ON predefined_locations(building_name);
    CREATE INDEX IF NOT EXISTS idx_predefined_locations_active ON predefined_locations(is_active);
  `;

  // 3. RPC 함수 생성
  const createRpcSQL = `
    -- get_buildings 함수 생성
    CREATE OR REPLACE FUNCTION get_buildings()
    RETURNS TABLE(building_name TEXT, room_count BIGINT)
    SECURITY DEFINER
    SET search_path = public
    AS $$
    BEGIN
      RETURN QUERY
      SELECT
        pl.building_name,
        COUNT(*) as room_count
      FROM predefined_locations pl
      WHERE pl.is_active = true
      GROUP BY pl.building_name
      ORDER BY pl.building_name;
    END;
    $$ LANGUAGE plpgsql;

    -- get_rooms_by_building 함수 생성
    CREATE OR REPLACE FUNCTION get_rooms_by_building(p_building_name TEXT)
    RETURNS TABLE(
      id UUID,
      room_number TEXT,
      display_name TEXT,
      latitude DECIMAL,
      longitude DECIMAL,
      radius INTEGER
    )
    SECURITY DEFINER
    SET search_path = public
    AS $$
    BEGIN
      RETURN QUERY
      SELECT
        pl.id,
        pl.room_number,
        pl.display_name,
        pl.latitude,
        pl.longitude,
        pl.radius
      FROM predefined_locations pl
      WHERE pl.building_name = p_building_name
        AND pl.is_active = true
      ORDER BY pl.room_number;
    END;
    $$ LANGUAGE plpgsql;
  `;

  // 4. 샘플 데이터 삽입
  const insertDataSQL = `
    -- 기존 데이터 삭제 (중복 방지)
    DELETE FROM predefined_locations WHERE building_name IN ('제1자연관', '제2자연관', '공학관');

    -- 새 데이터 삽입
    INSERT INTO predefined_locations (building_name, room_number, display_name, latitude, longitude, radius) VALUES
    ('제1자연관', '501호', '제1자연관 501호', 36.6291, 127.4565, 50),
    ('제1자연관', '502호', '제1자연관 502호', 36.6292, 127.4566, 50),
    ('제1자연관', '503호', '제1자연관 503호', 36.6293, 127.4567, 50),
    ('제2자연관', '301호', '제2자연관 301호', 36.6294, 127.4568, 50),
    ('제2자연관', '302호', '제2자연관 302호', 36.6295, 127.4569, 50),
    ('공학관', '201호', '공학관 201호', 36.6296, 127.4570, 50),
    ('공학관', '202호', '공학관 202호', 36.6297, 127.4571, 50);
  `;

  // 순차적으로 실행
  console.log('\n=== 데이터베이스 수정 작업 시작 ===\n');

  // 직접 Supabase API를 통한 실행이 제한적이므로,
  // 마이그레이션 파일을 생성하는 것이 더 나은 방법

  console.log('⚠️ Supabase는 직접 DDL 실행을 제한합니다.');
  console.log('📝 대신 마이그레이션 파일을 생성합니다...\n');

  const migrationContent = `
-- 자동 생성된 마이그레이션 파일
-- 날짜: ${new Date().toISOString()}

${addColumnsSQL}

${createTableSQL}

${createRpcSQL}

${insertDataSQL}

-- RLS 정책 추가
ALTER TABLE predefined_locations ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (존재하는 경우)
DROP POLICY IF EXISTS "Allow authenticated users to read predefined locations" ON predefined_locations;
DROP POLICY IF EXISTS "Allow service role to manage predefined locations" ON predefined_locations;

-- 새 정책 생성
CREATE POLICY "Allow authenticated users to read predefined locations"
ON predefined_locations FOR SELECT
TO authenticated
USING (is_active = true);

CREATE POLICY "Allow service role to manage predefined locations"
ON predefined_locations FOR ALL
TO service_role
USING (true);
`;

  // 마이그레이션 파일 생성
  const migrationPath = path.join(__dirname, '..', 'database', 'migrations', '013_fix_rpc_and_schema_esm.sql');

  fs.writeFileSync(migrationPath, migrationContent);
  console.log(`✅ 마이그레이션 파일 생성됨: ${migrationPath}`);

  console.log('\n📌 다음 단계:');
  console.log('1. Supabase 대시보드에서 SQL Editor를 열어주세요.');
  console.log('2. 생성된 마이그레이션 파일의 내용을 복사하여 실행하세요.');
  console.log(`   파일 경로: ${migrationPath}`);
  console.log('3. 또는 supabase CLI를 사용하여 마이그레이션을 실행하세요:');
  console.log('   supabase db push');
}

// 스크립트 실행
fixDatabase().catch(console.error);