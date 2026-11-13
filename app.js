import {
  KEYBOARD_MAX,
  KEYBOARD_MIN,
  formatConcertName,
  formatWrittenName,
  generateQuestion,
  getKeyboardNotes,
  midiToNote,
  renderStaff
} from "./music.js";

const STORAGE_KEY = "trillo-progress-v1";
const BASE_STATS = {
  answered: 0,
  correct: 0,
  elapsedSeconds: 0,
  bestStreak: 0,
  currentStreak: 0,
  clefs: { treble: { answered: 0, correct: 0 }, bass: { answered: 0, correct: 0 } },
  sessions: []
};
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const elements = {
  nav: $("#main-navigation"),
  menu: $(".menu-toggle"),
  keyboard: $("#piano-keyboard"),
  staff: $("#staff-svg"),
  feedback: $("#answer-feedback"),
  hint: $("#staff-hint"),
  next: $("#next-question"),
  pause: $("#pause-session"),
  pauseOverlay: $("#pause-overlay"),
  finished: $("#session-finished")
};

function showNotice(message, isError = false) {
  let notice = $("#app-notice");
  if (!notice) {
    notice = document.createElement("div");
    notice.id = "app-notice";
    notice.setAttribute("role", "status");
    notice.setAttribute("aria-live", "polite");
    notice.className = "app-notice";
    document.body.append(notice);
  }
  notice.textContent = message;
  notice.dataset.state = isError ? "error" : "success";
  notice.hidden = false;
  window.clearTimeout(showNotice.timeout);
  showNotice.timeout = window.setTimeout(() => { notice.hidden = true; }, 4200);
}

function validStats(value) {
  return value && Number.isInteger(value.answered) && value.answered >= 0 &&
    Number.isInteger(value.correct) && value.correct >= 0 && value.correct <= value.answered &&
    Number.isFinite(value.elapsedSeconds) && value.elapsedSeconds >= 0 &&
    Number.isInteger(value.bestStreak) && value.bestStreak >= 0 &&
    value.clefs && ["treble", "bass"].every((clef) => value.clefs[clef] &&
      Number.isInteger(value.clefs[clef].answered) && value.clefs[clef].answered >= 0 &&
      Number.isInteger(value.clefs[clef].correct) && value.clefs[clef].correct >= 0 &&
      value.clefs[clef].correct <= value.clefs[clef].answered) &&
    Number.isInteger(value.currentStreak) && value.currentStreak >= 0 && value.currentStreak <= value.bestStreak &&
    Array.isArray(value.sessions) && value.sessions.every((item) =>
      item && typeof item.date === "string" && Number.isInteger(item.answered) && item.answered >= 0 &&
      Number.isInteger(item.correct) && item.correct >= 0 && item.correct <= item.answered &&
      Number.isInteger(item.wrong) && item.wrong >= 0 && item.correct + item.wrong === item.answered &&
      Number.isFinite(item.elapsedSeconds) && item.elapsedSeconds >= 0);
}

function loadStats() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return structuredClone(BASE_STATS);
    const value = JSON.parse(stored);
    if (!validStats(value)) throw new TypeError("Dữ liệu tiến độ đã lưu không đúng định dạng.");
    return { ...BASE_STATS, ...value, clefs: { treble: { ...BASE_STATS.clefs.treble, ...value.clefs.treble }, bass: { ...BASE_STATS.clefs.bass, ...value.clefs.bass } } };
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof TypeError) {
      showNotice("Dữ liệu tiến độ không đọc được. Trillo sẽ bắt đầu một bảng tiến độ mới.", true);
      return structuredClone(BASE_STATS);
    }
    showNotice("Trình duyệt không cho phép đọc bộ nhớ cục bộ. Tiến độ có thể không được lưu.", true);
    return structuredClone(BASE_STATS);
  }
}

let stats = loadStats();
function saveStats() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
    return true;
  } catch {
    showNotice("Không thể lưu tiến độ trên thiết bị này. Kiểm tra dung lượng hoặc cài đặt trình duyệt.", true);
    return false;
  }
}

