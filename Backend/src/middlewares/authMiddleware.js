const admin = require("firebase-admin");
const { getAuth } = require("firebase-admin/auth");
const jwt = require("jsonwebtoken");
const prisma = require("../db");

// Kiểm tra và khởi tạo Firebase Admin SDK an toàn tuyệt đối
try {
  const existingApps = (admin.getApps ? admin.getApps() : admin.apps) || [];
  if (existingApps.length === 0) {
    admin.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || "flashcard-cloud-g12-91bee",
    });
    console.log("[Firebase Admin] Khởi tạo hệ thống Auth thành công với Project ID:", process.env.FIREBASE_PROJECT_ID || "flashcard-cloud-g12-91bee");
  }
} catch (initError) {
  console.error("⚠️ Lỗi khởi tạo Firebase Admin SDK:", initError.message);
}

/**
 * Middleware xác thực yêu cầu API sử dụng hệ thống JWT hoặc Firebase ID Token
 */
module.exports = async (req, res, next) => {
  const authHeader = req.headers["authorization"] || req.headers["Authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Không tìm thấy token xác thực. Quyền truy cập bị từ chối.",
    });
  }

  let userId = "";
  let email = "";

  // 1. Thử xác thực với JWT của hệ thống
  try {
    const jwtSecret = process.env.JWT_SECRET || "cki_cloud_g12_default_secret_key_123456";
    const decoded = jwt.verify(token, jwtSecret);
    userId = decoded.userId;
    email = decoded.email;
  } catch (jwtErr) {
    // 2. Fallback: Thử xác thực với Firebase ID Token từ Google
    try {
      const authInstance = getAuth();
      const decodedToken = await authInstance.verifyIdToken(token);
      userId = decodedToken.uid;
      email = decodedToken.email;
    } catch (firebaseErr) {
      console.warn("[Auth Middleware] Xác thực token thất bại (Cả JWT & Firebase):", firebaseErr.message);
      
      return res.status(403).json({
        success: false,
        message: "Token xác thực không hợp lệ hoặc đã hết hạn.",
      });
    }
  }

  // 3. Chuẩn hóa/Đồng bộ hóa User ID về Database UUID dựa theo Email để tránh lỗi mismatch giữa Firebase UID và Postgres UUID
  try {
    if (email) {
      const dbUser = await prisma.user.findUnique({
        where: { email: email }
      });
      if (dbUser) {
        userId = dbUser.id; // Gán ID chuẩn trong cơ sở dữ liệu
      }
    }
  } catch (dbError) {
    console.error("[Auth Middleware] ⚠️ Lỗi khi đồng bộ User ID từ DB:", dbError.message);
  }

  req.user = {
    userId,
    email
  };
  return next();
};