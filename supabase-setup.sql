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

-- ═══════════════════════════════════════════════════
-- Battleship 온라인 대전 — 대기방 테이블
-- ═══════════════════════════════════════════════════

create table if not exists battleship_rooms (
  code       text primary key,
  host_name  text not null default '대기 중',
  created_at timestamptz default now()
);

alter table battleship_rooms enable row level security;

-- 누구나 조회/삽입/삭제 가능
create policy "rooms_select" on battleship_rooms
  for select using (true);

create policy "rooms_insert" on battleship_rooms
  for insert with check (
    char_length(code) = 4
    and char_length(host_name) between 1 and 12
  );

create policy "rooms_delete" on battleship_rooms
  for delete using (true);

-- 10분 이상 된 방 자동 정리용 인덱스
create index if not exists idx_rooms_created
  on battleship_rooms (created_at);

-- ═══════════════════════════════════════════════════
-- 게임 클릭 수 추적 — 인기순 정렬용
-- ═══════════════════════════════════════════════════

create table if not exists game_clicks (
  game   text primary key,
  clicks int  not null default 0
);

alter table game_clicks enable row level security;

create policy "clicks_select" on game_clicks
  for select using (true);

-- 클릭 수 증가 함수 (atomic upsert)
create or replace function increment_click(game_name text)
returns void as $$
begin
  insert into game_clicks (game, clicks) values (game_name, 1)
  on conflict (game) do update set clicks = game_clicks.clicks + 1;
end;
$$ language plpgsql security definer;
