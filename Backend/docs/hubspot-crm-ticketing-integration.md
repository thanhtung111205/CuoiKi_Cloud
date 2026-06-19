# Tích hợp HubSpot CRM & Ticketing API

## Tổng quan

HubSpot đóng vai trò là "trạm kiểm soát" thông tin học viên trung tâm với 3 tính năng chính:

| Tính năng | Trigger | API HubSpot được dùng |
|---|---|---|
| Đồng bộ hồ sơ người dùng | Sau mỗi lần đăng nhập / đăng ký | Contacts API — Batch Upsert |
| Tiếp nhận form báo cáo lỗi | User gửi form từ Dashboard | Forms Submissions API |
| Tạo ticket cảnh báo gian lận | FE phát hiện chuyển tab trong Battle | Tickets API — Tạo + Gắn Contact |

---

## Cơ chế phát hiện gian lận (Tab Switching)

FE theo dõi sự kiện `visibilitychange` trong suốt phiên Battle. Khi người dùng chuyển sang tab khác hoặc thu nhỏ cửa sổ, số lần vi phạm tăng dần. Khi vượt ngưỡng **3 lần**, FE gọi `POST /api/battle/report-fraud` để BE tự động tạo ticket cảnh báo trên HubSpot.

```
[FE — BattleArena đang chạy]
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    tabSwitchCount++;
    if (tabSwitchCount >= FRAUD_THRESHOLD) {
      fetch('/api/battle/report-fraud', { method: 'POST', body: { pin, tabSwitchCount } })
    }
  }
})

[BE nhận request]
POST /api/battle/report-fraud
  → Xác thực JWT → Lấy thông tin user từ DB
  → Kiểm tra ngưỡng hợp lệ (count >= 3)
  → hubspotService.createFraudTicket(...)  ← Tạo Ticket trên HubSpot
  → Ghi log vào Firestore battle document
  → Response 201
```

> Ngưỡng 3 lần có thể tùy chỉnh qua biến môi trường `FRAUD_TAB_SWITCH_THRESHOLD`.

---

## Chuẩn bị HubSpot

### Bước 1 — Tạo Private App

