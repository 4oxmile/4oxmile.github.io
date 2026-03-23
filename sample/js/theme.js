/* ═══════════════════════════════════════════════════
   Theme Toggle — 2단계 테마 전환 (다크 ↔ 라이트)

   사용법:
   - 스타일가이드: 토글 버튼 포함 (미리보기용)
   - 개별 게임: /js/theme-init.js 사용 (토글 버튼 없음)
   ═══════════════════════════════════════════════════ */

const THEME_KEY = 'theme';
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

function isDark() {
  const t = localStorage.getItem(THEME_KEY);
  if (t === 'dark') return true;
  if (t === 'light') return false;
  return prefersDark;
}

function applyTheme(dark) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
  updateToggleUI(dark);
  updateIndicator(dark);
}

function toggleTheme() {
  applyTheme(!isDark());
}

function updateToggleUI(dark) {
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = dark ? '☀️' : '🌙';
}

function updateIndicator(dark) {
  const el = document.getElementById('theme-indicator');
  if (el) el.textContent = '테마: ' + (dark ? '다크' : '라이트');
}

/* ── Init ── */
applyTheme(isDark());