function navigate(page, updateHistory = true) {
  const target = document.querySelector(`[data-view="${page}"]`) ? page : "home";
  if (target !== "practice" && session.settings && !session.finished) {
    session.paused = true;
    elements.pauseOverlay.hidden = false;
    elements.pause.textContent = "▶ Tiếp tục";
    saveStats();
  }
  $$("[data-view]").forEach((view) => { view.hidden = view.dataset.view !== target; });
  $$("[data-page]").forEach((link) => {
    if (link.dataset.page === target && link.closest("nav")) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  elements.nav.classList.remove("is-open");
  elements.menu.setAttribute("aria-expanded", "false");
  elements.menu.setAttribute("aria-label", "Mở điều hướng");
  elements.menu.textContent = "☰";
  if (updateHistory && window.location.hash !== `#${target}`) window.history.pushState({ page: target }, "", `#${target}`);
  if (target === "progress") renderProgress();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

$$("[data-page]").forEach((link) => link.addEventListener("click", (event) => {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  if (link.dataset.page === "practice" && (!session.settings || session.finished)) {
    startSession();
    return;
  }
  navigate(link.dataset.page);
}));
window.addEventListener("popstate", () => navigate(window.location.hash.slice(1) || "home", false));
window.addEventListener("hashchange", () => {
  const page = window.location.hash.slice(1);
  if (document.querySelector(`[data-view="${page}"]`)) navigate(page, false);
});
elements.menu.addEventListener("click", () => {
  const open = elements.menu.getAttribute("aria-expanded") !== "true";
  elements.nav.classList.toggle("is-open", open);
  elements.menu.setAttribute("aria-expanded", String(open));
  elements.menu.setAttribute("aria-label", open ? "Đóng điều hướng" : "Mở điều hướng");
  elements.menu.textContent = open ? "×" : "☰";
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && elements.menu.getAttribute("aria-expanded") === "true") {
    elements.nav.classList.remove("is-open");
    elements.menu.setAttribute("aria-expanded", "false");
    elements.menu.setAttribute("aria-label", "Mở điều hướng");
    elements.menu.textContent = "☰";
    elements.menu.focus();
  }
});

const clefSelect = $("#clef-select");
const exerciseSelect = $("#exercise-select");
const difficultySelect = $("#difficulty-select");
const lowSelect = $("#range-low");
const highSelect = $("#range-high");
const totalSelect = $("#question-total");
const noteOptions = [];
for (let midi = KEYBOARD_MIN; midi <= KEYBOARD_MAX; midi += 1) {
  const note = midiToNote(midi);
  noteOptions.push({ midi, note });
}

function noteOptionLabel({ midi, note }) {
  const names = {
    C: "Đô", "C♯": "Đô♯", D: "Rê", "D♯": "Rê♯", E: "Mi",
    F: "Fa", "F♯": "Fa♯", G: "Sol", "G♯": "Sol♯", A: "La",
    "A♯": "La♯", B: "Si"
  };
  return `${names[note.name]}${note.octave}`;
}
for (const select of [lowSelect, highSelect]) {
  for (const option of noteOptions) select.add(new Option(noteOptionLabel(option), String(option.midi)));
}

const presets = {
  easy: { clefMode: "treble", minMidi: 60, maxMidi: 76, total: 5 },
  medium: { clefMode: "treble", minMidi: 55, maxMidi: 79, total: 10 },
  hard: { clefMode: "both", minMidi: 43, maxMidi: 84, total: 10 },
  advanced: { clefMode: "both", minMidi: 36, maxMidi: 84, total: 20 }
};

function applyDifficultyPreset() {
  const preset = presets[difficultySelect.value];
  clefSelect.value = chosenExercise === "mixed" ? "both" : preset.clefMode;
  lowSelect.value = String(preset.minMidi);
  highSelect.value = String(preset.maxMidi);
  totalSelect.value = String(preset.total);
}

exerciseSelect.addEventListener("change", () => {
  chosenExercise = exerciseSelect.value;
  if (chosenExercise === "mixed") clefSelect.value = "both";
  synchronizeModeCards();
});
clefSelect.addEventListener("change", updateModeSummary);
difficultySelect.addEventListener("change", () => {
  chosenDifficulty = difficultySelect.value;
  applyDifficultyPreset();
  synchronizeModeCards();
});
$("#apply-settings").addEventListener("click", () => {
  if (Number(lowSelect.value) > Number(highSelect.value)) {
    showNotice("Nốt thấp nhất phải bằng hoặc thấp hơn nốt cao nhất.", true);
    lowSelect.focus();
    return;
  }
  startSession();
});

const session = {
  settings: null,
  question: null,
  questionNumber: 0,
  answered: 0,
  correct: 0,
  wrong: 0,
  points: 0,
  streak: 0,
  bestStreak: 0,
  paused: false,
  elapsedSeconds: 0,
  finished: false
};
let soundEnabled = true;
let audioContext;
let sessionTimer;
let storageTimer;

function getSettings() {
  return {
    clefMode: clefSelect.value,
    exercise: exerciseSelect.value,
    difficulty: difficultySelect.value,
    minMidi: Number(lowSelect.value),
    maxMidi: Number(highSelect.value),
    total: Number(totalSelect.value)
  };
}

function playTone(midi) {
  if (!soundEnabled) return;
  try {
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor) {
      soundEnabled = false;
      $("#sound-toggle").setAttribute("aria-pressed", "false");
      $(".toggle-state").textContent = "Không hỗ trợ";
      showNotice("Trình duyệt này chưa hỗ trợ phát âm thanh.", true);
      return;
    }
    audioContext ||= new AudioContextConstructor();
    if (audioContext.state === "suspended") void audioContext.resume();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12);
    gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, audioContext.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.7);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.71);
  } catch {
    showNotice("Không thể phát âm thanh. Bạn vẫn có thể tiếp tục luyện tập bình thường.", true);
  }
}

