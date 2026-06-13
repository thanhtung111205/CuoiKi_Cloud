// Backend/scripts/cleanupDecks.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function cleanup() {
  console.log("🧹 Đang dọn dẹp toàn bộ bộ bài trong cơ sở dữ liệu...");
  try {
    const result = await prisma.deck.deleteMany({});
    console.log(`✅ Thành công! Đã xóa ${result.count} bộ bài và toàn bộ flashcard liên quan.`);
  } catch (error) {
    console.error("❌ Lỗi dọn dẹp cơ sở dữ liệu:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

cleanup();
