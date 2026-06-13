// ====================================================
// CKI CLOUD G12 - API ROUTES
// Định nghĩa các route RESTful cho ứng dụng
// ====================================================

const express = require("express");
const router = express.Router();

// Import controllers & middleware
const deckController = require("../controllers/deckController");
const authController = require("../controllers/authController");
const authMiddleware = require("../middlewares/authMiddleware");

// -----------------------------------------------
// AUTH ROUTES
// -----------------------------------------------
// Đăng nhập / Đăng ký qua Google ID Token (Firebase Auth)
router.post("/auth/google-login", authController.googleLogin);

// Đăng nhập bằng Email & Password (Firebase Auth + Cloudflare Turnstile)
router.post("/auth/email-login", authController.emailLogin);

// Đăng ký tài khoản mới bằng Email & Password (Firebase Auth + Cloudflare Turnstile)
router.post("/auth/email-signup", authController.emailSignup);

// Lấy thông tin user hiện tại (Sử dụng JWT do hệ thống của ta phát hành)
router.get("/auth/me", authMiddleware, authController.getMe);

// -----------------------------------------------
// POST /api/generate-deck
// Tạo bộ flashcard từ văn bản đầu vào
// Giả lập quá trình gọi Google Cloud Translation & TTS APIs
// -----------------------------------------------
router.post("/generate-deck", authMiddleware, deckController.generateDeck);

// -----------------------------------------------
// GET /api/health
// Kiểm tra trạng thái API (dùng cho monitoring)
// -----------------------------------------------
router.get("/health", (req, res) => {
  res.json({
    status: "ok",
    api: "CKI Cloud G12 - REST API",
    uptime: `${Math.floor(process.uptime())}s`,
  });
});

module.exports = router;