function createKeyboard() {
  const notes = getKeyboardNotes();
  elements.keyboard.replaceChildren();
  const whites = notes.filter((note) => note.white);
  const whitePositions = new Map(whites.map((note, index) => [note.midi, index]));
  for (const note of notes) {
    const key = document.createElement("button");
    key.type = "button";
    key.className = `piano-key ${note.white ? "white" : "black"}`;
    key.dataset.midi = String(note.midi);
    key.setAttribute("aria-label", `${formatConcertName(note.midi)}, phím ${note.white ? "trắng" : "đen"}`);
    key.setAttribute("aria-pressed", "false");
    if (note.white) {
      const label = document.createElement("span");
      label.className = "key-label";
      label.textContent = note.isOctaveStart ? `Đô ${note.octave}` : "";
      key.append(label);
    } else {
      const label = document.createElement("span");
      label.className = "key-label";
      label.textContent = note.name;
      key.append(label);
      const lowerWhiteIndex = whites.findIndex((white) => white.midi > note.midi) - 1;
      const lowerWhite = whites[lowerWhiteIndex];
      if (!lowerWhite) throw new Error("Không thể xác định vị trí phím đen trên bàn phím.");
      key.style.left = `${4 + (whitePositions.get(lowerWhite.midi) + 1) * 36 - 1}px`;
    }
    key.addEventListener("click", () => answerQuestion(note.midi));
    elements.keyboard.append(key);
  }
}

function updateSessionStats() {
  $("#score-value").textContent = String(session.points);
  $("#correct-count").textContent = String(session.correct);
  $("#wrong-count").textContent = String(session.wrong);
  $("#accuracy-value").textContent = session.answered ? `${Math.round(session.correct / session.answered * 100)}%` : "—";
  $("#streak-value").textContent = String(session.streak);
  $("#best-streak-session").textContent = String(session.bestStreak);
  const total = session.settings?.total || 0;
  $("#question-count").textContent = total
    ? `Câu ${Math.min(session.questionNumber, total)} trong ${total}`
    : `Câu ${session.questionNumber} · Không giới hạn`;
  const percent = total ? Math.min(100, Math.round(session.answered / total * 100)) : 0;
  $("#progress-percent").textContent = total ? `${percent}%` : `${session.answered} câu`;
  $("#progress-bar").style.width = `${percent}%`;
}

