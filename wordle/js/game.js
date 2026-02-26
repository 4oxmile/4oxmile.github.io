/* ===================== WORD LISTS ===================== */

// Answer pool (100 common 5-letter words)
const ANSWERS = [
  "about","above","abuse","actor","acute","admit","adopt","adult","after","again",
  "agent","agree","ahead","alarm","album","alert","alike","align","alley","allow",
  "alone","along","altar","angel","angry","anime","ankle","annex","apart","apple",
  "apply","arena","argue","arise","armor","array","arrow","aside","asset","atlas",
  "attic","audio","audit","avoid","awake","award","aware","awful","azure","badly",
  "basic","basis","batch","beach","beard","beast","began","begin","being","below",
  "bench","berry","birth","black","blade","blame","bland","blank","blast","blaze",
  "bleed","blend","bless","blind","block","blood","bloom","blown","board","bonus",
  "boost","bound","boxer","brain","brand","brave","bread","break","bride","brief",
  "bring","broad","broke","brook","brown","brush","buddy","build","built","bulge"
];

// Valid guesses (300+ words including answers)
const VALID_WORDS = new Set([
  ...ANSWERS,
  "aahed","aalii","abaci","aback","abaft","abash","abate","abbey","abbot","abide",
  "abler","abode","abort","abound","abrupt","absurd","abyss","ached","acorn","acres",
  "acted","acute","adage","added","adept","adhere","adore","adorn","adrift","aegis",
  "afoot","agile","aglow","agony","aided","aimed","aired","aisle","aitch","aloft",
  "alpha","alter","alums","amber","amble","amend","amiss","ample","amuse","angel",
  "annoy","antic","antsy","anvil","aphid","apple","aptly","arbor","ardor","areal",
  "areas","arose","artsy","aspic","atone","atop","atria","attic","augur","aunts",
  "avail","avian","avid","axial","axles","axons","backs","bagel","baggy","baked",
  "baker","banal","banks","barns","baron","baste","baton","batty","bayou","bayonet",
  "beady","beige","being","beset","bevel","bezel","biers","biome","biped","birds",
  "bison","bitch","bitty","blare","bliss","bloat","blunt","blurt","boggy","bogus",
  "bongo","books","booth","booze","borax","botch","bough","boxer","brace","braid",
  "brake","brash","brawn","braze","breve","briar","brine","brink","brisk","broil",
  "brooch","brood","brunt","brute","budge","bulky","bully","bumps","bumpy","bunch",
  "bunny","buoys","burly","burns","burro","burrs","butte","buyer","cabal","cabin",
  "cache","cadet","camel","cameo","canal","candy","canny","canoe","canto","caped",
  "caper","carat","cargo","carol","carom","carve","caste","catch","catty","caulk",
  "cedar","cells","chafe","champ","chant","chaos","chapt","chard","charm","chars",
  "chart","chasm","cheap","check","cheek","cheer","chess","chest","chide","chief",
  "chime","chimp","choir","chord","chore","chose","civic","civil","claim","clamp",
  "clang","clank","clash","clasp","class","cleat","cleft","clerk","click","cliff",
  "cling","clink","cloak","clone","close","cloth","cloud","clout","clove","clown",
  "clubs","cluck","clump","clung","coax","cobalt","cobra","comet","comic","comma",
  "coral","couch","cough","could","count","coupe","court","covet","cozy","craft",
  "crane","crank","creak","creek","creed","creep","crest","cried","crisp","cross",
  "crude","cruel","crumb","crush","crust","curly","curse","curve","cushy","cycle",
  "cynic","daddy","dance","daunt","dazed","debut","decal","decay","decoy","delta",
  "dense","depot","depth","derby","detox","devil","ditty","dodge","dogma","doing",
  "dolly","donor","doubt","dough","dowdy","dowel","draft","drain","drape","drawl",
  "drawn","dread","dream","dregs","dried","drift","drool","droop","drove","drown",
  "druid","drunk","dunce","dusty","dwarf","dwell","eagle","early","earth","easel",
  "eerie","eight","elbow","elder","elite","emote","empty","enemy","enjoy","envy",
  "epoxy","equal","equip","ethic","evoke","exact","exert","exile","exist","extra",
  "fable","facet","faint","faith","faker","fancy","farce","fatal","favor","feast",
  "feces","femur","fence","ferny","ferry","fetch","fever","fewer","fiber","fiend",
  "fight","finch","first","fixed","fizzy","fjord","flame","flank","flare","flash",
  "flask","flaunt","fledge","flesh","flick","fling","flint","float","flock","flora",
  "floss","flout","fluid","flume","flung","flush","flute","focus","foggy","foray",
  "force","forge","forth","found","frail","frame","frank","fraud","freak","freed",
  "fresh","front","frost","froze","frugal","frump","fungi","funky","funny","genre",
  "ghost","giddy","given","gizmo","glade","glare","glean","glide","glint","gloat",
  "gloom","glory","gloss","glove","glyph","gnash","gnome","godly","gorge","gouge",
  "grace","grade","grain","grail","grasp","graze","greed","greet","grief","grill",
  "grime","grimy","gripe","groan","groin","grope","grove","growl","gruel","gruff",
  "grunt","guile","guise","gusto","gypsy","habit","happy","harsh","haven","havoc",
  "hazel","heart","heist","helix","hence","heron","heroic","horse","house","hover",
  "howl","human","humid","hurry","husky","hutch","hyena","hyper","icing","icily",
  "impel","inane","inner","inter","intro","irked","irony","itchy","ivory","jaunt",
  "jazzy","jelly","jewel","joust","joker","judge","juice","juicy","jumpy","kayak",
  "kazoo","knack","knave","kneel","knelt","knife","knock","knoll","knot","known",
  "kudos","label","lance","large","laser","later","lapse","latch","layer","leaky",
  "leapt","learn","leave","ledge","legal","lemon","level","lever","light","limbo",
  "liner","liner","lingo","lions","liver","llama","lodge","lofty","logic","loopy",
  "louse","lousy","lucid","lumpy","lunar","lusty","lyric","macro","mafia","magic",
  "maize","major","manor","maple","march","marlin","marsh","match","matte","maxim",
  "meant","media","melee","merit","metal","might","mirth","miser","mimic","mince",
  "mirage","miser","modal","model","moldy","money","monks","moody","moral","morph",
  "mossy","mourn","muddy","mural","murky","musty","muted","naive","nasty","naval",
  "nervy","night","noble","noise","noisy","nymph","ocean","often","ombre","onyx",
  "order","other","otter","ought","outdo","outer","outrun","ovary","overt","oxide",
  "ozone","paint","panda","panic","party","pasta","pasty","patch","patio","pause",
  "payoff","peace","penal","perch","perky","perch","pesky","petty","phase","phony",
  "photo","piano","pixel","picky","pilot","pinch","piped","pirate","pitch","pixel",
  "pivot","pixie","pizza","place","plaid","plain","plait","plank","plant","plasm",
  "plaza","plead","pleat","plied","pluck","plumb","plume","plush","poker","polar",
  "posse","pound","pouty","power","prank","press","price","prick","pride","prime",
  "prism","privy","probe","prone","prong","prose","prove","prowl","proxy","prude",
  "prune","psalm","puck","pulse","punch","pupil","purge","pushy","quake","qualm",
  "quart","quest","queue","quick","quiet","quill","quirk","quota","quote","rabbi",
  "radar","rainy","raise","rally","ramen","ranch","range","rapid","raven","realm",
  "rebel","recap","recon","regal","reign","relax","remix","repay","repel","reset",
  "revel","ridge","risky","rogue","rouge","rough","round","rouse","rower","rowdy",
  "royal","ruddy","ruler","rusty","sadly","saint","salsa","salve","sandy","sauce",
  "saucy","saved","savvy","scald","scalp","scaly","scamp","scant","scare","scarf",
  "scene","scoop","scope","score","scorn","scour","scout","scowl","scram","scrap",
  "scrawl","screw","scrum","seedy","serve","setup","seven","sewer","shall","shame",
  "shape","shard","shark","sheen","sheer","shelf","shell","shift","shine","shire",
  "shirt","shock","shone","shoot","shore","short","shove","shrew","shrub","shrug",
  "sigma","silky","silly","since","sixth","sixty","sized","skate","skier","skimp",
  "skirt","skulk","slain","slant","slash","sleek","sleet","slept","slick","slime",
  "slimy","sling","slump","slunk","smack","small","smear","smell","smelt","smile",
  "smite","smock","smoke","smoky","snack","snaky","snare","snark","sneer","sniff",
  "snore","snort","snout","snowy","solar","sonar","sonic","sorry","spark","spawn",
  "spear","spend","spice","spill","spine","spoke","spook","spoon","sport","spray",
  "spree","sprig","spunk","squad","squat","squid","stack","staff","staid","stain",
  "stair","stake","stale","stall","stamp","stand","stank","stark","stash","state",
  "stead","steel","steep","steer","stern","stiff","still","sting","stink","stomp",
  "stood","store","stout","strap","stray","strip","strive","strum","strut","stuck",
  "study","stump","stunt","suave","shuck","sugar","suite","sulk","sully","sunny",
  "super","surge","swarm","swath","swear","sweat","sweep","sweet","swift","swill",
  "swipe","swirl","sword","synth","taboo","tacit","talon","tangy","tense","tepid",
  "terse","theft","there","these","thick","thing","think","thorn","those","throb",
  "throw","thrum","thumb","thump","tiara","tidal","tinge","tipsy","titan","title",
  "toady","token","total","touch","tough","towel","tower","toxic","track","trade",
  "trail","train","tramp","trash","trawl","tread","trend","trial","trick","tripe",
  "trite","troll","troop","trot","trout","trove","truce","truck","truly","tryst",
  "tulle","tumor","tundra","tuned","tunic","tuple","tutor","twang","tweak","twice",
  "twill","twirl","twist","tying","ultra","umbra","uncle","under","unfit","union",
  "unlit","until","upper","upset","usher","usual","utter","vague","valid","valor",
  "valve","vapor","vault","venom","verse","vigor","viola","viper","viral","visit",
  "visor","vital","vivid","vocab","vodka","vomit","voter","vague","voter","waltz",
  "waste","watch","water","weary","wedge","weedy","whelm","where","while","whiff",
  "whirl","witch","witty","won't","world","wrath","wreck","wring","wrist","wrong",
  "wrote","yacht","yield","young","yours","youth","zingy","zippy","zonal","zoned"
]);

