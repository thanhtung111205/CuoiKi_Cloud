// ====================================================
// CKI CLOUD G12 - ANALYTICS CONTROLLER
// Đồng bộ dữ liệu học tập lên Zoho Analytics
// Trả về embed URL biểu đồ cho Dashboard
// ====================================================

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const analyticsService = require("../services/analyticsService");

// -----------------------------------------------
// Helper: Chuyển mảng object sang chuỗi CSV
// -----------------------------------------------
function toCSV(rows) {
  if (!rows || rows.length === 0) return "";
  const headers = Object.keys(rows[0]).join(",");
  const lines = rows.map((row) =>
    Object.values(row)
      .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
      .join(",")
  );
  return [headers, ...lines].join("\n");
}

// -----------------------------------------------
// Tổng hợp hoạt động học theo ngày
// -----------------------------------------------
async function aggregateStudyActivity(userId) {
  const progresses = await prisma.studyProgress.findMany({
    where: { userId },
    select: { lastReviewedAt: true, repetition: true, interval: true },
  });

  const byDay = {};
  for (const p of progresses) {
    if (!p.lastReviewedAt) continue;
    const day = p.lastReviewedAt.toISOString().split("T")[0];
    if (!byDay[day]) byDay[day] = { hard: 0, good: 0, easy: 0, total: 0 };

    if (p.repetition === 0) byDay[day].hard++;
    else if (p.interval <= 3) byDay[day].good++;
    else byDay[day].easy++;
    byDay[day].total++;
  }

  return Object.entries(byDay).map(([day, counts]) => ({
    user_id: userId,
    review_date: day,
    cards_reviewed: counts.total,
    hard_count: counts.hard,
    good_count: counts.good,
    easy_count: counts.easy,
  }));
}

// -----------------------------------------------
// Phân bố mức thành thạo từ vựng (SM-2 repetition)
// -----------------------------------------------
async function aggregateVocabMastery(userId) {
  const progresses = await prisma.studyProgress.findMany({
    where: { userId },
    select: { repetition: true },
  });

  const counts = { "Mới": 0, "Đang học": 0, "Ôn tập": 0, "Thành thạo": 0 };

  for (const p of progresses) {
    if (p.repetition === 0) counts["Mới"]++;
    else if (p.repetition === 1) counts["Đang học"]++;
    else if (p.repetition === 2) counts["Ôn tập"]++;
    else counts["Thành thạo"]++;
  }

  const today = new Date().toISOString().split("T")[0];

  return Object.entries(counts).map(([level, count]) => ({
    user_id: userId,
    mastery_level: level,
    card_count: count,
    synced_at: today,
  }));
}

// -----------------------------------------------
// Tiến độ từng bộ thẻ
// -----------------------------------------------
async function aggregateDeckProgress(userId) {
  const decks = await prisma.deck.findMany({
    where: { userId, status: "ready" },
    select: {
      title: true,
      flashcards: {
        select: {
          id: true,
          progresses: {
            where: { userId },
            select: { id: true },
          },
        },
      },
    },
  });

  const today = new Date().toISOString().split("T")[0];

  return decks.map((deck) => {
    const total = deck.flashcards.length;
    const studied = deck.flashcards.filter((f) => f.progresses.length > 0).length;
    return {
      user_id: userId,
      deck_title: deck.title.substring(0, 50),
      total_cards: total,
      studied_cards: studied,
      progress_percent: total > 0 ? Math.round((studied / total) * 100) : 0,
      synced_at: today,
    };
  });
}

// -----------------------------------------------
// Thống kê thi đấu
// -----------------------------------------------
async function aggregateBattleStats(userId) {
  const [user, asP1, asP2] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { fullName: true, email: true } }),
    prisma.matchHistory.findMany({ where: { player1Id: userId }, select: { winnerId: true } }),
    prisma.matchHistory.findMany({ where: { player2Id: userId }, select: { winnerId: true } }),
  ]);

  const allMatches = [...asP1, ...asP2];
  const total = allMatches.length;
  const wins = allMatches.filter((m) => m.winnerId === userId).length;
  const draws = allMatches.filter((m) => m.winnerId === null).length;
  const losses = total - wins - draws;

  const today = new Date().toISOString().split("T")[0];

  return [{
    user_id: userId,
    user_name: user?.fullName || user?.email || userId,
    wins,
    losses,
    draws,
    total_matches: total,
    synced_at: today,
  }];
}

