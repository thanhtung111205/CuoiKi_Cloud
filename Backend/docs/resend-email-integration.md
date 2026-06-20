# Tích hợp Resend Email API

## Tổng quan

Resend là dịch vụ Email-as-a-Service (EaaS) dùng để gửi 4 loại email trong hệ thống:

| Loại email | Trigger | Endpoint |
|---|---|---|
| Xác nhận tài khoản | Sau khi `emailSignup` thành công | Tự động (không cần gọi riêng) |
| Kết quả thi đấu | FE gọi sau khi trận kết thúc | `POST /api/battle/send-email` |
| Báo cáo tiến độ học tập | FE gọi từ trang Dashboard | `POST /api/email/study-report` |
| Nhắc nhở ôn tập | FE gọi khi user vào trang Study | `POST /api/email/review-reminder` |

---

## Cấu hình môi trường

Thêm vào `Backend/.env`:

```env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=no-reply@nhom12c365httt.live
```

> Lấy API key tại [resend.com](https://resend.com) → Settings → API Keys.  
> `RESEND_FROM_EMAIL` phải dùng domain đã verify trong Resend dashboard.  
> Nếu thiếu `RESEND_API_KEY`, toàn bộ hàm gửi email sẽ log mock và không throw lỗi (giữ nguyên behavior hiện tại của `battleController`).

---

## Cài đặt package

```bash
cd Backend
npm install resend
```

> Dùng SDK chính thức thay vì `fetch` thủ công để có TypeScript types và retry tự động.

---

## Luồng triển khai

```
authController.emailSignup()
  └─ emailService.sendAccountConfirmation()  ← Gọi sau prisma.user.create()

battleController.sendEmail()
  └─ emailService.sendBattleResult()          ← Thay thế inline fetch hiện tại

emailController.sendStudyReport()             ← Controller mới
  └─ emailService.sendStudyProgressReport()

emailController.sendReviewReminder()          ← Controller mới
  └─ emailService.sendReviewReminderEmail()
```

---

## File 1: `Backend/src/services/emailService.js` (mới)

Tạo file này theo cấu trúc tương tự `r2Service.js` — một service thuần, không biết về Express req/res.

```js
// ====================================================
// CKI CLOUD G12 - RESEND EMAIL SERVICE
// Dịch vụ gửi email qua Resend API
// Hỗ trợ: xác nhận tài khoản, kết quả thi đấu,
//          báo cáo tiến độ học, nhắc nhở ôn tập
// ====================================================

const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM_EMAIL || "no-reply@nhom12c365httt.live";

// -----------------------------------------------
// Hàm nội bộ: Gửi email qua Resend SDK
// -----------------------------------------------
async function _send({ to, subject, html }) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;

  if (!RESEND_API_KEY) {
    console.log(`[Email Service] [MOCK] Không có RESEND_API_KEY. Giả lập gửi tới: ${to} | Chủ đề: "${subject}"`);
    return { id: "mock_id", mock: true };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    });

    if (error) {
      console.error(`[Email Service] ❌ Resend API trả về lỗi:`, error);
      throw new Error(error.message);
    }

    console.log(`[Email Service] ✅ Gửi email thành công. ID: ${data.id} | Tới: ${to}`);
    return data;
  } catch (err) {
    console.error(`[Email Service] ❌ Lỗi kết nối Resend:`, err.message);
    throw err;
  }
}

// -----------------------------------------------
// 1. Email xác nhận tài khoản
//    Gọi sau khi tạo user mới (emailSignup)
// -----------------------------------------------
exports.sendAccountConfirmation = async (email, fullName) => {
  const subject = "🎉 Chào mừng bạn đến với CKI Flashcard!";
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px; color: #111827;">
      <h2 style="color: #4B0082; margin-bottom: 8px;">Chào mừng, ${fullName}! 👋</h2>
      <p style="color: #6b7280;">Tài khoản của bạn đã được tạo thành công trên hệ thống <strong>CKI Flashcard</strong>.</p>

      <div style="background: #f5f3ff; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <p style="margin: 0; font-size: 14px;"><strong>Email đăng ký:</strong> ${email}</p>
      </div>

      <p style="font-size: 14px; color: #374151;">Bạn có thể bắt đầu:</p>
      <ul style="font-size: 14px; color: #374151; padding-left: 20px;">
        <li>Tạo bộ flashcard từ đoạn văn bất kỳ</li>
        <li>Học từ vựng với thuật toán lặp lại ngắt quãng SM-2</li>
        <li>Thách đấu với bạn bè tại Đấu Trường Flashcard</li>
      </ul>

      <a href="https://nhom12c365httt.live" style="display: inline-block; margin-top: 16px; padding: 12px 24px; background: #4B0082; color: white; text-decoration: none; border-radius: 8px; font-size: 14px;">
        Bắt đầu học ngay →
      </a>

      <p style="font-size: 11px; color: #9ca3af; margin-top: 32px; border-top: 1px solid #f3f4f6; padding-top: 16px;">
        CKI Cloud - Nhóm 12 | Hệ thống học ngoại ngữ thông minh
      </p>
    </div>
  `;

  return _send({ to: email, subject, html });
};

