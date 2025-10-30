-- Add PDR (Pedestrian Dead Reckoning) metadata columns to location_logs
-- GPS-PDR 융합 추적 메타데이터 저장을 위한 컬럼 추가

ALTER TABLE location_logs
ADD COLUMN IF NOT EXISTS tracking_mode TEXT CHECK (tracking_mode IN ('gps-only', 'pdr-only', 'fusion')),
ADD COLUMN IF NOT EXISTS environment TEXT CHECK (environment IN ('outdoor', 'indoor', 'unknown')),
ADD COLUMN IF NOT EXISTS confidence DECIMAL(3, 2),  -- 0.00 ~ 1.00
ADD COLUMN IF NOT EXISTS gps_weight DECIMAL(3, 2),  -- 0.00 ~ 1.00
ADD COLUMN IF NOT EXISTS pdr_weight DECIMAL(3, 2),  -- 0.00 ~ 1.00
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 인덱스 추가 (tracking_mode와 environment로 쿼리 성능 향상)
CREATE INDEX IF NOT EXISTS idx_location_logs_tracking_mode ON location_logs(tracking_mode);
CREATE INDEX IF NOT EXISTS idx_location_logs_environment ON location_logs(environment);

-- 코멘트 추가
COMMENT ON COLUMN location_logs.tracking_mode IS 'GPS-PDR 융합 추적 모드: gps-only (GPS만), pdr-only (PDR만), fusion (융합)';
COMMENT ON COLUMN location_logs.environment IS '감지된 환경: outdoor (실외), indoor (실내), unknown (미상)';
COMMENT ON COLUMN location_logs.confidence IS 'PDR 융합 신뢰도 (0.00 ~ 1.00)';
COMMENT ON COLUMN location_logs.gps_weight IS 'GPS 가중치 (0.00 ~ 1.00, 융합 시 사용)';
COMMENT ON COLUMN location_logs.pdr_weight IS 'PDR 가중치 (0.00 ~ 1.00, 융합 시 사용)';
