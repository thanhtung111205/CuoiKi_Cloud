// Backend/src/services/aiServices.js
const { TranslationServiceClient } = require('@google-cloud/translate').v3;
const { google } = require('googleapis');
const { uploadAudio } = require('./r2Service');

// Khởi tạo Google Custom Search API Client
const customsearch = google.customsearch('v1');

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
    const projectId = process.env.GCP_PROJECT_ID || 'flashcard-cloud-g12';
    const location = 'global';

    const request = {
      parent: `projects/${projectId}/locations/${location}`,
      contents: [textToTranslate],
      mimeType: 'text/plain',
      sourceLanguageCode: 'en',
      targetLanguageCode: 'vi',
    };

    const [response] = await translationClient.translateText(request);
    const result = response.translations[0].translatedText;
    console.log(`[AI Service] ✅ Dịch: "${textToTranslate}" → "${result}"`);
    return result;
  } catch (error) {
    console.error('[AI Service] ❌ Lỗi Google Translate API:', error.message);
    return 'Không rõ nghĩa';
  }
};

/**
 * Hàm 1b: Dịch hàng loạt danh sách từ vựng sang tiếng Việt bằng một yêu cầu duy nhất (Tránh lỗi spam N+1 API)
 * @param {string[]} wordsArray - Mảng các từ vựng tiếng Anh
 * @returns {Promise<string[]>} - Mảng các nghĩa tiếng Việt tương ứng
 */
exports.translateTextBatch = async (wordsArray) => {
  if (!wordsArray || wordsArray.length === 0) return [];
  try {
    const projectId = process.env.GCP_PROJECT_ID || 'flashcard-cloud-g12';
    const location = 'global';

    const request = {
      parent: `projects/${projectId}/locations/${location}`,
      contents: wordsArray,
      mimeType: 'text/plain',
      sourceLanguageCode: 'en',
      targetLanguageCode: 'vi',
    };

    const [response] = await translationClient.translateText(request);
    const results = response.translations.map(t => t.translatedText);
    console.log(`[AI Service] ✅ Dịch hàng loạt thành công ${wordsArray.length} từ trong 1 API request duy nhất.`);
    return results;
  } catch (error) {
    console.error('[AI Service] ❌ Lỗi Google Translate Batch API:', error.message);
    // Trả về mảng rỗng làm dự phòng
    return wordsArray.map(() => 'Không rõ nghĩa');
  }
};

/**
 * Hàm 2: Lấy link ảnh minh họa cho từ vựng
 * (Sử dụng API của Wikimedia Commons - miễn phí, không chặn ở Việt Nam và có độ chính xác cao.
 * Có cơ chế fallback về picsum.photos nếu không tìm thấy kết quả hoặc bị lỗi).
 * @param {string} keyword - Từ vựng cần tìm ảnh
 * @returns {Promise<string>} - URL hình ảnh trực tuyến
 */
