# Laporan audit, implementasi & pengujian — 16 Oktober 2026

## 1. Temuan audit workspace

| Hal | Temuan |
|---|---|
| Lokasi plugin yang benar | `wp-content/plugins/Apeiron` (git: 9 file modified + 11 untracked milik pengguna, termasuk seluruh kode Daftar Hadiah). Folder kerja `wp-content/Apeiron` adalah salinan lama **tanpa** widget Daftar Hadiah/Form Order API. |
| Perubahan plugin | Tidak ada. `git status` plugin identik sebelum/sesudah (20 entri yang sudah ada). |
| Folder aplikasi | `C:\Users\mamay\OneDrive\Gambar\MDUNDIG` (sebelumnya kosong). Tidak ada git repo; `.gitignore` disiapkan (`.env*`, build, laporan uji). |
| Referensi kontrak tambahan | `Admin/Tabs/DaftarHadiahTab.php` memuat Code.gs referensi; semantik `guest_id = "guest-" + sha256(website_id|invitation_id|whatsapp)`, hash payload reservasi, aturan revisi, dan paging diporting apa adanya. |
| Batasan plugin | `DaftarHadiahSettings::valid_api_url()` menolak `localhost`, `.local/.test`, IP, dan port → **plugin hanya bisa dihubungkan ke deployment HTTPS publik**, bukan server lokal. |

Catatan (bukan bug yang diperbaiki, hanya dilaporkan): `FormOrderSettings::send_to_api()` hanya mengembalikan `true/false`, sehingga respons Form Order `200` (duplikat) dan `201` (baru) diperlakukan sama oleh plugin — sesuai kontrak.

## 2. Design tokens (Apeiron-portal)

Sumber: `github.com/MamaymaulanaA/Apeiron-portal` commit `5bb7c8e`, berkas `frontend/src/styles/tokens.css`, `base.css`, komponen `AppSidebar`, `AppTopBar`, `ModalDialog`, `ToastHost`, `StatCard`, `PaginationBar`, `EmptyState`.

- Brand tunggal `#2563eb` (hover `#1d4ed8`, active `#1e40af`, soft `#eff4ff`); netral `#101828…#ffffff`; status warn `#b54708`, err `#b42318`.
- Radius 10px (8px elemen kecil), kontrol 40/34/46px, sidebar putih 248px, topbar 60px, bayangan nyaris tak terlihat, field tanpa bayangan, fokus = outline 2px brand.
- Font **Ubuntu** (+ Ubuntu Mono). Portal sendiri mencatat Ubuntu tidak memiliki bobot 600 → bobot dibatasi 400/500 (diverifikasi Playwright: bobot heading & tombol ≤ 600).
- Contoh warna `#083c57` dari spesifikasi lama **tidak dipakai** karena tidak ada di repository.

## 3. Supabase (connector)

- Project: `xksgdqwxqvxczzztgzuu` "MamaymaulanaA's Project", region `ap-southeast-1`, Postgres 17 — satu-satunya project; sebelumnya **kosong** (tanpa tabel public/migrasi/pengguna).
- Migrasi **benar-benar diterapkan** lewat connector (hasil `success:true`): `mdundig_core`, `mdundig_integration`, `mdundig_dashboard`. Berkas sumber: `supabase/migrations/2026101600*.sql` (berkas pertama diterapkan tanpa komentar; isi SQL identik).
- Advisor keamanan setelah migrasi: hanya INFO "RLS enabled no policy" untuk `app_meta` & `rate_limits` (sengaja: hanya service_role).
- Advisor performa: INFO foreign key audit (`created_by`, `revoked_by`, dst.) tanpa indeks dan indeks "belum terpakai" (database masih kosong). Tidak diubah.
- Connector tidak memberi secret key → runtime Vercel tetap butuh env (lihat README). Pengaturan Auth (Site URL, redirect, signup) tidak dapat diubah lewat connector → langkah manual di README.
- Data uji live: dibuat di dalam transaksi yang di-rollback; satu fixture uji konkurensi yang di-commit **sudah dihapus**. Hitungan akhir: 0 website, 0 undangan, 0 hadiah, 0 reservasi, 0 pengguna.

## 4. Keamanan & akses (ringkas)

- Token Website: `mdh_` + 32 byte CSPRNG (64 hex). Disimpan sebagai HMAC-SHA256 (`NUXT_TOKEN_HASH_SECRET`); kolom `token_hash` tidak dapat dibaca role `authenticated`. Plaintext hanya di respons pembuatan/rotasi. Izin modul per token (`daftar_hadiah`, `form_order`); tidak ada operasi baca Form Order untuk token.
- Fungsi integrasi `public.api_*` hanya dapat dieksekusi `service_role`; `anon`/`authenticated` ditolak (diuji).
- Dashboard memakai JWT pengguna → semua query lewat RLS. Pelanggan: hanya undangan dengan akses eksplisit atau pemetaan `owner_id` per website; `owner_id NULL` tidak pernah cocok. Form Order: policy SELECT hanya admin; route `/api/app/admin/**` juga memanggil `requireAdmin`.
- Admin tidak bisa dibuat lewat signup; bootstrap eksplisit via `bootstrap_platform_admin()` (khusus SQL Editor/service_role).
- Rate limit di PostgreSQL (`rate_limits`, per token per menit) → efektif lintas instance serverless.
- Log integrasi: module, operation, correlation_id, status, error, durasi — tanpa token, payload, nama tamu, atau nomor WhatsApp.

