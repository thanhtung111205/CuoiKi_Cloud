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
    const { title, text, autoTranslate, autoAudio } = req.body;

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
    const finalTitle = title && title.trim() ? title.trim() : `Bộ thẻ: ${autoTitle}`;

    // 2. --- Lưu thông tin bộ thẻ tạm thời vào PostgreSQL qua Prisma ---
    // Đặt trạng thái ban đầu là 'processing' theo đúng thiết kế Schema hệ thống
    const newDeck = await prisma.deck.create({
      data: {
        title: finalTitle,
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

/**
 * POST /api/decks
 * Tạo một bộ thẻ mới thủ công
 */
exports.createDeck = async (req, res) => {
  try {
    const { title, description } = req.body;
    const userId = req.user.userId;

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return res.status(400).json({ success: false, message: "Tiêu đề bộ thẻ không được để trống." });
    }

    const newDeck = await prisma.deck.create({
      data: {
        title: title.trim(),
        description: description ? description.trim() : null,
        userId: userId,
        status: "ready", // Tạo thủ công thì sẵn sàng luôn
      },
    });

    return res.status(201).json({ success: true, data: newDeck });
  } catch (error) {
    console.error("[DeckController] Error creating deck:", error);
    return res.status(500).json({ success: false, message: "Lỗi Server Internal", error: error.message });
  }
};

/**
 * GET /api/decks
 * Lấy danh sách bộ thẻ (có phân trang và lọc theo creatorId)
 */
exports.getDecks = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const creatorId = req.query.creatorId;
    
    if (page < 1 || limit < 1) {
      return res.status(400).json({ success: false, message: "Page hoặc limit không hợp lệ." });
    }

    const userId = req.user.userId;
    const skip = (page - 1) * limit;
    const whereCondition = creatorId ? { userId: creatorId } : { userId: userId };

    const [totalItems, decks] = await Promise.all([
      prisma.deck.count({ where: whereCondition }),
      prisma.deck.findMany({
        where: whereCondition,
        skip: skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { flashcards: true }
          },
          flashcards: {
            select: {
              id: true,
              progresses: {
                where: { userId: userId },
                select: { id: true }
              }
            }
          }
        }
      })
    ]);

    const totalPages = Math.ceil(totalItems / limit);

    // Tính toán tỷ lệ phần trăm tiến độ học (số thẻ đã học / tổng số thẻ)
    const decksWithProgress = decks.map(deck => {
      const totalCards = deck._count.flashcards;
      const studiedCards = deck.flashcards.filter(f => f.progresses.length > 0).length;
      const progressPercent = totalCards > 0 ? Math.round((studiedCards / totalCards) * 100) : 0;
      
      const { flashcards, ...cleanDeck } = deck;
      return {
        ...cleanDeck,
        progress: progressPercent
      };
    });

    return res.status(200).json({
      success: true,
      data: decksWithProgress,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalItems: totalItems,
        limit: limit
      }
    });
  } catch (error) {
    console.error("[DeckController] Error fetching decks:", error);
    return res.status(500).json({ success: false, message: "Lỗi Server Internal", error: error.message });
  }
};

/**
 * PUT /api/decks/:id
 * Cập nhật thông tin bộ thẻ
 */
exports.updateDeck = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description } = req.body;
    const userId = req.user.userId;

    const existingDeck = await prisma.deck.findUnique({ where: { id } });
    if (!existingDeck) {
      return res.status(404).json({ success: false, message: "Không tìm thấy bộ thẻ." });
    }

    // Kiểm tra quyền sở hữu
    if (existingDeck.userId !== userId) {
      return res.status(403).json({ success: false, message: "Bạn không có quyền sửa bộ thẻ này." });
    }

    const updatedDeck = await prisma.deck.update({
      where: { id },
      data: {
        title: title ? title.trim() : undefined,
        description: description !== undefined ? description : undefined,
      }
    });

    return res.status(200).json({ success: true, data: updatedDeck });
  } catch (error) {
    console.error("[DeckController] Error updating deck:", error);
    return res.status(500).json({ success: false, message: "Lỗi Server Internal", error: error.message });
  }
};

/**
 * DELETE /api/decks/:id
 * Xóa bộ thẻ
 */
exports.deleteDeck = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const existingDeck = await prisma.deck.findUnique({ where: { id } });
    if (!existingDeck) {
      return res.status(404).json({ success: false, message: "Không tìm thấy bộ thẻ." });
    }

    if (existingDeck.userId !== userId) {
      return res.status(403).json({ success: false, message: "Bạn không có quyền xóa bộ thẻ này." });
    }

    await prisma.deck.delete({
      where: { id }
    });

    return res.status(200).json({ success: true, message: "Xóa bộ thẻ thành công." });
  } catch (error) {
    console.error("[DeckController] Error deleting deck:", error);
    return res.status(500).json({ success: false, message: "Lỗi Server Internal", error: error.message });
  }
};

/**
 * GET /api/decks/:id
 * Lấy thông tin chi tiết một bộ thẻ
 */
exports.getDeckById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const deck = await prisma.deck.findUnique({
      where: { id },
      include: {
        _count: {
          select: { flashcards: true }
        },
        flashcards: {
          select: {
            id: true,
            progresses: {
              where: { userId: userId },
              select: { id: true }
            }
          }
        }
      }
    });

    if (!deck) {
      return res.status(404).json({ success: false, message: "Không tìm thấy bộ thẻ." });
    }

    if (deck.userId !== userId) {
      return res.status(403).json({ success: false, message: "Bạn không có quyền truy cập bộ thẻ này." });
    }

    // Tính toán tiến độ học tập
    const totalCards = deck._count.flashcards;
    const studiedCards = deck.flashcards.filter(f => f.progresses.length > 0).length;
    const progressPercent = totalCards > 0 ? Math.round((studiedCards / totalCards) * 100) : 0;

    const { flashcards, ...cleanDeck } = deck;
    const deckWithProgress = {
      ...cleanDeck,
      progress: progressPercent
    };

    return res.status(200).json({ success: true, data: deckWithProgress });
  } catch (error) {
    console.error("[DeckController] Error fetching deck:", error);
    return res.status(500).json({ success: false, message: "Lỗi Server Internal", error: error.message });
  }
};