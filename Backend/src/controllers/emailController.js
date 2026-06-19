// ====================================================
// CKI CLOUD G12 - EMAIL CONTROLLER
// ====================================================

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const emailService = require("../services/emailService");
const { runDailyReviewReminder, runWeeklyStudyReport } = require("../scheduler");

// TEST: Trigger thủ công job nhắc ôn tập (dùng khi demo/kiểm tra)
exports.triggerReviewReminder = async (req, res) => {
  try {
    await runDailyReviewReminder();
    return res.status(200).json({ success: true, message: "Đã chạy xong job nhắc ôn tập." });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// TEST: Trigger thủ công job báo cáo tiến độ (dùng khi demo/kiểm tra)
exports.triggerStudyReport = async (req, res) => {
  try {
    await runWeeklyStudyReport();
    return res.status(200).json({ success: true, message: "Đã chạy xong job báo cáo tiến độ." });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
