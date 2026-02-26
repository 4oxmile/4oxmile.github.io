'use strict';

// ─────────────────────────────────────────────
//  Word Pool (200+ English words)
// ─────────────────────────────────────────────
const WORD_POOL = [
  // 3-letter
  'ace','act','air','arm','art','ask','bag','ban','bar','bat','bay','bed','big',
  'bit','box','boy','bug','bus','buy','can','cap','car','cat','cop','cow','cry',
  'cup','cut','day','die','dig','dim','dip','dog','dot','dry','dye','ear','eat',
  'egg','end','era','eve','eye','fad','fan','far','fat','fee','few','fig','fit',
  'fix','fly','fog','for','fox','fun','gap','gas','gel','gem','get','god','got',
  'gun','gut','gym','had','ham','hat','hay','hex','him','his','hit','hop','hot',
  'how','hub','hug','hum','ice','ill','ink','ion','jar','jaw','jet','job','joy',
  'jug','key','kid','kin','kit','lab','lap','law','lay','leg','let','lid','lip',
  'log','lot','low','mad','man','map','mat','mix','mob','mod','mom','mud','mug',
  // 4-letter
  'able','acid','aged','also','area','army','away','back','ball','band','bank',
  'base','bath','beat','been','belt','best','bike','bill','bind','bird','bite',
  'blow','blue','blur','bold','bolt','bone','book','boot','born','boss','both',
  'bull','burn','busy','cake','call','came','camp','card','care','cash','cast',
  'cave','cent','chip','city','clap','clay','clip','club','clue','coal','coat',
  'code','coin','cold','coil','cook','cool','copy','cord','core','corn','cost',
  'crew','crop','curl','dark','data','dawn','days','dead','deal','dear','deck',
  'deep','deer','deny','desk','dice','diet','dirt','disc','disk','dive','dock',
  'does','done','doom','door','dose','down','draw','drew','drop','drum','dual',
  'duke','dull','dump','dusk','dust','duty','each','earn','east','easy','edge',
  'else','epic','even','ever','evil','exam','exit','face','fact','fade','fail',
  'fair','fake','fall','fame','fast','fate','fear','feat','feed','feel','feet',
  'fell','felt','file','fill','film','find','fine','fire','firm','fish','fist',
  'flag','flat','flaw','flew','flip','flow','foam','fold','folk','font','food',
  'foot','fore','form','fort','four','free','from','fuel','full','fund','fuse',
  'gain','game','gave','gear','gift','give','glad','glow','glue','goal','gold',
  'golf','gone','good','grab','gray','grew','grid','grip','grow','gulf','guru',
  'gust','hack','half','hall','hang','hard','harm','hate','have','head','heal',
  'heap','heat','heel','held','help','herb','here','hero','hide','high','hill',
  'hint','hire','hold','hole','home','hood','hook','hope','horn','host','hour',
  'hull','husk','icon','idea','idle','inch','into','iris','isle','item','jack',
  'jail','jazz','join','jump','just','keen','keep','kick','kill','kind','king',
  'knot','know','lace','lack','lake','lamp','land','lane','lava','lead','leaf',
  'lean','leap','left','lens','less','lick','life','lift','like','lime','line',
  'link','lion','list','live','load','lock','loft','lone','long','look','loop',
  'lord','lose','loss','lost','loud','love','luck','lure','lush','made','mail',
  'main','make','male','mall','malt','many','mark','mars','mass','mast','mean',
  'meat','meet','melt','menu','mesh','mild','milk','mill','mind','mine','mint',
  'miss','mist','moan','mock','mode','mold','more','most','moth','move','much',
  'mule','must','myth','nail','name','navy','near','neck','need','nest','news',
  'next','nice','node','none','noon','norm','nose','note','noun','nova','numb',
  // 5-letter
  'about','above','abuse','acute','admit','adopt','adult','after','again','agent',
  'agree','ahead','alarm','album','alert','align','alive','alley','allot','allow',
  'alone','along','aloud','alpha','alter','angel','angle','angry','anime','ankle',
  'annex','apart','apple','apply','arena','argue','arise','arrow','asset','atlas',
  'audio','audit','avoid','award','aware','awful','badly','basic','basis','batch',
  'beach','begin','being','below','bench','berry','birth','black','blade','blame',
  'bland','blank','blast','blaze','bleed','blend','bless','blind','block','blood',
  'blown','board','bonus','boost','bound','brain','brand','brave','bread','break',
  'breed','brick','bride','brief','bring','broad','broke','brook','brown','brush',
  'build','built','burst','cabin','cable','calls','candy','carry','catch','cause',
  'chain','chair','chalk','chaos','cheap','check','cheek','chess','chest','chief',
  'child','china','clean','clear','click','climb','clock','clone','close','cloud',
  'coach','coast','color','comic','comma','coral','court','cover','crack','craft',
  'crane','crash','crazy','cream','crest','crime','crisp','cross','crowd','crown',
  'crush','curve','cycle','daily','dance','debut','decoy','delta','dense','depot',
  'depth','derby','derby','devil','diary','digit','dirty','disco','dizzy','dodge',
  'doing','donor','draft','drain','drama','drape','dread','dream','dress','drift',
  'drive','drone','drove','drowm','drown','drugs','drums','dunno','dwarf','dying',
  'early','earth','eight','elite','embed','empty','enemy','enjoy','enter','entry',
  'equal','error','event','every','exact','exist','extra','fable','faith','false',
  'fancy','fatal','feast','fence','fetch','fiber','field','fifth','fight','final',
  'fixed','flame','flare','flash','fleet','flesh','float','flood','floor','floss',
  'flour','focus','force','forge','forth','forum','found','frame','frank','fresh',
  'front','frost','froze','fully','funky','fuzzy','globe','gloom','glory','gloss',
  'glove','glyph','going','grace','grade','grain','grand','grant','grape','grasp',
  'grass','grave','great','greed','green','greet','grief','grind','groan','groom',
  'group','grove','guard','guess','guide','guild','guise','gusto','habit','happy',
  'harsh','hasn','haunt','haven','heavy','helix','hence','hinge','hippo','honey',
  'honor','horse','hotel','house','human','humor','hurry','ideal','image','imply',
  'index','indie','infer','inner','input','inter','intro','ionic','judge','juice',
  'juicy','jumbo','knife','kneel','knock','known','label','large','laser','later',
  'laugh','layer','learn','least','leave','legal','lemon','level','light','liked',
  'limit','linen','liver','local','lodge','logic','lyric',
  // 6-letter
  'action','advice','affect','afford','afraid','agency','agenda','almost','always',
  'animal','annual','answer','appeal','archer','arrive','asking','attack','author',
  'battle','beauty','before','behind','better','beyond','bigger','bridge','bright',
  'broken','bronze','budget','camera','castle','cattle','center','chance','change',
  'charge','chrome','circle','client','coffee','column','combat','common','comply',
  'corner','create','credit','crisis','custom','danger','debate','decade','decide',
  'design','desire','detail','device','dinner','direct','domain','double','driven',
  'effect','effort','empire','enable','ending','engage','engine','entire','escape',
  'evening','evolve','exceed','expect','expert','extend','factor','family','famous',
  'faster','father','figure','filter','finger','finite','flower','follow','forest',
  'forget','formal','fossil','global','golden','ground','growth','happen','harbor',
  'having','health','height','hidden','higher','hosted','impact','import','income',
  'indeed','inject','inside','insult','intake','intent','island','kernel','launch',
  'leader','legacy','length','little','locate','locked','manner','market','master',
  'matter','medium','member','memory','mental','mirror','mobile','module','moment',
  'mostly','mother','motion','motive','nation','nature','nearly','normal','notice',
  'obtain','office','online','option','orange','origin','output','oxygen','packed',
  'palace','parent','phrase','planet','player','plenty','policy','portal','pretty',
  'prison','profit','prompt','proven','purple','puzzle','random','ranked','rather',
  'reason','record','reduce','regard','relate','remote','render','repair','repeat',
  'rescue','return','reveal','review','robust','rocket','sample','saving','scheme',
  'signal','simple','single','smooth','social','source','spread','spring','square',
  'stable','static','status','steady','stream','strict','string','strong','studio',
  'submit','sudden','switch','symbol','system','talent','target','theory','things',
  'though','threat','thrown','ticket','timber','timely','toggle','toward','travel',
  'trophy','tunnel','turtle','unique','update','useful','vector','vertex','window',
  'winter','wisdom','wonder','worker','yellow'
];

