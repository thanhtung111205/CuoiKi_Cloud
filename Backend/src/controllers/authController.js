const { PrismaClient } = require("@prisma/client");
const admin = require("firebase-admin");
const jwt = require("jsonwebtoken");

const prisma = new PrismaClient();

// Đảm bảo lấy đúng đối tượng admin trong mọi trường hợp import CJS/ESM của phiên bản v14
const firebaseAdmin = admin.initializeApp ? admin : (admin.default || admin);
const apps = firebaseAdmin.apps || [];

// Khởi tạo Firebase Admin SDK
if (apps.length === 0) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT;

  try {
    if (serviceAccountPath) {
      // Nếu cấu hình file Service Account JSON
      const serviceAccount = require(serviceAccountPath);
      firebaseAdmin.initializeApp({
        credential: firebaseAdmin.credential.cert(serviceAccount),
      });
      console.log("[Firebase Admin] Khởi tạo thành công với Service Account.");
    } else if (projectId) {
      // Khởi tạo chỉ với Project ID (đủ để verify ID Token từ Firebase Public Keys)
      firebaseAdmin.initializeApp({
        projectId: projectId,
      });
      console.log(`[Firebase Admin] Khởi tạo thành công với Project ID: ${projectId}.`);
    } else {
      // Mặc định tự động tìm ứng dụng
      firebaseAdmin.initializeApp();
      console.log("[Firebase Admin] Khởi tạo thành công với Application Default Credentials.");
    }
  } catch (err) {
    console.warn("[Firebase Admin] Cảnh báo: Không thể cấu hình Firebase Admin tự động.", err.message);
    console.warn("API Đăng nhập bằng Google có thể gặp lỗi nếu thiếu cấu hình FIREBASE_PROJECT_ID.");
  }
}


/**
 * POST /api/auth/google-login
 * Xác thực Google ID Token (Firebase) và tạo/tìm user trong PostgreSQL
 */
exports.googleLogin = async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: "Thiếu Firebase ID Token gửi từ client.",
      });
    }

    let decodedToken;
    try {
      // Xác thực ID Token từ client bằng Firebase Admin
      const { getAuth } = require("firebase-admin/auth");
      decodedToken = await getAuth().verifyIdToken(idToken);
    } catch (verifyError) {
      console.error("Lỗi verify Firebase ID Token:", verifyError.message);
      return res.status(401).json({
        success: false,
        message: "Firebase ID Token không hợp lệ hoặc đã hết hạn.",
        error: verifyError.code || verifyError.message,
      });
    }

    // Trích xuất thông tin người dùng từ token đã verify
    const { email, name: fullName, picture: avatarUrl } = decodedToken;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Token không chứa địa chỉ email hợp lệ.",
      });
    }

    console.log(`[Auth] Đăng nhập email: ${email}, Tên: ${fullName}`);

    // Truy vấn hoặc tạo mới user sử dụng Prisma (upsert bảo đảm tính toàn vẹn)
    // Bọc trong try-catch riêng cho DB để tránh sập app nếu mất kết nối Postgres
    let user;
    try {
      user = await prisma.user.upsert({
        where: { email },
        update: {
          fullName: fullName || email.split("@")[0],
          avatarUrl: avatarUrl || null,
        },
        create: {
          email,
          fullName: fullName || email.split("@")[0],
          avatarUrl: avatarUrl || null,
        },
      });
    } catch (dbError) {
      console.error("Lỗi thao tác cơ sở dữ liệu (Prisma):", dbError);
      return res.status(500).json({
        success: false,
        message: "Không thể kết nối hoặc lưu dữ liệu vào PostgreSQL.",
        error: process.env.NODE_ENV === "development" ? dbError.message : undefined,
      });
    }

    // Sinh JWT Token cho hệ thống của chúng ta để client dùng cho các API sau
    const jwtSecret = process.env.JWT_SECRET || "cki_cloud_g12_default_secret_key_123456";
    const appToken = jwt.sign(
      { userId: user.id, email: user.email },
      jwtSecret,
      { expiresIn: "7d" } // Hạn dùng 7 ngày
    );

    return res.status(200).json({
      success: true,
      message: "Đăng nhập thành công.",
      token: appToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (error) {
    console.error("Lỗi server xử lý googleLogin:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống trong quá trình đăng nhập Google.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * GET /api/auth/me
 * Lấy thông tin user hiện tại từ token JWT (để khôi phục session khi F5 trang)
 */
exports.getMe = async (req, res) => {
  try {
    // req.user được gán từ authMiddleware
    const userId = req.user.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy người dùng này trong hệ thống.",
      });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (error) {
    console.error("Lỗi lấy thông tin user hiện tại:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi lấy thông tin người dùng.",
    });
  }
};