function renderQuestion() {
  if (session.finished || !session.question) return;
  renderStaff(elements.staff, session.question);
  $("#clef-badge").textContent = session.question.clef === "treble" ? "Khóa Sol" : "Khóa Fa";
  elements.feedback.hidden = true;
  elements.feedback.textContent = "";
  elements.feedback.className = "answer-feedback";
  elements.hint.hidden = false;
  elements.next.disabled = true;
  for (const key of $$(".piano-key")) {
    key.disabled = session.paused;
    key.classList.remove("is-correct", "is-answer", "is-pressed");
    key.setAttribute("aria-pressed", "false");
  }
  updateSessionStats();
}

function nextQuestion() {
  if (session.settings.total > 0 && session.questionNumber >= session.settings.total) {
    finishSession();
    return;
  }
  try {
    session.question = generateQuestion(session.settings);
  } catch (error) {
    showNotice(error.message, true);
    finishSession(false);
    return;
  }
  session.questionNumber += 1;
  renderQuestion();
}

function answerQuestion(midi) {
  if (!session.question || session.paused || session.finished || !elements.next.disabled) return;
  const isCorrect = midi === session.question.targetMidi;
  session.answered += 1;
  if (isCorrect) {
    session.correct += 1;
    session.points += 10;
    session.streak += 1;
    session.bestStreak = Math.max(session.bestStreak, session.streak);
    elements.feedback.className = "answer-feedback is-correct";
    elements.feedback.textContent = `Chính xác! ${formatWrittenName(session.question)} là ${formatConcertName(session.question.targetMidi)}.`;
  } else {
    session.wrong += 1;
    session.streak = 0;
    elements.feedback.className = "answer-feedback is-wrong";
    elements.feedback.textContent = `Chưa sao! Nốt này là ${formatWrittenName(session.question)} (${formatConcertName(session.question.targetMidi)}). Cùng thử câu tiếp theo nhé.`;
  }
  session.feedback = { correct: isCorrect };
  stats.answered += 1;
  stats.correct += Number(isCorrect);
  stats.currentStreak = isCorrect ? stats.currentStreak + 1 : 0;
  stats.bestStreak = Math.max(stats.bestStreak, stats.currentStreak);
  stats.clefs[session.question.clef].answered += 1;
  stats.clefs[session.question.clef].correct += Number(isCorrect);
  elements.feedback.hidden = false;
  elements.hint.hidden = true;
  const chosenKey = $(`.piano-key[data-midi="${midi}"]`);
  const answerKey = $(`.piano-key[data-midi="${session.question.targetMidi}"]`);
  if (chosenKey) chosenKey.classList.add(isCorrect ? "is-correct" : "is-answer");
  if (!isCorrect && answerKey) answerKey.classList.add("is-correct");
  for (const key of $$(".piano-key")) key.disabled = true;
  elements.next.disabled = false;
  elements.next.textContent = session.settings.total && session.answered >= session.settings.total ? "Xem kết quả →" : "Câu tiếp theo →";
  playTone(isCorrect ? session.question.targetMidi : midi);
  updateSessionStats();
  saveStats();
}

function finishSession(shouldSave = true) {
  if (session.finished) return;
  session.finished = true;
  session.paused = false;
  window.clearInterval(sessionTimer);
  window.clearInterval(storageTimer);
  if (shouldSave && session.answered > 0) {
    const now = new Date();
    stats.sessions.unshift({
      date: now.toISOString(),
      answered: session.answered,
      correct: session.correct,
      wrong: session.wrong,
      elapsedSeconds: session.elapsedSeconds,
      difficulty: session.settings.difficulty,
      exercise: session.settings.exercise,
      clefMode: session.settings.clefMode,
      bestStreak: session.bestStreak
    });
    stats.sessions = stats.sessions.slice(0, 50);
  }
  $("#finish-summary").textContent = session.answered
    ? `Bạn trả lời đúng ${session.correct}/${session.answered} câu — chính xác ${Math.round(session.correct / session.answered * 100)}%. Một bước tiến tuyệt vời!`
    : "Hãy chọn phạm vi nốt phù hợp và bắt đầu buổi tập nhé.";
  elements.pauseOverlay.hidden = true;
  elements.finished.hidden = false;
  elements.pause.disabled = true;
  elements.next.disabled = true;
  $("#finish-session").disabled = true;
  $("#score-live").textContent = "ĐÃ KẾT THÚC";
  updateSessionStats();
  if (shouldSave) saveStats();
}

