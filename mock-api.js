/*
 Mock API untuk latihan fetch/async Task Tracker.
 Semua endpoint dilayani di memori browser, jadi aplikasi bisa dibuka
 langsung dari file:// tanpa menjalankan server.

 Endpoint:
   GET    /api/tugas        daftar tugas (tambah ?q= untuk cari judul)
   POST   /api/tugas        tambah tugas; balas 400 jika data tidak valid
   PATCH  /api/tugas/:id    ubah status selesai
   DELETE /api/tugas/:id    hapus tugas (balas 204)
   GET    /api/matkul       daftar mata kuliah

 Kontrol dari Console browser:
   __API.setMode('normal')   jeda 300 ms (bawaan)
   __API.setMode('lambat')   jeda 2,5 detik
   __API.setMode('offline')  simulasi koneksi putus
   __API.reset()             pulihkan data contoh
   __API.getMode()           mode yang sedang aktif
*/
(function () {
  const JEDA_NORMAL = 300;
  const JEDA_LAMBAT = 2500;

  const MATKUL = [
    'Pemrograman Web',
    'Jaringan Komputer',
    'Sistem Operasi',
    'Basis Data',
    'Keamanan Siber',
    'Kecerdasan Buatan',
    'Lainnya',
  ];

  let mode = 'normal';
  let nomorId = 0;
  let db = [];

  const fetchAsli = window.fetch.bind(window);

  function tanggalDari(offsetHari) {
    const d = new Date();
    d.setDate(d.getDate() + offsetHari);
    const bulan = String(d.getMonth() + 1).padStart(2, '0');
    const tanggal = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${bulan}-${tanggal}`;
  }

  function buatTugas(judul, matkul, deadline, selesai) {
    nomorId += 1;
    return { id: `t${nomorId}`, judul, matkul, deadline, selesai };
  }

  // Data contoh sengaja beragam: ada yang telat, dekat, dan jangka panjang.
  function buatSeed() {
    nomorId = 0;
    return [
      buatTugas('Kerjakan laporan jaringan', 'Jaringan Komputer', tanggalDari(2), false),
      buatTugas('Revisi makalah keamanan', 'Keamanan Siber', tanggalDari(-1), false),
      buatTugas('Proposal proyek akhir', 'Pemrograman Web', tanggalDari(20), false),
      buatTugas('Latihan soal basis data', 'Basis Data', tanggalDari(1), true),
      buatTugas('Ringkasan bab sistem operasi', 'Sistem Operasi', tanggalDari(30), true),
    ];
  }

  db = buatSeed();

  function jeda(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function balas(status, data) {
    if (status === 204) return new Response(null, { status });
    return new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  function salinan(tugas) {
    return { ...tugas };
  }

  function cariMasalah(body) {
    if (!body || typeof body !== 'object') {
      return { message: 'Data tugas tidak valid.', field: null };
    }
    const judul = typeof body.judul === 'string' ? body.judul.trim() : '';
    const matkul = typeof body.matkul === 'string' ? body.matkul.trim() : '';
    const deadline = typeof body.deadline === 'string' ? body.deadline.trim() : '';

    if (judul.length < 3) {
      return { message: 'Judul tugas minimal 3 karakter.', field: 'judul' };
    }
    if (matkul === '') {
      return { message: 'Mata kuliah wajib dipilih.', field: 'matkul' };
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline)) {
      return { message: 'Deadline wajib diisi.', field: 'deadline' };
    }
    if (db.some((t) => t.judul.toLowerCase() === judul.toLowerCase())) {
      return { message: 'Tugas dengan judul itu sudah ada.', field: 'judul' };
    }
    return null;
  }

  function bacaBody(options) {
    if (!options || options.body == null) return {};
    try {
      return JSON.parse(String(options.body));
    } catch {
      return null;
    }
  }

  async function tanganiApi(alamat, options) {
    const metode = (options.method || 'GET').toUpperCase();
    const bagian = alamat.pathname.split('/').filter(Boolean);
    const sumber = bagian[1];
    const id = bagian[2];

    if (sumber === 'matkul' && metode === 'GET') {
      return balas(200, [...MATKUL]);
    }

    if (sumber === 'tugas') {
      if (metode === 'GET' && !id) {
        const kunci = (alamat.searchParams.get('q') || '').trim().toLowerCase();
        const hasil = kunci ? db.filter((t) => t.judul.toLowerCase().includes(kunci)) : db;
        return balas(200, hasil.map(salinan));
      }

      if (metode === 'POST' && !id) {
        const body = bacaBody(options);
        if (body === null) return balas(400, { message: 'Body request bukan JSON yang valid.', field: null });

        const masalah = cariMasalah(body);
        if (masalah) return balas(400, masalah);

        const tugas = buatTugas(body.judul.trim(), body.matkul.trim(), body.deadline.trim(), false);
        db.push(tugas);
        return balas(201, salinan(tugas));
      }

      if (id) {
        const posisi = db.findIndex((t) => t.id === id);
        if (posisi === -1) return balas(404, { message: 'Tugas tidak ditemukan.' });

        if (metode === 'PATCH') {
          const body = bacaBody(options);
          if (body === null) return balas(400, { message: 'Body request bukan JSON yang valid.', field: null });
          if (typeof body.selesai === 'boolean') db[posisi].selesai = body.selesai;
          return balas(200, salinan(db[posisi]));
        }

        if (metode === 'DELETE') {
          db.splice(posisi, 1);
          return balas(204, null);
        }
      }
    }

    return balas(404, { message: `Endpoint tidak ditemukan: ${metode} ${alamat.pathname}` });
  }

  window.fetch = async function (input, options = {}) {
    const alamat = new URL(typeof input === 'string' ? input : input.url, window.location.href);

    if (!alamat.pathname.startsWith('/api/')) {
      return fetchAsli(input, options);
    }

    if (mode === 'offline') {
      await jeda(150);
      throw new TypeError('Failed to fetch');
    }

    await jeda(mode === 'lambat' ? JEDA_LAMBAT : JEDA_NORMAL);
    return tanganiApi(alamat, options);
  };

  window.__API = {
    setMode(namaBaru) {
      if (!['normal', 'lambat', 'offline'].includes(namaBaru)) {
        console.warn(`Mode "${namaBaru}" tidak dikenal. Pakai 'normal', 'lambat', atau 'offline'.`);
        return mode;
      }
      console.log(`__API: mode ${mode} -> ${namaBaru}`);
      mode = namaBaru;
      return mode;
    },
    getMode() {
      return mode;
    },
    reset() {
      db = buatSeed();
      console.log('__API: data contoh dipulihkan.');
    },
  };

  console.log("Mock API siap. Coba __API.setMode('offline') atau __API.setMode('lambat').");
})();
