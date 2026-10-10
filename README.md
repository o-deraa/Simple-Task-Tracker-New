# Task Tracker Kuliah (Minggu 6)

Link log penggunaan AI (Untuk AI saya lanjutkan dari log penggunaan AI pada week 5 sehingga menjadi agak panjang): https://chatgpt.com/share/6aca79bd-eb98-83ec-92aa-210882a96ab5

Link github: https://github.com/o-deraa/Simple-Task-Tracker-New

Versi Minggu 6 menghubungkan aplikasi Task Tracker dari Minggu 5 ke backend REST API secara asinkron dengan `async/await`.

Backend disimulasikan oleh `mock-api.js`, yang menambal `window.fetch` saat halaman dimuat. Aplikasi bisa dibuka langsung dari `index.html` lewat protokol `file://`, tanpa menjalankan server.

## Berkas

| Berkas | Isi |
| --- | --- |
| `index.html` | Struktur halaman |
| `style.css` | Gaya, sama seperti Minggu 5|
| `app.js` | Logika aplikasi, sekarang memanggil API |
| `mock-api.js` | REST API tiruan (GET/POST/PATCH/DELETE) |

## Cara menjalankan

1. Buka `index.html` di browser. Mock memuat 5 tugas contoh.
2. Buka Console browser untuk mencoba mode mock:

```js
__API.setMode('normal')   // jeda 300 ms (bawaan)
__API.setMode('lambat')   // jeda 2,5 detik, untuk melihat skeleton loading
__API.setMode('offline')  // simulasi koneksi putus
__API.reset()             // pulihkan data contoh
__API.getMode()           // mode yang sedang aktif
```

## Perbedaan dengan Minggu 5

| Aspek | Minggu 5 | Minggu 6 |
| --- | --- | --- |
| Sumber data | localStorage | REST API (mock) |
| Muat data awal | sinkron dari localStorage | `Promise.all` ke dua endpoint |
| Tambah tugas | dorong ke array | `POST /api/tugas` |
| Tandai selesai | ubah array | `PATCH /api/tugas/:id` |
| Hapus tugas | saring array | `DELETE /api/tugas/:id` |
| State tampilan | kosong atau terisi | loading, error, kosong, sukses |
| Penanganan kegagalan | tidak ada | pesan server dan tombol "Coba lagi" |
| Pencarian | tidak ada | debounce 400 ms ke `GET /api/tugas?q=` |
| Perubahan tampilan | langsung tersimpan | optimistis, di-rollback bila gagal |
| localStorage | tugas dan tema | tema saja |

## Rincian perubahan per berkas

### `index.html`

- Counter awal berubah dari `0 tugas aktif` menjadi `Memuat tugas...`, karena data belum ada saat halaman dibuka.
- Form (judul, mata kuliah, deadline, tombol) `disabled` sampai data siap. Isi `<select>` mata kuliah dikosongkan lalu diisi dari `GET /api/matkul`.
- Tambahan baru: input pencarian `#search-input`, blok skeleton `#loading-state`, blok error `#error-state` dengan tombol `#retry-button`, paragraf error server `#error-server`, dan notifikasi `#toast`.
- Kartu jangka panjang dan progress diberi `id` supaya bisa disembunyikan saat data belum siap.
- Footer berubah menjadi "Tugas tersimpan di server."
- `mock-api.js` dimuat sebelum `app.js`; keduanya memakai `defer`.

### `style.css`

File ini menambah gaya untuk komponen baru, tanpa mengubah palet dan tata letak:

- `:disabled` untuk input, select, dan tombol utama. Hover dan active hanya berlaku saat tidak disabled.
- `.cari`: gaya input pencarian di atas kartu gelap.
- `.skeleton` dan `@keyframes kilau`: animasi kilau saat memuat.
- `.status-kotak` dan `.status-pesan`: kotak pesan error.
- `.toast`: notifikasi di bawah tengah layar.
- `.daftar-tugas[aria-busy="true"]`: daftar diredupkan saat memuat atau mencari.
- `prefers-reduced-motion` sekarang juga mematikan `animation`.

### `app.js`

- Penyimpanan lokal dihapus. `STORAGE_KEY`, `createId()`, `isValidTask()`, `loadTasks()`, dan `saveTasks()` tidak dipakai lagi, `tasks` dimulai dari array kosong. localStorage hanya menyimpan pilihan tema.
- Helper `api(url, options)` membungkus `fetch`: kegagalan jaringan menjadi pesan yang mudah dibaca, respons `!res.ok` dilempar sebagai `Error` yang membawa pesan server beserta `status` dan `payload`, dan status 204 mengembalikan `null`.
- `loadInitial()` memanggil `Promise.all([GET /api/tugas, GET /api/matkul])`, mengisi daftar tugas dan opsi mata kuliah, lalu menetapkan `loadState` (`loading`, `ready`, atau `error`).
- `render()` memeriksa `loadState` untuk menampilkan atau menyembunyikan skeleton, kotak error, daftar, kartu jangka panjang, dan progress. Ia juga menonaktifkan form saat data belum siap serta menerapkan filter dan hasil pencarian.
- Setiap aksi menjadi request: POST untuk tambah, PATCH untuk centang, DELETE untuk hapus.
- Submit berjalan asinkron. Tombol berubah menjadi "Menyimpan..." dan nonaktif selama pengiriman. Error 400 dari server dipetakan ke kolom yang sesuai lewat `error.payload.field`, sementara validasi di sisi klien tetap ada.
- Event delegation tetap memakai satu listener per `<ul>`, kini asinkron. Centang dan hapus memakai pembaruan optimistis: tampilan berubah lebih dulu, lalu dikembalikan (rollback) dengan notifikasi bila request gagal.
- Pencarian memakai debounce 400 ms dan mengirim `GET /api/tugas?q=`. Penjaga `requestNumber` mencegah respons lama menimpa yang baru.
- Inisialisasi berubah dari `render()` menjadi `loadInitial()`.

## Endpoint mock

| Method | Endpoint | Keterangan |
| --- | --- | --- |
| GET | `/api/tugas` | Daftar tugas. Tambah `?q=` untuk mencari judul. |
| POST | `/api/tugas` | Tambah tugas. Balas 201, atau 400 bila data tidak valid. |
| PATCH | `/api/tugas/:id` | Ubah status `selesai`. |
| DELETE | `/api/tugas/:id` | Hapus tugas. Balas 204. |
| GET | `/api/matkul` | Daftar mata kuliah untuk `<select>`. |

Aturan validasi di server: judul minimal 3 karakter, mata kuliah wajib, deadline wajib, dan judul tidak boleh duplikat. Error 400 mengembalikan `{ message, field }`.

## Pengujian
 
- Muat awal (sukses) dan tiga state lainnya: loading, error, kosong.
- POST sukses dan POST 400 (pesan dari server tampil di kolom terkait).
- PATCH dan DELETE melalui event delegation.
- Rollback saat offline untuk centang dan hapus.
- Tombol "Coba lagi" memulihkan tampilan setelah error.
- Pencarian debounce dan pencarian tanpa hasil.
- Mode `offline` dan `lambat` tanpa error tak tertangani di Console.
