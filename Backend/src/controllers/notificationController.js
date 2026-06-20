// ====================================================
// NOTIFICATION CONTROLLER - Quản lý thông báo đẩy
// ====================================================

const prisma = require("../db");
const { getMessaging } = require("firebase-admin/messaging");

/**
 * POST /api/notifications/check-spaced-repetition
 * Quét các flashcard đến hạn ôn tập và gửi thông báo qua FCM
 */
exports.checkSpacedRepetition = async (req, res) => {
  try {
    const now = new Date();
    
    // Tìm tất cả các tiến độ ôn tập đến hạn hoặc quá hạn
    const progressList = await prisma.studyProgress.findMany({
      where: {
        nextReviewDate: {
          lte: now
        }
      },
      select: {
        userId: true
      }
    });

    if (progressList.length === 0) {
      return res.json({ success: true, message: "Không có từ vựng nào đến hạn ôn tập." });
    }

    // Đếm số từ vựng đến hạn của từng User
    const userDueCounts = {};
    for (const item of progressList) {
      userDueCounts[item.userId] = (userDueCounts[item.userId] || 0) + 1;
    }

    // Lấy fcmToken của các User này
    const userIds = Object.keys(userDueCounts);
    const users = await prisma.user.findMany({
      where: {
        id: { in: userIds },
        fcmToken: { not: null }
      },
      select: {
        id: true,
        fcmToken: true
      }
    });

    if (users.length === 0) {
      return res.json({ success: true, message: "Không tìm thấy user nào có fcmToken để gửi thông báo." });
    }

    let successCount = 0;
    let failureCount = 0;

    // Gửi thông báo đẩy cho từng User
    for (const user of users) {
      const count = userDueCounts[user.id];
      const message = {
        token: user.fcmToken,
        notification: {
          title: "FlashMaster ôn tập",
          body: `Bạn có ${count} từ vựng cần ôn tập hôm nay!`,
        },
        webpush: {
          notification: {
            icon: "/favicon.svg",
            badge: "/favicon.svg",
          },
          fcmOptions: {
            link: "/study"
          }
        }
      };

      try {
        await getMessaging().send(message);
        successCount++;
      } catch (fcmErr) {
        console.error(`[checkSpacedRepetition] Lỗi gửi FCM cho user ${user.id}:`, fcmErr.message);
        failureCount++;
      }
    }

    console.log(`[checkSpacedRepetition] Hoàn thành. Gửi thành công: ${successCount}, Thất bại: ${failureCount}`);
    return res.json({
      success: true,
      message: `Đã xử lý thông báo. Thành công: ${successCount}, Thất bại: ${failureCount}`
    });
  } catch (error) {
    console.error("[checkSpacedRepetition] Lỗi hệ thống:", error);
    return res.status(500).json({ success: false, message: "Lỗi Server Internal.", error: error.message });
  }
};
