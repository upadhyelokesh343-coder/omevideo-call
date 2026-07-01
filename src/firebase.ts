import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCrlSF8j3hJc26moUV5Zb0NFX20_uZGPbU",
  authDomain: "movie-app-7b094.firebaseapp.com",
  projectId: "movie-app-7b094",
  storageBucket: "movie-app-7b094.appspot.com",
  messagingSenderId: "440506227358",
  appId: "1:440506227358:web:e764c7f029cc57ef25b98f",
  measurementId: "G-55MRFWBK9L"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Use the default database instance with long polling enabled to bypass iframe/transport restrictions
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});
export default app;