// ─────────────────────────────────────────────
//  Game Config
// ─────────────────────────────────────────────
const CONFIG = {
  BASE_SPEED: 28,          // px per second at level 1
  SPEED_PER_LEVEL: 7,      // additional px/s per level
  MAX_CONCURRENT: 6,       // max simultaneous words
  SPAWN_INTERVAL: 2200,    // ms between spawns (base)
  SPAWN_MIN: 900,          // ms floor for spawn interval
  SPAWN_DECEL_PER_LEVEL: 130,
  BOARD_PADDING: 12,       // px from edges
  DANGER_ZONE: 0.72,       // fraction of board height for "danger" class
  SCORE_BASE: 10,          // per word
  SCORE_LENGTH_BONUS: 4,   // per extra char beyond 3
  COMBO_THRESHOLD: 3,      // combos start after this many consecutive
  COMBO_MULTIPLIER: 0.5,   // extra fraction per combo tier
  LEVEL_UP_WORDS: 8,       // words per level
  LIVES: 3,
  WPM_WINDOW: 30000,       // ms window for WPM calculation
};

// ─────────────────────────────────────────────
//  Utility
// ─────────────────────────────────────────────
function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function randInt(min, max) {
  return Math.floor(rand(min, max + 1));
}

function pickWord(level, usedWords) {
  // weight toward longer words as level increases
  const minLen = Math.min(3 + Math.floor(level * 0.4), 6);
  const maxLen = Math.min(4 + Math.floor(level * 0.6), 10);
  const pool = WORD_POOL.filter(w => w.length >= minLen && w.length <= maxLen && !usedWords.has(w));
  if (pool.length === 0) {
    // fallback: ignore usedWords
    const fallback = WORD_POOL.filter(w => w.length >= minLen && w.length <= maxLen);
    return fallback[randInt(0, fallback.length - 1)];
  }
  return pool[randInt(0, pool.length - 1)];
}