/* ===================== CONSTANTS ===================== */
const WORD_LENGTH = 5;
const MAX_ATTEMPTS = 6;

const KEY_ROWS = [
  ["Q","W","E","R","T","Y","U","I","O","P"],
  ["A","S","D","F","G","H","J","K","L"],
  ["ENTER","Z","X","C","V","B","N","M","⌫"]
];

/* ===================== STATE ===================== */
let targetWord = "";
let currentRow = 0;
let currentCol = 0;
let board = [];           // 6x5 array of letter strings
let tileEls = [];         // 6x5 array of DOM elements
let keyMap = {};          // letter -> DOM key element
let gameActive = false;
let isAnimating = false;  // block input during flip animations

/* ===================== STATS ===================== */
function loadStats() {
  const defaults = { played: 0, wins: 0, streak: 0, maxStreak: 0 };
  try {
    return JSON.parse(localStorage.getItem("wordle_stats")) || defaults;
  } catch {
    return defaults;
  }
}

function saveStats(stats) {
  localStorage.setItem("wordle_stats", JSON.stringify(stats));
}

/* ===================== INIT ===================== */
function initBoard() {
  const boardEl = document.getElementById("board");
  boardEl.innerHTML = "";
  board = [];
  tileEls = [];

  for (let r = 0; r < MAX_ATTEMPTS; r++) {
    board.push(Array(WORD_LENGTH).fill(""));
    tileEls.push([]);
    for (let c = 0; c < WORD_LENGTH; c++) {
      const tile = document.createElement("div");
      tile.classList.add("tile");
      boardEl.appendChild(tile);
      tileEls[r].push(tile);
    }
  }
}

