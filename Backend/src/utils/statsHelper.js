// ====================================================
// STATS HELPER - Lấy thống kê người dùng
// Tái sử dụng logic này ở nhiều nơi (profile, dashboard, etc)
// ====================================================

const prisma = require("../db");

/**
 * Lấy toàn bộ thống kê của một user
 * Chạy các query song song để tối ưu hiệu suất
 * @param {string} userId - ID của user
 * @returns {Promise<Object>} - Object chứa các thống kê
 */
exports.getUserStats = async (userId) => {
  try {
    const [totalCards, totalMatches, totalWins, totalDecks] = await Promise.all([
      // Tổng số thẻ đã học
      prisma.studyProgress.count({
        where: { userId },
      }),
      // Tổng số trận battle
      prisma.matchHistory.count({
        where: {
          OR: [
            { player1Id: userId },
            { player2Id: userId },
          ],
        },
      }),
      // Tổng số trận thắng
      prisma.matchHistory.count({
        where: {
          winnerId: userId,
        },
      }),
      // Tổng số bộ thẻ
      prisma.deck.count({
        where: { userId },
      }),
    ]);

    // Tính tỉ lệ thắng
    const winRate = totalMatches > 0
      ? Math.round((totalWins / totalMatches) * 100)
      : 0;

    return {
      totalCardsStudied: totalCards,
      totalMatches,
      totalWins,
      winRate,
      totalDecks,
    };
  } catch (error) {
    console.error("[StatsHelper] Lỗi khi lấy thống kê:", error.message);
    throw error;
  }
};

/**
 * Lấy số thẻ cần ôn hôm nay
 * @param {string} userId - ID của user
 * @returns {Promise<number>} - Số thẻ cần ôn
 */
exports.getCardsDueToday = async (userId) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    const cardsDueToday = await prisma.studyProgress.count({
      where: {
        userId,
        nextReviewDate: {
          gte: startOfDay,
          lt: endOfDay,
        },
      },
    });

    return cardsDueToday;
  } catch (error) {
    console.error("[StatsHelper] Lỗi khi lấy thẻ cần ôn hôm nay:", error.message);
    throw error;
  }
};
