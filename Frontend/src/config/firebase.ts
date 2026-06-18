import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

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
export const messaging = getMessaging(app);

/**
 * Hàm yêu cầu quyền nhận thông báo từ trình duyệt và lấy FCM Token.
 */
export const requestForToken = async (): Promise<string | null> => {
  try {
    if (!("Notification" in window)) {
      console.warn("Trình duyệt không hỗ trợ Notification API.");
      return null;
    }

    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
      if (!vapidKey) {
        console.error("Thiếu cấu hình VITE_FIREBASE_VAPID_KEY trong .env");
        return null;
      }

      // Đăng ký Service Worker tường minh
      let currentToken;
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        currentToken = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
      } else {
        currentToken = await getToken(messaging, { vapidKey });
      }
      if (currentToken) {
        return currentToken;
      } else {
        console.warn("Không tìm thấy registration token. Xin quyền hoặc cấu hình lại.");
        return null;
      }
    } else {
      console.warn("Quyền nhận thông báo bị từ chối.");
      return null;
    }
  } catch (error) {
    console.error("Lỗi khi lấy FCM Token:", error);
    return null;
  }
};

/**
 * Lắng nghe tin nhắn đẩy khi người dùng đang ở giao diện web (Foreground)
 */
export const onMessageListener = () =>
  new Promise((resolve) => {
    onMessage(messaging, (payload) => {
      resolve(payload);
    });
  });

// Cấu hình prompt chọn tài khoản mỗi lần bấm đăng nhập
googleProvider.setCustomParameters({
  prompt: "select_account",
});

// Đặt chế độ persistence để giữ session đăng nhập
setPersistence(auth, browserLocalPersistence).catch(err => {
  console.error("Lỗi thiết lập persistence:", err);
});