1. Đăng nhập [app.hubspot.com](https://app.hubspot.com) → chọn portal của bạn
2. **Settings → Integrations → Private Apps → Create a private app**
3. Đặt tên: `CKI Flashcard Integration`
4. Chọn scopes:

| Scope | Dùng cho |
|---|---|
| `crm.objects.contacts.read` | Tìm Contact theo email |
| `crm.objects.contacts.write` | Tạo / cập nhật Contact |
| `crm.objects.tickets.read` | Đọc ticket |
| `crm.objects.tickets.write` | Tạo ticket cảnh báo |
| `forms` | Submit form báo cáo lỗi |

5. Tạo app → Sao chép **Access Token** (dạng `pat-na1-xxx...`)
6. Ghi lại **Portal ID** (hiển thị góc trên bên phải, dạng số)

### Bước 2 — Tạo Custom Properties cho Contact

Vào **Settings → Properties → Contact properties → Create property** và tạo 3 trường tùy chỉnh:

| Internal name | Label | Type |
|---|---|---|
| `app_user_id` | App User ID | Single-line text |
| `current_streak` | Chuỗi ngày học hiện tại | Number |
| `total_decks` | Số bộ thẻ đã tạo | Number |

### Bước 3 — Tạo Ticket Pipeline cho gian lận

1. **Settings → Objects → Tickets → Pipelines → Create pipeline**
2. Tên pipeline: `Fraud Alerts`
3. Tạo 3 stages: `Mới` (ID: 1), `Đang xử lý` (ID: 2), `Đã xử lý` (ID: 3)
4. Ghi lại **Pipeline ID** và **Stage ID** của stage `Mới`

### Bước 4 — Tạo Form báo cáo lỗi

1. **Marketing → Forms → Create form → Embedded form**
2. Tên: `Bug Report - CKI Flashcard`
3. Thêm các trường: `Email` (required), `Firstname`, `Loại lỗi` (dropdown), `Mô tả lỗi` (textarea)
4. Sau khi tạo, vào **Share → Embed code** → lấy `data-form-id` = **Form GUID**

---

## Cấu hình môi trường

Thêm vào `Backend/.env`:

```env
# HubSpot Private App
HUBSPOT_ACCESS_TOKEN=pat-na1-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
HUBSPOT_PORTAL_ID=xxxxxxxxxx

# HubSpot - Form báo cáo lỗi
HUBSPOT_BUG_REPORT_FORM_GUID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# HubSpot - Ticket Pipeline gian lận
HUBSPOT_FRAUD_PIPELINE_ID=xxxxxxxxxx
HUBSPOT_FRAUD_PIPELINE_STAGE_ID=xxxxxxxxxx

# Ngưỡng số lần chuyển tab để kích hoạt cảnh báo
FRAUD_TAB_SWITCH_THRESHOLD=3
```

---

## Luồng triển khai

```
[authController.googleLogin / emailLogin / emailSignup]
  → prisma.user.upsert() / create()  ← Đã có
  → hubspotService.upsertContact()   ← Thêm mới (fire-and-forget)

[POST /api/battle/report-fraud]       ← Route mới
  → battleController.reportFraud()   ← Hàm mới trong file hiện tại
  → hubspotService.createFraudTicket()
  → hubspotService.associateTicketWithContact()

[POST /api/support/bug-report]        ← Route mới
  → supportController.submitBugReport()   ← Controller mới
  → hubspotService.submitBugReportForm()
```

---

## File 1: `Backend/src/services/hubspotService.js` (mới)

Theo cấu trúc tương tự `r2Service.js` — service thuần, không biết về Express req/res.

```js
// ====================================================
// CKI CLOUD G12 - HUBSPOT CRM & TICKETING SERVICE
// Đồng bộ hồ sơ học viên, tiếp nhận báo cáo lỗi
// và tự động tạo ticket cảnh báo gian lận
// ====================================================

const HUBSPOT_API_BASE = "https://api.hubapi.com";

// -----------------------------------------------
// Helper nội bộ: Gọi HubSpot REST API
// -----------------------------------------------
async function _callHubSpot(method, path, body = null) {
  const HUBSPOT_ACCESS_TOKEN = process.env.HUBSPOT_ACCESS_TOKEN;

  if (!HUBSPOT_ACCESS_TOKEN) {
    console.warn(`[HubSpot] Thiếu HUBSPOT_ACCESS_TOKEN. Bỏ qua lệnh gọi: ${method} ${path}`);
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
    console.error(`[HubSpot] ❌ Lỗi ${method} ${path}:`, JSON.stringify(data));
    throw new Error(data.message || `HubSpot API error ${response.status}`);
  }

  return data;
}

// -----------------------------------------------
// 1. Đồng bộ (Upsert) hồ sơ người dùng lên HubSpot Contacts
//    Gọi sau mỗi lần đăng nhập / đăng ký thành công
//    user: { id, email, fullName, currentStreak, totalDecks }
// -----------------------------------------------
exports.upsertContact = async (user) => {
  try {
    const nameParts = (user.fullName || "").trim().split(" ");
    const firstname = nameParts.slice(0, -1).join(" ") || nameParts[0] || "";
    const lastname = nameParts.length > 1 ? nameParts[nameParts.length - 1] : "";

    // Batch Upsert API — idProperty: "email" cho phép upsert mà không cần tìm ID trước
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

    console.log(`[HubSpot] ✅ Upsert Contact thành công: ${user.email}`);
    return result;
  } catch (error) {
    // Không throw — lỗi HubSpot không được làm gián đoạn luồng auth
    console.error(`[HubSpot] ⚠️ Lỗi upsert Contact (${user.email}):`, error.message);
  }
};

// -----------------------------------------------
// 2. Lấy HubSpot Contact ID theo email
//    Dùng nội bộ để gắn ticket vào contact
// -----------------------------------------------
async function _findContactIdByEmail(email) {
  try {
    const data = await _callHubSpot("POST", "/crm/v3/objects/contacts/search", {
      filterGroups: [
        {
          filters: [
            { propertyName: "email", operator: "EQ", value: email },
          ],
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

// -----------------------------------------------
// 3. Tạo Ticket cảnh báo gian lận
//    fraudInfo: { userEmail, userId, userFullName, pin, tabSwitchCount, questionIndex, detectedAt }
// -----------------------------------------------
exports.createFraudTicket = async (fraudInfo) => {
  const {
    userEmail,
    userId,
    userFullName,
    pin,
    tabSwitchCount,
    questionIndex,
    detectedAt,
  } = fraudInfo;

  const PIPELINE_ID = process.env.HUBSPOT_FRAUD_PIPELINE_ID || "0";
  const STAGE_ID = process.env.HUBSPOT_FRAUD_PIPELINE_STAGE_ID || "1";

  const ticketContent = [
    `📧 Email học viên : ${userEmail}`,
    `🆔 User ID        : ${userId}`,
    `👤 Họ tên         : ${userFullName}`,
    `🎮 Mã phòng đấu   : #${pin}`,
    `🔄 Số lần chuyển tab: ${tabSwitchCount} lần`,
    `❓ Tại câu hỏi số : ${questionIndex + 1}`,
    `🕐 Thời điểm phát hiện: ${detectedAt}`,
    ``,
    `HỆ THỐNG TỰ ĐỘNG phát hiện hành vi gian lận trong phiên Quiz Battle.`,
    `Vui lòng xem xét và xử lý theo quy định của trung tâm.`,
  ].join("\n");

  try {
    const ticket = await _callHubSpot("POST", "/crm/v3/objects/tickets", {
      properties: {
        subject: `🚨 Cảnh báo gian lận - Quiz Battle #${pin} - ${userEmail}`,
        content: ticketContent,
        hs_pipeline: PIPELINE_ID,
        hs_pipeline_stage: STAGE_ID,
        hs_ticket_priority: "HIGH",
      },
    });

    console.log(`[HubSpot] ✅ Tạo Fraud Ticket thành công. ID: ${ticket.id} | User: ${userEmail}`);

    // Gắn ticket vào Contact nếu tìm thấy (best-effort, không block)
    const contactId = await _findContactIdByEmail(userEmail);
    if (contactId && ticket.id) {
      await exports.associateTicketWithContact(ticket.id, contactId);
    }

    return ticket;
  } catch (error) {
    console.error(`[HubSpot] ❌ Lỗi tạo Fraud Ticket cho ${userEmail}:`, error.message);
    throw error;
  }
};

