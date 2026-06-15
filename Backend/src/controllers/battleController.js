const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");

// Đảm bảo Firebase Admin SDK được khởi tạo an toàn
try {
  if (!admin.apps || admin.apps.length === 0) {
    admin.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || "flashcard-cloud-g12-91bee",
    });
    console.log("[battleController] Khởi tạo Firebase Admin SDK thành công.");
  }
} catch (error) {
  console.error("[battleController] Lỗi khi khởi tạo Firebase Admin SDK:", error.message);
}

const db = getFirestore();

/**
 * POST /api/battle/submit-answer
 * Xử lý tính toán sát thương, HP, Combo của người chơi thời gian thực và đồng bộ lên Firestore
 */
exports.submitAnswer = async (req, res) => {
  try {
    const { pin, questionId, selectedAnswer, timeLeft } = req.body;
    const reqUserId = req.user.userId;
    const reqEmail = req.user.email;

    if (!pin) {
      return res.status(400).json({ success: false, message: "Thiếu mã PIN phòng đấu." });
    }

    const roomRef = db.collection("battles").doc(pin);
    const roomDoc = await roomRef.get();

    if (!roomDoc.exists) {
      return res.status(404).json({ success: false, message: "Không tìm thấy phòng đấu." });
    }

    const battleData = roomDoc.data();
    if (battleData.status !== "playing") {
      return res.status(400).json({ success: false, message: "Trận đấu không diễn ra." });
    }

    // 1. Xác định vai trò của người chơi (Host hay Guest)
    let role = null;
    if (battleData.hostId === reqUserId || (reqEmail && battleData.hostEmail === reqEmail)) {
      role = "host";
    } else if (battleData.guestId === reqUserId || (reqEmail && battleData.guestEmail === reqEmail)) {
      role = "guest";
    }

    if (!role) {
      return res.status(403).json({ success: false, message: "Bạn không thuộc phòng đấu này." });
    }

    // 2. Chống gửi đáp án trùng lặp cho cùng một câu hỏi hiện tại
    if (role === "host" && battleData.hostSelectedAnswer !== null) {
      return res.json({ success: true, message: "Đã ghi nhận câu trả lời trước đó." });
    }
    if (role === "guest" && battleData.guestSelectedAnswer !== null) {
      return res.json({ success: true, message: "Đã ghi nhận câu trả lời trước đó." });
    }

    const currentQuestionIndex = battleData.currentQuestionIndex;
    const currentQuestion = battleData.questions[currentQuestionIndex];
    if (!currentQuestion) {
      return res.status(400).json({ success: false, message: "Câu hỏi hiện tại không tồn tại." });
    }

    // 3. Tiến hành tính toán sát thương, HP và Combo
    const updateData = {};
    updateData.updatedAt = Date.now();

    if (role === "host") {
      updateData.hostSelectedAnswer = selectedAnswer;
      if (selectedAnswer === -1) {
        // Trường hợp hết thời gian (Không trả lời) -> Phạt trừ 100 HP, mất combo
        updateData.hostCombo = 0;
        updateData.hostHP = Math.max(0, (battleData.hostHP ?? 1000) - 100);
        updateData.hostDamageIndicator = "💥 -100";
      } else {
        const isCorrect = selectedAnswer === currentQuestion.correct;
        if (isCorrect) {
          // Trả lời đúng -> Tăng combo và trừ HP của đối thủ (Guest)
          const newCombo = (battleData.hostCombo ?? 0) + 1;
          updateData.hostCombo = newCombo;
          // Sát thương cơ bản: 50. Bonus thêm 25 sát thương cho mỗi cấp combo từ combo 2 trở đi.
          const damage = 50 + (newCombo > 1 ? (newCombo - 1) * 25 : 0);
          updateData.guestHP = Math.max(0, (battleData.guestHP ?? 1000) - damage);
          updateData.guestDamageIndicator = `-${damage}`;
        } else {
          // Trả lời sai -> Tự chịu phạt 25 HP, mất combo
          updateData.hostCombo = 0;
          updateData.hostHP = Math.max(0, (battleData.hostHP ?? 1000) - 25);
          updateData.hostDamageIndicator = "💥 -25";
        }
      }
    } else {
      updateData.guestSelectedAnswer = selectedAnswer;
      if (selectedAnswer === -1) {
        // Trường hợp hết thời gian (Không trả lời) -> Phạt trừ 100 HP, mất combo
        updateData.guestCombo = 0;
        updateData.guestHP = Math.max(0, (battleData.guestHP ?? 1000) - 100);
        updateData.guestDamageIndicator = "💥 -100";
      } else {
        const isCorrect = selectedAnswer === currentQuestion.correct;
        if (isCorrect) {
          // Trả lời đúng -> Tăng combo và trừ HP của đối thủ (Host)
          const newCombo = (battleData.guestCombo ?? 0) + 1;
          updateData.guestCombo = newCombo;
          // Sát thương cơ bản: 50. Bonus thêm 25 sát thương cho mỗi cấp combo từ combo 2 trở đi.
          const damage = 50 + (newCombo > 1 ? (newCombo - 1) * 25 : 0);
          updateData.hostHP = Math.max(0, (battleData.hostHP ?? 1000) - damage);
          updateData.hostDamageIndicator = `-${damage}`;
        } else {
          // Trả lời sai -> Tự chịu phạt 25 HP, mất combo
          updateData.guestCombo = 0;
          updateData.guestHP = Math.max(0, (battleData.guestHP ?? 1000) - 25);
          updateData.guestDamageIndicator = "💥 -25";
        }
      }
    }

    // 4. Cập nhật phòng đấu lên Firestore realtime
    await roomRef.update(updateData);
    console.log(`[battleController] Đồng bộ câu trả lời cho phòng #${pin} [Vai trò: ${role}, Đáp án: ${selectedAnswer}]`);

    return res.json({ success: true, message: "Tính toán và cập nhật sát thương thành công." });
  } catch (error) {
    console.error("[battleController] Lỗi submitAnswer:", error);
    return res.status(500).json({ success: false, message: "Lỗi Server Internal.", error: error.message });
  }
};