exports.searchImage = async (keyword) => {
  try {
    const key = process.env.GOOGLE_SEARCH_API_KEY;
    const cx = process.env.GOOGLE_SEARCH_CX;

    if (key && cx) {
      console.log(`[AI Service] 🔍 Đang gọi Google Custom Search API cho "${keyword}"...`);
      const res = await customsearch.cse.list({
        cx: cx,
        key: key,
        q: keyword,
        searchType: 'image',
        num: 1
      });

      if (res.data.items && res.data.items.length > 0 && res.data.items[0].link) {
        const imageUrl = res.data.items[0].link;
        console.log(`[AI Service] 📸 Sinh ảnh (Google Search) cho "${keyword}": ${imageUrl}`);
        return imageUrl;
      }
    }
  } catch (err) {
    console.error(`[AI Service] ⚠️ Lỗi Google Custom Search API cho "${keyword}":`, err.message);
  }

  // Fallback sang Wikimedia Commons nếu lỗi hoặc hết quota
  try {
    console.log(`[AI Service] 🔄 Đang dùng Fallback Wikimedia Commons cho "${keyword}"...`);
    const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(keyword)}&gsrnamespace=6&gsrlimit=1&prop=imageinfo&iiprop=url&format=json&origin=*`;
    const res = await fetch(url);
    const data = await res.json();
    
    if (data.query && data.query.pages) {
      const pages = data.query.pages;
      const firstPageId = Object.keys(pages)[0];
      const imageInfo = pages[firstPageId].imageinfo;
      if (imageInfo && imageInfo[0] && imageInfo[0].url) {
        console.log(`[AI Service] 📸 Sinh ảnh (Wikimedia Fallback) cho "${keyword}": ${imageInfo[0].url}`);
        return imageInfo[0].url;
      }
    }
  } catch (wikiErr) {
    console.error(`[AI Service] ⚠️ Lỗi fallback Wikimedia cho "${keyword}":`, wikiErr.message);
  }

  // Fallback cuối cùng về picsum.photos
  const fallbackUrl = `https://picsum.photos/seed/${encodeURIComponent(keyword)}/320/240`;
  console.log(`[AI Service] 📸 Sinh ảnh (Fallback Picsum) cho "${keyword}": ${fallbackUrl}`);
  return fallbackUrl;
};

// ====================================================
// Hàm 3: Bóc tách từ vựng từ văn bản
// ====================================================
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
  'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as',
  'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then',
  'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'both',
  'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
  'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just',
  'don', 'now', 'and', 'but', 'or', 'if', 'while', 'that', 'this',
  'these', 'those', 'me', 'my', 'we', 'our', 'you', 'your',
  'he', 'him', 'his', 'she', 'her', 'it', 'its', 'they', 'them', 'their',
  'what', 'which', 'who', 'whom', 'up', 'about', 'also', 'many', 'much',
  'since', 'until', 'because', 'however', 'still', 'even',
]);

/**
 * Bóc tách từ vựng có nghĩa từ đoạn văn bản
 * @param {string} text - Văn bản gốc
 * @returns {Promise<string[]>} - Danh sách từ vựng
 */
exports.extractVocabulary = async (text) => {
  try {
    console.log('[AI Service] 📝 Đang bóc tách từ vựng...');
    const words = text.toLowerCase().match(/[a-zA-Z]{3,}/g) || [];
    const uniqueWords = [...new Set(words)];
    const meaningfulWords = uniqueWords.filter(w => !STOP_WORDS.has(w));
    console.log(`[AI Service] ✅ Lọc được ${meaningfulWords.length} từ có nghĩa từ ${uniqueWords.length} từ tổng.`);
    return meaningfulWords.slice(0, 15);
  } catch (error) {
    console.error('[AI Service] ❌ Lỗi bóc tách từ vựng:', error.message);
    return [];
  }
};

// ====================================================
// Hàm 4: Google Cloud Text-to-Speech
// ====================================================
const textToSpeech = require('@google-cloud/text-to-speech');
const ttsClient = new textToSpeech.TextToSpeechClient();

/**
 * Sinh audio phát âm cho từ vựng qua Google Cloud TTS
 * @param {string} word - Từ vựng cần phát âm
 * @returns {Promise<string>} - URL hoặc data URI của file mp3
 */
exports.generateAudio = async (word) => {
  try {
    const request = {
      input: { text: word },
      voice: { languageCode: 'en-US', name: 'en-US-Standard-D' },
      audioConfig: { audioEncoding: 'MP3' },
    };

    const [response] = await ttsClient.synthesizeSpeech(request);

    // Sinh tên file duy nhất và upload lên Cloudflare R2
    const cleanWord = word.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    const filename = `${Date.now()}_${cleanWord}.mp3`;
    const audioUrl = await uploadAudio(filename, response.audioContent);

    console.log(`[AI Service] 🔊 TTS: "${word}" → R2 URL: ${audioUrl}`);
    return audioUrl;
  } catch (error) {
    console.error(`[AI Service] ❌ Lỗi Google TTS cho "${word}":`, error.message);
    return '';
  }
};