// Backend/src/workers/generationWorker.js
const { PubSub } = require("@google-cloud/pubsub");
const { PrismaClient } = require("@prisma/client");
const { translateText, searchImage } = require("../services/aiServices");

const pubsub = new PubSub({
  projectId: "flashcard-cloud-g12" // Điền chính xác ID dự án GCP của nhóm mày
});

const prisma = new PrismaClient();

const subscriptionName = "flashcard-generation-tasks-sub"; 

// Hàm bổ trợ: Tách văn bản thô thành danh sách các từ vựng độc lập (Bỏ dấu câu, viết thường)
function extractWords(text) {
  if (!text) return [];
  // Sử dụng Regex tách từ, loại bỏ ký tự đặc biệt và số
  const words = text.toLowerCase().match(/[a-zA-Z]+/g) || [];
  // Loại bỏ các từ trùng lặp bằng Set để tránh sinh trùng thẻ
  return [...new Set(words)];
}

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

      // 1. Trích xuất danh sách từ vựng từ văn bản thô
      const words = extractWords(text);
      console.log(`[Worker] 📝 Tìm thấy ${words.length} từ vựng độc lập cần xử lý.`);

      if (words.length === 0) {
        throw new Error("Không thể trích xuất được từ vựng nào từ văn bản đầu vào.");
      }

      // Giới hạn tối đa 20 từ cho mỗi bộ thẻ để tránh vượt quá hạn mức quota API free của Google
      const wordsToProcess = words.slice(0, 20);

      // 2. Vòng lặp xử lý từng từ để tạo Flashcard (Chạy tuần tự để kiểm soát luồng gọi API)
      for (const word of wordsToProcess) {
        let definition = "Chưa cập nhật";
        let imageUrl = null;

        // Nếu user tích chọn tự động dịch -> Gọi Google Translate API
        if (autoTranslate) {
          definition = await translateText(word);
        }

        // Gọi Google Custom Search API lấy ảnh minh họa
        imageUrl = await searchImage(word);

        // Giả lập tạo URL audio phát âm nếu user tích chọn (Tính năng Text-to-Speech làm ở bước sau)
        let audioUrl = autoAudio ? `https://dict.youdao.com/dictvoice?audio=${word}&type=2` : null;

        // =========================================================================
        // FIX TRIỆT ĐỂ: Xóa bỏ trường 'definition' thừa, chỉ giữ lại đúng Schema DB
        // =========================================================================
        await prisma.flashcard.create({
          data: {
            wordEn: word, 
            meaningVi: definition || "Không rõ nghĩa", // Dùng biến dịch gán vào cột meaningVi
            imageUrl: imageUrl || "https://via.placeholder.com/150?text=Error", 
            audioUrl: audioUrl || "", 
            deckId: deckId,
          }
        });
        // =========================================================================
                
        console.log(`   + Đã tạo thẻ: [${word}] -> [${definition}]`);
      }

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