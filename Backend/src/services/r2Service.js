// Backend/src/services/r2Service.js
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

// Khởi tạo S3 Client cho Cloudflare R2
const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

/**
 * Upload buffer âm thanh lên Cloudflare R2
 * @param {string} filename - Tên file lưu trên R2 (ví dụ: dog.mp3)
 * @param {Buffer} buffer - Dữ liệu nhị phân của file âm thanh
 * @returns {Promise<string>} - URL công khai của file âm thanh
 */
exports.uploadAudio = async (filename, buffer) => {
  try {
    const bucketName = process.env.R2_BUCKET_NAME || "flashcard-media-assets";
    
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: `audio/${filename}`,
      Body: buffer,
      ContentType: "audio/mpeg",
    });

    await s3.send(command);

    const publicDomain = process.env.R2_PUBLIC_DOMAIN || "https://pub-40c37caa6940412f8e6bf662a11b8c10.r2.dev";
    const cleanedDomain = publicDomain.endsWith('/') ? publicDomain.slice(0, -1) : publicDomain;
    
    return `${cleanedDomain}/audio/${filename}`;
  } catch (error) {
    console.error("[R2 Service] ❌ Lỗi upload file lên R2:", error.message);
    throw error;
  }
};