// ─────────────────────────────────────────────
//  Storage
// ─────────────────────────────────────────────
const STORAGE_KEY_SCORE = 'typing_highscore';
const STORAGE_KEY_WPM   = 'typing_bestwpm';

function getHighScore() { return parseInt(localStorage.getItem(STORAGE_KEY_SCORE) || '0', 10); }
function getBestWPM()    { return parseInt(localStorage.getItem(STORAGE_KEY_WPM)   || '0', 10); }
function saveHighScore(s) { localStorage.setItem(STORAGE_KEY_SCORE, s); }
function saveBestWPM(w)   { localStorage.setItem(STORAGE_KEY_WPM,   w); }

// ─────────────────────────────────────────────
//  DOM References
// ─────────────────────────────────────────────
const $ = id => document.getElementById(id);

const screens = {
  start:    $('screen-start'),
  gameover: $('screen-gameover'),
  pause:    $('screen-pause'),
};

const ui = {
  score:       $('score-val'),
  wpm:         $('wpm-val'),
  lives:       $('lives-display'),
  combo:       $('combo-display'),
  levelBadge:  $('level-badge'),
  board:       $('game-board'),
  input:       $('word-input'),
  startHS:     $('start-highscore'),
  startWPM:    $('start-bestwpm'),
  goScore:     $('go-score'),
  goWords:     $('go-words'),
  goWPM:       $('go-wpm'),
  goLevel:     $('go-level'),
  goNewScore:  $('go-new-score'),
  goNewWPM:    $('go-new-wpm'),
  pauseBtn:    $('pause-btn'),
};

// ─────────────────────────────────────────────
//  Game State
// ─────────────────────────────────────────────
let state = null;
let animFrame = null;
let spawnTimer = null;
let lastTimestamp = null;

function createState() {
  return {
    running: false,
    paused: false,
    score: 0,
    lives: CONFIG.LIVES,
    level: 1,
    wordsTyped: 0,
    wordsThisLevel: 0,
    combo: 0,
    words: [],           // active falling word objects
    usedWords: new Set(),
    // WPM tracking
    typeTimes: [],       // timestamps of correct word completions
    wpm: 0,
  };
}

// ─────────────────────────────────────────────
//  Word Object
// ─────────────────────────────────────────────
let wordIdCounter = 0;

function createWordObj(text, x, boardHeight, level) {
  const speed = CONFIG.BASE_SPEED + CONFIG.SPEED_PER_LEVEL * (level - 1);
  const jitter = rand(-4, 4);
  return {
    id: ++wordIdCounter,
    text,
    x,
    y: -40,
    speed: speed + jitter,
    el: null,
    active: false,   // currently being typed
    typed: '',
    alive: true,
  };
}

