# Tích hợp Zoho Analytics

## Tổng quan

Zoho Analytics được dùng để trực quan hóa dữ liệu học tập dưới dạng biểu đồ nhúng (embedded charts) vào Dashboard của người dùng. Backend tổng hợp dữ liệu từ PostgreSQL, đẩy lên Zoho Analytics qua REST API, rồi trả về embed URL cho FE nhúng vào `<iframe>`.

### 5 biểu đồ được nhúng vào Dashboard

| ID | Tên biểu đồ | Loại | Dữ liệu nguồn (DB) |
|---|---|---|---|
| `CHART_ACTIVITY` | Hoạt động học theo ngày | Line chart | `study_progresses.last_reviewed_at` |
| `CHART_MASTERY` | Mức thành thạo từ vựng | Donut chart | `study_progresses.repetition` |
| `CHART_DECKS` | Tiến độ từng bộ thẻ | Horizontal bar | `decks` + `study_progresses` |
| `CHART_EF` | Phân bố Ease Factor | Histogram | `study_progresses.ease_factor` |
| `CHART_BATTLE` | Tỷ lệ thắng/thua thi đấu | Pie chart | `match_histories` |

---

## Chuẩn bị Zoho Analytics

### Bước 1 — Tạo tài khoản và workspace

#### 1.1 Đăng ký tài khoản Zoho

