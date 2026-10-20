// Isi konfigurasi dari Firebase Console > Project settings > Your apps.
// Konfigurasi web Firebase bukan password rahasia; keamanan wajib ditegakkan lewat Firestore Rules.
export const firebaseConfig = {
  apiKey: "AIzaSyBJek005UbmAusja5GGaRiTVEzZ-XhV7LA",
  authDomain: "webskript.firebaseapp.com",
  projectId: "webskript",
  storageBucket: "webskript.firebasestorage.appm",
  messagingSenderId: "202428663455",
  appId: "1:202428663455:web:86d33f885a1ead83f084aa"
};
export const firebaseReady = !Object.values(firebaseConfig).some(v => String(v).startsWith("GANTI_"));
