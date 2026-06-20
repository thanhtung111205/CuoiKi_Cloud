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
const profileController = require("../controllers/profileController");
const notificationController = require("../controllers/notificationController");

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

const flashcardController = require("../controllers/flashcardController");
const battleController = require("../controllers/battleController");

// -----------------------------------------------
// DECK ROUTES
// -----------------------------------------------
router.post("/decks", authMiddleware, deckController.createDeck);
router.get("/decks", authMiddleware, deckController.getDecks);
router.get("/decks/:id", authMiddleware, deckController.getDeckById);
router.put("/decks/:id", authMiddleware, deckController.updateDeck);
router.delete("/decks/:id", authMiddleware, deckController.deleteDeck);

// -----------------------------------------------
// FLASHCARD ROUTES
// -----------------------------------------------
router.post("/flashcards", authMiddleware, flashcardController.createFlashcard);
router.post("/flashcards/generate-single", authMiddleware, flashcardController.generateSingleFlashcard);
router.get("/decks/:id/flashcards", authMiddleware, flashcardController.getFlashcardsByDeck);
router.put("/flashcards/:id", authMiddleware, flashcardController.updateFlashcard);
router.delete("/flashcards/:id", authMiddleware, flashcardController.deleteFlashcard);
router.post("/flashcards/:id/review", authMiddleware, flashcardController.reviewFlashcard);

// -----------------------------------------------
// BATTLE ROUTES
// -----------------------------------------------
router.post("/battle/submit-answer", authMiddleware, battleController.submitAnswer);
router.post("/battle/send-email", authMiddleware, battleController.sendEmail);
router.post("/battle/save-history", authMiddleware, battleController.saveHistory);
router.get("/battle/history", authMiddleware, battleController.getHistory);
router.post("/battle/report-cheating", authMiddleware, battleController.reportCheating);

// -----------------------------------------------
// USER PROFILE ROUTES
// -----------------------------------------------
router.get("/user/profile", authMiddleware, profileController.getProfile);
router.put("/user/profile", authMiddleware, profileController.updateProfile);

// Endpoint giả lập ngày hoạt động (chỉ cho phép ở môi trường dev hoặc khi được bật cấu hình)
if (process.env.NODE_ENV !== "production" || process.env.ALLOW_STREAK_MOCK === "true") {
  router.post("/user/mock-active-date", authMiddleware, profileController.mockActiveDate);
}

// -----------------------------------------------
// EMAIL ROUTES
// -----------------------------------------------
const emailController = require("../controllers/emailController");

// Trigger thủ công để test nhanh khi demo (không cần chờ cron)
router.post("/email/trigger-review-reminder", authMiddleware, emailController.triggerReviewReminder);
router.post("/email/trigger-study-report", authMiddleware, emailController.triggerStudyReport);

// -----------------------------------------------
// SUPPORT ROUTES
// -----------------------------------------------
const supportController = require("../controllers/supportController");

router.post("/support/bug-report", authMiddleware, supportController.submitBugReport);

// -----------------------------------------------
// BATTLE FRAUD DETECTION
// -----------------------------------------------
router.post("/battle/report-fraud", authMiddleware, battleController.reportFraud);

// -----------------------------------------------
// ANALYTICS ROUTES (Zoho Analytics)
// -----------------------------------------------
const analyticsController = require("../controllers/analyticsController");

router.get("/analytics/embed-urls", authMiddleware, analyticsController.getEmbedUrls);
router.post("/analytics/sync", authMiddleware, analyticsController.syncUserAnalytics);
router.get("/analytics/summary", authMiddleware, analyticsController.getAnalyticsSummary);

module.exports = router;