1. Mở trình duyệt, truy cập **[https://analytics.zoho.com](https://analytics.zoho.com)**

2. Nhấn nút **"Sign Up for Free"** ở góc trên bên phải trang chủ

3. Điền thông tin đăng ký:
   - **First Name / Last Name**: Họ và tên thành viên nhóm
   - **Email Address**: Email cá nhân hoặc email nhóm (dùng email này để đăng nhập sau)
   - **Password**: Đặt mật khẩu mạnh (ít nhất 8 ký tự, có chữ hoa + số)
   - **Country**: Chọn `Vietnam`

4. Nhấn **"Sign Up"** → Zoho gửi email xác nhận đến địa chỉ đã đăng ký

5. Mở email, nhấn link **"Verify Email Address"** (link có hiệu lực 24 giờ)

6. Sau khi xác minh, trình duyệt tự chuyển về trang chào mừng Zoho Analytics

> **Lưu ý**: Zoho Analytics có gói **Free** cho đến 2 người dùng và 5000 hàng dữ liệu — đủ dùng cho môi trường dev và demo. Không cần nhập thẻ tín dụng.

---

#### 1.2 Hoàn thành thiết lập ban đầu (Setup Wizard)

Sau khi đăng nhập lần đầu, Zoho Analytics hiển thị màn hình chào mừng:

1. **"What describes you best?"** → Chọn **"Student"** hoặc **"Developer"**

2. **"What would you like to do first?"** → Chọn **"Start with a blank workspace"**
   - Nếu không thấy màn hình này, bỏ qua và tiếp tục bước 1.3

3. Nhấn **"Get Started"** hoặc **"Continue"**

---

#### 1.3 Tạo Workspace mới

Workspace là "kho" chứa toàn bộ bảng dữ liệu và biểu đồ của dự án.

1. Ở giao diện chính (Home), nhìn thanh bên trái → nhấn biểu tượng **"+"** cạnh chữ **"Workspaces"**
   - Hoặc vào menu trên cùng: **New → New Workspace**

2. Hộp thoại **"Create Workspace"** xuất hiện:
   - **Workspace Name**: Nhập `CKI Flashcard Analytics`
   - **Description** (tuỳ chọn): `Dữ liệu học tập và thi đấu - CKI Cloud G12`
   - **Currency** và **Timezone**: Giữ mặc định hoặc chọn `Asia/Ho_Chi_Minh`

3. Nhấn **"Create"**

4. Zoho tạo workspace và tự động mở vào bên trong — giao diện trắng với thông báo **"No views found"** là bình thường

---

#### 1.4 Lấy Workspace ID

Workspace ID cần thiết để cấu hình biến môi trường `ZOHO_WORKSPACE_ID`.

1. Sau khi đã vào trong workspace `CKI Flashcard Analytics`

2. Nhìn lên **thanh địa chỉ (URL bar)** của trình duyệt, URL có dạng:
   ```
   https://analytics.zoho.com/workspace/1234567890123456789/
   ```

3. Sao chép chuỗi số dài sau `/workspace/` — đó là **Workspace ID**
   - Ví dụ: `1234567890123456789`

4. Dán vào file `.env`:
   ```env
   ZOHO_WORKSPACE_ID=1234567890123456789
   ```

> **Mẹo**: Nếu URL không hiển thị đủ, nhấn vào thanh địa chỉ một lần để thấy toàn bộ URL.

---

#### 1.5 Lấy Organization ID (Org ID)

Org ID là mã định danh tổ chức Zoho, cần thiết để gọi REST API.

1. Nhấn biểu tượng bánh răng **⚙️ Settings** ở góc trên bên phải
   - Hoặc nhấn vào **avatar** (ảnh đại diện) → chọn **"Organization Settings"**

2. Trang **Organization Settings** mở ra, nhìn vào mục **"Organization Details"**

3. Tìm dòng **"Organization ID"** (hoặc **"Portal ID"**) → sao chép giá trị số
   - Ví dụ: `799786345`

4. Dán vào file `.env`:
   ```env
   ZOHO_ORG_ID=799786345
   ```

> **Không tìm thấy Org ID?**
> Thử cách khác: vào bất kỳ bảng nào trong workspace → nhìn URL sẽ có dạng:
> `https://analytics.zoho.com/reporting/WorkspaceID/ViewID`
> Hoặc vào **Help → About** trong Zoho Analytics để xem thông tin portal.

---

#### 1.6 Kiểm tra lại thông tin đã thu thập

Trước khi sang Bước 2, đảm bảo đã có đủ 2 giá trị sau:

| Biến môi trường | Ví dụ giá trị | Lấy từ đâu |
|---|---|---|
| `ZOHO_WORKSPACE_ID` | `1234567890123456789` | URL sau `/workspace/` |
| `ZOHO_ORG_ID` | `799786345` | Settings → Organization Details |

File `.env` lúc này có dạng:
```env
ZOHO_ORG_ID=799786345
ZOHO_WORKSPACE_ID=1234567890123456789
# (Các biến khác sẽ điền sau ở Bước 2, 3, 4, 5)
```

### Bước 2 — Tạo 4 bảng dữ liệu trong workspace

Vào workspace → **New Table → By importing data** → tạo thủ công với cấu trúc sau:

**Bảng `study_activity`**
| Column | Type | Ghi chú |
|---|---|---|
| `user_id` | Plain Text | |
| `review_date` | Date | Format: YYYY-MM-DD |
| `cards_reviewed` | Number | |
| `hard_count` | Number | Số thẻ đánh giá "hard" |
| `good_count` | Number | |
| `easy_count` | Number | |

**Bảng `vocab_mastery`**
| Column | Type | Ghi chú |
|---|---|---|
| `user_id` | Plain Text | |
| `mastery_level` | Plain Text | "Mới" / "Đang học" / "Ôn tập" / "Thành thạo" |
| `card_count` | Number | |
| `synced_at` | Date | |

**Bảng `deck_progress`**
| Column | Type | Ghi chú |
|---|---|---|
| `user_id` | Plain Text | |
| `deck_title` | Plain Text | |
| `total_cards` | Number | |
| `studied_cards` | Number | |
| `progress_percent` | Number | 0-100 |
| `synced_at` | Date | |

**Bảng `battle_stats`**
| Column | Type | Ghi chú |
|---|---|---|
| `user_id` | Plain Text | |
| `wins` | Number | |
| `losses` | Number | |
| `draws` | Number | |
| `total_matches` | Number | |
| `synced_at` | Date | |

Sau khi tạo xong mỗi bảng, ghi lại **View ID** của bảng đó (xuất hiện trong URL).

### Bước 3 — Tạo biểu đồ từ bảng dữ liệu

Trong Zoho Analytics, tạo 5 chart từ các bảng tương ứng. Cấu hình từng chart:

- `CHART_ACTIVITY`: Dùng `study_activity` → X = `review_date`, Y = `cards_reviewed` → Line chart
- `CHART_MASTERY`: Dùng `vocab_mastery` → Dimension = `mastery_level`, Measure = `card_count` → Donut
- `CHART_DECKS`: Dùng `deck_progress` → X = `deck_title`, Y = `progress_percent` → Bar
- `CHART_EF`: Dùng `vocab_mastery` (hoặc tạo thêm bảng riêng) → Histogram of `ease_factor`
- `CHART_BATTLE`: Dùng `battle_stats` → Pie của wins/losses/draws

Ghi lại **View ID** của mỗi chart.

### Bước 4 — Cấu hình Private Embed

1. Mở từng chart → **Share → Embed in Website → Private**
2. Bật **Row-level Security** → chọn filter theo column `user_id`
3. Lấy **Embed Secret Key** tại **Settings → Private Embed Key**

### Bước 5 — Tạo OAuth credentials

1. Vào [api-console.zoho.com](https://api-console.zoho.com) → **Server-based Applications**
2. Tạo mới → ghi lại `Client ID`, `Client Secret`
3. Grant scopes: `ZohoAnalytics.data.create`, `ZohoAnalytics.data.update`, `ZohoAnalytics.embed.read`
4. Generate **Refresh Token** bằng Authorization Code flow một lần, lưu lại

---

## Cấu hình môi trường

Thêm vào `Backend/.env`:

```env
# Zoho Analytics - OAuth
ZOHO_CLIENT_ID=1000.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ZOHO_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ZOHO_REFRESH_TOKEN=1000.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Zoho Analytics - Workspace
ZOHO_ORG_ID=xxxxxxxxxx
ZOHO_WORKSPACE_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Zoho Analytics - View IDs (lấy từ URL của từng bảng/chart)
ZOHO_VIEW_STUDY_ACTIVITY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ZOHO_VIEW_VOCAB_MASTERY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ZOHO_VIEW_DECK_PROGRESS=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ZOHO_VIEW_BATTLE_STATS=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ZOHO_VIEW_CHART_ACTIVITY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ZOHO_VIEW_CHART_MASTERY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ZOHO_VIEW_CHART_DECKS=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ZOHO_VIEW_CHART_EF=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ZOHO_VIEW_CHART_BATTLE=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Zoho Analytics - Private Embed
ZOHO_EMBED_SECRET_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## Luồng triển khai

```
[FE mở Dashboard]
       ↓
GET /api/analytics/embed-urls  (Bearer token)
       ↓
analyticsController.getEmbedUrls()
  → prisma: aggregate dữ liệu user (decks, progress, battle)
  → analyticsService.generateEmbedUrl(viewId, userId)  ← Ký URL với HMAC
  → Trả về { chartActivity: "https://...", chartMastery: "https://...", ... }
       ↓
FE nhúng từng URL vào <iframe>

[FE bấm "Đồng bộ dữ liệu" hoặc trigger tự động]
       ↓
POST /api/analytics/sync  (Bearer token)
       ↓
analyticsController.syncUserAnalytics()
  → Aggregate 4 dataset từ PostgreSQL
  → analyticsService.importData(viewId, csvRows) × 4  ← Push lên Zoho
  → Response 200
       ↓
Zoho Analytics cập nhật charts tự động
```

---

## File 1: `Backend/src/services/analyticsService.js` (mới)

Theo cấu trúc tương tự `pubsubService.js` — service thuần, không biết về Express req/res. Quản lý OAuth token trong bộ nhớ để tránh gọi API lấy token mỗi request.

```js
// ====================================================
// CKI CLOUD G12 - ZOHO ANALYTICS SERVICE
// Đồng bộ dữ liệu học tập lên Zoho Analytics
// và sinh URL nhúng biểu đồ vào Dashboard
// ====================================================

const crypto = require("crypto");

// --- Token cache in-memory (không cần Redis cho MVP) ---
let _cachedToken = null;
let _tokenExpiresAt = 0;

const ZOHO_API_BASE = "https://analyticsapi.zoho.com/restapi/v2";
const ZOHO_AUTH_URL = "https://accounts.zoho.com/oauth/v2/token";

// -----------------------------------------------
// Lấy Zoho OAuth Access Token (có cache 55 phút)
// -----------------------------------------------
async function getAccessToken() {
  const now = Date.now();

  // Token còn hiệu lực (Zoho token hết hạn sau 3600s, cache 55 phút)
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
    console.error("[Zoho Analytics] ❌ Lỗi lấy access token:", data);
    throw new Error(data.error || "Không lấy được Zoho access token.");
  }

  _cachedToken = data.access_token;
  _tokenExpiresAt = now + 55 * 60 * 1000; // Cache 55 phút

  console.log("[Zoho Analytics] ✅ Đã lấy access token mới.");
  return _cachedToken;
}

// -----------------------------------------------
// Đẩy dữ liệu CSV lên một bảng (View) trong Zoho Analytics
// viewId: ID bảng dữ liệu (không phải chart)
// csvRows: string CSV (header + data rows)
// -----------------------------------------------
exports.importData = async (viewId, csvRows) => {
  const ZOHO_ORG_ID = process.env.ZOHO_ORG_ID;
  const ZOHO_WORKSPACE_ID = process.env.ZOHO_WORKSPACE_ID;

  if (!ZOHO_ORG_ID || !ZOHO_WORKSPACE_ID || !viewId) {
    console.warn("[Zoho Analytics] Thiếu cấu hình ZOHO_ORG_ID / ZOHO_WORKSPACE_ID / viewId. Bỏ qua đồng bộ.");
    return { skipped: true };
  }

  const accessToken = await getAccessToken();

  // Zoho Analytics Bulk Import API nhận multipart/form-data
  const formData = new FormData();
  formData.append("config", JSON.stringify({ operation: "truncateadd" })); // Xóa cũ + thêm mới
  formData.append("data", new Blob([csvRows], { type: "text/csv" }), "data.csv");

  const url = `${ZOHO_API_BASE}/bulk/workspaces/${ZOHO_WORKSPACE_ID}/views/${viewId}/data`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      "ZANALYTICS-ORGID": ZOHO_ORG_ID,
    },
    body: formData,
  });

  const result = await response.json();

  if (!response.ok) {
    console.error(`[Zoho Analytics] ❌ Lỗi import data vào view ${viewId}:`, result);
    throw new Error(result.message || "Lỗi Zoho Analytics import.");
  }

  console.log(`[Zoho Analytics] ✅ Import thành công ${viewId}:`, result.data?.importSummary || "ok");
  return result;
};

