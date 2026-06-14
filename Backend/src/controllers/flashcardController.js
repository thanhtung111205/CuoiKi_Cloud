const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const aiServices = require("../services/aiServices");

/**
 * POST /api/flashcards
 * Tạo flashcard mới trong một deck cụ thể
 */
exports.createFlashcard = async (req, res) => {
  try {
    const { deckId, front_text, back_text, image_url, audio_url } = req.body;
    const userId = req.user.userId;

    if (!deckId || !front_text || !back_text) {
      return res.status(400).json({ 
        success: false, 
        message: "Thiếu thông tin bắt buộc: deckId, front_text hoặc back_text." 
      });
    }

    // Kiểm tra Deck có tồn tại và thuộc quyền sở hữu của user không
    const deck = await prisma.deck.findUnique({ where: { id: deckId } });
    if (!deck) {
      return res.status(404).json({ success: false, message: "Không tìm thấy bộ thẻ." });
    }
    if (deck.userId !== userId) {
      return res.status(403).json({ success: false, message: "Bạn không có quyền thêm thẻ vào bộ này." });
    }

    const newFlashcard = await prisma.flashcard.create({
      data: {
        deckId: deckId,
        wordEn: front_text,
        meaningVi: back_text,
        imageUrl: image_url || null,
        audioUrl: audio_url || null,
      }
    });

    return res.status(201).json({ success: true, data: newFlashcard });
  } catch (error) {
    console.error("[FlashcardController] Error creating flashcard:", error);
    return res.status(500).json({ success: false, message: "Lỗi Server Internal", error: error.message });
  }
};

/**
 * GET /api/decks/:id/flashcards
 * Lấy danh sách flashcards của một deck (có phân trang)
 */
exports.getFlashcardsByDeck = async (req, res) => {
  try {
    const { id: deckId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    if (page < 1 || limit < 1) {
      return res.status(400).json({ success: false, message: "Page hoặc limit không hợp lệ." });
    }

    // Kiểm tra bộ thẻ có tồn tại
    const deck = await prisma.deck.findUnique({ where: { id: deckId } });
    if (!deck) {
      return res.status(404).json({ success: false, message: "Không tìm thấy bộ thẻ." });
    }

    const skip = (page - 1) * limit;

    const [totalItems, flashcards] = await Promise.all([
      prisma.flashcard.count({ where: { deckId } }),
      prisma.flashcard.findMany({
        where: { deckId },
        skip: skip,
        take: limit,
        orderBy: { createdAt: 'asc' }
      })
    ]);

    const totalPages = Math.ceil(totalItems / limit);

    return res.status(200).json({
      success: true,
      data: flashcards,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalItems: totalItems,
        limit: limit
      }
    });
  } catch (error) {
    console.error("[FlashcardController] Error fetching flashcards:", error);
    return res.status(500).json({ success: false, message: "Lỗi Server Internal", error: error.message });
  }
};

/**
 * PUT /api/flashcards/:id
 * Cập nhật flashcard
 */
exports.updateFlashcard = async (req, res) => {
  try {
    const { id } = req.params;
    const { front_text, back_text, image_url, audio_url } = req.body;
    const userId = req.user.userId;

    const existingCard = await prisma.flashcard.findUnique({ 
      where: { id },
      include: { deck: true }
    });

    if (!existingCard) {
      return res.status(404).json({ success: false, message: "Không tìm thấy flashcard." });
    }

    // Kiểm tra quyền (chỉ chủ bộ thẻ mới được sửa)
    if (existingCard.deck.userId !== userId) {
      return res.status(403).json({ success: false, message: "Bạn không có quyền sửa flashcard này." });
    }

    const updatedCard = await prisma.flashcard.update({
      where: { id },
      data: {
        wordEn: front_text !== undefined ? front_text : undefined,
        meaningVi: back_text !== undefined ? back_text : undefined,
        imageUrl: image_url !== undefined ? image_url : undefined,
        audioUrl: audio_url !== undefined ? audio_url : undefined,
      }
    });

    return res.status(200).json({ success: true, data: updatedCard });
  } catch (error) {
    console.error("[FlashcardController] Error updating flashcard:", error);
    return res.status(500).json({ success: false, message: "Lỗi Server Internal", error: error.message });
  }
};

/**
 * DELETE /api/flashcards/:id
 * Xóa flashcard
 */
exports.deleteFlashcard = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const existingCard = await prisma.flashcard.findUnique({ 
      where: { id },
      include: { deck: true }
    });

    if (!existingCard) {
      return res.status(404).json({ success: false, message: "Không tìm thấy flashcard." });
    }

    if (existingCard.deck.userId !== userId) {
      return res.status(403).json({ success: false, message: "Bạn không có quyền xóa flashcard này." });
    }

    await prisma.flashcard.delete({
      where: { id }
    });

    return res.status(200).json({ success: true, message: "Xóa flashcard thành công." });
  } catch (error) {
    console.error("[FlashcardController] Error deleting flashcard:", error);
    return res.status(500).json({ success: false, message: "Lỗi Server Internal", error: error.message });
  }
};

