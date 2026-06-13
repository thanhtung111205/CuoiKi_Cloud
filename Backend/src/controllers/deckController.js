// ====================================================
// CKI CLOUD G12 - DECK CONTROLLER (PRODUCTION VERSION)
// Xử lý logic nghiệp vụ cho việc tạo bộ flashcard
// ====================================================
// Kiến trúc Production:
//   - Nhận text từ client
//   - Tạo bản ghi Deck trong DB với trạng thái 'processing'
//   - Đẩy payload chứa deckId, text lên Google Cloud Pub/Sub
//   - Trả về response 202 Accepted ngay lập tức cho Client
// ====================================================

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { publishGenerationTask } = require("../services/pubsubService");

/**
 * POST /api/generate-deck
 * Tạo bộ flashcard từ văn bản đầu vào (Kiến trúc phi đồng bộ qua Pub/Sub)
 *
 * @param {Object} req.body
 * @param {string} req.body.text - Văn bản cần tạo flashcard
 * @param {boolean} req.body.autoTranslate - Tự động dịch sang tiếng Việt
 * @param {boolean} req.body.autoAudio - Tự động tạo audio phát âm (TTS)
 *
 * @returns {Object} response
 */
exports.generateDeck = async (req, res) => {
  try {
    const { text, autoTranslate, autoAudio } = req.body;

    // 1. --- Validate dữ liệu đầu vào nghiêm ngặt ---
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp văn bản (text) để tạo flashcard.",
        error: "MISSING_TEXT",
      });
    }

    // Kiểm tra độ dài văn bản để tránh overload hệ thống (Giới hạn tạm thời 5000 ký tự)
    if (text.length > 5000) {
      return res.status(400).json({
        success: false,
        message: "Văn bản quá dài! Vui lòng nhập dưới 5000 ký tự để hệ thống xử lý tối ưu.",
        error: "TEXT_TOO_LONG",
      });
    }

    // Kiểm tra sự tồn tại của thông tin User từ Middleware xác thực (Auth Middleware)
    if (!req.user || !req.user.userId) {
      return res.status(401).json({
        success: false,
        message: "Yêu cầu không hợp lệ. Bạn cần đăng nhập để thực hiện chức năng này.",
        error: "UNAUTHORIZED",
      });
    }

    let userId = req.user.userId;
    const email = req.user.email || "";

    console.log(`[DeckController] 🚀 Nhận yêu cầu sinh thẻ từ User: ${userId}`);
    console.log(`   📝 Text preview: "${text.substring(0, 60)}${text.length > 60 ? "..." : ""}"`);
    console.log(`   🌐 Dịch tự động: ${!!autoTranslate} | 🔊 Cấu hình Audio: ${!!autoAudio}`);

    // =========================================================================
    // FIX DỨT ĐIỂM 100%: Xử lý triệt để lỗi Unique Constraint Email đã tồn tại
    // =========================================================================
    try {
      const fallbackName = email ? email.split("@")[0] : "Google User";

      // Bước A: Kiểm tra xem email này đã được đăng ký dưới một ID nào khác chưa
      let existingUser = null;
      if (email) {
        existingUser = await prisma.user.findUnique({
          where: { email: email }
        });
      }

      if (existingUser) {
        // Nếu tìm thấy user có email này rồi, ta lấy luôn ID đang có trong DB của họ
        // Điều này giúp tránh việc chèn trùng email gây sập hệ thống
        userId = existingUser.id;
        console.log(`[Prisma Bảo Vệ] Tìm thấy User có sẵn qua Email. Sử dụng ID gốc trong DB: ${userId}`);
      } else {
        // Nếu hoàn toàn chưa có email này trong DB, kiểm tra tiếp theo ID
        const userById = await prisma.user.findUnique({
          where: { id: userId }
        });

        if (!userById) {
          // Chưa có cả ID lẫn Email -> Tiến hành tạo mới hoàn toàn một bản ghi mồi
          await prisma.user.create({
            data: {
              id: userId,
              email: email,
              fullName: fallbackName,
            },
          });
          console.log(`[Prisma Bảo Vệ] Đã tạo mới bản ghi User mồi thành công với ID: ${userId}`);
        }
      }
    } catch (userDbError) {
      console.error("🔥 Lỗi kiểm tra / đồng bộ User dưới DB:", userDbError.message);
      return res.status(500).json({
        success: false,
        message: "Không thể đồng bộ thông tin tài khoản của bạn với cơ sở dữ liệu.",
        error: userDbError.message
      });
    }
    // =========================================================================

    // Trích xuất tiêu đề tự động từ 30 ký tự đầu tiên của văn bản để làm tên bộ thẻ tạm thời
    const autoTitle = text.trim().substring(0, 30) + (text.length > 30 ? "..." : "");

    // 2. --- Lưu thông tin bộ thẻ tạm thời vào PostgreSQL qua Prisma ---
    // Đặt trạng thái ban đầu là 'processing' theo đúng thiết kế Schema hệ thống
    const newDeck = await prisma.deck.create({
      data: {
        title: `Bộ thẻ: ${autoTitle}`,
        description: "Bộ thẻ ghi nhớ được tạo tự động bởi AI",
        sourceText: text,
        status: "processing", 
        userId: userId, // Dùng userId đã được chuẩn hóa an toàn ở trên
      },
      // Sử dụng select để tối ưu hóa dữ liệu trả về, giảm tải băng thông và RAM hệ thống
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true
      }
    });

    // 3. --- Đẩy Task xử lý vào hàng đợi tin nhắn Google Cloud Pub/Sub ---
    // Gói toàn bộ payload thông tin cấu hình gửi đi để Cloud Function bóc tách và thực thi
    const taskPayload = {
      deckId: newDeck.id,
      text: text,
      autoTranslate: !!autoTranslate,
      autoAudio: !!autoAudio
    };

    await publishGenerationTask(taskPayload);
    
    console.log(`[DeckController] ✅ Đã đẩy Task của Deck ID [${newDeck.id}] lên Pub/Sub topic thành công.`);

    // 4. --- Trả về HTTP Status 202 Accepted ngay lập tức cho Client ---
    // Không bắt client đợi AI xử lý, Frontend sẽ nhận mã 202 và thực hiện Polling hoặc chờ WebSockets thông báo
    return res.status(202).json({
      success: true,
      message: "Hệ thống đã tiếp nhận yêu cầu và đang tiến hành tạo bộ flashcard tự động.",
      deckId: newDeck.id,
      status: newDeck.status,
      meta: {
        inputLength: text.length,
        autoTranslate: !!autoTranslate,
        autoAudio: !!autoAudio,
        acceptedAt: new Date().toISOString(),
        processingStyle: "Asynchronous via GCP Pub/Sub & Cloud Functions"
      }
    });

  } catch (error) {
    console.error("[DeckController] ❌ Lỗi nghiêm trọng tại hệ thống sinh dữ liệu Deck:", error);

    return res.status(500).json({
      success: false,
      message: "Đã xảy ra sự cố hệ thống trong quá trình tiếp nhận tạo bộ thẻ.",
      error: process.env.NODE_ENV === "development" ? error.message : "INTERNAL_SERVER_ERROR",
    });
  }
};