// -----------------------------------------------
// Sinh Private Embed URL có ký HMAC cho một chart
// viewId: ID của chart/view cần nhúng
// userId: dùng làm criteria filter (row-level security)
// -----------------------------------------------
exports.generateEmbedUrl = (viewId, userId) => {
  const EMBED_SECRET = process.env.ZOHO_EMBED_SECRET_KEY;

  // Base URL của chart view trên Zoho Analytics
  const baseUrl = `https://analytics.zoho.com/open-view/${viewId}`;

  // Criteria lọc dữ liệu theo user hiện tại (Row-Level Security)
  const criteria = `"user_id"='${userId}'`;
  const urlWithCriteria = `${baseUrl}?ZOHO_CRITERIA=${encodeURIComponent(criteria)}`;

  if (!EMBED_SECRET) {
    // Môi trường dev: trả về URL không ký (chỉ dùng nội bộ)
    console.warn("[Zoho Analytics] Thiếu ZOHO_EMBED_SECRET_KEY, trả về URL không ký.");
    return urlWithCriteria;
  }

  // Ký URL bằng HMAC-SHA256 với Private Embed Key
  const hmac = crypto.createHmac("sha256", EMBED_SECRET);
  hmac.update(urlWithCriteria);
  const signature = hmac.digest("hex");

  return `${urlWithCriteria}&ZOHO_VALID_INFO=${signature}`;
};
```

---

## File 2: `Backend/src/controllers/analyticsController.js` (mới)

Tổng hợp dữ liệu từ PostgreSQL, chuyển sang CSV, gọi `analyticsService` để đẩy lên Zoho, và tạo embed URL cho FE.

```js
// ====================================================
// CKI CLOUD G12 - ANALYTICS CONTROLLER
// Đồng bộ dữ liệu học tập lên Zoho Analytics
// Trả về embed URL biểu đồ cho Dashboard
// ====================================================

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const analyticsService = require("../services/analyticsService");