function initKeyboard() {
  keyMap = {};
  const rows = [
    document.getElementById("keyRow1"),
    document.getElementById("keyRow2"),
    document.getElementById("keyRow3")
  ];

  rows.forEach((rowEl, i) => {
    rowEl.innerHTML = "";
    KEY_ROWS[i].forEach(label => {
      const btn = document.createElement("button");
      btn.classList.add("key");
      btn.textContent = label;
      btn.dataset.key = label;
      if (label === "ENTER" || label === "⌫") {
        btn.classList.add("wide");
      } else {
        keyMap[label] = btn;
      }
      btn.addEventListener("click", () => handleKey(label));
      rowEl.appendChild(btn);
    });
  });
}

function pickWord() {
  return ANSWERS[Math.floor(Math.random() * ANSWERS.length)].toUpperCase();
}

function startGame() {
  targetWord = pickWord();
  currentRow = 0;
  currentCol = 0;
  gameActive = true;
  isAnimating = false;
  initBoard();
  initKeyboard();
}

/* ===================== INPUT ===================== */
function handleKey(key) {
  if (!gameActive || isAnimating) return;

  if (key === "⌫" || key === "BACKSPACE") {
    deleteLetter();
  } else if (key === "ENTER") {
    submitGuess();
  } else if (/^[A-Z]$/.test(key)) {
    typeLetter(key);
  }
}

