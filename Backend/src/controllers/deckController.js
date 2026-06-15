// ====================================================
// CKI CLOUD G12 - DECK CONTROLLER
// Xử lý logic nghiệp vụ cho việc tạo bộ flashcard
// ====================================================
// Kiến trúc MVP: Trả về dữ liệu mẫu (mock data)
// Kiến trúc Production:
//   - Nhận text từ client
//   - Đẩy vào Google Cloud Pub/Sub
//   - Cloud Functions xử lý: gọi Translation API → TTS API
//   - Lưu kết quả vào Firestore
//   - Trả về kết quả hoặc thông báo qua WebSocket
// ====================================================

/**
 * POST /api/generate-deck
 * Tạo bộ flashcard từ văn bản đầu vào
 *
 * @param {Object} req.body
 * @param {string} req.body.text - Văn bản cần tạo flashcard
 * @param {boolean} req.body.autoTranslate - Tự động dịch sang tiếng Việt
 * @param {boolean} req.body.autoAudio - Tự động tạo audio phát âm (TTS)
 *
 * @returns {Object} response
 * @returns {boolean} response.success - Trạng thái xử lý
 * @returns {string} response.message - Thông báo kết quả
 * @returns {Object} response.meta - Thông tin cấu hình đã dùng
 * @returns {Array} response.deck - Mảng flashcard đã tạo
 */
exports.generateDeck = async (req, res) => {
  try {
    const { text, autoTranslate, autoAudio } = req.body;

    // --- Validate đầu vào ---
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp văn bản (text) để tạo flashcard.",
        error: "MISSING_TEXT",
      });
    }

    console.log("[DeckController] Nhận yêu cầu tạo deck:");
    console.log(`  📝 Text: "${text.substring(0, 100)}${text.length > 100 ? "..." : ""}"`);
    console.log(`  🌐 Auto Translate: ${autoTranslate}`);
    console.log(`  🔊 Auto Audio: ${autoAudio}`);

    // -----------------------------------------------
    // MOCK: Giả lập thời gian xử lý 2 giây
    // Thực tế sẽ đẩy vào Pub/Sub và xử lý bằng Cloud Functions
    // Flow thực tế:
    //   1. Client gửi text → Backend API
    //   2. Backend publish message lên Pub/Sub topic "generate-deck"
    //   3. Cloud Function subscribe topic, xử lý:
    //      a. Tách từ vựng từ text (NLP)
    //      b. Gọi Google Cloud Translation API dịch từng từ
    //      c. Gọi Google Cloud Text-to-Speech API tạo audio
    //      d. Lưu audio vào Cloud Storage
    //      e. Lưu flashcard data vào Firestore
    //   4. Client nhận kết quả qua WebSocket hoặc polling
    // -----------------------------------------------
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // --- Dữ liệu flashcard mẫu (Mock Data) ---
    const mockDeck = [
      {
        id: "card_001",
        word: "Ecosystem",
        meaning: "Hệ sinh thái",
        pronunciation: "/ˈiːkoʊˌsɪstəm/",
        example: "The coral reef is a diverse ecosystem.",
        audioUrl: autoAudio ? "/audio/ecosystem.mp3" : null,
      },
      {
        id: "card_002",
        word: "Vocabulary",
        meaning: "Từ vựng",
        pronunciation: "/voʊˈkæbjʊˌlɛri/",
        example: "Building vocabulary is essential for language learning.",
        audioUrl: autoAudio ? "/audio/vocabulary.mp3" : null,
      },
      {
        id: "card_003",
        word: "Flashcard",
        meaning: "Thẻ ghi nhớ",
        pronunciation: "/ˈflæʃˌkɑːrd/",
        example: "Flashcards are a great tool for memorization.",
        audioUrl: autoAudio ? "/audio/flashcard.mp3" : null,
      },
      {
        id: "card_004",
        word: "Competition",
        meaning: "Cuộc thi đấu",
        pronunciation: "/ˌkɑːmpəˈtɪʃən/",
        example: "The competition was fierce but fair.",
        audioUrl: autoAudio ? "/audio/competition.mp3" : null,
      },
      {
        id: "card_005",
        word: "Translation",
        meaning: "Bản dịch / Sự phiên dịch",
        pronunciation: "/trænzˈleɪʃən/",
        example: "Machine translation has improved significantly.",
        audioUrl: autoAudio ? "/audio/translation.mp3" : null,
      },
    ];

    // --- Trả về kết quả ---
    console.log(`[DeckController] ✅ Đã tạo ${mockDeck.length} flashcard`);

    return res.status(200).json({
      success: true,
      message: `Đã tạo thành công ${mockDeck.length} flashcard từ văn bản.`,
      meta: {
        inputLength: text.length,
        autoTranslate: !!autoTranslate,
        autoAudio: !!autoAudio,
        generatedAt: new Date().toISOString(),
        processingNote: "Mock data - Thực tế sẽ đẩy vào Pub/Sub và xử lý bằng Cloud Functions",
      },
      deck: mockDeck,
    });
  } catch (error) {
    console.error("[DeckController] ❌ Lỗi tạo deck:", error);

    return res.status(500).json({
      success: false,
      message: "Đã xảy ra lỗi khi tạo flashcard. Vui lòng thử lại.",
      error: process.env.NODE_ENV === "development" ? error.message : "INTERNAL_SERVER_ERROR",
    });
  }
};
