// Backend/src/workers/generationWorker.js
const { PubSub } = require("@google-cloud/pubsub");
const { PrismaClient } = require("@prisma/client");
const { translateTextBatch, searchImage, extractVocabulary, generateAudio } = require("../services/aiServices");

const pubsub = new PubSub({
  projectId: "flashcard-cloud-g12" // Điền chính xác ID dự án GCP của nhóm mày
});

const prisma = new PrismaClient();

const subscriptionName = "flashcard-generation-tasks-sub";

function startWorker() {
  const subscription = pubsub.subscription(subscriptionName);

  console.log(`[Worker] 🎧 Đang lắng nghe các task sinh thẻ từ Pub/Sub...`);

  subscription.on("message", async (message) => {
    console.log(`[Worker] 📩 Nhận được 1 Task mới! ID: ${message.id}`);

    let payload;

    // --- BƯỚC SỬA SỐ 1: BẢO VỆ CHỐNG SẬP KHI PARSE JSON VÀ FIX LỖI MESSAGE.DATA ---
    try {
      const rawData = message.data ? message.data.toString() : message.toString();
      payload = JSON.parse(rawData);
    } catch (parseError) {
      console.error(`[Worker] 🪲 Lỗi rác Pub/Sub hoặc sai định dạng JSON. Hủy tin nhắn để tránh vòng lặp lỗi.`, parseError.message);
      message.ack(); // Xác nhận xóa tin nhắn rác này trên GCP ngay lập tức
      return;
    }
    // --------------------------------------------------------------------------

    try {
      const { deckId, text, autoTranslate, autoAudio } = payload;

      console.log(`[Worker] ⚙️ Bắt đầu bóc tách từ vựng cho Deck ID: ${deckId}`);

      // 1. Trích xuất danh sách từ vựng từ văn bản thô qua Custom API
      const words = await extractVocabulary(text);
      console.log(`[Worker] 📝 Tìm thấy ${words.length} từ vựng độc lập cần xử lý.`);

      if (!words || words.length === 0) {
        throw new Error("Không thể trích xuất được từ vựng nào từ văn bản đầu vào.");
      }

      // Giới hạn tối đa 20 từ cho mỗi bộ thẻ
      const wordsToProcess = words.slice(0, 20);
      const flashcardsData = [];

      // 2. Thực hiện dịch thuật hàng loạt (Batch translation) để tránh lỗi query N+1
      let translatedWordsMap = {};
      if (autoTranslate && wordsToProcess.length > 0) {
        try {
          console.log(`[Worker] 🌐 Đang dịch hàng loạt ${wordsToProcess.length} từ...`);
          const translations = await translateTextBatch(wordsToProcess);
          wordsToProcess.forEach((word, idx) => {
            translatedWordsMap[word] = translations[idx] || "Không rõ nghĩa";
          });
        } catch (err) {
          console.error(`[Worker] ⚠️ Lỗi dịch hàng loạt:`, err.message);
        }
      }

      console.log(`[Worker] 🚀 Đang gọi API Sinh ảnh & TTS song song cho từng từ...`);
      
      const promises = wordsToProcess.map(async (word) => {
        try {
          const definition = translatedWordsMap[word] || (autoTranslate ? "Không rõ nghĩa" : "Chưa cập nhật");
          
          // Bỏ qua những từ không dịch được
          if (definition === "Không rõ nghĩa") {
            console.log(`[Worker] ⏭️ Bỏ qua từ "${word}" vì không dịch được.`);
            return null;
          }
          
          const [imageUrl, audioUrl] = await Promise.all([
            searchImage(word),
            autoAudio ? generateAudio(word) : Promise.resolve("")
          ]);

          return {
            wordEn: word,
            meaningVi: definition,
            imageUrl: imageUrl || "https://loremflickr.com/320/240/error",
            audioUrl: audioUrl || "",
            deckId: deckId,
          };
        } catch (wordError) {
          console.error(`[Worker] ⚠️ Lỗi khi xử lý từ "${word}":`, wordError.message);
          return null; 
        }
      });

      // Đợi tất cả Promise hoàn thành
      const results = await Promise.all(promises);
      
      // Lọc bỏ các từ bị lỗi hoặc không dịch được (return null ở trên)
      const validFlashcards = results.filter(card => card !== null);

      if (validFlashcards.length === 0) {
        throw new Error("Tất cả các từ vựng đều gặp lỗi khi xử lý API.");
      }

      // 3. Lưu mảng Flashcards vào Database bằng Prisma
      await prisma.flashcard.createMany({
        data: validFlashcards
      });
      
      console.log(`[Worker] 💾 Đã lưu thành công ${validFlashcards.length} thẻ vào database.`);

      // 4. --- XỬ LÝ XONG: CẬP NHẬT TRẠNG THÁI DECK SANG READY ---
      await prisma.deck.update({
        where: { id: deckId },
        data: { status: "ready" },
      });

      console.log(`[Worker] ✅ Hoàn thành trọn vẹn Deck ID: ${deckId}. Đã đổi trạng thái sang 'ready'.`);

      // Xác nhận với Pub/Sub để xóa tin nhắn khỏi hàng đợi, tránh xử lý lại
      message.ack();

    } catch (error) {
      console.error(`[Worker] ❌ Lỗi nghiêm trọng khi xử lý tin nhắn nội bộ:`, error);

      // Nếu lỗi, đổi trạng thái bộ thẻ sang 'failed' để thông báo trên giao diện Frontend
      if (payload && payload.deckId) {
        await prisma.deck.update({
          where: { id: payload.deckId },
          data: { status: "failed" },
        }).catch(err => console.error("Lỗi cập nhật trạng thái thất bại:", err));
      }

      // Báo lỗi với Pub/Sub để tin nhắn được giữ lại xử lý sau
      message.nack();
    }
  });

  subscription.on("error", (error) => {
    console.error(`[Worker] ⚠️ Lỗi Subscription phát sinh:`, error);
  });
}

module.exports = { startWorker };