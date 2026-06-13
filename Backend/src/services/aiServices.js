// Backend/src/services/aiServices.js
const { TranslationServiceClient } = require('@google-cloud/translate').v3;
const { google } = require('googleapis');

// 1. Khởi tạo Google Translate Client
// Hệ thống chạy trên Cloud Run/Cloud Function sẽ tự bốc credentials từ Service Account
const translationClient = new TranslationServiceClient();

/**
 * Hàm 1: Gọi Google Cloud Translation API để dịch từ vựng sang tiếng Việt
 * @param {string} textToTranslate - Từ hoặc cụm từ tiếng Anh cần dịch
 * @returns {Promise<string>} - Nghĩa tiếng Việt
 */
exports.translateText = async (textToTranslate) => {
  try {
    const projectId = process.env.GCP_PROJECT_ID || 'flashcard-cloud-g12-91bee'; 
    const location = 'global';

    const request = {
      parent: `projects/${projectId}/locations/${location}`,
      contents: [textToTranslate],
      mimeType: 'text/plain',
      sourceLanguageCode: 'en',
      targetLanguageCode: 'vi',
    };

    const [response] = await translationClient.translateText(request);
    return response.translations[0].translatedText;
  } catch (error) {
    console.error('[AI Service] ❌ Lỗi Google Translate API:', error.message);
    return 'Không rõ nghĩa'; // Fallback nếu API lỗi hoặc hết quota
  }
};

/**
 * Hàm 2: Gọi Google Custom Search JSON API để lấy link ảnh minh họa
 * @param {string} keyword - Từ vựng tiếng Anh cần tìm ảnh
 * @returns {Promise<string>} - URL hình ảnh trực tuyến
 */
exports.searchImage = async (keyword) => {
  try {
    const customsearch = google.customsearch('v1');
    
    // Cần cấu hình API_KEY và SEARCH_ENGINE_ID (CX) trong file .env
    const res = await customsearch.cse.list({
      cx: process.env.GOOGLE_SEARCH_CX, 
      key: process.env.GOOGLE_SEARCH_API_KEY,
      q: keyword,
      searchType: 'image',
      num: 1, // Chỉ lấy 1 bức ảnh duy nhất để tối ưu dung lượng và tốc độ
    });

    if (res.data.items && res.data.items.length > 0) {
      return res.data.items[0].link; // Trả về link ảnh trực tiếp
    }
    return 'https://via.placeholder.com/150?text=No+Image'; // Ảnh mặc định nếu không tìm thấy
  } catch (error) {
    console.error('[AI Service] ❌ Lỗi Google Custom Search API:', error.message);
    return 'https://via.placeholder.com/150?text=Error';
  }
};