/**
 * POST /api/flashcards/:id/review
 * Lưu tiến độ học tập (Spaced Repetition SM-2) của một thẻ
 */
exports.reviewFlashcard = async (req, res) => {
  try {
    const { id: flashcardId } = req.params;
    const { rating } = req.body; // 'hard', 'good', 'easy'
    const userId = req.user.userId;

    if (!['hard', 'good', 'easy'].includes(rating)) {
      return res.status(400).json({ success: false, message: "Đánh giá không hợp lệ (yêu cầu: 'hard', 'good', 'easy')." });
    }

    const card = await prisma.flashcard.findUnique({ where: { id: flashcardId } });
    if (!card) {
      return res.status(404).json({ success: false, message: "Không tìm thấy thẻ học." });
    }

    // Lấy hoặc khởi tạo tiến độ học tập
    let progress = await prisma.studyProgress.findUnique({
      where: {
        userId_flashcardId: { userId, flashcardId }
      }
    });

    let interval = 1;
    let repetition = 0;
    let easeFactor = 2.5;

    if (progress) {
      interval = progress.interval;
      repetition = progress.repetition;
      easeFactor = progress.easeFactor;
    }

    // Thuật toán SM-2 rút gọn
    if (rating === 'hard') {
      repetition = 0;
      interval = 1; // Ôn tập lại vào ngày mai
      easeFactor = Math.max(1.3, easeFactor - 0.2);
    } else if (rating === 'good') {
      repetition += 1;
      if (repetition === 1) interval = 1;
      else if (repetition === 2) interval = 3;
      else interval = Math.round(interval * easeFactor);
    } else if (rating === 'easy') {
      repetition += 1;
      if (repetition === 1) interval = 3;
      else if (repetition === 2) interval = 7;
      else interval = Math.round(interval * easeFactor * 1.2);
      easeFactor = Math.min(3.0, easeFactor + 0.15);
    }

    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + interval);

    const updatedProgress = await prisma.studyProgress.upsert({
      where: {
        userId_flashcardId: { userId, flashcardId }
      },
      update: {
        interval,
        repetition,
        easeFactor,
        nextReviewDate,
        lastReviewedAt: new Date(),
      },
      create: {
        userId,
        flashcardId,
        interval,
        repetition,
        easeFactor,
        nextReviewDate,
      }
    });

    return res.status(200).json({
      success: true,
      message: "Lưu tiến độ học tập thành công.",
      data: updatedProgress
    });
  } catch (error) {
    console.error("[FlashcardController] Error reviewing flashcard:", error);
    return res.status(500).json({ success: false, message: "Lỗi Server Internal", error: error.message });
  }
};

/**
 * POST /api/flashcards/generate-single
 * Tạo thẻ thủ công: Nhập 1 từ tiếng Anh → tự động sinh nghĩa, audio, ảnh
 */
exports.generateSingleFlashcard = async (req, res) => {
  try {
    const { deckId, word } = req.body;
    const userId = req.user.userId;

    if (!deckId || !word || !word.trim()) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin bắt buộc: deckId hoặc word."
      });
    }

    // Kiểm tra Deck có tồn tại và thuộc quyền sở hữu của user
    const deck = await prisma.deck.findUnique({ where: { id: deckId } });
    if (!deck) {
      return res.status(404).json({ success: false, message: "Không tìm thấy bộ thẻ." });
    }
    if (deck.userId !== userId) {
      return res.status(403).json({ success: false, message: "Bạn không có quyền thêm thẻ vào bộ này." });
    }

    const trimmedWord = word.trim();

    // Gọi song song các dịch vụ AI để tối ưu thời gian
    const [meaningVi, audioUrl, imageUrl] = await Promise.all([
      aiServices.translateText(trimmedWord),
      aiServices.generateAudio(trimmedWord),
      aiServices.searchImage(trimmedWord),
    ]);

    // Lưu flashcard mới vào database
    const newFlashcard = await prisma.flashcard.create({
      data: {
        deckId: deckId,
        wordEn: trimmedWord,
        meaningVi: meaningVi,
        audioUrl: audioUrl || null,
        imageUrl: imageUrl || null,
      }
    });

    console.log(`[FlashcardController] ✅ Tạo thẻ thủ công: "${trimmedWord}" → "${meaningVi}"`);

    return res.status(201).json({
      success: true,
      message: `Đã tạo thẻ "${trimmedWord}" thành công.`,
      data: newFlashcard
    });
  } catch (error) {
    console.error("[FlashcardController] Error generating single flashcard:", error);
    return res.status(500).json({ success: false, message: "Lỗi Server Internal", error: error.message });
  }
};
