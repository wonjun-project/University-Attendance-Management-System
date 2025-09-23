# Feature Specification: QR 세션 동기화 오류 복구

**Feature Branch**: `001-qr-qr-session`  
**Created**: 2025-09-24  
**Status**: Draft  
**Input**: User description: "노트북으로 교수 계정에 접속해서 qr 코드를 생성하고 바로 앞에 있는 스마트폰으로 학생 계정에 접속해서 qr 인증을 했는데 session not found 라는 글귀가 뜨면서 출석 체크가 안돼. 디버깅해서 안정적으로 앱 구동이 가능하게 해줘."

## Execution Flow (main)
```
1. Parse user description from Input
   -> If empty: ERROR "No feature description provided"
2. Extract key concepts from description
   -> Identify: actors, actions, data, constraints
3. For each unclear aspect:
   -> Mark with [NEEDS CLARIFICATION: specific question]
4. Fill User Scenarios & Testing section
   -> If no clear user flow: ERROR "Cannot determine user scenarios"
5. Generate Functional Requirements
   -> Each requirement must be testable
   -> Mark ambiguous requirements
6. Identify Key Entities (if data involved)
7. Run Review Checklist
   -> If any [NEEDS CLARIFICATION]: WARN "Spec has uncertainties"
   -> If implementation details found: ERROR "Remove tech details"
8. Return: SUCCESS (spec ready for planning)
```

---

## Clarifications

### Session 2025-09-24
- Q: QR 세션이 만료되기까지 허용할 최대 지속 시간은 얼마로 설정할까요? → A: 10분
- Q: 학생 기기 시간과 서버 시간 사이 허용할 최대 시계 오차는 어느 정도로 둘까요? → A: 1분
- Q: 세션 조회에 실패한 경우 학생 단말이 자동으로 재시도해야 할까요? → A: 자동 재시도 1회 (3초 후)
- Q: 동시 접속 시 동일 학생이 여러 기기로 QR을 스캔할 때, 첫 성공 이후 추가 시도는 어떻게 처리할까요? → A: 추가 시도 모두 거부하고 이미 출석 처리됨을 안내
- Q: QR 인증 실패가 3회 연속 발생하면 어떤 관측 및 알림 조치를 취할까요? → A: 로그만 남김


## ⚡ Quick Guidelines
- ✅ Focus on WHAT users need and WHY
- ❌ Avoid HOW to implement (no tech stack, APIs, code structure)
- 👥 Written for business stakeholders, not developers
- 🇰🇷 모든 서술과 제목은 한국어로 작성하고, 필요한 경우 원문 용어는 괄호로 병기한다
- 🔒 Call out privacy, attendance integrity, observability, and accessibility duties from the constitution when applicable

### Section Requirements
- **Mandatory sections**: Must be completed for every feature
- **Optional sections**: Include only when relevant to the feature
- When a section doesn't apply, remove it entirely (don't leave as "N/A")

### For AI Generation
When creating this spec from a user prompt:
1. **Mark all ambiguities**: Use [NEEDS CLARIFICATION: specific question] for any assumption you'd need to make
2. **Don't guess**: If the prompt doesn't specify something (e.g., "login system" without auth method), mark it
3. **Think like a tester**: Every vague requirement should fail the "testable and unambiguous" checklist item
4. **Common underspecified areas**:
   - User types and permissions
   - Data retention/deletion policies  
   - Performance targets and scale
   - Error handling behaviors
   - Integration requirements
   - Security/compliance needs

---

## User Scenarios & Testing *(mandatory)*

### Primary User Story
노트북으로 교수 계정에 로그인한 담당자가 수업 시작 전 출석용 QR 코드를 생성하고, 강의실에서 학생이 스마트폰으로 해당 QR을 즉시 스캔하여 출석을 완료한다. 시스템은 세션을 안정적으로 찾고 출석 결과를 실시간으로 양쪽에 반영한다.

### Acceptance Scenarios
1. **Given** 교수 계정이 강의 세션을 생성해 활성 QR을 노출한 상태, **When** 학생이 같은 강의실에서 스마트폰으로 QR을 스캔해 인증을 시도하면, **Then** 시스템은 유효한 세션을 찾아 출석 기록을 생성하며 성공 메시지를 한국어로 안내한다.
2. **Given** 학생이 QR을 스캔했으나 세션 식별 값이 유효하지 않을 때, **When** 시스템이 세션을 발견하지 못하면, **Then** 사용자에게 원인(만료, 연결 지연 등)을 설명하고 QR 재갱신 또는 새로고침 절차를 안내하며 로그로 사건을 기록한다.
3. **Given** 교수와 학생이 서로 다른 네트워크(예: 노트북은 유선, 스마트폰은 LTE)에 연결된 상태, **When** 동시 접속으로 QR 인증을 수행하면, **Then** 통신 지연에도 불구하고 세션이 동기화되어 출석이 기록되거나 재시도 흐름이 자동으로 처리된다.