## 5. Hasil pengujian (nyata)

| Lapisan | Lingkungan | Hasil |
|---|---|---|
| SQL kontrak + RLS (`tests/sql/live_contract_and_rls.sql`) | **Supabase live** via connector, transaksi di-rollback | **72/72 assertion lulus** |
| Stok 1, 6 permintaan reserve | Supabase live via connector | 1 berhasil, 5 `gift_unavailable` — **namun log menunjukkan connector menjalankan panggilan berurutan**, jadi ini bukan bukti paralel |
| Unit (`tests/unit`) | lokal | 15/15 |
| Integrasi + konkurensi paralel (`tests/db/integration.test.ts`) | PostgreSQL 17 lokal (embedded), 40 koneksi | 27/27 — 25 reserve paralel pada stok 1 → tepat 1 sukses; 20 paralel pada stok 3 → tepat 3; 10 retry identik paralel → 1 baris |
| Server hasil build + **kelas PHP asli plugin** (`tests/db/server-and-plugin.test.ts`, `tests/plugin-php/harness.php`) | HTTP nyata → Nitro → PostgreSQL lokal | 6/6 (≥30 pemeriksaan PHP: ping, availability, reserve, idempoten, stok habis, konflik, revisi lama, laporan, owner_id, Form Order ping/submit/retry/konflik, token salah) |
| Browser (`tests/e2e`, Playwright Chromium) | server build, Auth & API dashboard **di-mock** | 29 lulus, 1 dilewati sengaja (desktop tanpa drawer) × desktop/tablet/mobile |
| Kebocoran secret (`npm run check:bundle`) | server build dengan secret palsu | OK |
| Typecheck strict (`nuxt typecheck`) | — | 0 error |

Temuan yang diperbaiki selama pengujian: normalisasi URL menerima skema asing (`ftp://` → diprefiks https); halaman tidak-berhak tanpa `<h1>`; tombol salin menggantung di Chrome mobile (Clipboard API tanpa resolve → kini timeout + fallback); **`.sr-only` di header tabel melebarkan halaman di mobile** sehingga modal keluar layar (kini `.table-wrap` menjadi containing block).

### Latensi (`reports/latency-local.json`)

Kondisi: Windows 11, Node 24, Nitro node-server hasil build, PostgreSQL 17 lokal di mesin yang sama, request berurutan (n=60), katalog 20 hadiah.

| Operasi | p50 | p95 |
|---|---|---|
| availability | 6,7 ms | 9,2 ms |
| reserve | 7,3 ms | 9,8 ms |
| Form Order submit | 5,4 ms | 7,6 ms |

Ini **bukan** angka produksi. Di Vercel `sin1` + Supabase `ap-southeast-1` akan ada tambahan cold start, TLS, dan 2 panggilan PostgREST per request (autentikasi token + operasi). Ukur ulang setelah deploy.

## 5b. Pembaruan: akun dibuat admin & login username

- Migrasi `mdundig_accounts` **diterapkan** ke Supabase: kolom `profiles.username` (unik, huruf kecil), trigger profil membaca username dari metadata, `api_login_attempt` (pembatas login, khusus service_role), `bootstrap_platform_admin(email, username)`.
- Server: `POST /api/app/auth/login` (username/email), `POST /api/app/admin/users`, `POST /api/app/admin/users/:id/password`; undangan email dihapus. Akun tanpa email memakai `<username>@akun.mdundig.invalid`.
- Admin default `admin` dibuat lewat `scripts/bootstrap-admin.mjs --username admin` oleh pemilik proyek. **Tidak dibuat oleh asisten**: pembuatan akun/login di Supabase Auth (layanan remote) tidak dilakukan otomatis, dan password `admin` ditolak (Supabase min. 6, dashboard min. 8, spesifikasi melarang password admin hardcoded).
- Uji: unit login/akun 9 kasus; DB lokal 4 kasus (username unik, bootstrap, pelanggan tak bisa ubah username, throttle); **Supabase live 12/12** (`tests/sql/live_accounts.sql`, di-rollback); Playwright: admin masuk dengan username `admin` → tambah akun (password 5 karakter ditolak dengan pesan) → atur ulang password; pelanggan masuk dengan username & ditolak dari halaman admin — 35 lulus di 3 viewport.
- Perbaikan dari uji ini: dua toast sempat tampil bertumpuk saat pesan diganti (kini `mode="out-in"`); validasi bawaan browser diganti pesan Indonesia di form akun; helper DB lokal kini mencoba port lain bila bentrok.
- Belum terverifikasi live: apakah Supabase Auth project ini menerima email internal domain `.invalid` pada `admin.createUser` (diterima oleh validasi format GoTrue standar; bila ditolak, isi email nyata saat membuat akun).

