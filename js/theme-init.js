/* Theme Init — localStorage에서 테마를 읽어 html[data-theme] 적용 */
(function(){
  var t = localStorage.getItem('theme');
  if (t === 'dark' || t === 'light') {
    document.documentElement.setAttribute('data-theme', t);
  } else {
    // system 또는 미설정: OS 기본값 감지해서 적용
    var dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  }
})();
