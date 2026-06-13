// Backend/scripts/testSmartDeck.js

// Lấy biến môi trường nếu cần thiết
require('dotenv').config();

const { 
  extractVocabulary, 
  translateText, 
  generateAudio,
  searchImage
} = require('../src/services/aiServices');

/**
 * Script mô phỏng luồng gọi 3 API của Smart Deck:
 * 1. Bóc tách từ vựng (Custom API)
 * 2. Dịch tiếng Việt (Google Translation)
 * 3. Tạo Audio & Upload (Google TTS + Cloudflare R2 Mock)
 */
async function testSmartDeckFlow() {
  console.log("==========================================");
  console.log("🚀 BẮT ĐẦU TEST LUỒNG SMART DECK API");
  console.log("==========================================\n");

  const sampleText = "The quick brown fox jumps over the lazy dog. Programming is fun!";
  console.log(`[Input Text] "${sampleText}"\n`);

  try {
    // 1. Test Bóc tách văn bản
    console.log("▶ Bước 1: Test Bóc tách từ vựng (Custom API Mock)...");
    const words = await extractVocabulary(sampleText);
    
    if (!words || words.length === 0) {
      console.log("❌ Không bóc tách được từ vựng nào.");
      return;
    }
    console.log(`✅ Kết quả (lấy 5 từ đầu): [${words.join(', ')}]\n`);

    // 2. Test song song Translation & TTS & Image Search
    console.log("▶ Bước 2: Test Dịch thuật & TTS & Image Search (Promise.all)...");
    const promises = words.map(async (word) => {
      try {
        console.log(`  ⏳ Đang xử lý từ: "${word}"...`);
        const [definition, audioUrl, imageUrl] = await Promise.all([
          translateText(word),
          generateAudio(word),
          searchImage(word)
        ]);

        return { word, definition, audioUrl, imageUrl };
      } catch (err) {
        console.error(`  ❌ Lỗi khi xử lý từ "${word}":`, err.message);
        return null;
      }
    });

    const results = await Promise.all(promises);
    const validResults = results.filter(r => r !== null);

    console.log("\n==========================================");
    console.log("🎉 KẾT QUẢ CUỐI CÙNG:");
    console.log("==========================================");
    validResults.forEach((res, index) => {
      console.log(`\nThẻ #${index + 1}:`);
      console.log(` - Tiếng Anh : ${res.word}`);
      console.log(` - Tiếng Việt: ${res.definition}`);
      console.log(` - Ảnh (URL) : ${res.imageUrl}`);
      console.log(` - Phát âm   : ${res.audioUrl}`);
    });
    console.log("\n✅ Test hoàn tất!");

  } catch (error) {
    console.error("❌ Lỗi toàn cục trong quá trình test:", error.message);
  }
}

// Chạy hàm test
testSmartDeckFlow();