## 5c. Pembaruan: nama MDUNDIG, menu per modul, UI netral

- Nama platform di UI: **MDUNDIG — Manajemen Data Undangan Digital** (judul tab `… — MDUNDIG`, halaman login, sidebar). "Daftar Hadiah" kini nama modul.
- Menu: **Ringkasan**, **Daftar Hadiah** (tab Undangan/Reservasi; `/daftar-hadiah`), **Order Undangan** (khusus admin; `/order-undangan`), grup **Pengaturan** (Website, Koneksi, Pengguna & Akses). Pelanggan hanya melihat Ringkasan, Daftar Hadiah, Profil. Endpoint API tidak berubah.
- Istilah konsisten: "Order Undangan" di menu, judul, ringkasan, CSV (`order-undangan-YYYY-MM-DD.csv`), izin token; "akses pelanggan" untuk status pemetaan.
- Warna dekoratif dihapus: callout & field token netral (abu-abu), badge berlatar putih dengan titik status, ikon kartu ringkasan abu-abu, menu aktif abu-abu dengan ikon biru. Biru hanya untuk aksi utama, fokus, dan status aktif; merah hanya untuk error. Diverifikasi Playwright (latar `.badge/.alert/.stat-icon` hanya putih/abu-abu).
- Uji: vitest 61/61, Playwright 38 lulus + 1 dilewati sengaja.

## 5d. Pembaruan: CRUD admin

- Migrasi `mdundig_admin_crud` **diterapkan** ke Supabase (non-destruktif): kolom `source`/`admin_note`/`updated_at` pada reservasi, `status`/`admin_note`/`source`/`updated_at` pada order (post_id dsb. boleh kosong untuk order manual), fungsi `admin_reservation_create/update/delete` (SECURITY DEFINER + cek admin + lock baris hadiah), policy admin untuk insert/update/delete order, hapus undangan, hapus token yang dicabut.
- Server: route CRUD admin untuk reservasi, order, website, token, pengguna, undangan. WhatsApp dinormalisasi sama seperti plugin. `payload_hash` order asli tidak diubah sehingga retry WordPress tetap idempoten.
- Katalog hadiah tetap dikelola di WordPress (sumber utama sesuai spesifikasi); perubahan di dashboard akan tertimpa sinkron berikutnya.
- Uji: PostgreSQL lokal 7 kasus CRUD; **Supabase live 17/17** (`tests/sql/live_admin_crud.sql`, di-rollback); unit 71/71 total; Playwright 62 lulus + 1 dilewati sengaja (termasuk 18 uji CRUD di 3 viewport).

## 5e. Pembaruan: hapus undangan sekaligus, Order Undangan lebih ringkas

- Migrasi `mdundig_invitation_delete` **diterapkan**: `admin_invitations_delete(uuid[])` menghapus undangan (maks. 500 sekaligus) beserta reservasi, katalog, dan akses dalam satu transaksi; khusus admin. Uji live 3/3 (rollback).
- Daftar Hadiah: kotak centang per baris & "pilih semua", tombol Hapus terpilih / Hapus per baris, konfirmasi menyebut jumlah reservasi yang ikut terhapus.
- Order Undangan: ringkasan satu baris (pemesan & mempelai, field kosong dilewati); detail dalam popup, dikelompokkan per bagian (Pemesan, Pria, Wanita, Akad, Resepsi, Rekening n, Lainnya) dengan label tanpa awalan; field kosong disembunyikan dengan tombol tampilkan. Halaman detail terpisah dihapus.
- Uji: vitest 75/75, Playwright 68 lulus + 1 dilewati sengaja.

## 5f. Pembaruan: dashboard Ringkasan baru