// -----------------------------------------------
// Helper: Chuyển mảng object sang chuỗi CSV
// -----------------------------------------------
function toCSV(rows) {
  if (!rows || rows.length === 0) return "";
  const headers = Object.keys(rows[0]).join(",");
  const lines = rows.map((row) =>
    Object.values(row)
      .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
      .join(",")
  );
  return [headers, ...lines].join("\n");
}

// -----------------------------------------------
// Helper: Tổng hợp hoạt động học theo ngày
// Trả về mảng { user_id, review_date, cards_reviewed, hard_count, good_count, easy_count }
// -----------------------------------------------
async function aggregateStudyActivity(userId) {
  const progresses = await prisma.studyProgress.findMany({
    where: { userId },
    select: { lastReviewedAt: true, interval: true, repetition: true, easeFactor: true },
  });

  // Gom nhóm theo ngày (YYYY-MM-DD)
  const byDay = {};
  for (const p of progresses) {
    const day = p.lastReviewedAt.toISOString().split("T")[0];
    if (!byDay[day]) byDay[day] = { hard: 0, good: 0, easy: 0, total: 0 };

    // Phân loại rating dựa vào repetition và interval (heuristic từ SM-2)
    if (p.repetition === 0) byDay[day].hard++;
    else if (p.interval <= 3) byDay[day].good++;
    else byDay[day].easy++;
    byDay[day].total++;
  }

  return Object.entries(byDay).map(([day, counts]) => ({
    user_id: userId,
    review_date: day,
    cards_reviewed: counts.total,
    hard_count: counts.hard,
    good_count: counts.good,
    easy_count: counts.easy,
  }));
}

