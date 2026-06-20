// ====================================================
// PROFILE CONTROLLER - Quản lý hồ sơ tài khoản
// ====================================================

const prisma = require("../db");
const { getUserStats, getCardsDueToday } = require("../utils/statsHelper");

/**
 * GET /api/user/profile
 * Lấy toàn bộ thông tin hồ sơ + thống kê học tập của user hiện tại
 */
exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.userId;

    // 1. Lấy thông tin cơ bản của user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        avatarUrl: true,
        currentStreak: true,
        longestStreak: true,
        lastActiveDate: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy người dùng.",
      });
    }

    // 2. Lấy thống kê từ helper (optimize với Promise.all)
    const stats = await getUserStats(userId);

    // 3. Lấy số thẻ cần ôn hôm nay
    const cardsDueToday = await getCardsDueToday(userId);

    return res.status(200).json({
      success: true,
      data: {
        // Thông tin cá nhân
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,

        // Thống kê Streak
        currentStreak: user.currentStreak,
        longestStreak: user.longestStreak,
        lastActiveDate: user.lastActiveDate,

        // Thống kê học tập
        stats: {
          totalCardsStudied: stats.totalCardsStudied,
          cardsDueToday,
          totalDecks: stats.totalDecks,
          totalMatches: stats.totalMatches,
          totalWins: stats.totalWins,
          winRate: stats.winRate,
        },
      },
    });
  } catch (error) {
    console.error("[Profile] Lỗi getProfile:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi lấy hồ sơ.",
    });
  }
};

/**
 * PUT /api/user/profile
 * Cập nhật thông tin cá nhân (tên hiển thị,ảnh avatar)
 */
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { fullName, avatarUrl } = req.body;

    // 1. Chỉ validate fullName nếu nó thực sự được gửi lên
    if (fullName !== undefined) {
      if (fullName.trim().length === 0) {
        return res.status(400).json({ success: false, message: "Tên không được để trống." });
      }
      if (fullName.trim().length > 50) {
        return res.status(400).json({ success: false, message: "Tên tối đa 50 ký tự." });
      }
    }

    // 2. Xây dựng object dữ liệu linh hoạt
    const dataToUpdate = {};
    if (fullName !== undefined) dataToUpdate.fullName = fullName.trim();
    if (avatarUrl !== undefined) dataToUpdate.avatarUrl = avatarUrl;

    // 3. Nếu không có gì để update
    if (Object.keys(dataToUpdate).length === 0) {
      return res.status(400).json({ success: false, message: "Không có dữ liệu thay đổi." });
    }

    // 4. Cập nhật database
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: dataToUpdate,
      select: {
        id: true,
        email: true,
        fullName: true,
        avatarUrl: true,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Cập nhật hồ sơ thành công.",
      data: updatedUser,
    });
  } catch (error) {
    console.error("[Profile] Lỗi updateProfile:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi cập nhật hồ sơ.",
    });
  }
};

/**
 * POST /api/user/fcm-token
 * Cập nhật FCM token cho user hiện tại vào PostgreSQL
 */
exports.updateFcmToken = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, message: "Thiếu FCM Token." });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { fcmToken: token }
    });

    return res.status(200).json({
      success: true,
      message: "Cập nhật FCM Token thành công."
    });
  } catch (error) {
    console.error("[Profile] Lỗi updateFcmToken:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi lưu FCM Token."
    });
  }
};
