// Backend/scripts/testHubSpot.js
require('dotenv').config();

async function testHubSpot() {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  console.log('HubSpot Token:', token ? 'Đã cấu hình' : 'Chưa cấu hình');
  
  if (!token) {
    console.error('Thiếu cấu hình HUBSPOT_ACCESS_TOKEN trong file .env');
    return;
  }

  try {
    console.log('🔍 Đang gửi yêu cầu tạo Ticket cảnh báo lên HubSpot CRM...');
    const response = await fetch("https://api.hubapi.com/crm/v3/objects/tickets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        properties: {
          subject: "Cảnh báo gian lận: Chuyển tab khi thi đấu Quiz Battle (Test Script)",
          content: "Chi tiết cảnh báo:\n-------------------------------\n- ID Học viên: test-user-id-123\n- Email: test-student@gmail.com\n- Tên học viên: Nguyễn Văn A (Test)\n- Hành vi phát hiện: Học viên chuyển sang tab khác trong quá trình Quiz Battle\n-------------------------------",
          hs_ticket_priority: "HIGH",
          hs_pipeline: "0",
          hs_pipeline_stage: "1"
        }
      })
    });

    const resData = await response.json();

    if (response.ok) {
      console.log(`✅ Kết nối HubSpot thành công! Đã tạo Ticket ID: ${resData.id}`);
      console.log('Thông tin Ticket:', JSON.stringify(resData.properties, null, 2));
    } else {
      console.error('❌ Lỗi phản hồi từ HubSpot API:', JSON.stringify(resData, null, 2));
    }
  } catch (err) {
    console.error('❌ Lỗi kết nối đến HubSpot:', err.message);
  }
}

testHubSpot();