// -----------------------------------------------
// Helper: Phân bố mức thành thạo từ vựng
// Dựa trên số lần lặp (repetition) từ thuật toán SM-2
//   0      → "Mới"        (chưa học lần nào)
//   1      → "Đang học"   (đúng 1 lần)
//   2      → "Ôn tập"     (đúng 2 lần, interval 6 ngày)
//   3+     → "Thành thạo" (interval dài, EF ổn định)
// -----------------------------------------------
async function aggregateVocabMastery(userId) {
  const progresses = await prisma.studyProgress.findMany({
    where: { userId },
    select: { repetition: true },
  });

  const counts = { "Mới": 0, "Đang học": 0, "Ôn tập": 0, "Thành thạo": 0 };

  for (const p of progresses) {
    if (p.repetition === 0) counts["Mới"]++;
    else if (p.repetition === 1) counts["Đang học"]++;
    else if (p.repetition === 2) counts["Ôn tập"]++;
    else counts["Thành thạo"]++;
  }

  const today = new Date().toISOString().split("T")[0];

  return Object.entries(counts).map(([level, count]) => ({
    user_id: userId,
    mastery_level: level,
    card_count: count,
    synced_at: today,
  }));
}

// -----------------------------------------------
// Helper: Tiến độ từng bộ thẻ
// -----------------------------------------------
async function aggregateDeckProgress(userId) {
  const decks = await prisma.deck.findMany({
    where: { userId, status: "ready" },
    select: {
      title: true,
      flashcards: {
        select: {
          id: true,
          progresses: {
            where: { userId },
            select: { id: true },
          },
        },
      },
    },
  });

  const today = new Date().toISOString().split("T")[0];

  return decks.map((deck) => {
    const total = deck.flashcards.length;
    const studied = deck.flashcards.filter((f) => f.progresses.length > 0).length;
    return {
      user_id: userId,
      deck_title: deck.title.substring(0, 50), // Giới hạn độ dài tên
      total_cards: total,
      studied_cards: studied,
      progress_percent: total > 0 ? Math.round((studied / total) * 100) : 0,
      synced_at: today,
    };
  });
}