- Migrasi `mdundig_dashboard_stats` **diterapkan**: `dashboard_stats(p_days)` (SECURITY INVOKER, jadi RLS tetap berlaku; hari dihitung Asia/Jakarta). Pelanggan hanya mendapat angka undangan miliknya; data Website, order, dan audit hanya untuk admin. Endpoint `GET /api/app/dashboard?days=7|14|30|90`.
- Baris 1: kartu KPI besar (Total undangan, Hadiah aktif, Reservasi terkonfirmasi, Website terhubung untuk admin) dengan perubahan vs 7 hari sebelumnya dan sparkline 7 hari.
- Baris 2: grafik tren reservasi (rentang 7/14/30/90 hari, tooltip crosshair, navigasi panah, tabel sr-only) dan donut status reservasi.
- Baris 3: Hadiah terpopuler, **Data form masuk** (admin; 5 order terbaru dengan avatar wajah acak deterministik, tanpa jaringan; klik membuka popup detail order), Aktivitas terbaru. Panel dalam satu baris setinggi sama; keadaan kosong rata tengah.
- Palet grafik divalidasi skrip (biru #2563eb, peach #b85c22, lilac #6a53b8, rose #d4547e).
- Scrollbar: tampilan scrollbar disembunyikan, diganti garis biru tipis 3px (Chrome/Edge/Safari) atau `thin` (Firefox); konten tetap bisa digulir.
- Uji: vitest 76/76, Playwright 77 lulus + 1 dilewati sengaja (khusus viewport sempit), typecheck bersih, cek secret bundle OK.
- Revisi: kotak statistik di "Data form masuk" dihapus (langsung daftar avatar). Panel baris bawah kini setinggi panel Status reservasi (diukur otomatis, juga di dashboard pelanggan); isi digulir di dalam panel. Data form masuk & Aktivitas terbaru berjalan sendiri pelan (10 px/detik, gerak transform sub-piksel agar halus) sebagai pita tanpa ujung: salinan kedua (aria-hidden + inert) menyambung di bawah sehingga setelah item terakhir langsung muncul item pertama, tanpa kembali ke atas. Berhenti saat disorot/difokus/disentuh; roda mouse & tombol panah menggeser pita; `prefers-reduced-motion` → daftar biasa yang bisa digulir. Hadiah terpopuler statis tetapi bisa digulir. Data dashboard dimuat ulang diam-diam tiap 60 detik saat tab terlihat, sehingga urutan hadiah terpopuler & daftar terbaru ikut berganti. Uji: Playwright 79 lulus + 5 dilewati sengaja (tes gulir otomatis cukup di desktop), vitest 76/76.

## 5g. Pembaruan: akses undangan diatur per akun

- Halaman **Pengguna & Akses** kini satu tabel akun: kolom **Undangan** (jumlah akses; admin = Semua) dan tombol **Akses** pada akun pelanggan yang membuka popup centang undangan (dengan pencarian & pilih semua). **Tambah akun** bisa langsung memilih undangan.
- Bagian "Akses undangan" (dropdown akun + undangan + tabel) dihapus beserta endpoint `GET /api/app/admin/access` yang hanya dipakai bagian itu.
- **Pemetaan otomatis dari WordPress (lanjutan)** dipindah ke halaman **Koneksi**, per website yang dipilih.
- Endpoint baru `GET`/`PUT /api/app/admin/users/[id]/access` (khusus admin, RLS tetap berlaku; PUT menyamakan daftar akses: yang baru diberikan, yang tidak dicentang dicabut, tiap perubahan tercatat di audit; ditolak untuk akun admin & undangan yang tidak ada). `POST /api/app/admin/users` menerima `invitation_ids` opsional; daftar akun menyertakan `access_count`.
- Akses per undangan di halaman detail undangan tetap ada.

## 5h. Pembaruan: tampilan ponsel (admin & pelanggan)

- **Tabel jadi kartu di layar < 640px** (Daftar Hadiah, detail undangan, Reservasi, Order Undangan, Website, Token, Pengguna): satu kartu per baris, judul kartu di atas, tiap nilai berlabel kolom (disalin otomatis dari kepala tabel oleh direktif `v-stack`), tombol aksi di bawah — tidak ada lagi tabel yang perlu digeser ke samping. Desktop/tablet tetap tabel biasa. "Pilih semua" Daftar Hadiah tetap tersedia di atas kartu.
- **Ringkasan**: kartu KPI 2 kolom di ponsel; kartu sempit otomatis ringkas (container query: ikon & label kecil, grafik mini selebar kartu di bawah angka, "vs 7 hari lalu"). Pelanggan (3 kartu): kartu ketiga selebar baris. Panel daftar di bawah mengikuti tinggi isi (maks. 420px, lalu digulir) saat satu kolom; di desktop tetap setinggi Status reservasi.
- Detail undangan: dua kartu statistik berdampingan di ponsel.
- Uji: tes baru khusus ponsel (kartu berlabel, tombol aksi di dalam layar, tanpa gulir horizontal, KPI 2 kolom). Playwright 83 lulus + 7 dilewati sengaja, vitest 76/76, typecheck bersih, cek secret OK.

## 5i. Pembaruan: halaman detail Daftar Hadiah

- Kartu statistik diganti kartu KPI seperti Ringkasan: Hadiah aktif, Reservasi terkonfirmasi, **Stok tersedia** (dari total jumlah awal), dan **Akses pelanggan** (admin) — 2 kolom di ponsel.
- Katalog hadiah: foto/ikon, kolom **Ketersediaan** dengan bar "x dari y tersedia", Dipesan, Kapasitas, Status.
- Panel **Akses pelanggan** ringkas di samping katalog (desktop): daftar pelanggan dengan avatar, tombol cabut (×), tambah pelanggan; email internal akun username tidak lagi ditampilkan (endpoint akses kini ikut mengirim `username`). Kartu KPI akses langsung ikut berubah setelah beri/cabut.
- Komponen `StatCard` dihapus karena tidak dipakai lagi.
- Uji: 2 tes baru (admin & pelanggan). Playwright 89 lulus + 7 dilewati sengaja, vitest 76/76, typecheck bersih, cek secret OK.
- Revisi: kartu Katalog (ikon + jumlah hadiah) dan Akses pelanggan (deskripsi kecil) setinggi sama (360px di desktop). Isi katalog berupa daftar yang berjalan sendiri halus & menyambung (komponen gulir yang sama dengan Ringkasan) bila hadiah lebih banyak dari tinggi kartu; berhenti saat disorot. Ponsel: tinggi mengikuti isi (maks. 520px).
- Tabel Reservasi (semua halaman) menampilkan **7 data per halaman**, selebihnya lewat tombol halaman berikutnya.
- Kolom cari di semua bar filter (Daftar Hadiah, Reservasi, Order Undangan, Pengguna) kini melebar mengisi baris, sehingga pilihan filter di sebelahnya rata ke kanan.
- Uji: Playwright 91 lulus + 11 dilewati sengaja (tes baru: katalog berjalan & setinggi panel akses, paging 7, filter rata kanan), vitest 76/76, typecheck bersih, cek secret OK.

## 5j. Pembaruan: detail undangan rapat & halaman Website/Koneksi seragam

- Detail undangan: tinggi kartu Katalog kini mengikuti tinggi isi panel Akses pelanggan (diukur otomatis; panel akses min. 300px, maks. 480px lalu digulir), sehingga tidak ada celah di bawah panel akses. Area gulir katalog diberi jarak atas/bawah seperti panel Ringkasan agar baris tidak menempel ke kepala kolom/tepi kartu.
- Website: kartu "Daftar website" berikon + deskripsi + jumlah; tombol Ubah/Hapus jadi ikon (seperti Pengguna), Koneksi tetap tombol teks.
- Koneksi: pilihan website pindah ke kanan judul halaman (seperti tombol aksi halaman lain); kartu Status koneksi, URL API, Token Website berikon + deskripsi; Token: Rotasi tombol teks, Ubah label/Cabut/Hapus ikon (tidak lagi terpotong di kanan) + jumlah token aktif.
- Pengguna: kartu Akun diberi deskripsi + jumlah akun.
- Order Undangan (kartu "Daftar order"), Daftar Hadiah (kartu "Daftar undangan") dan tabel Reservasi (semua halaman) memakai pola yang sama: ikon + judul + deskripsi kecil + jumlah data; tombol aksi baris sekunder jadi ikon (Hapus, Ubah), tombol utama tetap teks (Detail). Di ponsel, jumlah reservasi disembunyikan agar tombol header tidak berdesakan.
- Uji: Playwright 91 lulus + 11 dilewati sengaja, vitest 76/76, typecheck bersih, cek secret OK.

## 5k. Pembaruan: laporan PDF, CSV rapi, Profil & Tambah akun

- **Laporan PDF** (admin & pelanggan) — `GET /api/app/reservations/export-pdf` dan `GET /api/app/admin/form-orders/export-pdf` (admin). Dibuat di server dengan pdfkit + font Ubuntu 400/500 (WOFF di `server/assets/fonts`, lisensi Ubuntu Font Licence disertakan). A4 lanskap: kepala MDUNDIG + waktu dibuat (WIB), judul & filter aktif, kartu ringkasan (total, terkonfirmasi, dibatalkan, hadiah dipesan / status order), tabel dengan kepala diulang tiap halaman, nomor halaman. Order: satu kartu per order, isi dikelompokkan per bagian (Pemesan, Pria, Wanita, Akad, …), field kosong dilewati. Filter & RLS sama dengan daftar di layar.
- **CSV** kini memakai pemisah titik koma (Excel berbahasa Indonesia langsung memisah kolom; Google Sheets/LibreOffice mendeteksi otomatis), BOM UTF-8 tetap; WhatsApp ditulis 0812-3456-7890 (tetap teks, tidak jadi notasi ilmiah). CSV Order kini juga mengikuti filter status.
- **Tombol unduh**: tombol terpisah "Unduh PDF" (utama; biru untuk pelanggan) + menu ▾ berisi PDF (Disarankan) dan CSV. Ukuran sama dengan tombol lain (40px).
- **Profil**: kartu ringkasan akun (avatar, nama, @username, peran), kartu Data akun & Ubah password berikon + deskripsi, tombol di kaki kartu.
- **Tambah akun**: dua langkah — 1) Data akun → **Berikutnya**, 2) Akses undangan → **Kembali / Buat akun**; langkah 1 divalidasi (username & password) sebelum lanjut; galat username/email dari server mengembalikan ke langkah 1. Popup form (akun, akses, password, website, token, order, reservasi) kini memakai ikon di kepala.
- Dependensi baru: `pdfkit` (runtime), `@types/pdfkit` (dev).
- Revisi: **semua popup** kini berikon + deskripsi kecil (detail & form order, token baru/label/rotasi, website tambah/ubah, akun). Popup konfirmasi (hapus, cabut token, lepas ikatan) memakai ikon peringatan merah + "Tindakan ini tidak dapat dibatalkan." (kalimat ganda di pesan dihapus). Tombol "Buat token" kini berukuran sama dengan tombol utama lain.
- Uji: vitest 82/82 (termasuk tes PDF: font Ubuntu tertanam, multi-halaman, ringkasan, kartu order), Playwright 91 lulus + 11 dilewati sengaja, typecheck bersih, cek secret OK. Endpoint PDF belum diuji terhadap Supabase live dari sesi ini (perlu login); renderer & paket hasil build sudah diuji.

