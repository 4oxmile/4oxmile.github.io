-- ═══════════════════════════════════════════════════
-- 4ox.kr 게임 리더보드 — Supabase 보안 강화 SQL
-- Supabase Dashboard → SQL Editor 에서 실행하세요
-- 재실행 가능(idempotent)하게 작성됨
-- ═══════════════════════════════════════════════════

-- 1) SCORE TABLE
create table if not exists public.scores (
  id         bigint generated always as identity primary key,
  game       text not null,
  nickname   text not null,
  score      int  not null,
  created_at timestamptz default now()
);

-- 기본 제약(기존 환경에도 적용)
alter table public.scores
  alter column game set not null,
  alter column nickname set not null,
  alter column score set not null;

alter table public.scores drop constraint if exists scores_game_format_chk;
alter table public.scores add constraint scores_game_format_chk
  check (game ~ '^[a-z0-9_-]{1,30}$');

alter table public.scores drop constraint if exists scores_nickname_len_chk;
alter table public.scores add constraint scores_nickname_len_chk
  check (char_length(btrim(nickname)) between 1 and 12);

alter table public.scores drop constraint if exists scores_score_range_chk;
alter table public.scores add constraint scores_score_range_chk
  check (score between 0 and 10000000);

alter table public.scores enable row level security;
alter table public.scores force row level security;

-- 정책 재정의
drop policy if exists scores_select on public.scores;
create policy scores_select on public.scores
  for select
  using (true);

drop policy if exists scores_insert on public.scores;
create policy scores_insert on public.scores
  for insert
  with check (
    game ~ '^[a-z0-9_-]{1,30}$'
    and char_length(btrim(nickname)) between 1 and 12
    and score between 0 and 10000000
  );

-- 익명/인증 사용자 권한 최소화 (select/insert만)
revoke all on table public.scores from anon, authenticated;
grant select, insert on table public.scores to anon, authenticated;

create index if not exists idx_scores_game_score_desc
  on public.scores (game, score desc);

create index if not exists idx_scores_game_score_asc
  on public.scores (game, score asc);

-- 2) BATTLESHIP ROOMS
create table if not exists public.battleship_rooms (
  code       text primary key,
  host_name  text not null default '대기 중',
  created_at timestamptz default now()
);

alter table public.battleship_rooms
  alter column code set not null,
  alter column host_name set not null;

alter table public.battleship_rooms drop constraint if exists rooms_code_format_chk;
alter table public.battleship_rooms add constraint rooms_code_format_chk
  check (code ~ '^[A-Z0-9]{4}$');

alter table public.battleship_rooms drop constraint if exists rooms_host_name_len_chk;
alter table public.battleship_rooms add constraint rooms_host_name_len_chk
  check (char_length(btrim(host_name)) between 1 and 12);

alter table public.battleship_rooms enable row level security;
alter table public.battleship_rooms force row level security;

drop policy if exists rooms_select on public.battleship_rooms;
create policy rooms_select on public.battleship_rooms
  for select using (true);

drop policy if exists rooms_insert on public.battleship_rooms;
create policy rooms_insert on public.battleship_rooms
  for insert with check (
    code ~ '^[A-Z0-9]{4}$'
    and char_length(btrim(host_name)) between 1 and 12
  );

drop policy if exists rooms_delete on public.battleship_rooms;
create policy rooms_delete on public.battleship_rooms
  for delete using (true);

revoke all on table public.battleship_rooms from anon, authenticated;
grant select, insert, delete on table public.battleship_rooms to anon, authenticated;

create index if not exists idx_rooms_created
  on public.battleship_rooms (created_at);

-- 3) GAME ROOMS (generic for tictactoe, omok, etc.)
create table if not exists public.game_rooms (
  id         bigint generated always as identity primary key,
  game       text not null,
  code       text not null,
  host_name  text not null default '대기 중',
  created_at timestamptz default now()
);

alter table public.game_rooms
  alter column game set not null,
  alter column code set not null,
  alter column host_name set not null;

alter table public.game_rooms drop constraint if exists game_rooms_game_chk;
alter table public.game_rooms add constraint game_rooms_game_chk
  check (game ~ '^[a-z0-9_-]{1,30}$');

alter table public.game_rooms drop constraint if exists game_rooms_code_chk;
alter table public.game_rooms add constraint game_rooms_code_chk
  check (code ~ '^[A-Z0-9]{4}$');

alter table public.game_rooms drop constraint if exists game_rooms_host_name_chk;
alter table public.game_rooms add constraint game_rooms_host_name_chk
  check (char_length(btrim(host_name)) between 1 and 12);

alter table public.game_rooms enable row level security;
alter table public.game_rooms force row level security;

drop policy if exists game_rooms_select on public.game_rooms;
create policy game_rooms_select on public.game_rooms
  for select using (true);

drop policy if exists game_rooms_insert on public.game_rooms;
create policy game_rooms_insert on public.game_rooms
  for insert with check (
    game ~ '^[a-z0-9_-]{1,30}$'
    and code ~ '^[A-Z0-9]{4}$'
    and char_length(btrim(host_name)) between 1 and 12
  );

drop policy if exists game_rooms_delete on public.game_rooms;
create policy game_rooms_delete on public.game_rooms
  for delete using (true);

revoke all on table public.game_rooms from anon, authenticated;
grant select, insert, delete on table public.game_rooms to anon, authenticated;

create index if not exists idx_game_rooms_game_created
  on public.game_rooms (game, created_at);

-- 4) GAME CLICKS
create table if not exists public.game_clicks (
  game   text primary key,
  clicks int  not null default 0
);

alter table public.game_clicks
  alter column game set not null,
  alter column clicks set not null;

alter table public.game_clicks drop constraint if exists clicks_game_format_chk;
alter table public.game_clicks add constraint clicks_game_format_chk
  check (game ~ '^[a-z0-9_-]{1,30}$');

alter table public.game_clicks drop constraint if exists clicks_nonnegative_chk;
alter table public.game_clicks add constraint clicks_nonnegative_chk
  check (clicks >= 0);

alter table public.game_clicks enable row level security;
alter table public.game_clicks force row level security;

drop policy if exists clicks_select on public.game_clicks;
create policy clicks_select on public.game_clicks
  for select using (true);

revoke all on table public.game_clicks from anon, authenticated;
grant select on table public.game_clicks to anon, authenticated;

-- SECURITY DEFINER 함수는 search_path 고정이 핵심
create or replace function public.increment_click(game_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text;
begin
  normalized := lower(btrim(game_name));

  if normalized is null or normalized !~ '^[a-z0-9_-]{1,30}$' then
    return;
  end if;

  insert into public.game_clicks (game, clicks)
  values (normalized, 1)
  on conflict (game)
  do update set clicks = public.game_clicks.clicks + 1;
end;
$$;

revoke all on function public.increment_click(text) from public;
grant execute on function public.increment_click(text) to anon, authenticated;