function spawnWord() {
  if (!state || !state.running || state.paused) return;
  if (state.words.length >= CONFIG.MAX_CONCURRENT) return;

  const board = ui.board;
  const bw = board.clientWidth;
  const bh = board.clientHeight;

  const text = pickWord(state.level, state.usedWords);
  state.usedWords.add(text);
  if (state.usedWords.size > WORD_POOL.length * 0.7) state.usedWords.clear();

  // estimate element width (rough: 10px per char + 24px padding)
  const estWidth = text.length * 10 + 24;
  const x = rand(CONFIG.BOARD_PADDING, Math.max(CONFIG.BOARD_PADDING, bw - estWidth - CONFIG.BOARD_PADDING));

  const word = createWordObj(text, x, bh, state.level);

  // Create DOM element
  const el = document.createElement('div');
  el.className = 'falling-word';
  el.style.left = `${word.x}px`;
  el.style.top  = `${word.y}px`;
  el.textContent = word.text;
  el.dataset.id = word.id;
  board.appendChild(el);
  word.el = el;

  state.words.push(word);
}

// ─────────────────────────────────────────────
//  Game Loop
// ─────────────────────────────────────────────
function gameLoop(timestamp) {
  if (!state.running || state.paused) return;

  const dt = lastTimestamp ? (timestamp - lastTimestamp) / 1000 : 0;
  lastTimestamp = timestamp;

  const bh = ui.board.clientHeight;
  const dangerY = bh * CONFIG.DANGER_ZONE;

  // Move words
  for (let i = state.words.length - 1; i >= 0; i--) {
    const w = state.words[i];
    if (!w.alive) { state.words.splice(i, 1); continue; }

    w.y += w.speed * dt;
    w.el.style.top = `${w.y}px`;

    // Danger class
    if (w.y > dangerY) {
      w.el.classList.add('danger');
      w.el.classList.remove('active');
    }

    // Word escaped
    if (w.y > bh + 10) {
      loseLife(w);
      removeWord(w);
      state.words.splice(i, 1);
    }
  }

  // Update active word highlight & input match
  updateActiveWord();
  updateWPM();

  animFrame = requestAnimationFrame(gameLoop);
}

function updateActiveWord() {
  const typed = ui.input.value.trim().toLowerCase();
  if (!typed) {
    // clear all active states
    state.words.forEach(w => {
      if (w.active) {
        w.active = false;
        w.typed = '';
        renderWordEl(w);
      }
    });
    return;
  }

  let best = null;
  let bestScore = -1;

  for (const w of state.words) {
    if (!w.alive) continue;
    if (w.text.startsWith(typed)) {
      // prefer the one lowest on screen (closest to bottom = most urgent)
      const score = w.y;
      if (score > bestScore) {
        bestScore = score;
        best = w;
      }
    }
  }

  // Update active states
  state.words.forEach(w => {
    if (w === best) {
      if (!w.active || w.typed !== typed) {
        w.active = true;
        w.typed = typed;
        renderWordEl(w);
      }
    } else if (w.active) {
      w.active = false;
      w.typed = '';
      renderWordEl(w);
    }
  });
}

function renderWordEl(w) {
  const el = w.el;
  if (!el) return;
  if (w.active && w.typed.length > 0) {
    el.classList.add('active');
    el.classList.remove('danger');
    const typed = w.typed;
    const rest  = w.text.slice(typed.length);
    el.innerHTML = `<span class="typed-portion">${typed}</span>${rest}`;
  } else {
    el.classList.remove('active');
    el.textContent = w.text;
    // re-apply danger if needed
    const bh = ui.board.clientHeight;
    if (w.y > bh * CONFIG.DANGER_ZONE) el.classList.add('danger');
  }
}

function removeWord(w) {
  if (w.el && w.el.parentNode) w.el.parentNode.removeChild(w.el);
  w.alive = false;
}

// ─────────────────────────────────────────────
//  Input Handler
// ─────────────────────────────────────────────
function handleInput() {
  if (!state || !state.running || state.paused) return;
  updateActiveWord();
}

function handleEnter() {
  if (!state || !state.running || state.paused) return;

  const typed = ui.input.value.trim().toLowerCase();
  if (!typed) return;

  // Find matching word (exact match)
  let matched = null;
  for (const w of state.words) {
    if (w.alive && w.text === typed) {
      matched = w;
      break;
    }
  }

  if (matched) {
    destroyWord(matched, typed);
    ui.input.value = '';
    ui.input.classList.remove('wrong-shake');
    void ui.input.offsetWidth; // reflow
    ui.input.classList.add('correct-flash');
    setTimeout(() => ui.input.classList.remove('correct-flash'), 350);
  } else {
    // Wrong word — shake input, break combo
    ui.input.classList.remove('wrong-shake');
    void ui.input.offsetWidth;
    ui.input.classList.add('wrong-shake');
    setTimeout(() => ui.input.classList.remove('wrong-shake'), 350);
    breakCombo();
  }
}