## 5l. Pembaruan: layar lebar

- Batas lebar konten (1440px) dihapus: dashboard kini memenuhi lebar layar di monitor besar (dicek 1920px & 2560px, tanpa celah kiri-kanan). Jarak tepi 1.5rem (2rem di layar ≥1600px), ponsel 1rem.

## 5m. Pembaruan: isi order dari widget hanya-lihat

- Migrasi `mdundig_widget_order_readonly` **diterapkan**: trigger `form_orders_guard_widget_content` menolak perubahan isi field, label, judul, atau sumber pada order `source = 'widget'` (pesan `widget_order_readonly`). Uji live (DO-block, rollback) pada order widget nyata: isi field diblokir = ya, judul diblokir = ya, catatan/status tetap bisa = ya.
- API `PATCH /api/app/admin/form-orders/:id`: `post_title`/`entries` untuk order widget → 409 dengan pesan jelas; status & catatan admin tetap bisa untuk semua order.
- Popup detail: order widget menampilkan "Isi dari klien — hanya-lihat" (tanpa tombol Ubah), catatan admin dapat diubah langsung di popup; order input manual tetap punya tombol Ubah (isi penuh). Tambah order & hapus tetap ada.
- Uji: DB lokal 10/10 (tes baru trigger), Playwright + tes baru alur order widget, vitest semua lulus.

