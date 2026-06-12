const jwt = require("jsonwebtoken");

/**
 * Middleware xác thực yêu cầu API sử dụng JWT Token
 * Định dạng: Authorization: Bearer <token>
 */
module.exports = (req, res, next) => {
  // Lấy token từ header Authorization
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Cắt phần "Bearer "

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Không tìm thấy token xác thực. Quyền truy cập bị từ chối.",
    });
  }

  const jwtSecret = process.env.JWT_SECRET || "cki_cloud_g12_default_secret_key_123456";

  jwt.verify(token, jwtSecret, (err, decoded) => {
    if (err) {
      console.warn("[Auth Middleware] Xác thực JWT thất bại:", err.message);
      return res.status(403).json({
        success: false,
        message: "Token xác thực không hợp lệ hoặc đã hết hạn.",
      });
    }

    // Gán thông tin user giải mã từ token vào request
    req.user = decoded; // Chứa { userId, email }
    next();
  });
};
