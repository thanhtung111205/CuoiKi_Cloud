const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const path = require("path");
const fs = require("fs");

// Đảm bảo lấy đúng đối tượng admin
const firebaseAdmin = admin.initializeApp ? admin : (admin.default || admin);
const apps = firebaseAdmin.apps || [];

if (apps.length === 0) {
  let credential;
  
  // 1. Thử load từ file service account được cấu hình trong env
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT);
      const certFn = firebaseAdmin.cert || (firebaseAdmin.credential && firebaseAdmin.credential.cert);
      if (certFn) {
        credential = certFn(serviceAccount);
        console.log("[Firebase Admin] Khởi tạo thành công bằng key từ FIREBASE_SERVICE_ACCOUNT.");
      }
    } catch (err) {
      console.error("[Firebase Admin] Lỗi load FIREBASE_SERVICE_ACCOUNT:", err.message);
    }
  }

  // 2. Thử load từ các file key khả dụng (ưu tiên firebase-db-key.json sau đó đến google-key.json)
  if (!credential) {
    const potentialPaths = [
      path.join(__dirname, "../firebase-db-key.json"),
      path.join(process.cwd(), "firebase-db-key.json"),
      path.join(process.cwd(), "Backend/firebase-db-key.json"),
      "/app/firebase-db-key.json",
      process.env.GOOGLE_APPLICATION_CREDENTIALS,
      path.join(__dirname, "../google-key.json"),
      path.join(process.cwd(), "google-key.json"),
      path.join(process.cwd(), "Backend/google-key.json"),
    ];

    for (const p of potentialPaths) {
      if (p && fs.existsSync(p)) {
        try {
          const serviceAccount = JSON.parse(fs.readFileSync(p, "utf8"));
          const certFn = firebaseAdmin.cert || (firebaseAdmin.credential && firebaseAdmin.credential.cert);
          if (certFn) {
            credential = certFn(serviceAccount);
            console.log(`[Firebase Admin] Khởi tạo thành công bằng key file từ: ${p}`);
            break;
          }
        } catch (err) {
          console.error(`[Firebase Admin] Lỗi đọc key file từ ${p}:`, err.message);
        }
      }
    }
  }

  // 3. Khởi tạo options
  const initOptions = {
    projectId: process.env.FIREBASE_PROJECT_ID || "flashcard-cloud-g12-91bee"
  };

  if (credential) {
    initOptions.credential = credential;
  } else {
    try {
      const appDefaultFn = firebaseAdmin.applicationDefault || (firebaseAdmin.credential && firebaseAdmin.credential.applicationDefault);
      if (appDefaultFn) {
        initOptions.credential = appDefaultFn();
        console.log("[Firebase Admin] Khởi tạo thành công bằng Application Default Credentials.");
      }
    } catch (err) {
      console.warn("[Firebase Admin] Cảnh báo: Không tìm thấy Application Default Credentials. Dùng cấu hình tối giản.");
    }
  }

  try {
    firebaseAdmin.initializeApp(initOptions);
    console.log(`[Firebase Admin] Khởi tạo Firebase Admin SDK thành công. Project ID: ${initOptions.projectId}`);
  } catch (error) {
    console.error("[Firebase Admin] Lỗi nghiêm trọng khi khởi tạo Firebase Admin SDK:", error);
  }
}

const db = getFirestore();

module.exports = {
  admin: firebaseAdmin,
  db
};
