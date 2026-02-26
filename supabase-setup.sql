-- ═══════════════════════════════════════════════════
-- 4ox.kr 게임 리더보드 — Supabase SQL 설정
-- Supabase Dashboard → SQL Editor 에서 실행하세요
-- ═══════════════════════════════════════════════════

-- 1. 테이블 생성
create table if not exists scores (
  id         bigint generated always as identity primary key,
  game       text not null,
  nickname   text not null,
  score      int  not null,
  created_at timestamptz default now()
);

-- 2. Row Level Security 활성화
alter table scores enable row level security;

-- 3. 누구나 조회 가능
create policy "scores_select" on scores
  for select using (true);

-- 4. 누구나 삽입 가능 (닉네임 1~12자, 게임명 1~30자)
create policy "scores_insert" on scores
  for insert with check (
    char_length(nickname) between 1 and 12
    and char_length(game) between 1 and 30
  );

-- 5. 수정/삭제 불가 (정책 없음 = RLS에 의해 차단)

-- 6. 빠른 조회를 위한 인덱스
create index if not exists idx_scores_game_score
  on scores (game, score desc);

create index if not exists idx_scores_game_score_asc
  on scores (game, score asc);
