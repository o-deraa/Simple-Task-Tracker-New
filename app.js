const THEME_KEY = 'ttk-tema';
const HARI_JANGKA_PANJANG = 7;

const taskList = document.getElementById('task-list');
const longList = document.getElementById('long-list');
const emptyState = document.getElementById('empty-state');
const longEmpty = document.getElementById('long-empty');
const kartuJangka = document.getElementById('kartu-jangka');
const themeButton = document.getElementById('theme-button');
const trashIcon = document.getElementById('icon-trash');
const taskForm = document.getElementById('task-form');
const taskTitle = document.getElementById('task-title');
const taskCourse = document.getElementById('task-course');
const taskDeadline = document.getElementById('task-deadline');
const errorTitle = document.getElementById('error-title');
const errorCourse = document.getElementById('error-course');
const errorDeadline = document.getElementById('error-deadline');
const errorServer = document.getElementById('error-server');
const tombolTambah = document.getElementById('tombol-tambah');
const counter = document.getElementById('counter');
const filterButtons = document.querySelectorAll('.filter-tombol');
const progressBox = document.getElementById('progress');
const progressCount = document.getElementById('progress-count');
const progressPercent = document.getElementById('progress-percent');
const progressBar = document.getElementById('progress-bar');
const progressFill = document.getElementById('progress-fill');
const searchInput = document.getElementById('search-input');
const loadingState = document.getElementById('loading-state');
const errorState = document.getElementById('error-state');
const errorMessage = document.getElementById('error-message');
const retryButton = document.getElementById('retry-button');
const toast = document.getElementById('toast');

const FOCUS_SECONDS = 25 * 60;
const BREAK_SECONDS = 5 * 60;
const CYCLE_COUNT = 4;

const timerNumber = document.getElementById('timer-number');
const timerPhase = document.getElementById('timer-phase');
const timerCycles = document.getElementById('timer-cycles');
const timerCycleText = document.getElementById('timer-cycle-text');
const startButton = document.getElementById('start-button');
const pauseButton = document.getElementById('pause-button');
const resetButton = document.getElementById('reset-button');

function render() {
  // Tugas belum dimuat dari server; tampilkan status memuat sebagai keadaan awal.
  loadingState.hidden = false;
  taskList.hidden = true;
  counter.textContent = 'Memuat tugas...';
}

function themeLabel(theme) {
  themeButton.textContent = theme === 'gelap' ? 'Mode terang' : 'Mode gelap';
}

themeButton.addEventListener('click', () => {
  const next = document.documentElement.dataset.tema === 'gelap' ? 'terang' : 'gelap';
  document.documentElement.dataset.tema = next;
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    // Tema tetap berlaku untuk sesi ini walau gagal disimpan.
  }
  themeLabel(next);
});

themeLabel(document.documentElement.dataset.tema || 'terang');

let timerPhaseName = 'fokus';
let secondsLeft = FOCUS_SECONDS;
let cyclesDone = 0;
let timerId = null;

function formatTime(totalSeconds) {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function renderTimer() {
  timerNumber.textContent = formatTime(secondsLeft);
  timerPhase.textContent = timerPhaseName === 'fokus' ? 'Fokus' : 'Istirahat';

  timerCycles.replaceChildren();
  for (let i = 0; i < CYCLE_COUNT; i += 1) {
    const dot = document.createElement('span');
    dot.className = i < cyclesDone ? 'siklus isi' : 'siklus';
    timerCycles.append(dot);
  }
  timerCycleText.textContent = `${cyclesDone} dari ${CYCLE_COUNT} siklus fokus selesai`;

  startButton.disabled = timerId !== null;
  pauseButton.disabled = timerId === null;
}

function nextPhase() {
  if (timerPhaseName === 'fokus') {
    cyclesDone += 1;
    if (cyclesDone >= CYCLE_COUNT) {
      // Empat siklus selesai: timer berhenti dan kembali ke awal.
      stopTimer();
      cyclesDone = 0;
      timerPhaseName = 'fokus';
      secondsLeft = FOCUS_SECONDS;
      return;
    }
    timerPhaseName = 'istirahat';
    secondsLeft = BREAK_SECONDS;
  } else {
    timerPhaseName = 'fokus';
    secondsLeft = FOCUS_SECONDS;
  }
}

function tick() {
  secondsLeft -= 1;
  if (secondsLeft <= 0) nextPhase();
  renderTimer();
}

function stopTimer() {
  clearInterval(timerId);
  timerId = null;
}

// Kembalikan timer ke kondisi awal: 25 menit fokus, belum ada siklus, berhenti.
function resetTimer() {
  stopTimer();
  timerPhaseName = 'fokus';
  secondsLeft = FOCUS_SECONDS;
  cyclesDone = 0;
  renderTimer();
}

startButton.addEventListener('click', () => {
  if (timerId !== null) return;
  timerId = setInterval(tick, 1000);
  renderTimer();
});

pauseButton.addEventListener('click', () => {
  stopTimer();
  renderTimer();
});

resetButton.addEventListener('click', resetTimer);

renderTimer();

render();