// -----------------------------------------------
// 2. Email kết quả thi đấu
//    Gọi từ battleController.sendEmail()
//    battleData: { hostName, hostEmail, hostHP, guestName, guestEmail, guestHP, pin }
// -----------------------------------------------
exports.sendBattleResult = async (battleData) => {
  const { hostName, hostEmail, hostHP, guestName, guestEmail, guestHP, pin } = battleData;

  const recipients = [hostEmail, guestEmail].filter(Boolean);
  if (recipients.length === 0) {
    throw new Error("Không có email người chơi nào để gửi.");
  }

  let resultBanner;
  if (hostHP === guestHP) {
    resultBanner = `🤝 HÒA NHAU! Hai chiến binh bất phân thắng bại!`;
  } else if (hostHP > guestHP) {
    resultBanner = `🎉 CHIẾN THẮNG: <strong>${hostName.toUpperCase()}</strong>!`;
  } else {
    resultBanner = `🎉 CHIẾN THẮNG: <strong>${guestName.toUpperCase()}</strong>!`;
  }

  const subject = `🏆 Kết Quả Trận Đấu Flashcard - Phòng #${pin}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px; color: #111827;">
      <h2 style="color: #4B0082; text-align: center; border-bottom: 2px solid #4B0082; padding-bottom: 12px;">
        🏆 Báo Cáo Kết Quả Đấu Trường Realtime
      </h2>
      <p style="text-align: center; color: #6b7280;">Phòng #${pin}</p>

      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
        <thead>
          <tr style="background: #f5f3ff;">
            <th style="padding: 12px; text-align: left; border: 1px solid #e5e7eb;">Người chơi</th>
            <th style="padding: 12px; text-align: center; border: 1px solid #e5e7eb;">Vai trò</th>
            <th style="padding: 12px; text-align: center; border: 1px solid #e5e7eb;">HP còn lại</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding: 12px; border: 1px solid #e5e7eb;"><strong>${hostName}</strong></td>
            <td style="padding: 12px; text-align: center; border: 1px solid #e5e7eb;">Host</td>
            <td style="padding: 12px; text-align: center; border: 1px solid #e5e7eb; color: ${hostHP > 0 ? "#10B981" : "#EF4444"}; font-weight: bold;">${hostHP} HP</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #e5e7eb;"><strong>${guestName}</strong></td>
            <td style="padding: 12px; text-align: center; border: 1px solid #e5e7eb;">Guest</td>
            <td style="padding: 12px; text-align: center; border: 1px solid #e5e7eb; color: ${guestHP > 0 ? "#10B981" : "#EF4444"}; font-weight: bold;">${guestHP} HP</td>
          </tr>
        </tbody>
      </table>

      <div style="background: #f5f3ff; border-radius: 8px; padding: 16px; text-align: center; font-size: 16px; font-weight: bold; color: #4B0082;">
        ${resultBanner}
      </div>

      <p style="font-size: 11px; color: #9ca3af; margin-top: 24px; text-align: center; border-top: 1px solid #f3f4f6; padding-top: 12px;">
        CKI Cloud - Nhóm 12 | Đấu trường Flashcard trực tuyến
      </p>
    </div>
  `;

  return _send({ to: recipients, subject, html });
};

