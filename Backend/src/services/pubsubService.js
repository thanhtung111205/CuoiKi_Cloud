// ====================================================
// CKI CLOUD G12 - GOOGLE CLOUD PUB/SUB SERVICE
// ====================================================

const { PubSub } = require('@google-cloud/pubsub');

const pubsub = new PubSub({
  projectId: "flashcard-cloud-g12"
});

const topicName = process.env.PUBSUB_TOPIC_NAME || 'flashcard-generation-tasks';

/**
 * Đẩy Task xử lý sinh thẻ ghi nhớ lên Google Cloud Pub/Sub
 * @param {Object} payload - Chứa { deckId, text, autoTranslate, autoAudio }
 */
exports.publishGenerationTask = async (payload) => {
  try {
    // Tự động kiểm tra và khởi tạo topic nếu chưa tồn tại (tiện lợi cho dev/local)
    const topic = pubsub.topic(topicName);
    const [exists] = await topic.exists();
    if (!exists) {
      console.log(`[PubSub Service] ⚠️ Topic "${topicName}" không tồn tại. Đang tiến hành tạo mới...`);
      await pubsub.createTopic(topicName);
      console.log(`[PubSub Service] ✅ Đã tạo mới Topic "${topicName}" thành công.`);
    }

    // Chuyển toàn bộ Object chứa cả text và cấu hình thành chuỗi JSON và mã hóa Buffer
    const dataBuffer = Buffer.from(JSON.stringify(payload));
    
    // Tiến hành bắn tin nhắn lên GCP Pub/Sub Topic
    const messageId = await topic.publishMessage({ data: dataBuffer });
    
    console.log(`[PubSub Service] ✅ Đã gửi task thành công. Message ID: ${messageId} | Deck ID: ${payload.deckId}`);
    return messageId;
  } catch (error) {
    console.error(`[PubSub Service] ❌ Thất bại khi đẩy tin nhắn lên Topic ${topicName}:`, error);
    throw error; // Re-throw để Controller hứng được và trả về lỗi 500
  }
};