// -----------------------------------------------
// Helper: Thống kê thi đấu
// -----------------------------------------------
async function aggregateBattleStats(userId) {
  const [asP1, asP2] = await Promise.all([
    prisma.matchHistory.findMany({
      where: { player1Id: userId },
      select: { winnerId: true },
    }),
    prisma.matchHistory.findMany({
      where: { player2Id: userId },
      select: { winnerId: true },
    }),
  ]);

  const allMatches = [...asP1, ...asP2];
  const total = allMatches.length;
  const wins = allMatches.filter((m) => m.winnerId === userId).length;
  const draws = allMatches.filter((m) => m.winnerId === null).length;
  const losses = total - wins - draws;

  const today = new Date().toISOString().split("T")[0];

  return [{
    user_id: userId,
    wins,
    losses,
    draws,
    total_matches: total,
    synced_at: today,
  }];
}

// -----------------------------------------------
// POST /api/analytics/sync
// Đồng bộ toàn bộ dữ liệu học tập của user lên Zoho Analytics
// FE gọi sau khi user hoàn thành một phiên học hoặc bấm nút thủ công
// -----------------------------------------------
exports.syncUserAnalytics = async (req, res) => {
  try {
    const userId = req.user.userId;
    console.log(`[AnalyticsController] 🚀 Bắt đầu sync dữ liệu analytics cho User: ${userId}`);

    // 1. Tổng hợp dữ liệu song song từ PostgreSQL
    const [activityData, masteryData, deckData, battleData] = await Promise.all([
      aggregateStudyActivity(userId),
      aggregateVocabMastery(userId),
      aggregateDeckProgress(userId),
      aggregateBattleStats(userId),
    ]);

    // 2. Đẩy từng dataset lên Zoho Analytics (chạy song song)
    const syncResults = await Promise.allSettled([
      analyticsService.importData(process.env.ZOHO_VIEW_STUDY_ACTIVITY, toCSV(activityData)),
      analyticsService.importData(process.env.ZOHO_VIEW_VOCAB_MASTERY, toCSV(masteryData)),
      analyticsService.importData(process.env.ZOHO_VIEW_DECK_PROGRESS, toCSV(deckData)),
      analyticsService.importData(process.env.ZOHO_VIEW_BATTLE_STATS, toCSV(battleData)),
    ]);

    // 3. Ghi nhận kết quả từng dataset
    const labels = ["study_activity", "vocab_mastery", "deck_progress", "battle_stats"];
    const summary = syncResults.map((result, i) => ({
      table: labels[i],
      status: result.status,
      error: result.status === "rejected" ? result.reason?.message : undefined,
    }));

    const hasError = syncResults.some((r) => r.status === "rejected");
    console.log(`[AnalyticsController] ✅ Sync hoàn thành:`, summary);

    return res.status(hasError ? 207 : 200).json({
      success: !hasError,
      message: hasError ? "Đồng bộ một phần. Một số bảng gặp lỗi." : "Đồng bộ dữ liệu thành công.",
      summary,
    });
  } catch (error) {
    console.error("[AnalyticsController] ❌ Lỗi sync analytics:", error);
    return res.status(500).json({ success: false, message: "Lỗi Server Internal", error: error.message });
  }
};