## 5n. Fitur notifikasi

- Migrasi `mdundig_notifications` **diterapkan**: tabel `notifications` (satu baris per penerima, RLS: hanya milik sendiri; pengguna hanya boleh membaca, menandai dibaca, dan menghapus — tidak bisa membuat/mengubah isi). Trigger database membuat notifikasi otomatis:
  - **Order Undangan baru** → semua admin platform.
  - **Reservasi hadiah baru** → semua admin + pelanggan yang berhak atas undangan itu (akses eksplisit atau pemetaan pemilik WordPress). Pelanggan lain tidak menerima.
  - Pembuat perubahan sendiri tidak diberi notifikasi (mis. admin yang menambah order/reservasi manual); admin lain tetap menerima.
  - Order/reservasi/undangan yang dihapus ikut menghapus notifikasinya.
  - Uji live (DO-block, rollback): order baru → notifikasi untuk 1 admin; penerima undangan pertama = 2 (admin + pelanggan berakses); RLS aktif.
- API: `GET /api/app/notifications` (filter `unread=1`, `kind=order|reservation`, paging 20), `GET /api/app/notifications/count`, `POST /api/app/notifications/read` (`{ ids }` atau `{ all: true }`), `POST /api/app/notifications/delete` (`{ ids }`, `{ read: true }`, atau `{ all: true }`).
- Tampilan: lonceng di topbar dengan angka belum dibaca (diperbarui tiap 30 detik saat tab terlihat) dan panel 6 notifikasi terbaru (klik → membuka data terkait & menandai dibaca; "Tandai semua dibaca"; "Lihat semua notifikasi"). Menu **Notifikasi** (dengan angka) di bagian Akun.
- Halaman **Notifikasi** (admin & pelanggan): filter Semua/Belum dibaca, jenis (admin: Order/Reservasi), "Tandai semua dibaca". Hapus sengaja tidak menonjol: ikon abu-abu tanpa teks per baris (merah hanya saat disorot) dan tautan kecil "Hapus yang sudah dibaca · Hapus semua" (keduanya dengan konfirmasi; "Hapus semua" ikut menghapus yang belum dibaca, data order/reservasi tidak tersentuh).
- Uji: DB lokal 5 tes baru (penerima per peran/akses, pembuat dikecualikan, RLS, hapus berantai), Playwright 3 tes baru (lonceng, halaman, pelanggan).

## 5o. Logo MDUNDIG

- Logo baru (SVG): kotak biru membulat + amplop undangan putih yang membentuk huruf "M", titik sebagai segel. Satu sumber bentuk dipakai di komponen `AppLogo` (menu samping dashboard & halaman login/lupa/atur password), `public/favicon.svg` (ikon tab browser), dan kepala laporan PDF (digambar vektor).
- Teks "Manajemen Data Undangan Digital" di menu samping kini boleh dua baris agar tidak terpotong di samping logo.

