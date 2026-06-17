// ====================================================
// PROFILE CONTROLLER - Quản lý hồ sơ tài khoản
// ====================================================
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

/**
 * GET /api/user/profile
 * Lấy toàn bộ thông tin hồ sơ + thống kê học tập của user hiện tại
 */
exports.getProfile = async (req, res) => {
  try {
    console.log("=== API PROFILE CALLED ===");

    if (!req.user || !req.user.userId) {
      return res.status(401).json({
        success: false,
        message: "Không tìm thấy thông tin xác thực!",
      });
    }

    // Chuỗi UUID nhận từ Token (Kiểu dữ liệu: String)
    const userId = req.user.userId;
    console.log("User ID từ Token (UUID):", userId);

    // 1. Lấy thông tin cơ bản của user từ bảng 'users'
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
      console.log("❌ Không tìm thấy User này trong Database local!");
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy người dùng.",
      });
    }

    // 2. Đếm tổng số thẻ flashcard đã học (Bảng study_progresses)
    const totalCardsStudied = await prisma.studyProgress.count({
      where: { userId: userId },
    });

    // 3. Đếm số thẻ cần ôn hôm nay (Xử lý dải ngày chuẩn UTC để PostgreSQL trong Docker không lệch giờ)
    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
    const endOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));

    const cardsDueToday = await prisma.studyProgress.count({
      where: {
        userId: userId,
        nextReviewDate: {
          gte: startOfDay,
          lt: endOfDay,
        },
      },
    });

    // 4. Thống kê Quiz Battle (Bảng match_histories - So khớp dạng chuỗi UUID gốc)
    const totalMatches = await prisma.matchHistory.count({
      where: {
        OR: [
          { player1Id: userId },
          { player2Id: userId },
        ],
      },
    }).catch(err => {
      console.warn("[Profile] Lỗi truy vấn bảng match_histories:", err.message);
      return 0;
    });

    const totalWins = await prisma.matchHistory.count({
      where: {
        winnerId: userId,
      },
    }).catch(() => 0);

    const winRate = totalMatches > 0
      ? Math.round((totalWins / totalMatches) * 100)
      : 0;

    // 5. Đếm tổng số bộ thẻ tự tạo (Bảng decks)
    const totalDecks = await prisma.deck.count({
      where: { userId: userId },
    });

    // 6. Trả về đúng cấu trúc Object lồng 'stats' khớp 100% Interface Frontend
    return res.status(200).json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
        currentStreak: user.currentStreak,
        longestStreak: user.longestStreak,
        lastActiveDate: user.lastActiveDate,
        stats: {
          totalCardsStudied,  // Tổng thẻ đã học
          cardsDueToday,      // Thẻ cần ôn hôm nay
          totalDecks,          // Tổng bộ thẻ
          totalMatches,        // Tổng trận đấu Quiz Battle
          totalWins,           // Tổng trận thắng
          winRate,             // Tỉ lệ thắng (%)
        },
      },
    });
  } catch (error) {
    console.error("[Profile] Lỗi nghiêm trọng tại getProfile:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi lấy hồ sơ.",
    });
  }
};

/**
 * PUT /api/user/profile
 * Cập nhật thông tin cá nhân (tên hiển thị)
 */
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { fullName } = req.body;

    if (!fullName || fullName.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Tên hiển thị không được để trống.",
      });
    }

    if (fullName.trim().length > 50) {
      return res.status(400).json({
        success: false,
        message: "Tên hiển thị không được quá 50 ký tự.",
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        fullName: fullName.trim(),
      },
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