// ====================================================
// CKI CLOUD G12 - EMAIL SCHEDULER
// Tự động gửi email theo lịch cho toàn bộ user
//
// Lịch chạy (giờ Việt Nam UTC+7):
//   - Hằng ngày 8:00 sáng  → Nhắc nhở ôn tập (chỉ user có thẻ đến hạn)
//   - Thứ Hai   8:00 sáng  → Báo cáo tiến độ học tập hằng tuần
// ====================================================

const cron = require("node-cron");
const { PrismaClient } = require("@prisma/client");
const emailService = require("./services/emailService");

const prisma = new PrismaClient();

// -----------------------------------------------
// Job 1: Nhắc nhở ôn tập - Hằng ngày lúc 8:00 sáng VN (1:00 UTC)
// Chỉ gửi cho user có thẻ đến hạn hôm nay
// -----------------------------------------------
async function runDailyReviewReminder() {
  console.log("[Scheduler] Bắt đầu job nhắc ôn tập hằng ngày...");

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  try {
    // Lấy tất cả user có thẻ đến hạn hôm nay
    const allUsersWithDueCards = await prisma.user.findMany({
      where: {
        progresses: {
          some: { nextReviewDate: { lte: today } },
        },
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        progresses: {
          where: { nextReviewDate: { lte: today } },
          select: {
            card: { select: { wordEn: true, meaningVi: true } },
          },
        },
      },
    });

    const usersWithDueCards = allUsersWithDueCards.filter((u) => u.email);

    if (usersWithDueCards.length === 0) {
      console.log("[Scheduler] Không có user nào có thẻ đến hạn hôm nay.");
      return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const user of usersWithDueCards) {
      try {
        const dueCards = user.progresses.map((p) => ({
          wordEn: p.card.wordEn,
          meaningVi: p.card.meaningVi,
        }));

        await emailService.sendReviewReminderEmail(user.email, user.fullName, dueCards);
        successCount++;
        console.log(`[Scheduler] Gửi nhắc ôn tập → ${user.email} (${dueCards.length} thẻ)`);
      } catch (err) {
        failCount++;
        console.error(`[Scheduler] Lỗi gửi tới ${user.email}:`, err.message);
      }
      // Tránh vượt rate limit Resend (tối đa 2 req/giây)
      await new Promise((resolve) => setTimeout(resolve, 600));
    }

    console.log(`[Scheduler] Hoàn tất nhắc ôn tập: ${successCount} thành công, ${failCount} thất bại.`);
  } catch (err) {
    console.error("[Scheduler] Lỗi job nhắc ôn tập:", err.message);
  }
}

// -----------------------------------------------
// Job 2: Báo cáo tiến độ học tập - Thứ Hai lúc 8:00 sáng VN (1:00 UTC)
// Gửi cho tất cả user có ít nhất 1 bộ thẻ
// -----------------------------------------------
async function runWeeklyStudyReport() {
  console.log("[Scheduler] Bắt đầu job báo cáo tiến độ hằng tuần...");

  try {
    const allUsers = await prisma.user.findMany({
      where: {
        decks: { some: {} },
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        currentStreak: true,
      },
    });

    const users = allUsers.filter((u) => u.email);

    if (users.length === 0) {
      console.log("[Scheduler] Không có user nào để gửi báo cáo.");
      return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const user of users) {
      try {
        const [totalDecks, flashcardStats] = await Promise.all([
          prisma.deck.count({ where: { userId: user.id } }),
          prisma.flashcard.findMany({
            where: { deck: { userId: user.id } },
            select: {
              id: true,
              progresses: {
                where: { userId: user.id },
                select: { id: true },
              },
            },
          }),
        ]);

        const totalCards = flashcardStats.length;
        const studiedCards = flashcardStats.filter((f) => f.progresses.length > 0).length;
        const progressPercent = totalCards > 0 ? Math.round((studiedCards / totalCards) * 100) : 0;

        await emailService.sendStudyProgressReport(user.email, user.fullName, {
          totalDecks,
          totalCards,
          studiedCards,
          progressPercent,
          currentStreak: user.currentStreak || 0,
        });

        successCount++;
        console.log(`[Scheduler] Gửi báo cáo tiến độ → ${user.email}`);
      } catch (err) {
        failCount++;
        console.error(`[Scheduler] Lỗi gửi tới ${user.email}:`, err.message);
      }
      // Tránh vượt rate limit Resend (tối đa 2 req/giây)
      await new Promise((resolve) => setTimeout(resolve, 600));
    }

    console.log(`[Scheduler] Hoàn tất báo cáo tiến độ: ${successCount} thành công, ${failCount} thất bại.`);
  } catch (err) {
    console.error("[Scheduler] Lỗi job báo cáo tiến độ:", err.message);
  }
}

// -----------------------------------------------
// Khởi động tất cả cron jobs
// -----------------------------------------------
function startScheduler() {
  // Hằng ngày lúc 8:00 sáng giờ Việt Nam (01:00 UTC)
  cron.schedule("0 1 * * *", runDailyReviewReminder, {
    timezone: "UTC",
  });

  // Thứ Hai hằng tuần lúc 8:00 sáng giờ Việt Nam (01:00 UTC)
  cron.schedule("0 1 * * 1", runWeeklyStudyReport, {
    timezone: "UTC",
  });

  console.log("[Scheduler] Đã đăng ký các cron jobs:");
  console.log("  → Nhắc ôn tập    : Hằng ngày lúc 8:00 sáng (VN)");
  console.log("  → Báo cáo tiến độ: Thứ Hai hằng tuần lúc 8:00 sáng (VN)");
}

module.exports = { startScheduler, runDailyReviewReminder, runWeeklyStudyReport };