// -----------------------------------------------
// 3. Email báo cáo tiến độ học tập
//    stats: { totalDecks, totalCards, studiedCards, progressPercent, currentStreak }
// -----------------------------------------------
exports.sendStudyProgressReport = async (email, fullName, stats) => {
  const { totalDecks, totalCards, studiedCards, progressPercent, currentStreak } = stats;

  const subject = `📊 Báo Cáo Tiến Độ Học Tập - ${fullName}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px; color: #111827;">
      <h2 style="color: #4B0082; margin-bottom: 4px;">📊 Báo Cáo Tiến Độ Học Tập</h2>
      <p style="color: #6b7280; margin-top: 0;">Xin chào <strong>${fullName}</strong>! Đây là tóm tắt quá trình học của bạn.</p>

      <div style="display: flex; gap: 12px; margin: 20px 0; flex-wrap: wrap;">
        <div style="flex: 1; min-width: 120px; background: #f5f3ff; border-radius: 8px; padding: 16px; text-align: center;">
          <div style="font-size: 28px; font-weight: bold; color: #4B0082;">${totalDecks}</div>
          <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">Bộ thẻ</div>
        </div>
        <div style="flex: 1; min-width: 120px; background: #f0fdf4; border-radius: 8px; padding: 16px; text-align: center;">
          <div style="font-size: 28px; font-weight: bold; color: #16a34a;">${studiedCards}/${totalCards}</div>
          <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">Thẻ đã học</div>
        </div>
        <div style="flex: 1; min-width: 120px; background: #fff7ed; border-radius: 8px; padding: 16px; text-align: center;">
          <div style="font-size: 28px; font-weight: bold; color: #ea580c;">${currentStreak} 🔥</div>
          <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">Chuỗi ngày</div>
        </div>
      </div>

      <div style="background: #f3f4f6; border-radius: 8px; padding: 12px; margin-bottom: 20px;">
        <div style="font-size: 13px; color: #374151; margin-bottom: 6px;">Tiến độ tổng thể</div>
        <div style="background: #e5e7eb; border-radius: 4px; height: 12px; overflow: hidden;">
          <div style="background: #4B0082; width: ${progressPercent}%; height: 100%; border-radius: 4px;"></div>
        </div>
        <div style="font-size: 12px; color: #6b7280; text-align: right; margin-top: 4px;">${progressPercent}%</div>
      </div>

      <a href="https://nhom12c365httt.live" style="display: inline-block; padding: 12px 24px; background: #4B0082; color: white; text-decoration: none; border-radius: 8px; font-size: 14px;">
        Tiếp tục học →
      </a>

      <p style="font-size: 11px; color: #9ca3af; margin-top: 24px; border-top: 1px solid #f3f4f6; padding-top: 12px;">
        CKI Cloud - Nhóm 12 | Hệ thống học ngoại ngữ thông minh
      </p>
    </div>
  `;

  return _send({ to: email, subject, html });
};

