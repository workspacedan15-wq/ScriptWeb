// Isi konfigurasi dari Firebase Console > Project settings > Your apps.
// Konfigurasi web Firebase bukan password rahasia; keamanan wajib ditegakkan lewat Firestore Rules.
export const firebaseConfig = {
  apiKey: "GANTI_DENGAN_API_KEY",
  authDomain: "GANTI_DENGAN_PROJECT_ID.firebaseapp.com",
  projectId: "GANTI_DENGAN_PROJECT_ID",
  storageBucket: "GANTI_DENGAN_PROJECT_ID.appspot.com",
  messagingSenderId: "GANTI_DENGAN_SENDER_ID",
  appId: "GANTI_DENGAN_APP_ID"
};
export const firebaseReady = !Object.values(firebaseConfig).some(v => String(v).startsWith("GANTI_"));
