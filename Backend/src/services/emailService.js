// ====================================================
// CKI CLOUD G12 - RESEND EMAIL SERVICE
// ====================================================

const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM_EMAIL || "no-reply@nhom12c365httt.live";

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
      console.error(`[Email Service] Resend API trả về lỗi:`, error);
      throw new Error(error.message);
    }

    console.log(`[Email Service] Gửi email thành công. ID: ${data.id} | Tới: ${to}`);
    return data;
  } catch (err) {
    console.error(`[Email Service] Lỗi kết nối Resend:`, err.message);
    throw err;
  }
}

// 1. Email xác nhận tài khoản
exports.sendAccountConfirmation = async (email, fullName) => {
  const subject = "Chào mừng bạn đến với CKI Flashcard!";
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px; color: #111827;">
      <h2 style="color: #4B0082; margin-bottom: 8px;">Chào mừng, ${fullName}!</h2>
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
        Bắt đầu học ngay
      </a>

      <p style="font-size: 11px; color: #9ca3af; margin-top: 32px; border-top: 1px solid #f3f4f6; padding-top: 16px;">
        CKI Cloud - Nhóm 12 | Hệ thống học ngoại ngữ thông minh
      </p>
    </div>
  `;

  return _send({ to: email, subject, html });
};

// 2. Email kết quả thi đấu
exports.sendBattleResult = async (battleData) => {
  const { hostName, hostEmail, hostHP, guestName, guestEmail, guestHP, pin } = battleData;

  const recipients = [hostEmail, guestEmail].filter(Boolean);
  if (recipients.length === 0) {
    throw new Error("Không có email người chơi nào để gửi.");
  }

  let resultBanner;
  if (hostHP === guestHP) {
    resultBanner = `HÒA NHAU! Hai chiến binh bất phân thắng bại!`;
  } else if (hostHP > guestHP) {
    resultBanner = `CHIẾN THẮNG: <strong>${hostName.toUpperCase()}</strong>!`;
  } else {
    resultBanner = `CHIẾN THẮNG: <strong>${guestName.toUpperCase()}</strong>!`;
  }

  const subject = `Kết Quả Trận Đấu Flashcard - Phòng #${pin}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px; color: #111827;">
      <h2 style="color: #4B0082; text-align: center; border-bottom: 2px solid #4B0082; padding-bottom: 12px;">
        Báo Cáo Kết Quả Đấu Trường Realtime
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

// 3. Email báo cáo tiến độ học tập
exports.sendStudyProgressReport = async (email, fullName, stats) => {
  const { totalDecks, totalCards, studiedCards, progressPercent, currentStreak } = stats;

  const subject = `Báo Cáo Tiến Độ Học Tập - ${fullName}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px; color: #111827;">
      <h2 style="color: #4B0082; margin-bottom: 4px;">Báo Cáo Tiến Độ Học Tập</h2>
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
          <div style="font-size: 28px; font-weight: bold; color: #ea580c;">${currentStreak}</div>
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
        Tiếp tục học
      </a>

      <p style="font-size: 11px; color: #9ca3af; margin-top: 24px; border-top: 1px solid #f3f4f6; padding-top: 12px;">
        CKI Cloud - Nhóm 12 | Hệ thống học ngoại ngữ thông minh
      </p>
    </div>
  `;

  return _send({ to: email, subject, html });
};

// 4. Email nhắc nhở ôn tập
exports.sendReviewReminderEmail = async (email, fullName, dueCards) => {
  const count = dueCards.length;

  const cardRows = dueCards
    .slice(0, 10)
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

  const subject = `Bạn có ${count} thẻ cần ôn tập hôm nay!`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px; color: #111827;">
      <h2 style="color: #4B0082; margin-bottom: 4px;">Đến Giờ Ôn Tập Rồi!</h2>
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
        Ôn tập ngay
      </a>

      <p style="font-size: 11px; color: #9ca3af; margin-top: 24px; border-top: 1px solid #f3f4f6; padding-top: 12px;">
        CKI Cloud - Nhóm 12 | Thuật toán lặp lại ngắt quãng SM-2
      </p>
    </div>
  `;

  return _send({ to: email, subject, html });
};
