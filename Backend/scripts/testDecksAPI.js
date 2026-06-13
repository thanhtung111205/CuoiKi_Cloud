// Backend/scripts/testDecksAPI.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function test() {
  const userId = "5939cd9b-c8b1-4a66-b552-41024e47a477";
  console.log("🔍 Đang truy vấn thử bằng Prisma cho User ID:", userId);

  try {
    const decks = await prisma.deck.findMany({
      include: {
        _count: {
          select: { flashcards: true }
        },
        flashcards: {
          select: {
            id: true,
            progresses: {
              where: { userId: userId },
              select: { id: true }
            }
          }
        }
      }
    });

    decks.forEach(deck => {
      const totalCards = deck._count.flashcards;
      const studiedCards = deck.flashcards.filter(f => f.progresses.length > 0).length;
      const progressPercent = totalCards > 0 ? Math.round((studiedCards / totalCards) * 100) : 0;
      console.log(`- Bộ thẻ: "${deck.title}" | ID: ${deck.id}`);
      console.log(`  Tổng số thẻ : ${totalCards}`);
      console.log(`  Số thẻ đã học: ${studiedCards}`);
      console.log(`  Tiến độ (%) : ${progressPercent}%`);
    });
  } catch (err) {
    console.error("Lỗi:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

test();
