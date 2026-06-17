// Backend/scripts/checkMatchHistory.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function checkMatchHistory() {
  console.log("🔍 Đang truy vấn lịch sử trận đấu (MatchHistory) trong Database...");
  try {
    const matches = await prisma.matchHistory.findMany({
      orderBy: {
        endedAt: "desc",
      },
      include: {
        player1: { select: { fullName: true, email: true } },
        player2: { select: { fullName: true, email: true } },
        winner: { select: { fullName: true } },
      },
      take: 10, // Lấy 10 trận gần nhất
    });

    if (matches.length === 0) {
      console.log("❌ Không tìm thấy dữ liệu trận đấu nào trong bảng match_histories!");
      return;
    }

    console.log(`✅ Tìm thấy ${matches.length} trận đấu trong Database:\n`);
    matches.forEach((match, index) => {
      console.log(`--- TRẬN ĐẤU #${index + 1} ---`);
      console.log(`ID: ${match.id}`);
      console.log(`Phòng (Room PIN): ${match.roomPin}`);
      console.log(`Người chơi 1 (P1): ${match.player1?.fullName} (${match.player1?.email}) - Điểm/HP còn lại: ${match.player1Score}`);
      console.log(`Người chơi 2 (P2): ${match.player2?.fullName} (${match.player2?.email}) - Điểm/HP còn lại: ${match.player2Score}`);
      console.log(`Người chiến thắng: ${match.winner?.fullName || "Hòa / Chưa kết thúc"}`);
      console.log(`Bắt đầu lúc: ${match.startedAt}`);
      console.log(`Kết thúc lúc: ${match.endedAt}`);
      console.log("-------------------------\n");
    });
  } catch (error) {
    console.error("❌ Lỗi truy vấn cơ sở dữ liệu:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkMatchHistory();
