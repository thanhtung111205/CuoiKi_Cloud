// Import các thư viện Firebase SDK cần thiết trong Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Khởi tạo ứng dụng Firebase trong Service Worker
firebase.initializeApp({
  apiKey: "AIzaSyCjEqA8PTQ91kUi0-Ny_73ozqJX5_3RCAg",
  authDomain: "flashcard-cloud-g12-91bee.firebaseapp.com",
  projectId: "flashcard-cloud-g12-91bee",
  storageBucket: "flashcard-cloud-g12-91bee.firebasestorage.app",
  messagingSenderId: "333965992080",
  appId: "1:333965992080:web:5d70eed86f1b52c1963815"
});

const messaging = firebase.messaging();

// Lắng nghe và xử lý tin nhắn đẩy khi ứng dụng đang chạy ngầm (hoặc đã đóng)
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Nhận được thông báo chạy ngầm:', payload);
  
  const notificationTitle = payload.notification?.title || 'Thông báo FlashMaster';
  const notificationOptions = {
    body: payload.notification?.body || 'Bạn có thông báo mới!',
    icon: payload.notification?.icon || '/favicon.svg',
    badge: '/favicon.svg',
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Cho phép Service Worker kích hoạt và tiếp quản trang web ngay lập tức khi đăng ký
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