// -----------------------------------------------
// 4. Gắn Ticket vào Contact (Association)
//    ticketId: HubSpot Ticket ID
//    contactId: HubSpot Contact ID
// -----------------------------------------------
exports.associateTicketWithContact = async (ticketId, contactId) => {
  try {
    // HubSpot Associations API v4 — gắn ticket với contact
    await _callHubSpot(
      "PUT",
      `/crm/v4/objects/tickets/${ticketId}/associations/contacts/${contactId}`,
      [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 16 }]
      // associationTypeId 16 = Ticket to Contact (HubSpot default)
    );

    console.log(`[HubSpot] ✅ Gắn Ticket ${ticketId} → Contact ${contactId} thành công.`);
  } catch (error) {
    // Không throw — gắn association thất bại không ảnh hưởng đến ticket đã tạo
    console.warn(`[HubSpot] ⚠️ Lỗi gắn association Ticket→Contact:`, error.message);
  }
};

// -----------------------------------------------
// 5. Submit Form báo cáo lỗi lên HubSpot
//    formData: { email, firstname, issue_type, description, pageUri? }
// -----------------------------------------------
exports.submitBugReportForm = async (formData) => {
  const PORTAL_ID = process.env.HUBSPOT_PORTAL_ID;
  const FORM_GUID = process.env.HUBSPOT_BUG_REPORT_FORM_GUID;

  if (!PORTAL_ID || !FORM_GUID) {
    console.warn("[HubSpot] Thiếu HUBSPOT_PORTAL_ID hoặc HUBSPOT_BUG_REPORT_FORM_GUID. Bỏ qua.");
    return { skipped: true };
  }

  // HubSpot Forms Submissions API (không cần access token — dùng portal ID + form GUID)
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
    `${HUBSPOT_API_BASE}/submissions/v3/integration/submit/${PORTAL_ID}/${FORM_GUID}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    console.error(`[HubSpot] ❌ Lỗi submit form báo cáo lỗi:`, err);
    throw new Error(err.message || `HubSpot Forms API error ${response.status}`);
  }

  console.log(`[HubSpot] ✅ Submit form báo cáo lỗi thành công từ: ${formData.email}`);
  return { success: true };
};
```

---

## File 2: `Backend/src/controllers/supportController.js` (mới)

```js
// ====================================================
// CKI CLOUD G12 - SUPPORT CONTROLLER
// Tiếp nhận báo cáo lỗi từ người dùng
// và chuyển tiếp tới HubSpot Forms API
// ====================================================

const hubspotService = require("../services/hubspotService");

/**
 * POST /api/support/bug-report
 * User gửi form báo cáo lỗi từ Dashboard
 *
 * Body: { issue_type, description }
 * (email và firstname lấy từ authMiddleware — không cần user tự nhập lại)
 */
exports.submitBugReport = async (req, res) => {
  try {
    const { issue_type, description } = req.body;
    const userEmail = req.user.email;
    const userId = req.user.userId;

    if (!issue_type || !description || description.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng chọn loại lỗi và mô tả chi tiết (ít nhất 10 ký tự).",
      });
    }

    if (description.length > 2000) {
      return res.status(400).json({
        success: false,
        message: "Mô tả lỗi không được vượt quá 2000 ký tự.",
      });
    }

    console.log(`[SupportController] 📝 Báo cáo lỗi từ ${userEmail} | Loại: ${issue_type}`);

    await hubspotService.submitBugReportForm({
      email: userEmail,
      issue_type,
      description: description.trim(),
      pageUri: req.headers.referer || "https://nhom12c365httt.live",
    });

    return res.status(200).json({
      success: true,
      message: "Cảm ơn bạn đã báo cáo! Chúng tôi sẽ xem xét và phản hồi sớm nhất có thể.",
    });
  } catch (error) {
    console.error("[SupportController] ❌ Lỗi gửi báo cáo:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể gửi báo cáo lúc này. Vui lòng thử lại sau.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
```

---

## File 3: Chỉnh sửa `Backend/src/controllers/authController.js`

Thêm contact sync sau mỗi lần đăng nhập / đăng ký thành công. Áp dụng cho cả 3 hàm: `googleLogin`, `emailLogin`, `emailSignup`.

**Vị trí chèn**: Ngay sau dòng `user = await prisma.user.upsert(...)` (hoặc `prisma.user.create()`), trước khi ký JWT. Dùng `.catch()` để không block response.

```js
// Thêm ở đầu file authController.js (sau các require hiện có)
const hubspotService = require("../services/hubspotService");
const { PrismaClient: PrismaForHubspot } = require("@prisma/client");
const prismaForCount = new PrismaForHubspot();

// --------------------------------------------------
// Trong exports.googleLogin — sau dòng user = await prisma.user.upsert(...)
// --------------------------------------------------

// Đồng bộ hồ sơ lên HubSpot (bất đồng bộ, không block response)
prismaForCount.deck.count({ where: { userId: user.id } })
  .then((totalDecks) => {
    hubspotService.upsertContact({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      currentStreak: user.currentStreak,
      totalDecks,
    });
  })
  .catch((err) => console.warn("[Auth] Lỗi sync HubSpot Contact:", err.message));


// --------------------------------------------------
// Trong exports.emailLogin — vị trí tương tự
// --------------------------------------------------

prismaForCount.deck.count({ where: { userId: user.id } })
  .then((totalDecks) => {
    hubspotService.upsertContact({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      currentStreak: user.currentStreak,
      totalDecks,
    });
  })
  .catch((err) => console.warn("[Auth] Lỗi sync HubSpot Contact:", err.message));


// --------------------------------------------------
// Trong exports.emailSignup — vị trí tương tự
// (user.currentStreak = 0 và totalDecks = 0 cho user mới)
// --------------------------------------------------

hubspotService.upsertContact({
  id: user.id,
  email: user.email,
  fullName: user.fullName,
  currentStreak: 0,
  totalDecks: 0,
}).catch((err) => console.warn("[Auth] Lỗi sync HubSpot Contact:", err.message));
```

---

## File 4: Chỉnh sửa `Backend/src/controllers/battleController.js`

Thêm hàm `reportFraud` vào cuối file (sau `exports.sendEmail`):

```js
// Thêm ở đầu file (sau require hiện có)
const { PrismaClient: PrismaForFraud } = require("@prisma/client");
const prismaFraud = new PrismaForFraud();
const hubspotService = require("../services/hubspotService");

// -----------------------------------------------
// Thêm vào cuối file battleController.js
// -----------------------------------------------

/**
 * POST /api/battle/report-fraud
 * FE gọi khi phát hiện người dùng chuyển tab quá ngưỡng cho phép
 * trong quá trình thi đấu Quiz Battle
 *
 * Body: { pin, tabSwitchCount, questionIndex }
 */
exports.reportFraud = async (req, res) => {
  try {
    const { pin, tabSwitchCount, questionIndex = 0 } = req.body;
    const reqUserId = req.user.userId;
    const reqEmail = req.user.email;

    // --- Validate đầu vào ---
    if (!pin) {
      return res.status(400).json({ success: false, message: "Thiếu mã PIN phòng đấu." });
    }

    const THRESHOLD = parseInt(process.env.FRAUD_TAB_SWITCH_THRESHOLD) || 3;
    if (!tabSwitchCount || tabSwitchCount < THRESHOLD) {
      return res.status(400).json({
        success: false,
        message: `Số lần chuyển tab (${tabSwitchCount}) chưa đạt ngưỡng cảnh báo (${THRESHOLD}).`,
      });
    }

    // --- Kiểm tra phòng đấu tồn tại và user thuộc phòng ---
    const roomRef = db.collection("battles").doc(pin);
    const roomDoc = await roomRef.get();

    if (!roomDoc.exists) {
      return res.status(404).json({ success: false, message: "Không tìm thấy phòng đấu." });
    }

    const battleData = roomDoc.data();
    const isInRoom =
      battleData.hostId === reqUserId ||
      battleData.guestId === reqUserId ||
      battleData.hostEmail === reqEmail ||
      battleData.guestEmail === reqEmail;

    if (!isInRoom) {
      return res.status(403).json({ success: false, message: "Bạn không thuộc phòng đấu này." });
    }

    // --- Chống spam: Kiểm tra đã tạo ticket cho user này trong phòng này chưa ---
    const fraudLogKey = `fraudReported_${reqUserId}`;
    if (battleData[fraudLogKey] === true) {
      return res.status(200).json({
        success: true,
        message: "Hành vi này đã được ghi nhận trước đó.",
        alreadyReported: true,
      });
    }

    // --- Lấy tên đầy đủ của user từ DB để điền vào ticket ---
    let userFullName = reqEmail;
    try {
      const dbUser = await prismaFraud.user.findUnique({
        where: { id: reqUserId },
        select: { fullName: true },
      });
      if (dbUser) userFullName = dbUser.fullName;
    } catch {
      // Không block nếu lỗi DB — vẫn tạo ticket với email
    }

    const detectedAt = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

    console.log(`[BattleController] 🚨 Phát hiện gian lận! User: ${reqEmail} | Phòng: #${pin} | Tab switch: ${tabSwitchCount} lần`);

    // --- Tạo Ticket cảnh báo trên HubSpot ---
    await hubspotService.createFraudTicket({
      userEmail: reqEmail,
      userId: reqUserId,
      userFullName,
      pin,
      tabSwitchCount,
      questionIndex,
      detectedAt,
    });

    // --- Đánh dấu đã báo cáo vào Firestore để tránh tạo ticket trùng lặp ---
    await roomRef.update({ [fraudLogKey]: true });

    return res.status(201).json({
      success: true,
      message: "Hành vi gian lận đã được ghi nhận và báo cáo.",
    });
  } catch (error) {
    console.error("[BattleController] ❌ Lỗi reportFraud:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi Server Internal.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
```

---

## File 5: Chỉnh sửa `Backend/src/routes/api.js`

Thêm vào cuối file (trước `module.exports`):

```js
const supportController = require("../controllers/supportController");

// -----------------------------------------------
// SUPPORT ROUTES
// -----------------------------------------------
router.post("/support/bug-report", authMiddleware, supportController.submitBugReport);

// -----------------------------------------------
// BATTLE ROUTES — thêm vào sau route đã có
// -----------------------------------------------
router.post("/battle/report-fraud", authMiddleware, battleController.reportFraud);
```

---

## Tóm tắt endpoint mới

| Method | Path | Auth | Mô tả |
|---|---|---|---|
| `POST` | `/api/support/bug-report` | ✅ JWT | Gửi form báo cáo lỗi lên HubSpot Forms |
| `POST` | `/api/battle/report-fraud` | ✅ JWT | Tạo ticket cảnh báo gian lận chuyển tab |

Contact sync xảy ra tự động trong các route auth hiện có — không có endpoint riêng.

---

## Luồng dữ liệu đầy đủ

```
══════════════════════════════════════════════════════
  LUỒNG 1: Đồng bộ hồ sơ người dùng
══════════════════════════════════════════════════════
POST /api/auth/google-login | email-login | email-signup
  → prisma.user.upsert() / create()
  → prisma.deck.count()  ─────────────────────┐
  → hubspotService.upsertContact()             │ fire-and-forget
    → POST /crm/v3/objects/contacts/batch/upsert  (idProperty: email)
      → Tạo mới nếu chưa có | Cập nhật nếu đã có
  → jwt.sign() → Response 200/201  ◄───────────┘ (không chờ HubSpot)

══════════════════════════════════════════════════════
  LUỒNG 2: Phát hiện gian lận trong Battle
══════════════════════════════════════════════════════
[FE — BattleArena]
  document.visibilitychange → tabSwitchCount++
  if (tabSwitchCount >= 3) → POST /api/battle/report-fraud
                              { pin, tabSwitchCount, questionIndex }
       ↓
authMiddleware → req.user = { userId, email }
       ↓
battleController.reportFraud()
  1. Validate: pin có tồn tại? user thuộc phòng này?
  2. Chống spam: fraudReported_{userId} đã = true trong Firestore?
  3. prisma.user.findUnique() → lấy fullName
       ↓
hubspotService.createFraudTicket()
  → POST /crm/v3/objects/tickets
    {
      subject: "🚨 Cảnh báo gian lận - Quiz Battle #pin - email",
      content: "Email: ... | Tab switch: N lần | Câu số: X | Lúc: ...",
      hs_pipeline: FRAUD_PIPELINE_ID,
      hs_pipeline_stage: FRAUD_STAGE_ID,
      hs_ticket_priority: "HIGH"
    }
  → _findContactIdByEmail()  ← Tìm Contact ID theo email
  → associateTicketWithContact()
    → PUT /crm/v4/objects/tickets/{ticketId}/associations/contacts/{contactId}
       ↓
roomRef.update({ fraudReported_{userId}: true })  ← Đánh dấu Firestore
       ↓
Response 201

══════════════════════════════════════════════════════
  LUỒNG 3: Báo cáo lỗi
══════════════════════════════════════════════════════
POST /api/support/bug-report
  { issue_type: "Lỗi âm thanh", description: "..." }
  (email lấy từ authMiddleware, user không cần nhập)
       ↓
supportController.submitBugReport()
  → Validate: issue_type có giá trị, description 10-2000 ký tự
       ↓
hubspotService.submitBugReportForm()
  → POST /submissions/v3/integration/submit/{portalId}/{formGuid}
    (Không cần access token — dùng portalId + formGuid)
    { fields: [email, firstname, issue_type, description], context: { pageUri } }
       ↓
Response 200: "Cảm ơn bạn đã báo cáo!"
```

---

## Hành vi khi thiếu cấu hình (Dev mode)

| Thiếu biến | Hành vi |
|---|---|
| `HUBSPOT_ACCESS_TOKEN` | `_callHubSpot()` log warn và trả về `{ skipped: true }` — không throw, không crash |
| `HUBSPOT_PORTAL_ID` hoặc `HUBSPOT_BUG_REPORT_FORM_GUID` | `submitBugReportForm()` log warn và trả về `{ skipped: true }` |
| `HUBSPOT_FRAUD_PIPELINE_ID` | Dùng giá trị mặc định `"0"` (Default pipeline HubSpot) |
| `FRAUD_TAB_SWITCH_THRESHOLD` | Ngưỡng mặc định `3` |

`upsertContact()` dùng `.catch()` khi được gọi từ authController — mọi lỗi HubSpot đều bị nuốt, không ảnh hưởng luồng đăng nhập. `createFraudTicket()` throw lỗi để controller trả 500 (fraud detection là nghiệp vụ quan trọng, cần biết khi thất bại).