/**
 * POST /api/battle/send-email
 * Gửi báo cáo kết quả trận đấu tới email của 2 người chơi qua Resend API
 */
exports.sendEmail = async (req, res) => {
  try {
    const { pin } = req.body;
    if (!pin) {
      return res.status(400).json({ success: false, message: "Thiếu mã PIN phòng đấu." });
    }

    const roomRef = db.collection("battles").doc(pin);
    const roomDoc = await roomRef.get();

    if (!roomDoc.exists) {
      return res.status(404).json({ success: false, message: "Không tìm thấy phòng đấu." });
    }

    const battleData = roomDoc.data();
    const RESEND_API_KEY = process.env.RESEND_API_KEY;

    console.log(`[battleController] Chuẩn bị gửi email kết quả cho phòng #${pin}`);
    
    const recipients = [battleData.hostEmail, battleData.guestEmail].filter(Boolean);
    if (recipients.length === 0) {
      return res.status(400).json({ success: false, message: "Không tìm thấy email của người chơi nào." });
    }

    if (RESEND_API_KEY) {
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: "Võ Đài Flashcard <onboarding@resend.dev>",
            to: recipients,
            subject: `🏆 Kết Quả Trận Đấu Flashcard Realtime - Phòng #${pin}`,
            html: `
              <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 10px;">
                <h2 style="color: #4B0082; text-align: center; border-bottom: 2px solid #4B0082; padding-bottom: 10px;">🏆 Báo Cáo Kết Quả Đấu Trường Realtime 🏆</h2>
                <p>Xin chào các chiến binh, trận đấu tại đấu trường Flashcard <strong>phòng #${pin}</strong> đã kết thúc phân định thắng bại!</p>
                
                <table border="1" cellpadding="12" cellspacing="0" style="border-collapse: collapse; width: 100%; text-align: center; margin-top: 15px;">
                  <thead>
                    <tr style="background-color: #f2f2f2; font-weight: bold;">
                      <th>Người chơi</th>
                      <th>Email</th>
                      <th>HP Còn Lại</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>${battleData.hostName} (Host)</strong></td>
                      <td>${battleData.hostEmail || "Chưa thiết lập"}</td>
                      <td><span style="color: ${battleData.hostHP > 0 ? "#10B981" : "#EF4444"}; font-weight: bold; font-size: 16px;">${battleData.hostHP} HP</span></td>
                    </tr>
                    <tr>
                      <td><strong>${battleData.guestName} (Guest)</strong></td>
                      <td>${battleData.guestEmail || "Chưa thiết lập"}</td>
                      <td><span style="color: ${battleData.guestHP > 0 ? "#10B981" : "#EF4444"}; font-weight: bold; font-size: 16px;">${battleData.guestHP} HP</span></td>
                    </tr>
                  </tbody>
                </table>
                
                <div style="margin-top: 25px; padding: 15px; background-color: #f9f9f9; border-radius: 5px; text-align: center; font-weight: bold; color: #4B0082;">
                  ${
                    battleData.hostHP === battleData.guestHP
                      ? "🤝 KẾT QUẢ: HÒA NHAU! Hai chiến binh bất phân thắng bại!"
                      : battleData.hostHP > battleData.guestHP
                      ? `🎉 CHIẾN THẮNG THUỘC VỀ: ${battleData.hostName.toUpperCase()}!`
                      : `🎉 CHIẾN THẮNG THUỘC VỀ: ${battleData.guestName.toUpperCase()}!`
                  }
                </div>
                
                <p style="font-size: 11px; color: #777; margin-top: 30px; text-align: center; border-top: 1px solid #eee; padding-top: 10px;">
                  Hệ thống Đấu Trường Flashcard trực tuyến. Thiết kế bởi CKI Cloud Nhóm 12.
                </p>
              </div>
            `,
          }),
        });

        const resData = await response.json();
        if (response.ok) {
          console.log("[battleController] Gửi email qua Resend thành công:", resData);
          return res.json({ success: true, message: "Gửi báo cáo email kết quả thành công.", id: resData.id });
        } else {
          console.error("[battleController] Resend API trả về lỗi:", resData);
          return res.status(500).json({ success: false, message: "Không thể gửi email qua Resend.", error: resData });
        }
      } catch (err) {
        console.error("[battleController] Lỗi kết nối tới Resend API:", err);
        return res.status(500).json({ success: false, message: "Lỗi kết nối khi gửi email.", error: err.message });
      }
    } else {
      console.log("[battleController] [MOCK SEND] Không phát hiện RESEND_API_KEY. Đã giả lập gửi báo cáo thành công.");
      return res.json({ success: true, message: "Gửi email báo cáo thành công (Chế độ giả lập development)." });
    }
  } catch (error) {
    console.error("[battleController] Lỗi sendEmail:", error);
    return res.status(500).json({ success: false, message: "Lỗi Server Internal.", error: error.message });
  }
};
