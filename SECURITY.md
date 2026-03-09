# Security Notes (GitHub Pages + Supabase)

이 프로젝트는 GitHub Pages(정적 호스팅) + Supabase(데이터 저장) 구조입니다.
핵심 보안 포인트는 "클라이언트 비밀"이 아니라 "DB 권한(RLS)"입니다.

## 1) 적용한 하드닝
- `supabase-setup.sql`
  - `scores`, `battleship_rooms`, `game_clicks`에 `RLS + FORCE RLS` 적용
  - 입력값 제약 강화 (게임명 slug 형식, 닉네임 길이, 점수 범위)
  - `anon/authenticated` 권한 최소화 (필요한 `select/insert/delete`만 허용)
  - `increment_click`를 `SECURITY DEFINER + search_path 고정`으로 재정의
  - 함수 실행 권한 최소화 (`public` revoke, `anon/authenticated` grant)

- `js/leaderboard.js`
  - 닉네임 sanitize/검증 추가
  - 점수 범위 clamp 추가 (`0..10,000,000`)
  - 중복 submit 방지 가드 추가

## 2) 운영 체크리스트
1. Supabase SQL Editor에서 최신 `supabase-setup.sql` 재실행
2. 실행 후 Table Editor에서 정책/권한이 기대대로 반영됐는지 확인
3. `scores`에 비정상 행(음수/초과 점수, 규격 외 game/nickname)이 없는지 점검
4. 필요 시 오래된 `battleship_rooms`를 정리하는 스케줄(Job) 추가

## 3) 남는 리스크
- 클라이언트 기반 게임은 "점수 조작 완전 방지"가 어렵습니다.
- 완전 대응하려면 서버 검증(예: Edge Function으로 서명/검증)이 필요합니다.

## 4) 추가 권장
- 가능하면 각 HTML에 CSP(meta 또는 헤더) 적용
- 외부 CDN 스크립트에 SRI/integrity 적용 검토