function destroyWord(w, typed) {
  // Explosion animation
  w.el.classList.add('exploding');
  w.el.classList.remove('active', 'danger');
  w.el.textContent = w.text;

  const rect = w.el.getBoundingClientRect();
  const boardRect = ui.board.getBoundingClientRect();
  const popX = rect.left - boardRect.left + rect.width / 2;
  const popY = rect.top  - boardRect.top;

  setTimeout(() => removeWord(w), 350);
  w.alive = false;

  // Score
  const len = typed.length;
  const baseScore = CONFIG.SCORE_BASE + Math.max(0, len - 3) * CONFIG.SCORE_LENGTH_BONUS;

  state.combo++;
  const comboTier = Math.max(0, state.combo - CONFIG.COMBO_THRESHOLD);
  const multiplier = 1 + comboTier * CONFIG.COMBO_MULTIPLIER;
  const earned = Math.round(baseScore * multiplier);

  state.score += earned;
  state.wordsTyped++;
  state.wordsThisLevel++;
  state.typeTimes.push(Date.now());

  // Show score popup
  showScorePopup(`+${earned}`, popX, popY, false);

  // Combo display
  if (state.combo >= CONFIG.COMBO_THRESHOLD) {
    showComboPopup(state.combo, popX, popY - 28);
    ui.combo.textContent = `${state.combo}x`;
    ui.combo.classList.remove('pop');
    void ui.combo.offsetWidth;
    ui.combo.classList.add('pop');
    setTimeout(() => ui.combo.classList.remove('pop'), 200);
  }

  // Level up?
  if (state.wordsThisLevel >= CONFIG.LEVEL_UP_WORDS) {
    state.level++;
    state.wordsThisLevel = 0;
    updateSpawnTimer();
    ui.levelBadge.textContent = `LV ${state.level}`;
    // brief flash on level badge
    ui.levelBadge.style.color = '#60A5FA';
    setTimeout(() => { ui.levelBadge.style.color = ''; }, 600);
  }

  updateHUD();
}

function showScorePopup(text, x, y, isCombo) {
  const el = document.createElement('div');
  el.className = 'score-popup' + (isCombo ? ' combo-popup' : '');
  el.textContent = text;
  el.style.left = `${x}px`;
  el.style.top  = `${y}px`;
  ui.board.appendChild(el);
  setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 800);
}

function showComboPopup(combo, x, y) {
  showScorePopup(`${combo} COMBO!`, x, y, true);
}

function breakCombo() {
  if (state.combo > 0) {
    state.combo = 0;
    ui.combo.textContent = '';
    updateHUD();
  }
}

// ─────────────────────────────────────────────
//  Lives
// ─────────────────────────────────────────────
function loseLife(w) {
  state.lives--;
  state.combo = 0;
  ui.combo.textContent = '';

  // Board flash
  const flash = document.createElement('div');
  flash.className = 'board-flash';
  ui.board.appendChild(flash);
  setTimeout(() => { if (flash.parentNode) flash.parentNode.removeChild(flash); }, 450);

  updateHUD();

  if (state.lives <= 0) {
    endGame();
  }
}

// ─────────────────────────────────────────────
//  WPM
// ─────────────────────────────────────────────
function updateWPM() {
  const now = Date.now();
  const window_ = CONFIG.WPM_WINDOW;
  state.typeTimes = state.typeTimes.filter(t => now - t < window_);
  const minutes = window_ / 60000;
  state.wpm = Math.round(state.typeTimes.length / minutes);
}

// ─────────────────────────────────────────────
//  HUD
// ─────────────────────────────────────────────
function updateHUD() {
  ui.score.textContent = state.score;
  ui.wpm.textContent   = state.wpm;
  ui.levelBadge.textContent = `LV ${state.level}`;

  // Lives
  ui.lives.innerHTML = '';
  for (let i = 0; i < CONFIG.LIVES; i++) {
    const span = document.createElement('span');
    span.className = 'life-icon' + (i >= state.lives ? ' lost' : '');
    span.textContent = '♥';
    ui.lives.appendChild(span);
  }

  if (state.combo >= CONFIG.COMBO_THRESHOLD) {
    ui.combo.textContent = `${state.combo}x`;
  } else {
    ui.combo.textContent = '';
  }
}

