// Backend/scripts/testReportCheating.js
require('dotenv').config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { reportCheating } = require("../src/controllers/battleController");

async function testReportCheating() {
  console.log("🔍 Bắt đầu thử nghiệm gọi controller reportCheating...");
  try {
    // 1. Tìm một user trong database để giả lập cuộc thi đấu
    const user = await prisma.user.findFirst({
      select: {
        id: true,
        email: true,
        fullName: true
      }
    });

    if (!user) {
      console.error("❌ Không tìm thấy user nào trong database để test!");
      return;
    }

    console.log(`👤 Sử dụng user giả lập: ${user.fullName} (ID: ${user.id}, Email: ${user.email})`);

    // 2. Mock request và response
    const req = {
      user: {
        userId: user.id,
        email: user.email
      },
      body: {
        reason: "Học viên click ra ngoài hoặc chuyển hướng tiêu điểm khỏi màn hình thi đấu Quiz Battle (Test Script)"
      }
    };

    const res = {
      statusCode: 200,
      status: function(code) {
        this.statusCode = code;
        return this;
      },
      json: function(data) {
        console.log(`\n📬 Phản hồi trả về (Status Code: ${this.statusCode}):`);
        console.log(JSON.stringify(data, null, 2));
      }
    };

    // 3. Thực thi controller
    await reportCheating(req, res);

  } catch (err) {
    console.error("❌ Lỗi chạy test:", err);
  } finally {
    await prisma.$disconnect();
  }
}

testReportCheating();