### Edge Cases
- QR 생성 시 즉시 만료되거나 시간이 맞지 않아 발생하는 `session not found` 오류를 어떻게 감지하고, 자동 재시도 1회(3초 후)를 포함해 복구할 것인가?
- 학생 기기 시간이 서버 시간과 1분을 초과해 어긋날 때 세션 검증이 실패하면 어떤 보정 절차를 안내할 것인가?
- 동일한 QR을 여러 학생이 동시에 스캔할 때 세션 충돌이나 중복 로그를 어떻게 방지하고, 동일 학생이 추가 기기로 시도하면 거부 후 이미 출석 처리됨을 안내하도록 할 것인가?
- 네트워크 일시 장애 후 재시도 시 이전 실패 기록을 어떻게 표시하고 관찰 가능하도록 남기며, 3회 연속 실패 로그를 운영자가 검토할 수 있게 할 것인가?

## Requirements *(mandatory)*

### Functional Requirements
- **FR-001**: 시스템은 교수 계정이 생성한 출석 QR 세션 정보를 서버측 저장소에 즉시(1초 이내) 기록하고, 세션 ID와 만료 시간을 명확히 관리하며 기본 만료 시간은 10분으로 설정한다.
- **FR-002**: 학생이 QR을 스캔하면 시스템은 최신 세션 ID를 조회하여 유효성을 검증하고, 기기 시간이 서버 기준 1분 이내인지 확인한 뒤 세션이 유효할 경우 출석 상태를 "출석"으로 저장해야 한다.
- **FR-003**: 세션을 찾지 못하거나 만료된 경우, 학생 단말은 3초 후 자동으로 한 번 재시도하고, 여전히 실패하면 사용자에게 한국어 오류 메시지와 재시도 방법(새 QR 요청, 페이지 새로고침 등)을 안내하며, 모든 실패 사유를 감사 로그에 남겨야 한다.
- **FR-004**: 동일한 강의에서 여러 기기가 동시에 인증을 시도하더라도 세션 상태가 일관되게 유지되어야 하며, 동일 학생의 추가 기기 시도는 거부하고 "이미 출석 처리됨" 안내와 함께 중복 출석 기록을 방지해야 한다.
- **FR-005**: 시스템은 세션 생성, 조회, 실패 이벤트를 구조화된 로그로 기록하고, 3회 연속 실패 시에도 자동 알림 대신 상세 로그만 남기며 운영자가 문제를 추적할 수 있도록 correlation ID와 시간 정보를 포함해야 한다.
- **FR-006**: 세션 데이터와 출석 기록은 Supabase Row Level Security 정책 하에서만 노출되며, 민감 좌표나 토큰은 로그에 직접 기록하지 않아야 한다.
- **FR-007**: QA 및 운영자는 Playwright 시나리오를 통해 노트북-모바일 동시 흐름을 재현하여 회귀 테스트를 수행할 수 있어야 한다.

### Key Entities *(include if feature involves data)*
- **QRSession**: 강의 식별자, 세션 ID, 생성 시각, 만료 시각, 발급자(교수) 정보를 담고 동시 접근 시에도 일관되게 조회되어야 하는 엔터티.
- **AttendanceAttempt**: 학생 ID, 세션 ID, 인증 시각, 결과 상태(성공/실패), 실패 사유, correlation ID를 저장하여 문제 원인을 추적하는 엔터티.
- **DeviceContext**: 접속 기기 종류(노트북/모바일), 네트워크 유형, 앱 버전 등 세션 검증에 참고할 수 있는 메타데이터를 담아 최소 24시간 내 파기하는 엔터티.

---

## Review & Acceptance Checklist
*GATE: Automated checks run during main() execution*

### Content Quality
- [ ] No implementation details (languages, frameworks, APIs)
- [ ] Focused on user value and business needs
- [ ] Written for non-technical stakeholders
- [ ] All mandatory sections completed

### Requirement Completeness
- [ ] No [NEEDS CLARIFICATION] markers remain
- [ ] Requirements are testable and unambiguous  
- [ ] Success criteria are measurable
- [ ] Scope is clearly bounded
- [ ] Dependencies and assumptions identified
- [ ] 문서 전체가 한국어로 작성되고 필수 번역이 병기되었다

---

## Execution Status
*Updated by main() during processing*

- [ ] User description parsed
- [ ] Key concepts extracted
- [ ] Ambiguities marked
- [ ] User scenarios defined
- [ ] Requirements generated
- [ ] Entities identified
- [ ] Review checklist passed

---
