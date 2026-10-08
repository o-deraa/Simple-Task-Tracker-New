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

let tasks = [];
let currentFilter = 'semua';
let loadState = 'loading';
let loadError = '';

async function api(url, options = {}) {
  let response;
  try {
    response = await fetch(url, options);
  } catch {
    throw new Error('Tidak bisa terhubung ke server. Periksa koneksi lalu coba lagi.');
  }

  if (!response.ok) {
    let message = `Permintaan gagal (HTTP ${response.status}).`;
    let payload = null;
    try {
      payload = await response.json();
      if (payload && payload.message) message = payload.message;
    } catch {
      // Respons error bukan JSON: pakai pesan bawaan.
    }
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  if (response.status === 204) return null;

  try {
    return await response.json();
  } catch {
    throw new Error('Respons server tidak bisa dibaca.');
  }
}

async function loadInitial() {
  loadState = 'loading';
  render();

  try {
    const [daftarTugas, daftarMatkul] = await Promise.all([
      api('/api/tugas'),
      api('/api/matkul'),
    ]);
    tasks = daftarTugas;
    fillCourseOptions(daftarMatkul);
    loadState = 'ready';
  } catch (error) {
    loadError = error.message;
    loadState = 'error';
  }

  render();
}

function fillCourseOptions(courses) {
  taskCourse.replaceChildren();

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Pilih mata kuliah';
  placeholder.disabled = true;
  placeholder.selected = true;
  taskCourse.append(placeholder);

  for (const name of courses) {
    const option = document.createElement('option');
    option.textContent = name;
    taskCourse.append(option);
  }
}

function daysUntil(iso) {
  const [tahun, bulan, tanggal] = iso.split('-').map(Number);
  const sekarang = new Date();
  const hariIni = new Date(sekarang.getFullYear(), sekarang.getMonth(), sekarang.getDate());
  const target = new Date(tahun, bulan - 1, tanggal);
  return Math.round((target - hariIni) / (24 * 60 * 60 * 1000));
}

function isLongTerm(task) {
  return daysUntil(task.deadline) > HARI_JANGKA_PANJANG;
}

// Deadline diurai manual sebagai tanggal lokal supaya tidak bergeser zona waktu.
function formatDate(iso) {
  const [tahun, bulan, tanggal] = iso.split('-').map(Number);
  return new Date(tahun, bulan - 1, tanggal).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function emptyMessage() {
  if (tasks.length === 0) return 'Belum ada tugas. Tambahkan lewat form di atas.';
  if (currentFilter === 'aktif') return 'Tidak ada tugas aktif pada deadline terdekat.';
  if (currentFilter === 'selesai') return 'Belum ada tugas selesai pada deadline terdekat.';
  return 'Tidak ada tugas dalam 7 hari ke depan. Cek Tugas Jangka Panjang.';
}

function longEmptyMessage() {
  if (currentFilter === 'aktif') return 'Tidak ada tugas jangka panjang yang aktif.';
  if (currentFilter === 'selesai') return 'Belum ada tugas jangka panjang yang selesai.';
  return 'Belum ada tugas jangka panjang.';
}

function createTaskItem(task) {
  const item = document.createElement('li');
  item.className = 'tugas';
  item.dataset.id = task.id;
  if (task.selesai) item.classList.add('selesai');

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'tugas-cek';
  checkbox.id = `cek-${task.id}`;
  checkbox.checked = task.selesai;
  checkbox.setAttribute('aria-label', `Tandai "${task.judul}" selesai`);

  const body = document.createElement('label');
  body.className = 'tugas-isi';
  body.htmlFor = checkbox.id;

  const title = document.createElement('span');
  title.className = 'tugas-judul';
  title.textContent = task.judul;

  const meta = document.createElement('span');
  meta.className = 'tugas-meta';

  const course = document.createElement('span');
  course.className = 'tugas-matkul';
  course.textContent = task.matkul;

  const deadline = document.createElement('span');
  deadline.className = 'tugas-deadline';
  if (!task.selesai && daysUntil(task.deadline) < 0) {
    deadline.classList.add('lewat');
    deadline.textContent = `Lewat: ${formatDate(task.deadline)}`;
  } else {
    deadline.textContent = formatDate(task.deadline);
  }

  meta.append(course, deadline);
  body.append(title, meta);

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'tugas-hapus';
  remove.setAttribute('aria-label', `Hapus "${task.judul}"`);
  remove.append(trashIcon.content.cloneNode(true));

  item.append(checkbox, body, remove);
  return item;
}

function matchesFilter(task) {
  if (currentFilter === 'aktif') return !task.selesai;
  if (currentFilter === 'selesai') return task.selesai;
  return true;
}

function byDeadline(a, b) {
  return a.deadline.localeCompare(b.deadline);
}

function render() {
  const ready = loadState === 'ready';

  loadingState.hidden = loadState !== 'loading';
  errorState.hidden = loadState !== 'error';
  taskList.hidden = !ready;
  taskList.setAttribute('aria-busy', String(loadState === 'loading'));
  kartuJangka.hidden = !ready;
  progressBox.hidden = !ready;

  taskTitle.disabled = !ready;
  taskCourse.disabled = !ready;
  taskDeadline.disabled = !ready;
  tombolTambah.disabled = true;
  searchInput.disabled = true;

  if (loadState === 'error') errorMessage.textContent = loadError;

  if (!ready) {
    counter.textContent = loadState === 'loading' ? 'Memuat tugas...' : 'Gagal memuat';
    return;
  }

  const daftarTampil = tasks.filter(matchesFilter);
  const tugasDekat = daftarTampil.filter((task) => !isLongTerm(task)).sort(byDeadline);
  const tugasPanjang = daftarTampil.filter((task) => isLongTerm(task)).sort(byDeadline);

  taskList.replaceChildren();
  for (const task of tugasDekat) taskList.append(createTaskItem(task));

  longList.replaceChildren();
  for (const task of tugasPanjang) longList.append(createTaskItem(task));

  emptyState.hidden = tugasDekat.length > 0;
  emptyState.textContent = emptyMessage();
  longEmpty.hidden = tugasPanjang.length > 0;
  longEmpty.textContent = longEmptyMessage();

  counter.textContent = `${tasks.filter((task) => !task.selesai).length} tugas aktif`;

  const selesai = tasks.filter((task) => task.selesai).length;
  const persen = tasks.length === 0 ? 0 : Math.round((selesai / tasks.length) * 100);
  progressCount.textContent = `${selesai} OF ${tasks.length}`;
  progressPercent.textContent = `${persen}%`;
  progressFill.style.width = `${persen}%`;
  progressBar.setAttribute('aria-valuenow', String(persen));

  for (const button of filterButtons) {
    const aktif = button.dataset.filter === currentFilter;
    button.classList.toggle('on', aktif);
    button.setAttribute('aria-pressed', String(aktif));
  }
}

for (const button of filterButtons) {
  button.addEventListener('click', () => {
    currentFilter = button.dataset.filter;
    render();
  });
}

retryButton.addEventListener('click', loadInitial);

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

loadInitial();