function startSession() {
  if (Number(lowSelect.value) > Number(highSelect.value)) {
    showNotice("Nốt thấp nhất phải bằng hoặc thấp hơn nốt cao nhất.", true);
    lowSelect.focus();
    return;
  }
  const settings = getSettings();
  try {
    generateQuestion(settings);
  } catch (error) {
    showNotice(error.message, true);
    return;
  }
  if (!session.finished && session.settings && session.answered > 0) finishSession();
  window.clearInterval(sessionTimer);
  window.clearInterval(storageTimer);
  Object.assign(session, {
    settings, question: null, questionNumber: 0, answered: 0, correct: 0, wrong: 0,
    points: 0, streak: 0, bestStreak: 0, paused: false, elapsedSeconds: 0, finished: false
  });
  chosenExercise = settings.exercise;
  chosenDifficulty = settings.difficulty;
  synchronizeModeCards();
  elements.finished.hidden = true;
  elements.pauseOverlay.hidden = true;
  elements.pause.disabled = false;
  $("#finish-session").disabled = false;
  elements.pause.textContent = "Ⅱ Tạm dừng";
  elements.next.disabled = true;
  elements.next.textContent = "Câu tiếp theo →";
  $("#score-live").textContent = "ĐANG TẬP";
  nextQuestion();
  navigate("practice");
  sessionTimer = window.setInterval(() => {
    if (!session.paused && !session.finished) {
      session.elapsedSeconds += 1;
      stats.elapsedSeconds += 1;
    }
  }, 1000);
  storageTimer = window.setInterval(() => { if (!session.finished) saveStats(); }, 10000);
}

elements.next.addEventListener("click", () => {
  if (!elements.next.disabled && !session.finished) {
    if (session.settings.total && session.answered >= session.settings.total) finishSession();
    else nextQuestion();
  }
});
elements.pause.addEventListener("click", () => {
  session.paused = !session.paused;
  elements.pauseOverlay.hidden = !session.paused;
  elements.pause.textContent = session.paused ? "▶ Tiếp tục" : "Ⅱ Tạm dừng";
  for (const key of $$(".piano-key")) key.disabled = session.paused || !elements.next.disabled;
  if (session.paused) $("#resume-session").focus();
});
$("#resume-session").addEventListener("click", () => {
  session.paused = false;
  elements.pauseOverlay.hidden = true;
  elements.pause.textContent = "Ⅱ Tạm dừng";
  for (const key of $$(".piano-key")) key.disabled = !elements.next.disabled;
});
$("#new-session").addEventListener("click", startSession);
$("#finish-session").addEventListener("click", () => finishSession());
$("#sound-toggle").addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  $("#sound-toggle").setAttribute("aria-pressed", String(soundEnabled));
  $(".toggle-state").textContent = soundEnabled ? "Bật" : "Tắt";
  if (soundEnabled) playTone(60);
});

const exerciseNames = { natural: "Nốt cơ bản", accidentals: "Dấu hóa", ledger: "Nốt ngoài khuông", mixed: "Tổng hợp" };
const difficultyNames = { easy: "Dễ", medium: "Trung bình", hard: "Khó", advanced: "Nâng cao" };
let chosenExercise = exerciseSelect.value;
let chosenDifficulty = difficultySelect.value;
function updateModeSummary() {
  const clefNames = { treble: "Khóa Sol", bass: "Khóa Fa", both: "Hai khóa" };
  $("#mode-summary").textContent = `${exerciseNames[chosenExercise]} · ${clefNames[clefSelect.value]} · ${difficultyNames[chosenDifficulty]}`;
}
function synchronizeModeCards() {
  $$(".mode-card").forEach((item) => {
    const selected = item.dataset.exercise === chosenExercise;
    item.classList.toggle("is-selected", selected);
    item.setAttribute("aria-pressed", String(selected));
  });
  $$(".level-card").forEach((item) => item.classList.toggle("is-selected", item.dataset.difficulty === chosenDifficulty));
  updateModeSummary();
}
$$(".mode-card").forEach((card) => card.addEventListener("click", () => {
  chosenExercise = card.dataset.exercise;
  exerciseSelect.value = chosenExercise;
  if (chosenExercise === "mixed") clefSelect.value = "both";
  synchronizeModeCards();
}));
$$(".level-card").forEach((card) => card.addEventListener("click", () => {
  chosenDifficulty = card.dataset.difficulty;
  difficultySelect.value = chosenDifficulty;
  synchronizeModeCards();
}));
$("#mode-start").addEventListener("click", () => {
  exerciseSelect.value = chosenExercise;
  difficultySelect.value = chosenDifficulty;
  applyDifficultyPreset();
  exerciseSelect.value = chosenExercise;
  startSession();
});

