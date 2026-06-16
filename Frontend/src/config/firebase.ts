import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Lưu ý: Trong môi trường thực tế, hãy cấu hình các giá trị này vào file .env
// Ví dụ: VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, ...
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

console.log("DEBUG Firebase Config:", firebaseConfig);

// Khởi tạo Firebase
const app = initializeApp(firebaseConfig);

// Khởi tạo các services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// Cấu hình prompt chọn tài khoản mỗi lần bấm đăng nhập
googleProvider.setCustomParameters({
  prompt: "select_account",
});

// Đặt chế độ persistence để giữ session đăng nhập
setPersistence(auth, browserLocalPersistence).catch(err => {
  console.error("Lỗi thiết lập persistence:", err);
});
