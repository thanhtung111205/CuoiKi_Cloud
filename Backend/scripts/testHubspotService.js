// Backend/scripts/testHubspotService.js
require('dotenv').config();
const { createContact, createTicketWithAssociation, createSupportTicket } = require('../src/services/hubspotService');

async function runTest() {
  console.log("=== BẮT ĐẦU CHẠY THỬ NGHIỆM HUBSPOT SERVICE ===");

  const testEmail = `test.student.${Math.floor(Math.random() * 10000)}@gmail.com`;
  const testFirstName = "Gia Bảo";
  const testLastName = "Nguyễn";

  // 1. Tạo Contact
  const contactId = await createContact(testEmail, testFirstName, testLastName);
  if (!contactId) {
    console.error("❌ Thử nghiệm tạo Contact thất bại!");
    return;
  }
  console.log(`\n1. ID Contact nhận được: ${contactId}`);

  // 2. Tạo Ticket liên kết với Contact học sinh
  const ticketId = await createTicketWithAssociation(
    "Cảnh báo gian lận: Chuyển tab khi thi đấu Quiz Battle (Test Service Association)",
    `Học sinh ${testLastName} ${testFirstName} có hành vi chuyển tab trình duyệt lúc ${new Date().toLocaleString()}`,
    contactId
  );
  if (!ticketId) {
    console.error("❌ Thử nghiệm tạo Ticket liên kết thất bại!");
  } else {
    console.log(`2. ID Ticket liên kết nhận được: ${ticketId}`);
  }

  // 3. Tạo Ticket lỗi Bug Report thông thường
  const supportTicketId = await createSupportTicket(
    "Lỗi kết nối Socket.io khi load phòng đấu (Bug Report - Service Test)",
    "Học viên bị mất kết nối và tự động chuyển về màn hình lobby mà không rõ nguyên nhân.",
    "MEDIUM"
  );
  if (!supportTicketId) {
    console.error("❌ Thử nghiệm tạo Ticket hỗ trợ thất bại!");
  } else {
    console.log(`3. ID Ticket hỗ trợ nhận được: ${supportTicketId}`);
  }

  console.log("\n=== HOÀN TẤT THỬ NGHIỆM ===");
}

runTest();