// -----------------------------------------------
// 4. Email nhắc nhở ôn tập
//    dueCards: [{ wordEn, meaningVi }] — danh sách thẻ đến hạn ôn
// -----------------------------------------------
exports.sendReviewReminderEmail = async (email, fullName, dueCards) => {
  const count = dueCards.length;

  const cardRows = dueCards
    .slice(0, 10) // Hiển thị tối đa 10 thẻ trong email
    .map(
      (card) => `
      <tr>
        <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-weight: 500;">${card.wordEn}</td>
        <td style="padding: 10px 12px; border: 1px solid #e5e7eb; color: #6b7280;">${card.meaningVi}</td>
      </tr>`
    )
    .join("");

  const moreText =
    count > 10
      ? `<p style="font-size: 13px; color: #9ca3af; text-align: center;">... và ${count - 10} thẻ khác</p>`
      : "";

  const subject = `⏰ Bạn có ${count} thẻ cần ôn tập hôm nay!`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px; color: #111827;">
      <h2 style="color: #4B0082; margin-bottom: 4px;">⏰ Đến Giờ Ôn Tập Rồi!</h2>
      <p style="color: #6b7280; margin-top: 0;">
        Chào <strong>${fullName}</strong>! Có <strong style="color: #4B0082;">${count} thẻ</strong> đang chờ bạn ôn tập theo lịch trình SM-2.
      </p>

      <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">
        <thead>
          <tr style="background: #f5f3ff;">
            <th style="padding: 10px 12px; text-align: left; border: 1px solid #e5e7eb;">Từ vựng</th>
            <th style="padding: 10px 12px; text-align: left; border: 1px solid #e5e7eb;">Nghĩa tiếng Việt</th>
          </tr>
        </thead>
        <tbody>
          ${cardRows}
        </tbody>
      </table>
      ${moreText}

      <a href="https://nhom12c365httt.live/study" style="display: inline-block; margin-top: 8px; padding: 12px 24px; background: #4B0082; color: white; text-decoration: none; border-radius: 8px; font-size: 14px;">
        Ôn tập ngay →
      </a>

      <p style="font-size: 11px; color: #9ca3af; margin-top: 24px; border-top: 1px solid #f3f4f6; padding-top: 12px;">
        CKI Cloud - Nhóm 12 | Thuật toán lặp lại ngắt quãng SM-2
      </p>
    </div>
  `;

  return _send({ to: email, subject, html });
};
```

---

## File 2: `Backend/src/controllers/emailController.js` (mới)

```js
// ====================================================
// CKI CLOUD G12 - EMAIL CONTROLLER
// Xử lý các route gửi email thủ công từ FE
// ====================================================

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const emailService = require("../services/emailService");

/**
 * POST /api/email/study-report
 * Gửi báo cáo tiến độ học tập tới email người dùng hiện tại
 */
exports.sendStudyReport = async (req, res) => {
  try {
    const userId = req.user.userId;
    const email = req.user.email;

    // Lấy thông tin user và tổng hợp tiến độ học tập
    const [user, totalDecks, flashcardStats] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.deck.count({ where: { userId } }),
      prisma.flashcard.findMany({
        where: { deck: { userId } },
        select: {
          id: true,
          wordEn: true,
          progresses: {
            where: { userId },
            select: { id: true }
          }
        }
      })
    ]);

    if (!user) {
      return res.status(404).json({ success: false, message: "Không tìm thấy người dùng." });
    }

    const totalCards = flashcardStats.length;
    const studiedCards = flashcardStats.filter(f => f.progresses.length > 0).length;
    const progressPercent = totalCards > 0 ? Math.round((studiedCards / totalCards) * 100) : 0;

    await emailService.sendStudyProgressReport(email, user.fullName, {
      totalDecks,
      totalCards,
      studiedCards,
      progressPercent,
      currentStreak: user.currentStreak,
    });

    return res.status(200).json({
      success: true,
      message: `Đã gửi báo cáo tiến độ tới ${email}.`,
    });
  } catch (error) {
    console.error("[EmailController] Lỗi gửi study report:", error);
    return res.status(500).json({ success: false, message: "Lỗi Server Internal", error: error.message });
  }
};

/**
 * POST /api/email/review-reminder
 * Gửi email nhắc nhở các thẻ đến hạn ôn tập hôm nay
 */
exports.sendReviewReminder = async (req, res) => {
  try {
    const userId = req.user.userId;
    const email = req.user.email;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ success: false, message: "Không tìm thấy người dùng." });
    }

    // Lấy các thẻ có nextReviewDate <= hôm nay
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const dueProgresses = await prisma.studyProgress.findMany({
      where: {
        userId,
        nextReviewDate: { lte: today },
      },
      include: {
        card: {
          select: { wordEn: true, meaningVi: true }
        }
      }
    });

    if (dueProgresses.length === 0) {
      return res.status(200).json({
        success: true,
        message: "Không có thẻ nào cần ôn tập hôm nay. Không gửi email.",
        count: 0,
      });
    }

    const dueCards = dueProgresses.map(p => ({
      wordEn: p.card.wordEn,
      meaningVi: p.card.meaningVi,
    }));

    await emailService.sendReviewReminderEmail(email, user.fullName, dueCards);

    return res.status(200).json({
      success: true,
      message: `Đã gửi nhắc nhở ${dueCards.length} thẻ ôn tập tới ${email}.`,
      count: dueCards.length,
    });
  } catch (error) {
    console.error("[EmailController] Lỗi gửi review reminder:", error);
    return res.status(500).json({ success: false, message: "Lỗi Server Internal", error: error.message });
  }
};
```

---

## File 3: Chỉnh sửa các file hiện tại

### `Backend/src/controllers/authController.js`

Sau dòng `prisma.user.create(...)` thành công trong `emailSignup`, thêm:

```js
// Vị trí: exports.emailSignup, sau khi user được tạo và trước khi ký JWT
// Khoảng dòng 369 (sau prisma.user.create)

const emailService = require("../services/emailService");

// Gửi email xác nhận tài khoản bất đồng bộ, không chặn response
emailService.sendAccountConfirmation(user.email, user.fullName).catch((err) => {
  console.warn("[Auth Signup] Không thể gửi email xác nhận:", err.message);
});
```

> Dùng `.catch()` thay vì `await` để không làm chậm response signup nếu Resend API chậm.

### `Backend/src/controllers/battleController.js`

Thay thế toàn bộ khối `if (RESEND_API_KEY) { ... }` trong `sendEmail` bằng:

```js
// Vị trí: exports.sendEmail, thay thế từ dòng 163 đến hết if/else
const emailService = require("../services/emailService");

await emailService.sendBattleResult({
  pin,
  hostName: battleData.hostName,
  hostEmail: battleData.hostEmail,
  hostHP: battleData.hostHP,
  guestName: battleData.guestName,
  guestEmail: battleData.guestEmail,
  guestHP: battleData.guestHP,
});

return res.json({ success: true, message: "Gửi báo cáo email kết quả thành công." });
```

### `Backend/src/routes/api.js`

Thêm vào cuối file (trước `module.exports`):

```js
const emailController = require("../controllers/emailController");

// -----------------------------------------------
// EMAIL ROUTES
// -----------------------------------------------
router.post("/email/study-report", authMiddleware, emailController.sendStudyReport);
router.post("/email/review-reminder", authMiddleware, emailController.sendReviewReminder);
```

---

## Tóm tắt các endpoint mới

| Method | Path | Auth | Mô tả |
|---|---|---|---|
| `POST` | `/api/email/study-report` | ✅ JWT | Gửi báo cáo tiến độ học của user hiện tại |
| `POST` | `/api/email/review-reminder` | ✅ JWT | Gửi nhắc nhở thẻ đến hạn ôn tập |
| `POST` | `/api/battle/send-email` | ✅ JWT | Gửi kết quả trận đấu (đã có, refactor dùng emailService) |

Email xác nhận tài khoản không có endpoint riêng — được gọi tự động bên trong `emailSignup`.

---

## Luồng dữ liệu tổng hợp

```
[1. Đăng ký tài khoản]
POST /api/auth/email-signup
  → authController.emailSignup()
  → prisma.user.create()
  → emailService.sendAccountConfirmation()  ← async, không block
  → Response 201

[2. Kết quả thi đấu]
POST /api/battle/send-email { pin }
  → battleController.sendEmail()
  → Firestore: db.collection("battles").doc(pin).get()
  → emailService.sendBattleResult(battleData)
  → Response 200

[3. Báo cáo tiến độ]
POST /api/email/study-report  (Authorization: Bearer <token>)
  → authMiddleware  →  emailController.sendStudyReport()
  → prisma: count decks + tổng hợp flashcard/progress
  → emailService.sendStudyProgressReport(email, fullName, stats)
  → Response 200

[4. Nhắc nhở ôn tập]
POST /api/email/review-reminder  (Authorization: Bearer <token>)
  → authMiddleware  →  emailController.sendReviewReminder()
  → prisma: studyProgress where nextReviewDate <= today
  → emailService.sendReviewReminderEmail(email, fullName, dueCards)
  → Response 200 (kể cả khi count = 0, không gửi email)
```
