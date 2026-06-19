// Backend/src/services/hubspotService.js
// ====================================================
// CKI CLOUD G12 - HUBSPOT CRM & TICKETING SERVICE
// Đồng bộ hồ sơ học viên, tiếp nhận báo cáo lỗi
// và tự động tạo ticket cảnh báo gian lận
// ====================================================

const HUBSPOT_API_BASE = "https://api.hubapi.com";

async function _callHubSpot(method, path, body = null) {
  const HUBSPOT_ACCESS_TOKEN = process.env.HUBSPOT_ACCESS_TOKEN;

  if (!HUBSPOT_ACCESS_TOKEN) {
    console.warn(`[HubSpot] Thiếu HUBSPOT_ACCESS_TOKEN. Bỏ qua: ${method} ${path}`);
    return { skipped: true };
  }

  const options = {
    method,
    headers: {
      Authorization: `Bearer ${HUBSPOT_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
  };

  if (body) options.body = JSON.stringify(body);

  const response = await fetch(`${HUBSPOT_API_BASE}${path}`, options);
  const data = await response.json();

  if (!response.ok) {
    console.error(`[HubSpot] Lỗi ${method} ${path}:`, JSON.stringify(data));
    throw new Error(data.message || `HubSpot API error ${response.status}`);
  }

  return data;
}

async function _findContactIdByEmail(email) {
  try {
    const data = await _callHubSpot("POST", "/crm/v3/objects/contacts/search", {
      filterGroups: [
        {
          filters: [{ propertyName: "email", operator: "EQ", value: email }],
        },
      ],
      properties: ["email"],
      limit: 1,
    });

    if (data.results && data.results.length > 0) {
      return data.results[0].id;
    }
    return null;
  } catch {
    return null;
  }
}

// Upsert Contact sau mỗi lần đăng nhập / đăng ký
// user: { id, email, fullName, currentStreak, totalDecks }
exports.upsertContact = async (user) => {
  try {
    const nameParts = (user.fullName || "").trim().split(" ");
    const firstname = nameParts.slice(0, -1).join(" ") || nameParts[0] || "";
    const lastname = nameParts.length > 1 ? nameParts[nameParts.length - 1] : "";

    const result = await _callHubSpot("POST", "/crm/v3/objects/contacts/batch/upsert", {
      inputs: [
        {
          idProperty: "email",
          id: user.email,
          properties: {
            email: user.email,
            firstname,
            lastname,
            app_user_id: user.id,
            current_streak: user.currentStreak ?? 0,
            total_decks: user.totalDecks ?? 0,
          },
        },
      ],
    });

    if (!result.skipped) {
      console.log(`[HubSpot] Upsert Contact: ${user.email}`);
    }
    return result;
  } catch (error) {
    console.error(`[HubSpot] Lỗi upsert Contact (${user.email}):`, error.message);
  }
};

// Tạo Ticket cảnh báo gian lận
// fraudInfo: { userEmail, userId, userFullName, pin, tabSwitchCount, questionIndex, detectedAt }
exports.createFraudTicket = async (fraudInfo) => {
  const { userEmail, userId, userFullName, pin, tabSwitchCount, questionIndex, detectedAt } = fraudInfo;

  const PIPELINE_ID = process.env.HUBSPOT_FRAUD_PIPELINE_ID || "0";
  const STAGE_ID = process.env.HUBSPOT_FRAUD_PIPELINE_STAGE_ID || "1";

  const ticketContent = [
    `Email học viên : ${userEmail}`,
    `User ID        : ${userId}`,
    `Họ tên         : ${userFullName}`,
    `Mã phòng đấu   : #${pin}`,
    `Số lần chuyển tab: ${tabSwitchCount} lần`,
    `Tại câu hỏi số : ${questionIndex + 1}`,
    `Thời điểm phát hiện: ${detectedAt}`,
    ``,
    `HỆ THỐNG TỰ ĐỘNG phát hiện hành vi gian lận trong phiên Quiz Battle.`,
    `Vui lòng xem xét và xử lý theo quy định của trung tâm.`,
  ].join("\n");

  try {
    const ticket = await _callHubSpot("POST", "/crm/v3/objects/tickets", {
      properties: {
        subject: `Cảnh báo gian lận - Quiz Battle #${pin} - ${userEmail}`,
        content: ticketContent,
        hs_pipeline: PIPELINE_ID,
        hs_pipeline_stage: STAGE_ID,
        hs_ticket_priority: "HIGH",
      },
    });

    console.log(`[HubSpot] Tạo Fraud Ticket. ID: ${ticket.id} | User: ${userEmail}`);

    const contactId = await _findContactIdByEmail(userEmail);
    if (contactId && ticket.id) {
      await exports.associateTicketWithContact(ticket.id, contactId);
    }

    return ticket;
  } catch (error) {
    console.error(`[HubSpot] Lỗi tạo Fraud Ticket cho ${userEmail}:`, error.message);
    throw error;
  }
};

// Gắn Ticket vào Contact
exports.associateTicketWithContact = async (ticketId, contactId) => {
  try {
    await _callHubSpot(
      "PUT",
      `/crm/v4/objects/tickets/${ticketId}/associations/contacts/${contactId}`,
      [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 16 }]
    );
    console.log(`[HubSpot] Gắn Ticket ${ticketId} → Contact ${contactId}`);
  } catch (error) {
    console.warn(`[HubSpot] Lỗi gắn association Ticket→Contact:`, error.message);
  }
};

// Submit Form báo cáo lỗi
// formData: { email, firstname, issue_type, description, pageUri? }
exports.submitBugReportForm = async (formData) => {
  const PORTAL_ID = process.env.HUBSPOT_PORTAL_ID;
  const FORM_GUID = process.env.HUBSPOT_BUG_REPORT_FORM_GUID;

  if (!PORTAL_ID || !FORM_GUID) {
    console.warn("[HubSpot] Thiếu HUBSPOT_PORTAL_ID hoặc HUBSPOT_BUG_REPORT_FORM_GUID. Bỏ qua.");
    return { skipped: true };
  }

  const payload = {
    submittedAt: Date.now(),
    fields: [
      { objectTypeId: "0-1", name: "email",       value: formData.email },
      { objectTypeId: "0-1", name: "firstname",   value: formData.firstname || "" },
      { objectTypeId: "0-1", name: "issue_type",  value: formData.issue_type || "Khác" },
      { objectTypeId: "0-1", name: "description", value: formData.description || "" },
    ],
    context: {
      pageUri: formData.pageUri || "https://nhom12c365httt.live",
      pageName: "CKI Flashcard - Bug Report",
    },
    legalConsentOptions: {
      consent: {
        consentToProcess: true,
        text: "Tôi đồng ý cho hệ thống xử lý thông tin báo cáo lỗi của mình.",
      },
    },
  };

  const response = await fetch(
    `https://api.hsforms.com/submissions/v3/integration/submit/${PORTAL_ID}/${FORM_GUID}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    console.error(`[HubSpot] Lỗi submit form báo cáo lỗi:`, err);
    throw new Error(err.message || `HubSpot Forms API error ${response.status}`);
  }

  console.log(`[HubSpot] Submit form báo cáo lỗi: ${formData.email}`);
  return { success: true };
};