// ─────────────────────────────────────────────
//  Spawn Timer
// ─────────────────────────────────────────────
function updateSpawnTimer() {
  clearInterval(spawnTimer);
  const interval = Math.max(
    CONFIG.SPAWN_MIN,
    CONFIG.SPAWN_INTERVAL - CONFIG.SPAWN_DECEL_PER_LEVEL * (state.level - 1)
  );
  spawnTimer = setInterval(spawnWord, interval);
}

// ─────────────────────────────────────────────
//  Game Lifecycle
// ─────────────────────────────────────────────
function startGame() {
  // Clear board
  ui.board.innerHTML = '';
  ui.input.value = '';

  state = createState();
  state.running = true;

  updateHUD();
  hideAllScreens();

  updateSpawnTimer();
  spawnWord(); // immediate first word

  lastTimestamp = null;
  animFrame = requestAnimationFrame(gameLoop);

  ui.input.focus();
}

function endGame() {
  state.running = false;
  clearInterval(spawnTimer);
  cancelAnimationFrame(animFrame);

  // Final WPM
  updateWPM();

  // Save high scores
  const prevHS  = getHighScore();
  const prevWPM = getBestWPM();
  const newHS   = state.score > prevHS;
  const newWPM  = state.wpm > prevWPM;

  if (newHS)  saveHighScore(state.score);
  if (newWPM) saveBestWPM(state.wpm);

  // Populate game over screen
  ui.goScore.textContent  = state.score;
  ui.goWords.textContent  = state.wordsTyped;
  ui.goWPM.textContent    = state.wpm;
  ui.goLevel.textContent  = state.level;
  ui.goNewScore.style.display = newHS  ? 'block' : 'none';
  ui.goNewWPM.style.display   = newWPM ? 'block' : 'none';

  showScreen('gameover');
}

function pauseGame() {
  if (!state || !state.running) return;
  state.paused = true;
  clearInterval(spawnTimer);
  cancelAnimationFrame(animFrame);
  ui.pauseBtn.textContent = '▶ 재개';
  showScreen('pause');
}

function resumeGame() {
  if (!state || !state.running) return;
  state.paused = false;
  hideAllScreens();
  updateSpawnTimer();
  lastTimestamp = null;
  animFrame = requestAnimationFrame(gameLoop);
  ui.pauseBtn.textContent = '⏸ 일시정지';
  ui.input.focus();
}

// ─────────────────────────────────────────────
//  Screen Helpers
// ─────────────────────────────────────────────
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.add('hidden'));
  if (screens[name]) screens[name].classList.remove('hidden');
}

function hideAllScreens() {
  Object.values(screens).forEach(s => s.classList.add('hidden'));
}

// ─────────────────────────────────────────────
//  Init
// ─────────────────────────────────────────────
function init() {
  // Populate start screen high scores
  ui.startHS.textContent  = getHighScore();
  ui.startWPM.textContent = getBestWPM();

  // Show start screen
  showScreen('start');

  // Input events
  ui.input.addEventListener('input', handleInput);
  ui.input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleEnter();
    }
    if (e.key === 'Escape') {
      if (state && state.running && !state.paused) pauseGame();
      else if (state && state.paused) resumeGame();
    }
  });

  // Button events
  $('btn-start').addEventListener('click', startGame);
  $('btn-restart').addEventListener('click', startGame);
  $('btn-resume').addEventListener('click', resumeGame);

  function returnToStart() {
    if (state) {
      state.running = false;
      state.paused = false;
      clearInterval(spawnTimer);
      cancelAnimationFrame(animFrame);
      ui.board.innerHTML = '';
      state = null;
    }
    ui.startHS.textContent  = getHighScore();
    ui.startWPM.textContent = getBestWPM();
    showScreen('start');
  }

  $('btn-quit').addEventListener('click', returnToStart);
  $('btn-quit-pause').addEventListener('click', returnToStart);

  ui.pauseBtn.addEventListener('click', () => {
    if (!state || !state.running) return;
    if (state.paused) resumeGame();
    else pauseGame();
  });

  // Keep input focused during game
  ui.board.addEventListener('click', () => {
    if (state && state.running && !state.paused) ui.input.focus();
  });

  // Prevent mobile keyboard dismissal from tapping board
  document.addEventListener('touchend', e => {
    if (state && state.running && !state.paused) {
      // only re-focus if target isn't a button
      if (!e.target.closest('button')) ui.input.focus();
    }
  }, { passive: true });
}

document.addEventListener('DOMContentLoaded', init);