// -----------------------------------------------
// GET /api/analytics/embed-urls
// Trả về danh sách embed URL đã ký cho FE nhúng vào iframe
// -----------------------------------------------
exports.getEmbedUrls = async (req, res) => {
  try {
    const userId = req.user.userId;

    const viewIds = {
      chartActivity: process.env.ZOHO_VIEW_CHART_ACTIVITY,
      chartMastery: process.env.ZOHO_VIEW_CHART_MASTERY,
      chartDecks: process.env.ZOHO_VIEW_CHART_DECKS,
      chartEF: process.env.ZOHO_VIEW_CHART_EF,
      chartBattle: process.env.ZOHO_VIEW_CHART_BATTLE,
    };

    // Kiểm tra cấu hình
    const missingViews = Object.entries(viewIds)
      .filter(([, id]) => !id)
      .map(([key]) => key);

    if (missingViews.length > 0) {
      console.warn(`[AnalyticsController] Thiếu View ID cho: ${missingViews.join(", ")}`);
    }

    // Sinh embed URL cho từng chart
    const embedUrls = {};
    for (const [key, viewId] of Object.entries(viewIds)) {
      if (viewId) {
        embedUrls[key] = analyticsService.generateEmbedUrl(viewId, userId);
      } else {
        embedUrls[key] = null;
      }
    }

    return res.status(200).json({
      success: true,
      data: embedUrls,
    });
  } catch (error) {
    console.error("[AnalyticsController] ❌ Lỗi lấy embed URLs:", error);
    return res.status(500).json({ success: false, message: "Lỗi Server Internal", error: error.message });
  }
};

// -----------------------------------------------
// GET /api/analytics/summary
// Trả về dữ liệu thô dạng JSON — dùng làm fallback
// nếu Zoho chưa cấu hình hoặc FE cần dữ liệu trực tiếp
// -----------------------------------------------
exports.getAnalyticsSummary = async (req, res) => {
  try {
    const userId = req.user.userId;

    const [activityData, masteryData, deckData, battleData] = await Promise.all([
      aggregateStudyActivity(userId),
      aggregateVocabMastery(userId),
      aggregateDeckProgress(userId),
      aggregateBattleStats(userId),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        studyActivity: activityData,
        vocabMastery: masteryData,
        deckProgress: deckData,
        battleStats: battleData[0] || { wins: 0, losses: 0, draws: 0, total_matches: 0 },
      },
    });
  } catch (error) {
    console.error("[AnalyticsController] ❌ Lỗi lấy analytics summary:", error);
    return res.status(500).json({ success: false, message: "Lỗi Server Internal", error: error.message });
  }
};
```

---

## File 3: Chỉnh sửa `Backend/src/routes/api.js`

Thêm vào cuối file (trước `module.exports`):

```js
const analyticsController = require("../controllers/analyticsController");

