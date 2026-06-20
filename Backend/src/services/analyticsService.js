// ====================================================
// CKI CLOUD G12 - ZOHO ANALYTICS SERVICE
// Đồng bộ dữ liệu học tập lên Zoho Analytics
// và sinh URL nhúng biểu đồ vào Dashboard
// ====================================================

const crypto = require("crypto");

// --- Token cache in-memory ---
let _cachedToken = null;
let _tokenExpiresAt = 0;

const ZOHO_API_BASE = "https://analyticsapi.zoho.com/api";
const ZOHO_AUTH_URL = "https://accounts.zoho.com/oauth/v2/token";

// -----------------------------------------------
// Lấy Zoho OAuth Access Token (cache 55 phút)
// -----------------------------------------------
async function getAccessToken() {
  const now = Date.now();

  if (_cachedToken && now < _tokenExpiresAt) {
    return _cachedToken;
  }

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: process.env.ZOHO_CLIENT_ID,
    client_secret: process.env.ZOHO_CLIENT_SECRET,
    refresh_token: process.env.ZOHO_REFRESH_TOKEN,
  });

  const response = await fetch(`${ZOHO_AUTH_URL}?${params.toString()}`, {
    method: "POST",
  });

  const data = await response.json();

  if (!response.ok || !data.access_token) {
    console.error("[Zoho Analytics] Lỗi lấy access token:", data);
    throw new Error(data.error || "Không lấy được Zoho access token.");
  }

  _cachedToken = data.access_token;
  _tokenExpiresAt = now + 55 * 60 * 1000;

  console.log("[Zoho Analytics] Đã lấy access token mới.");
  return _cachedToken;
}

// -----------------------------------------------
// Đẩy dữ liệu CSV lên một bảng (View) trong Zoho Analytics
// -----------------------------------------------
exports.importData = async (tableName, csvRows, matchingColumns) => {
  const ZOHO_OWNER_EMAIL = process.env.ZOHO_OWNER_EMAIL;
  const ZOHO_WORKSPACE_NAME = process.env.ZOHO_WORKSPACE_NAME || "CKI Flashcard Analytics";

  if (!ZOHO_OWNER_EMAIL || !tableName || !csvRows) {
    console.warn("[Zoho Analytics] Thiếu cấu hình hoặc không có dữ liệu. Bỏ qua đồng bộ.");
    return { skipped: true };
  }

  const accessToken = await getAccessToken();

  const url = `${ZOHO_API_BASE}/${encodeURIComponent(ZOHO_OWNER_EMAIL)}/${encodeURIComponent(ZOHO_WORKSPACE_NAME)}/${encodeURIComponent(tableName)}`;

  const params = new URLSearchParams({
    ZOHO_ACTION: "IMPORT",
    ZOHO_API_VERSION: "1.0",
    ZOHO_IMPORT_TYPE: matchingColumns ? "UPDATEADD" : "TRUNCATEADD",
    ZOHO_CREATE_TABLE: "false",
    ZOHO_AUTO_IDENTIFY: "true",
    ZOHO_ON_IMPORT_ERROR: "SETCOLUMNEMPTY",
    ZOHO_OUTPUT_FORMAT: "JSON",
    ZOHO_IMPORT_DATA: csvRows,
  });

  if (matchingColumns) {
    params.set("ZOHO_MATCHING_COLUMNS", matchingColumns);
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const result = await response.json();

  if (!response.ok || result.response?.error) {
    console.error(`[Zoho Analytics] Lỗi import data vào bảng ${tableName}:`, result);
    throw new Error(result.response?.error?.message || "Lỗi Zoho Analytics import.");
  }

  console.log(`[Zoho Analytics] Import thành công ${tableName}:`, result.response?.result?.importSummary || "ok");
  return result;
};

// -----------------------------------------------
// Sinh Private Embed URL có ký HMAC cho một chart
// -----------------------------------------------
exports.generateEmbedUrl = (viewId, userId) => {
  const EMBED_SECRET = process.env.ZOHO_EMBED_SECRET_KEY;

  if (!viewId) return null;

  const baseUrl = `https://analytics.zoho.com/open-view/${viewId}`;
  const criteria = `"user_id"='${userId}'`;
  const urlWithCriteria = `${baseUrl}?ZOHO_CRITERIA=${encodeURIComponent(criteria)}`;

  if (!EMBED_SECRET) {
    console.warn("[Zoho Analytics] Thiếu ZOHO_EMBED_SECRET_KEY, trả về URL không ký.");
    return urlWithCriteria;
  }

  const hmac = crypto.createHmac("sha256", EMBED_SECRET);
  hmac.update(urlWithCriteria);
  const signature = hmac.digest("hex");

  return `${urlWithCriteria}&ZOHO_VALID_INFO=${signature}`;
};