function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return minutes ? `${minutes} phút${remaining ? ` ${remaining} giây` : ""}` : `${remaining} giây`;
}
function setText(selector, text) { $(selector).textContent = text; }
function setBar(selector, percentage) { $(selector).style.width = `${Math.max(0, Math.min(100, percentage))}%`; }

function renderProgress() {
  const accuracy = stats.answered ? Math.round(stats.correct / stats.answered * 100) : null;
  setText("#total-answered", String(stats.answered));
  setText("#total-accuracy", accuracy === null ? "—" : `${accuracy}%`);
  setText("#total-time", `${Math.floor(stats.elapsedSeconds / 60)} phút`);
  setText("#total-best-streak", `${stats.bestStreak} nốt`);
  setBar("#accuracy-bar", accuracy ?? 0);
  for (const clef of ["treble", "bass"]) {
    const data = stats.clefs[clef];
    const percent = data.answered ? Math.round(data.correct / data.answered * 100) : null;
    setText(`#${clef}-detail`, `${data.answered} câu`);
    setText(`#${clef}-accuracy`, percent === null ? "—" : `${percent}%`);
    setBar(`#${clef}-bar`, percent ?? 0);
  }
  renderHistory();
}

function renderHistory() {
  const history = $("#session-history");
  history.replaceChildren();
  if (stats.sessions.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-history";
    empty.innerHTML = '<span aria-hidden="true">♪</span><p>Chưa có buổi tập nào.<br>Bắt đầu buổi luyện đầu tiên nhé!</p>';
    history.append(empty);
    return;
  }
  for (const item of stats.sessions.slice(0, 8)) {
    const row = document.createElement("div");
    row.className = "history-row";
    const description = document.createElement("div");
    description.className = "history-name";
    const title = document.createElement("strong");
    title.textContent = `${exerciseNames[item.exercise] || "Luyện tập"} · ${difficultyNames[item.difficulty] || "Tùy chỉnh"}`;
    const date = document.createElement("span");
    const parsedDate = new Date(item.date);
    date.textContent = Number.isNaN(parsedDate.getTime()) ? "Ngày không xác định" : new Intl.DateTimeFormat("vi-VN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(parsedDate);
    description.append(title, date);
    const duration = document.createElement("span");
    duration.textContent = formatDuration(item.elapsedSeconds);
    const result = document.createElement("span");
    result.className = "history-result";
    result.textContent = `${item.answered ? Math.round(item.correct / item.answered * 100) : 0}%`;
    row.append(description, duration, result);
    history.append(row);
  }
}

$("#reset-progress").addEventListener("click", () => {
  const confirmed = window.confirm("Xóa toàn bộ lịch sử và tiến độ luyện tập trên thiết bị này?");
  if (!confirmed) return;
  if (!session.finished) finishSession(false);
  stats = structuredClone(BASE_STATS);
  saveStats();
  renderProgress();
  showNotice("Đã xóa toàn bộ tiến độ luyện tập.");
});

window.addEventListener("pagehide", () => {
  if (session && !session.finished && session.elapsedSeconds > 0) saveStats();
});

createKeyboard();
const initialPage = window.location.hash.slice(1);
applyDifficultyPreset();
synchronizeModeCards();
if (initialPage === "practice") startSession();
else navigate(document.querySelector(`[data-view="${initialPage}"]`) ? initialPage : "home", false);
