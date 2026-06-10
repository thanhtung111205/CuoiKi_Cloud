// ====================================================
// CKI CLOUD G12 - API ROUTES
// Định nghĩa các route RESTful cho ứng dụng
// ====================================================

const express = require("express");
const router = express.Router();

// Import controllers
const deckController = require("../controllers/deckController");

// -----------------------------------------------
// POST /api/generate-deck
// Tạo bộ flashcard từ văn bản đầu vào
// Giả lập quá trình gọi Google Cloud Translation & TTS APIs
// -----------------------------------------------
router.post("/generate-deck", deckController.generateDeck);

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