function typeLetter(letter) {
  if (currentCol >= WORD_LENGTH) return;
  board[currentRow][currentCol] = letter;
  const tile = tileEls[currentRow][currentCol];
  tile.textContent = letter;
  tile.classList.add("filled");
  currentCol++;
}

function deleteLetter() {
  if (currentCol <= 0) return;
  currentCol--;
  board[currentRow][currentCol] = "";
  const tile = tileEls[currentRow][currentCol];
  tile.textContent = "";
  tile.classList.remove("filled");
}

/* ===================== GUESS EVALUATION ===================== */
function evaluateGuess(guess, target) {
  // Returns array of "green"|"yellow"|"gray" for each position
  const result = Array(WORD_LENGTH).fill("gray");
  const targetLetters = target.split("");
  const guessLetters = guess.split("");
  const used = Array(WORD_LENGTH).fill(false);

  // First pass: exact matches
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guessLetters[i] === targetLetters[i]) {
      result[i] = "green";
      used[i] = true;
    }
  }

  // Second pass: wrong position
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (result[i] === "green") continue;
    for (let j = 0; j < WORD_LENGTH; j++) {
      if (!used[j] && guessLetters[i] === targetLetters[j]) {
        result[i] = "yellow";
        used[j] = true;
        break;
      }
    }
  }

  return result;
}

/* ===================== SUBMIT ===================== */
function submitGuess() {
  if (currentCol < WORD_LENGTH) {
    shakeRow(currentRow);
    showToast("글자를 다 입력하세요!");
    return;
  }

  const guess = board[currentRow].join("");

  if (!VALID_WORDS.has(guess.toLowerCase()) && !ANSWERS.includes(guess.toLowerCase())) {
    shakeRow(currentRow);
    showToast("유효하지 않은 단어예요");
    return;
  }

  const evaluation = evaluateGuess(guess, targetWord);
  revealRow(currentRow, evaluation, guess, () => {
    updateKeyboardColors(guess, evaluation);

    const won = evaluation.every(e => e === "green");
    if (won) {
      bounceRow(currentRow);
      const attempt = currentRow + 1;
      setTimeout(() => endGame(true, attempt), 400);
    } else if (currentRow === MAX_ATTEMPTS - 1) {
      setTimeout(() => endGame(false, 0), 400);
    }

    currentRow++;
    currentCol = 0;
  });
}

/* ===================== TILE ANIMATIONS ===================== */
function revealRow(row, evaluation, guess, onComplete) {
  isAnimating = true;
  const tiles = tileEls[row];
  const FLIP_DELAY = 300; // ms between each tile flip

  tiles.forEach((tile, i) => {
    setTimeout(() => {
      tile.classList.add("flip");
      // Apply color at the midpoint (when tile faces away)
      setTimeout(() => {
        tile.classList.remove("filled");
        tile.classList.add(`revealed-${evaluation[i]}`);
      }, FLIP_DELAY / 2);

      if (i === WORD_LENGTH - 1) {
        setTimeout(() => {
          isAnimating = false;
          if (onComplete) onComplete();
        }, FLIP_DELAY);
      }
    }, i * FLIP_DELAY);
  });
}

