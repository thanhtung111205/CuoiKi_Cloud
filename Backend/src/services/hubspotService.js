// Backend/src/services/hubspotService.js

const HUBSPOT_API_URL = "https://api.hubapi.com/crm/v3/objects";

/**
 * Helper để lấy headers xác thực chung cho các cuộc gọi HubSpot API
 */
function getHeaders() {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) {
    console.warn("[HubSpot Service] ⚠️ Cảnh báo: Biến môi trường HUBSPOT_ACCESS_TOKEN chưa được cấu hình!");
  }
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`
  };
}

/**
 * 1. Hàm tạo một Contact mới trên HubSpot CRM
 * @param {string} email - Email của học sinh
 * @param {string} firstName - Tên học sinh
 * @param {string} lastName - Họ học sinh
 * @returns {Promise<string|null>} Trả về contactId (ID của contact vừa tạo hoặc tìm thấy) hoặc null nếu thất bại
 */
async function createContact(email, firstName, lastName) {
  try {
    console.log(`[HubSpot Service] 🔍 Đang tạo Contact cho học sinh: ${firstName} ${lastName} (${email})`);
    
    const response = await fetch(`${HUBSPOT_API_URL}/contacts`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        properties: {
          email: email,
          firstname: firstName,
          lastname: lastName
        }
      })
    });

    const resData = await response.json();

    if (response.ok) {
      console.log(`[HubSpot Service] ✅ Đã tạo thành công Contact trên HubSpot. ID Contact: ${resData.id}`);
      return resData.id;
    } else {
      // Xử lý trường hợp Contact đã tồn tại (HubSpot trả về mã lỗi 409 Conflict)
      if (response.status === 409 && resData.message?.includes("existing ID")) {
        const match = resData.message.match(/ID: (\d+)/);
        if (match && match[1]) {
          console.log(`[HubSpot Service] ℹ️ Contact đã tồn tại. Sử dụng ID hiện có: ${match[1]}`);
          return match[1];
        }
      }
      console.error("[HubSpot Service] ❌ Lỗi từ HubSpot API khi tạo Contact:", JSON.stringify(resData, null, 2));
      return null;
    }
  } catch (error) {
    console.error("[HubSpot Service] ❌ Lỗi kết nối khi tạo Contact:", error.message);
    return null;
  }
}

/**
 * 2. Hàm tạo Ticket cảnh báo gian lận và liên kết với Contact học sinh đã có
 * @param {string} subject - Tiêu đề của Ticket cảnh báo
 * @param {string} content - Nội dung chi tiết cảnh báo
 * @param {string} studentContactId - ID Contact của học sinh đã tạo/tìm thấy ở bước trước
 * @returns {Promise<string|null>} Trả về ticketId vừa tạo hoặc null nếu thất bại
 */
async function createTicketWithAssociation(subject, content, studentContactId) {
  try {
    console.log(`[HubSpot Service] 🔍 Đang tạo Ticket cảnh báo gian lận và liên kết với Contact ID: ${studentContactId}...`);
    
    const payload = {
      properties: {
        subject: subject,
        content: content,
        hs_ticket_priority: "HIGH",
        hs_pipeline: "0",        // Support Pipeline mặc định
        hs_pipeline_stage: "1"   // Trạng thái "New" của Ticket
      },
      // Hướng dẫn liên kết (Associations) chuẩn API v3 của HubSpot:
      // - "to": đối tượng được liên kết tới (ở đây là Contact học sinh).
      // - "types": xác định loại mối quan hệ.
      // - Với mối quan hệ "Ticket to Contact", HubSpot quy định associationTypeId là 16 (loại HUBSPOT_DEFINED).
      associations: [
        {
          to: {
            id: studentContactId
          },
          types: [
            {
              associationCategory: "HUBSPOT_DEFINED",
              associationTypeId: 16 // 16 biểu thị mối quan hệ "Ticket to Contact"
            }
          ]
        }
      ]
    };

    const response = await fetch(`${HUBSPOT_API_URL}/tickets`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(payload)
    });

    const resData = await response.json();

    if (response.ok) {
      console.log(`[HubSpot Service] ✅ Tạo Ticket cảnh báo gian lận & liên kết thành công! Ticket ID: ${resData.id}`);
      return resData.id;
    } else {
      console.error("[HubSpot Service] ❌ Lỗi từ HubSpot API khi tạo Ticket có liên kết:", JSON.stringify(resData, null, 2));
      return null;
    }
  } catch (error) {
    console.error("[HubSpot Service] ❌ Lỗi kết nối khi tạo Ticket có liên kết:", error.message);
    return null;
  }
}

/**
 * 3. Hàm tạo Ticket hỗ trợ lỗi (Bug Report) thông thường
 * @param {string} subject - Tiêu đề phản hồi lỗi
 * @param {string} description - Chi tiết mô tả lỗi
 * @param {string} priority - Mức độ ưu tiên (LOW, MEDIUM, HIGH)
 * @returns {Promise<string|null>} Trả về ticketId vừa tạo hoặc null nếu thất bại
 */
async function createSupportTicket(subject, description, priority = "MEDIUM") {
  try {
    console.log(`[HubSpot Service] 🔍 Đang tạo Ticket hỗ trợ lỗi thông thường (${priority})...`);

    const payload = {
      properties: {
        subject: subject,
        content: description,
        hs_ticket_priority: priority,
        hs_pipeline: "0",        // Support Pipeline mặc định
        hs_pipeline_stage: "1"   // Trạng thái "New" của Ticket
      }
    };

    const response = await fetch(`${HUBSPOT_API_URL}/tickets`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(payload)
    });

    const resData = await response.json();

    if (response.ok) {
      console.log(`[HubSpot Service] ✅ Tạo Ticket hỗ trợ lỗi thành công! Ticket ID: ${resData.id}`);
      return resData.id;
    } else {
      console.error("[HubSpot Service] ❌ Lỗi từ HubSpot API khi tạo Ticket hỗ trợ:", JSON.stringify(resData, null, 2));
      return null;
    }
  } catch (error) {
    console.error("[HubSpot Service] ❌ Lỗi kết nối khi tạo Ticket hỗ trợ:", error.message);
    return null;
  }
}

module.exports = {
  createContact,
  createTicketWithAssociation,
  createSupportTicket
};
