// ====================================================
// CKI CLOUD G12 - SUPPORT CONTROLLER
// Tiếp nhận báo cáo lỗi từ người dùng
// và chuyển tiếp tới HubSpot Forms API
// ====================================================

const hubspotService = require("../services/hubspotService");

/**
 * POST /api/support/bug-report
 * Body: { issue_type, description }
 * (email lấy từ authMiddleware)
 */
exports.submitBugReport = async (req, res) => {
  try {
    const { issue_type, description } = req.body;
    const userEmail = req.user.email;

    if (!issue_type || !description || description.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng chọn loại lỗi và mô tả chi tiết (ít nhất 10 ký tự).",
      });
    }

    if (description.length > 2000) {
      return res.status(400).json({
        success: false,
        message: "Mô tả lỗi không được vượt quá 2000 ký tự.",
      });
    }

    console.log(`[SupportController] Báo cáo lỗi từ ${userEmail} | Loại: ${issue_type}`);

    await hubspotService.submitBugReportForm({
      email: userEmail,
      issue_type,
      description: description.trim(),
      pageUri: req.headers.referer || "https://nhom12c365httt.live",
    });

    return res.status(200).json({
      success: true,
      message: "Cảm ơn bạn đã báo cáo! Chúng tôi sẽ xem xét và phản hồi sớm nhất có thể.",
    });
  } catch (error) {
    console.error("[SupportController] Lỗi gửi báo cáo:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể gửi báo cáo lúc này. Vui lòng thử lại sau.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