function shakeRow(row) {
  // Shake each tile in the row
  const tiles = tileEls[row];
  // Apply to the first tile's parent row by wrapping tiles in a div? No, shake per-tile.
  tiles.forEach(tile => {
    tile.classList.remove("row-shake");
    void tile.offsetWidth; // reflow
    tile.classList.add("row-shake");
    tile.addEventListener("animationend", () => tile.classList.remove("row-shake"), { once: true });
  });
}

function bounceRow(row) {
  tileEls[row].forEach((tile, i) => {
    setTimeout(() => {
      tile.classList.add("bounce");
      tile.addEventListener("animationend", () => tile.classList.remove("bounce"), { once: true });
    }, i * 90);
  });
}

/* ===================== KEYBOARD COLORS ===================== */
function updateKeyboardColors(guess, evaluation) {
  const priority = { green: 3, yellow: 2, gray: 1 };

  for (let i = 0; i < WORD_LENGTH; i++) {
    const letter = guess[i];
    const keyEl = keyMap[letter];
    if (!keyEl) continue;

    const current = keyEl.dataset.state || "";
    const newState = evaluation[i];

    if ((priority[newState] || 0) > (priority[current] || 0)) {
      keyEl.className = "key";
      keyEl.classList.add(newState);
      keyEl.dataset.state = newState;
    }
  }
}

/* ===================== END GAME ===================== */
function endGame(won, attempts) {
  gameActive = false;

  const stats = loadStats();
  stats.played++;

  if (won) {
    stats.wins++;
    stats.streak++;
    stats.maxStreak = Math.max(stats.maxStreak, stats.streak);
  } else {
    stats.streak = 0;
  }
  saveStats(stats);

  // Populate overlay
  document.getElementById("resultIcon").textContent = won ? "🎉" : "😔";
  document.getElementById("resultTitle").textContent = won ? "정답!" : "다음에 다시!";
  document.getElementById("resultAnswer").textContent =
    won ? `${attempts}번 만에 맞혔어요!` : `정답: ${targetWord}`;

  updateStatsUI(stats);

  setTimeout(() => {
    document.getElementById("gameOverScreen").classList.remove("hidden");
  }, won ? 800 : 300);
}

function updateStatsUI(stats) {
  document.getElementById("statPlayed").textContent = stats.played;
  document.getElementById("statWinPct").textContent =
    stats.played > 0 ? Math.round((stats.wins / stats.played) * 100) + "%" : "0%";
  document.getElementById("statStreak").textContent = stats.streak;
  document.getElementById("statMaxStreak").textContent = stats.maxStreak;
}

/* ===================== TOAST ===================== */
function showToast(msg, duration = 1500) {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.classList.add("toast");
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

/* ===================== KEYBOARD SUPPORT ===================== */
document.addEventListener("keydown", e => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const key = e.key.toUpperCase();
  if (key === "BACKSPACE") {
    handleKey("BACKSPACE");
  } else if (key === "ENTER") {
    handleKey("ENTER");
  } else if (/^[A-Z]$/.test(key)) {
    handleKey(key);
  }
});

/* ===================== UI WIRING ===================== */
document.getElementById("startBtn").addEventListener("click", () => {
  document.getElementById("startScreen").classList.add("hidden");
  startGame();
});

document.getElementById("newGameBtn").addEventListener("click", () => {
  document.getElementById("gameOverScreen").classList.add("hidden");
  startGame();
});

document.getElementById("helpBtn").addEventListener("click", () => {
  showToast("5글자 영단어를 6번 안에 맞춰보세요!");
});

document.getElementById("statsBtn").addEventListener("click", () => {
  const stats = loadStats();
  updateStatsUI(stats);
  if (gameActive) {
    showToast(
      `플레이: ${stats.played} | 승률: ${
        stats.played > 0 ? Math.round((stats.wins / stats.played) * 100) : 0
      }% | 연승: ${stats.streak}`
    );
  }
});
