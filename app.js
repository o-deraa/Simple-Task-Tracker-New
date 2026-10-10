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
let savingTask = false;
let searchTerm = '';
let matchIds = null;
let searchTimer = null;
let searchBusy = false;
let requestNumber = 0;

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

//deadline diurai manual sebagai tanggal lokal supaya tidak bergeser zona waktu.
function formatDate(iso) {
  const [tahun, bulan, tanggal] = iso.split('-').map(Number);
  return new Date(tahun, bulan - 1, tanggal).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function emptyMessage() {
  if (matchIds && matchIds.size === 0) return `Tidak ada tugas yang cocok dengan "${searchTerm}".`;
  if (tasks.length === 0) return 'Belum ada tugas. Tambahkan lewat form di atas.';
  if (currentFilter === 'aktif') return 'Tidak ada tugas aktif pada deadline terdekat.';
  if (currentFilter === 'selesai') return 'Belum ada tugas selesai pada deadline terdekat.';
  return 'Tidak ada tugas dalam 7 hari ke depan. Cek Tugas Jangka Panjang.';
}

function longEmptyMessage() {
  if (matchIds && matchIds.size === 0) return 'Tidak ada tugas jangka panjang yang cocok.';
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
  taskList.setAttribute('aria-busy', String(loadState === 'loading' || searchBusy));
  kartuJangka.hidden = !ready;
  progressBox.hidden = !ready;

  taskTitle.disabled = !ready;
  taskCourse.disabled = !ready;
  taskDeadline.disabled = !ready;
  tombolTambah.disabled = !ready || savingTask;
  tombolTambah.textContent = savingTask ? 'Menyimpan...' : '+ Tambah Tugas';
  searchInput.disabled = !ready;

  if (loadState === 'error') errorMessage.textContent = loadError;

  if (!ready) {
    counter.textContent = loadState === 'loading' ? 'Memuat tugas...' : 'Gagal memuat';
    return;
  }

  const daftarTampil = tasks
    .filter((task) => (!matchIds || matchIds.has(task.id)) && matchesFilter(task));
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

function showError(input, element, message) {
  input.setAttribute('aria-invalid', 'true');
  element.textContent = message;
  element.hidden = false;
}

function clearError(input, element) {
  input.removeAttribute('aria-invalid');
  element.textContent = '';
  element.hidden = true;
}

function showServerError(message) {
  errorServer.textContent = message;
  errorServer.hidden = false;
}

function clearServerError() {
  errorServer.textContent = '';
  errorServer.hidden = true;
}

taskForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (savingTask) return;

  const judul = taskTitle.value.trim();
  const matkul = taskCourse.value;
  const deadline = taskDeadline.value;
  let firstInvalid = null;

  clearServerError();

  if (judul.length < 3) {
    showError(taskTitle, errorTitle, 'Judul tugas minimal 3 karakter.');
    firstInvalid = taskTitle;
  }
  if (matkul === '') {
    showError(taskCourse, errorCourse, 'Pilih mata kuliah dulu.');
    if (!firstInvalid) firstInvalid = taskCourse;
  }
  if (deadline === '') {
    showError(taskDeadline, errorDeadline, 'Deadline wajib diisi.');
    if (!firstInvalid) firstInvalid = taskDeadline;
  }
  if (firstInvalid) {
    firstInvalid.focus();
    return;
  }

  savingTask = true;
  render();

  try {
    const tugasBaru = await api('/api/tugas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ judul, matkul, deadline }),
    });
    tasks.push(tugasBaru);
    if (matchIds) matchIds.add(tugasBaru.id);
    taskForm.reset();
    taskTitle.focus();
  } catch (error) {
    // error 400 berisi pesan validasi dari server
    if (error.status === 400 && error.payload && error.payload.field) {
      const field = error.payload.field;
      if (field === 'judul') showError(taskTitle, errorTitle, error.message);
      else if (field === 'matkul') showError(taskCourse, errorCourse, error.message);
      else if (field === 'deadline') showError(taskDeadline, errorDeadline, error.message);
      else showServerError(error.message);
    } else {
      showServerError(`Gagal menyimpan tugas: ${error.message}`);
    }
  } finally {
    savingTask = false;
    render();
  }
});

taskTitle.addEventListener('input', () => {
  clearError(taskTitle, errorTitle);
  clearServerError();
});
taskCourse.addEventListener('change', () => {
  clearError(taskCourse, errorCourse);
  clearServerError();
});
taskDeadline.addEventListener('input', () => {
  clearError(taskDeadline, errorDeadline);
  clearServerError();
});

let toastTimer = null;

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 4000);
}

async function toggleDone(task, done) {
  const previous = task.selesai;
  task.selesai = done; // optimistis: tampilan berubah lebih dulu
  render();

  try {
    const updated = await api(`/api/tugas/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selesai: done }),
    });
    Object.assign(task, updated); // sinkronkan dengan respons server
  } catch (error) {
    task.selesai = previous; // gagal: kembalikan ke keadaan semula
    showToast(`Perubahan dibatalkan: ${error.message}`);
  }
  render();
}

async function deleteTask(task) {
  const position = tasks.findIndex((entry) => entry.id === task.id);
  if (position === -1) return;

  tasks.splice(position, 1); // optimistis: baris dihapus lebih dulu
  render();

  try {
    await api(`/api/tugas/${task.id}`, { method: 'DELETE' });
  } catch (error) {
    tasks.splice(position, 0, task); // gagal: kembalikan ke posisi semula
    showToast(`Penghapusan dibatalkan: ${error.message}`);
  }
  render();
}

// Satu listener per <ul> melayani checkbox dan tombol hapus, termasuk item baru.
async function handleTaskClick(event) {
  const item = event.target.closest('.tugas');
  if (!item || loadState !== 'ready') return;

  const task = tasks.find((entry) => entry.id === item.dataset.id);
  if (!task) return;

  if (event.target.matches('.tugas-cek')) {
    await toggleDone(task, event.target.checked);
  } else if (event.target.closest('.tugas-hapus')) {
    await deleteTask(task);
  }
}

taskList.addEventListener('click', handleTaskClick);
longList.addEventListener('click', handleTaskClick);

async function loadTaskList(query) {
  const nomor = ++requestNumber;
  searchBusy = true;
  render();

  try {
    const url = query ? `/api/tugas?q=${encodeURIComponent(query)}` : '/api/tugas';
    const hasil = await api(url);
    if (nomor !== requestNumber) return; // respons usang, abaikan
    matchIds = query ? new Set(hasil.map((task) => task.id)) : null;
  } catch (error) {
    if (nomor !== requestNumber) return;
    showToast(`Pencarian gagal: ${error.message}`);
  } finally {
    if (nomor === requestNumber) {
      searchBusy = false;
      render();
    }
  }
}

searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    searchTerm = searchInput.value.trim();
    loadTaskList(searchTerm);
  }, 400);
});

function themeLabel(theme) {
  themeButton.textContent = theme === 'gelap' ? 'Mode terang' : 'Mode gelap';
}

themeButton.addEventListener('click', () => {
  const next = document.documentElement.dataset.tema === 'gelap' ? 'terang' : 'gelap';
  document.documentElement.dataset.tema = next;
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    // tema tetap berlaku untuk sesi ini walau gagal disimpan.
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
      // empat siklus selesai: timer berhenti dan kembali ke awal.
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

// kembalikan timer ke kondisi awal
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