// -----------------------------------------------
// POST /api/analytics/sync
// Đồng bộ toàn bộ dữ liệu học tập của user lên Zoho Analytics
// -----------------------------------------------
exports.syncUserAnalytics = async (req, res) => {
  try {
    const userId = req.user.userId;
    console.log(`[Analytics] Bắt đầu sync cho User: ${userId}`);

    const [activityData, masteryData, deckData, battleData] = await Promise.all([
      aggregateStudyActivity(userId),
      aggregateVocabMastery(userId),
      aggregateDeckProgress(userId),
      aggregateBattleStats(userId),
    ]);

    const syncResults = await Promise.allSettled([
      analyticsService.importData("study_activity", toCSV(activityData)),
      analyticsService.importData("vocab_mastery", toCSV(masteryData)),
      analyticsService.importData("deck_progress", toCSV(deckData)),
      analyticsService.importData("battle_stats", toCSV(battleData)),
    ]);

    const labels = ["study_activity", "vocab_mastery", "deck_progress", "battle_stats"];
    const summary = syncResults.map((result, i) => ({
      table: labels[i],
      status: result.status,
      error: result.status === "rejected" ? result.reason?.message : undefined,
    }));

    const hasError = syncResults.some((r) => r.status === "rejected" && !r.reason?.message?.includes("skipped"));
    console.log(`[Analytics] Sync hoàn thành:`, summary);

    return res.status(hasError ? 207 : 200).json({
      success: !hasError,
      message: hasError ? "Đồng bộ một phần. Một số bảng gặp lỗi." : "Đồng bộ dữ liệu thành công.",
      summary,
    });
  } catch (error) {
    console.error("[Analytics] Lỗi sync:", error);
    return res.status(500).json({ success: false, message: "Lỗi Server Internal", error: error.message });
  }
};

// -----------------------------------------------
// GET /api/analytics/embed-urls
// Trả về danh sách embed URL đã ký cho FE nhúng iframe
// -----------------------------------------------
exports.getEmbedUrls = async (req, res) => {
  try {
    const userId = req.user.userId;

    const viewIds = {
      chartActivity: process.env.ZOHO_VIEW_CHART_ACTIVITY,
      chartMastery: process.env.ZOHO_VIEW_CHART_MASTERY,
      chartDecks: process.env.ZOHO_VIEW_CHART_DECKS,
      chartEF: process.env.ZOHO_VIEW_CHART_EF,
      chartBattle: process.env.ZOHO_VIEW_CHART_BATTLE,
    };

    const embedUrls = {};
    for (const [key, viewId] of Object.entries(viewIds)) {
      embedUrls[key] = viewId ? analyticsService.generateEmbedUrl(viewId, userId) : null;
    }

    const hasAnyUrl = Object.values(embedUrls).some((u) => u !== null);

    return res.status(200).json({
      success: true,
      configured: hasAnyUrl,
      data: embedUrls,
    });
  } catch (error) {
    console.error("[Analytics] Lỗi lấy embed URLs:", error);
    return res.status(500).json({ success: false, message: "Lỗi Server Internal", error: error.message });
  }
};

// -----------------------------------------------
// GET /api/analytics/summary
// Trả về dữ liệu thô JSON — fallback khi Zoho chưa cấu hình
// -----------------------------------------------
exports.getAnalyticsSummary = async (req, res) => {
  try {
    const userId = req.user.userId;

    const [activityData, masteryData, deckData, battleData] = await Promise.all([
      aggregateStudyActivity(userId),
      aggregateVocabMastery(userId),
      aggregateDeckProgress(userId),
      aggregateBattleStats(userId),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        studyActivity: activityData,
        vocabMastery: masteryData,
        deckProgress: deckData,
        battleStats: battleData[0] || { wins: 0, losses: 0, draws: 0, total_matches: 0 },
      },
    });
  } catch (error) {
    console.error("[Analytics] Lỗi lấy summary:", error);
    return res.status(500).json({ success: false, message: "Lỗi Server Internal", error: error.message });
  }
};