## 5p. Menu bawah ponsel (pelanggan)

- Di layar < 768px, akun pelanggan memakai menu bawah mengambang: Ringkasan, Undangan, Reservasi, Notifikasi (dengan angka), Profil. Menu aktif terangkat ke lingkaran biru bercincin putih yang bergeser dengan animasi pegas saat berpindah menu; ikon di lingkaran muncul dengan animasi "pop". Warna & font mengikuti tema yang ada. Animasi mati bila `prefers-reduced-motion`.
- Revisi (menyamakan referensi): bar bergaya kartu (border 1px, radius & bayangan kartu, bukan bayangan besar); tepi atas bar membentuk punuk melengkung halus (SVG) di menu aktif, dan lingkaran biru berada di dalam punuk dengan jarak 7px (terpisah, bukan cincin tebal). Punuk + lingkaran bergeser bersama dengan animasi pegas.
- Burger disembunyikan untuk pelanggan di ponsel (diganti logo); tombol **Keluar** tersedia di bawah halaman Profil (khusus ponsel). Admin di ponsel dan semua pengguna di tablet/desktop tetap memakai menu samping.
- Konten & footer diberi ruang agar tidak tertutup menu bawah.
- Uji: 2 tes baru (menu bawah pelanggan ponsel: urutan, menu aktif, lingkaran bergeser, footer tidak tertutup; tidak tampil untuk admin ponsel/pelanggan desktop). Playwright 109 lulus + 14 dilewati sengaja, vitest 88/88.

## 5q. Menu bawah ponsel untuk admin

- Admin di ponsel kini juga memakai menu bawah (burger diganti logo): **Ringkasan · Hadiah · Order · Notifikasi · Lainnya**. Empat menu yang paling sering dipakai langsung terlihat; sisanya di **Lainnya**.
- **Lainnya** membuka lembar dari bawah (animasi geser, latar gelap) berkelompok: *Pengaturan* (Website, Koneksi, Pengguna & Akses) dan *Akun* (Profil, Keluar). Tiap menu berikon + deskripsi singkat agar jelas fungsinya.
- Agar tidak membingungkan: saat berada di halaman dalam "Lainnya", tombol Lainnya aktif dan lingkaran biru menampilkan ikon halaman tersebut; di lembar, halaman itu ditandai **Sedang dibuka**. Lembar tertutup dengan tombol ×, ketuk latar, tombol Esc, atau saat berpindah halaman; fokus kembali ke tombol Lainnya.
- Tablet & desktop tetap memakai menu samping (tes drawer kini khusus tablet).
- Notifikasi tidak dobel di ponsel: lonceng di topbar disembunyikan (< 768px) karena sudah ada menu Notifikasi berangka di menu bawah; lonceng tetap terpasang tersembunyi agar angka tetap diperbarui. Tablet & desktop tetap memakai lonceng.
- Uji: tes baru admin ponsel (4 menu + Lainnya, lembar berkelompok, penanda halaman aktif, Esc, Keluar), tes menu bawah tidak tampil di tablet/desktop. Playwright 109 lulus + 17 dilewati sengaja, typecheck bersih.

## 5r. Menu bawah: kapsul mengambang

- Bar menu bawah (admin & pelanggan, ponsel) diubah menjadi **kapsul mengambang**: ujung bulat penuh, tanpa garis tepi, bayangan lembut menyebar. Punuk lebih landai & lebar; lingkaran aktif 54px dengan cahaya biru tipis, berjarak 7px dari tepi punuk. Label menu aktif berwarna biru; ikon lain abu gelap, label abu. Animasi pegas & "pop" tetap.
- Revisi: tepi kiri-kanan bar kini sejajar persis dengan tepi kartu (jarak = padding halaman: 1rem di ≤ 640px, 1.5rem di 641–767px); cahaya lingkaran aktif dikecilkan menjadi bayangan sangat tipis.

## 5s. Perbaikan koneksi di Vercel & gambar hadiah

- **URL API localhost di Vercel**: `NUXT_PUBLIC_APP_URL` berisi `http://localhost:3000` (tersalin dari `.env` lokal) dipakai mentah-mentah. Kini nilai itu hanya dipakai bila HTTPS publik; selain itu URL API memakai domain yang sedang dibuka (mis. `https://mdundig.vercel.app`) dan halaman Koneksi menampilkan peringatan agar variabelnya diperbaiki. Tautan email lupa password memakai aturan yang sama.
- **Website diisi alamat MDUNDIG sendiri** (`https://mdundig.vercel.app/` sebagai "Apeiron.ID") tidak akan pernah terhubung karena plugin mengirim alamat beranda WordPress. Kini ditolak saat menambah/mengubah website, dan halaman Koneksi memberi peringatan untuk data lama.
- **Gambar hadiah** tidak disimpan di Supabase; gambar diambil langsung dari WordPress (`image_url`). Data saat ini berasal dari `http://aperion.local/…` (situs Local WP di komputer sendiri, http) sehingga diblokir browser di dashboard HTTPS dan tidak dapat diakses dari luar. Kini gambar yang gagal dimuat diganti ikon, dan katalog menjelaskan penyebabnya. Gambar tampil otomatis setelah WordPress online dengan HTTPS.
- Uji: unit `appUrl` (4), e2e peringatan Koneksi & fallback gambar. Playwright 114 lulus + 18 dilewati sengaja, vitest 92/92.

