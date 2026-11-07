# BAI Preventive Maintenance — Cloudflare Edition

Versi Cloudflare dari aplikasi Preventive Maintenance IT PT BAI.

## Arsitektur

- Cloudflare Workers + Workers Static Assets: menyajikan aplikasi dan API dari satu domain.
- Cloudflare D1: menyimpan inventaris aset, jadwal maintenance, riwayat pekerjaan, dan metadata/foto.
- **Tidak menggunakan Cloudflare R2, Pages Functions, VPS, PHP, atau XAMPP.**
- Aplikasi utama: `/`
- Dashboard Weekly Team IT (juga ada di ZIP sumber): `/weekly/`

Foto disimpan sebagai baris terpisah di D1, bukan digabungkan ke satu record besar. Data teks dibatasi 1,8 MB per snapshot untuk menjaga batas record D1.

## Persiapan di Cloudflare

1. Buat database D1 bernama `bai-preventive-maintenance` dari Cloudflare Dashboard → Storage & databases → D1.
2. Salin **Database ID** dari halaman database.
3. Buka `wrangler.jsonc`, ganti `GANTI_DENGAN_DATABASE_ID_D1` dengan Database ID yang sebenarnya.
4. Di database D1, buka tab **Console**, jalankan isi file `migrations/0001_initial.sql` satu kali.
5. Hubungkan repository GitHub ke Cloudflare Workers Builds (atau deploy dari terminal).

## Build settings untuk Cloudflare Workers Builds

Jika folder ini diletakkan di root repository:
- Root directory: `/` (kosong/root)
- Build command: `npm install`
- Deploy command: `npm run deploy`

Jika folder ini diletakkan di subfolder repository:
- Root directory: isi path folder ini, misalnya `Dashboard PM/PM`
- Build command: `npm install`
- Deploy command: `npm run deploy`

Pastikan `wrangler.jsonc`, `worker.js`, `package.json`, `migrations/`, dan `public/` berada pada root directory yang sama.

## Keamanan — wajib diperhatikan

API ini adalah API internal aplikasi, belum memiliki login bawaan. **Jangan publikasikan URL tanpa pembatasan akses.**
Sebelum dipakai dengan data operasional:
1. Buka Cloudflare Zero Trust → Access → Applications.
2. Tambahkan Self-hosted application untuk hostname Worker ini.
3. Buat policy Allow hanya untuk email/domain perusahaan atau pengguna yang memang berwenang.
4. Uji akses dari akun yang diizinkan dan dari browser/incognito yang tidak diizinkan.

Cloudflare Access akan melindungi halaman dan endpoint `/api/*` pada hostname yang sama. Jangan mengandalkan URL yang tidak diumumkan sebagai pengamanan.

## Catatan penggunaan

- Data pertama kali yang belum ada di D1 akan diinisialisasi dari data demonstrasi pada browser yang melakukan akses pertama. Setelah itu semua pengguna membaca database D1 yang sama.
- Cadangkan data melalui tombol **Cadangkan** secara berkala. File JSON tetap dapat dipulihkan melalui tombol **Pulihkan**.
- Foto maintenance dibatasi maksimal 5 foto per pekerjaan dan ukuran hasil optimasi aplikasi.
- Jika koneksi D1 gagal, aplikasi menampilkan status sinkronisasi gagal. Perubahan masih tersimpan di browser saat itu; jangan menghapus data browser sebelum sinkronisasi berhasil.
- Dashboard Weekly Team IT tetap berupa aplikasi statis tersendiri di `/weekly/`; penyimpanan/import di modul tersebut mengikuti mekanisme yang sudah ada pada sumbernya.

## Pemeriksaan

Buka `/api/health`. Jika berhasil, hasilnya `{"ok":true,...,"database":"connected"}`.