// -----------------------------------------------
// ANALYTICS ROUTES
// -----------------------------------------------
router.get("/analytics/embed-urls", authMiddleware, analyticsController.getEmbedUrls);
router.post("/analytics/sync", authMiddleware, analyticsController.syncUserAnalytics);
router.get("/analytics/summary", authMiddleware, analyticsController.getAnalyticsSummary);
```

---

## Tóm tắt các endpoint mới

| Method | Path | Auth | Mô tả | Response |
|---|---|---|---|---|
| `GET` | `/api/analytics/embed-urls` | ✅ JWT | Lấy 5 embed URL đã ký cho Dashboard | `{ chartActivity, chartMastery, ... }` |
| `POST` | `/api/analytics/sync` | ✅ JWT | Đẩy dữ liệu lên Zoho Analytics | `207` nếu sync một phần, `200` nếu thành công |
| `GET` | `/api/analytics/summary` | ✅ JWT | Dữ liệu thô JSON (fallback) | 4 dataset đã tổng hợp |

---

## Hướng dẫn nhúng vào FE (React)

FE gọi `GET /api/analytics/embed-urls`, sau đó nhúng từng URL vào `<iframe>`:

```tsx
// Ví dụ: Component nhúng chart Zoho Analytics
useEffect(() => {
  fetch("/api/analytics/embed-urls", {
    headers: { Authorization: `Bearer ${token}` }
  })
    .then(r => r.json())
    .then(({ data }) => setEmbedUrls(data));
}, []);

// Trong JSX
{embedUrls.chartActivity && (
  <iframe
    src={embedUrls.chartActivity}
    width="100%"
    height="400"
    frameBorder="0"
    title="Hoạt động học theo ngày"
  />
)}
```

Trigger sync sau mỗi phiên học (gọi sau `POST /api/flashcards/:id/review`):

```ts
// Gọi bất đồng bộ, không block UI
fetch("/api/analytics/sync", {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` }
}).catch(console.warn);
```

---

## Luồng dữ liệu đầy đủ

```
[User học xong 1 thẻ]
POST /api/flashcards/:id/review { rating }
  → reviewFlashcard() → prisma.studyProgress.upsert()
  → [FE trigger ngầm] POST /api/analytics/sync
       ↓
analyticsController.syncUserAnalytics()
  → aggregateStudyActivity()   ← GROUP BY ngày từ lastReviewedAt
  → aggregateVocabMastery()    ← Phân loại theo repetition (0/1/2/3+)
  → aggregateDeckProgress()    ← Tính % hoàn thành từng deck
  → aggregateBattleStats()     ← Đếm W/L/D từ matchHistory
       ↓ Promise.allSettled (4 task song song)
analyticsService.importData(viewId, csvRows) × 4
  → getAccessToken()  ← Cache 55 phút, refresh khi hết hạn
  → fetch Zoho Bulk Import API  (operation: truncateadd)
       ↓
Zoho Analytics cập nhật dữ liệu → Charts tự render lại

[User mở Dashboard]
GET /api/analytics/embed-urls
  → analyticsService.generateEmbedUrl(viewId, userId) × 5
    → HMAC-SHA256(baseUrl + criteria, EMBED_SECRET)
  → Trả về 5 signed URL
       ↓
FE nhúng <iframe src={signedUrl}> × 5
Zoho render chart với dữ liệu đã filter theo userId
```

---

## Xử lý khi Zoho chưa cấu hình (Dev mode)

Tất cả các hàm trong `analyticsService` đều xử lý graceful khi thiếu biến môi trường:

| Thiếu biến | Hành vi |
|---|---|
| `ZOHO_CLIENT_ID` / `ZOHO_CLIENT_SECRET` / `ZOHO_REFRESH_TOKEN` | `getAccessToken()` throw lỗi → `importData` bị skip |
| `ZOHO_ORG_ID` / `ZOHO_WORKSPACE_ID` / viewId | `importData` log warn và trả về `{ skipped: true }` |
| `ZOHO_EMBED_SECRET_KEY` | `generateEmbedUrl()` trả về URL không ký (log warn) |
| Thiếu bất kỳ `ZOHO_VIEW_CHART_*` | `getEmbedUrls()` trả về `null` cho chart đó, không crash |

`GET /api/analytics/summary` luôn hoạt động độc lập với Zoho — dùng làm fallback hiển thị số liệu thô khi chưa tích hợp xong.