## 5t. Audit kecepatan, lag & bug

Pengukuran:
- Vercel (halaman login, tanpa cache peramban): respons server 22 ms, DOM siap 488 ms, selesai dimuat 535 ms, ±168 KB ditransfer.
- Bundle JS klien: inti ±55 KB gzip + 2 potongan ±30 KB (Supabase & halaman); per halaman dimuat sesuai kebutuhan.
- Database live: `dashboard_stats(30)` 12 ms. Advisor performa hanya INFO (FK tanpa indeks) → ditambahkan indeks (migrasi `mdundig_fk_indexes` **diterapkan**). Peringatan keamanan `admin_*` SECURITY DEFINER memang disengaja (fungsi memeriksa admin di dalamnya). Sisa saran: aktifkan *Leaked password protection* di Supabase Auth (pengaturan dashboard Supabase).
- Sapuan semua halaman admin & pelanggan (desktop & ponsel): tidak ada error/peringatan console.

Bug & perbaikan:
- **Kartu KPI tidak bisa diklik**: dirender sebagai elemen `<nuxtlink>` tak dikenal (`resolveComponent` di template). Kini memakai `NuxtLink` langsung → tautan berfungsi.
- **Lag/boros CPU**: setiap daftar bergulir menjalankan animasi 60 fps terus-menerus walau diam, disorot, di luar layar, atau tab tersembunyi. Kini animasi hanya berjalan saat pita benar-benar bergerak & terlihat (IntersectionObserver + visibilitychange). Diukur: < 20 frame per 2 detik saat diam (sebelumnya ±360).
- **Font**: Ubuntu kini disajikan dari domain sendiri (`public/fonts`, 49 KB, preload 2 bobot, cache 1 tahun) — tanpa koneksi ke Google Fonts.
- **Layar pembuka** berlogo saat aplikasi dimuat (tidak ada layar putih kosong).
- Uji: 2 tes performa baru (frame animasi, KPI tautan, waktu muat; font lokal & layar pembuka). Playwright 116 lulus + 22 dilewati sengaja, vitest 92/92.

## 5u. Satu akun pelanggan = satu undangan

- Migrasi `mdundig_one_invitation_per_user` **diterapkan** (data live dicek dulu: tidak ada akun dengan >1 undangan). Database menolak akses kedua untuk akun yang sama (`invitation_access_one_per_user`), membatasi satu pemetaan otomatis per akun, dan melarang akses eksplisit + pemetaan sekaligus. Satu undangan tetap boleh untuk beberapa akun (mis. mempelai pria & wanita).
- Server: `PUT /users/:id/access` & `POST /users` maksimal satu undangan (dicek sebelum akun dibuat); ganti undangan = cabut lama lalu beri baru; beri akses dari detail undangan / pemetaan menolak akun yang sudah punya undangan dengan pesan yang menyebut judulnya.
- Tampilan: pemilih undangan kini pilih-satu (radio) dengan opsi "Tanpa undangan"; kolom Undangan di Pengguna menampilkan judul undangannya; di detail undangan & pemetaan, akun yang sudah punya undangan tampil "(sudah: …)" dan tidak bisa dipilih.
- Uji: DB 3 tes baru, e2e alur pilih/ganti/cabut. Playwright lulus semua (+ dilewati sengaja), vitest 95/95.

## 6. Belum dilakukan / butuh keputusan atau credential

1. **Deploy Vercel** belum dilakukan (tidak ada akses Vercel). Setelah deploy: isi env, atur Auth URL, bootstrap admin.
2. **Uji end-to-end live** (plugin WordPress → Vercel → Supabase, login & email asli) belum dapat dijalankan: perlu deployment HTTPS publik + secret key. Uji browser saat ini memakai mock Auth/API.
3. **Uji paralel live** di Supabase belum terbukti (connector berurutan). Bukti paralel tersedia untuk PostgreSQL 17 lokal dengan fungsi SQL yang sama.
4. **p50/p95 produksi** belum diukur.
5. Pengaturan Supabase Auth (matikan signup publik, redirect URL; SMTP opsional) harus dilakukan manual. Admin pertama dibuat oleh Anda dengan `scripts/bootstrap-admin.mjs`.
6. Pemetaan `owner_id` bergantung pada integrasi filter `apeiron_daftar_hadiah_owner_id` di WordPress — saat ini `null` sehingga akses pelanggan diberikan per undangan oleh admin.
7. Ekspor CSV dibatasi 50.000 baris per unduhan.
