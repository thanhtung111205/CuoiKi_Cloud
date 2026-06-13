const admin = require("firebase-admin");
const { getAuth } = require("firebase-admin/auth");

// Kiểm tra và khởi tạo Firebase Admin SDK an toàn tuyệt đối
try {
  if (!admin.apps || admin.apps.length === 0) {
    admin.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || "flashcard-cloud-g12-91bee",
    });
    console.log("[Firebase Admin] Khởi tạo hệ thống Auth thành công với Project ID:", process.env.FIREBASE_PROJECT_ID || "flashcard-cloud-g12-91bee");
  }
} catch (initError) {
  console.error("⚠️ Lỗi khởi tạo Firebase Admin SDK:", initError.message);
}

/**
 * Middleware xác thực yêu cầu API sử dụng Firebase ID Token từ Google Auth
 * Định dạng yêu cầu từ Frontend: Authorization: Bearer <token>
 */
module.exports = async (req, res, next) => {
  // 1. Lấy chuỗi Authorization từ Header request gửi lên
  const authHeader = req.headers["authorization"] || req.headers["Authorization"];
  
  // 2. Cắt chuỗi để lấy phần Token mã hóa phía sau chữ "Bearer "
  const token = authHeader && authHeader.split(" ")[1];

  // Nếu Frontend hoàn toàn không đính kèm Token
  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Không tìm thấy token xác thực. Quyền truy cập bị từ chối.",
    });
  }

  try {
    // SỬA DỨT ĐIỂM LỖI 'reading 0': Gọi trực tiếp getAuth() không truyền tham số mảng để lấy instance mặc định
    const authInstance = getAuth();
    const decodedToken = await authInstance.verifyIdToken(token);
    
    /**
     * Gán thông tin user giải mã từ Google vào object `req.user`
     * Firebase trả về chuỗi định danh duy nhất là 'uid', map thành 'userId'
     * để khớp hoàn toàn với các logic truy vấn database ở tầng Controller của bọn mày.
     */
    req.user = {
      userId: decodedToken.uid,
      email: decodedToken.email
    };

    // Token hợp lệ, cho phép request đi tiếp vào Controller
    next();
    
  } catch (err) {
    // Trường hợp token bị bẻ khóa, sai cấu trúc hoặc đã hết hạn
    console.warn("[Auth Middleware] Xác thực Firebase Token từ Google thất bại:", err.message);
    
    return res.status(403).json({
      success: false,
      message: "Token xác thực không hợp lệ hoặc đã hết hạn từ phía Google.",
    });
  }
};