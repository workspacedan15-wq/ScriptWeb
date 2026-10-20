# Script Studio — 8 Penerbit (Cloudflare Worker + Gemini)

Website workspace skrip video affiliate untuk 8 penerbit. AI hanya menerima instruksi teks; tidak ada upload gambar/video.

## Struktur folder
- `public/` — website frontend
- `src/index.js` — API Worker untuk Gemini dan fallback ke website statis
- `wrangler.jsonc` — konfigurasi deploy Cloudflare Worker
- `firestore.rules` — contoh aturan Firestore

## Penting sebelum deploy
1. Buka `public/firebase-config.js` dan isi konfigurasi Firebase Web milik project Anda jika ingin sinkronisasi data antar perangkat. Tanpa konfigurasi Firebase, website hanya menyimpan data di browser masing-masing.
2. Jangan pernah menaruh Gemini API key di file `public/`, `app.js`, atau `firebase-config.js`.

## Deploy melalui terminal dengan Wrangler
Prasyarat: Node.js terpasang di komputer.

1. Ekstrak ZIP ini.
2. Buka terminal/CMD pada folder `script-studio-worker`.
3. Jalankan:
   ```bash
   npx wrangler login
   npx wrangler secret put GEMINI_API_KEY
   ```
   Saat diminta, tempel Gemini API key di terminal. Jangan kirim key ke orang lain atau memasukkannya ke GitHub.
4. Deploy:
   ```bash
   npx wrangler deploy
   ```
5. Buka URL Worker yang ditampilkan setelah deploy.

Nama Worker pada konfigurasi: `script-studio-8-penerbit`. Jika nama ini sudah dipakai di akun Anda, ubah nilai `name` di `wrangler.jsonc` menjadi nama unik.

## Mode demo lokal
Frontend dapat diuji dengan server lokal dari folder `public`, tetapi API Gemini tidak akan berfungsi tanpa Worker yang sudah di-deploy. Firebase juga harus dikonfigurasi untuk berbagi data lintas perangkat.
