# CKI CLOUD G12 - Backend

> RESTful API & WebSocket Server cho **Hệ sinh thái Học ngoại ngữ và Thi đấu Flashcard** (MVP)

## 🛠 Tech Stack

| Công nghệ | Mục đích |
|-----------|----------|
| **Node.js** | Runtime JavaScript |
| **Express.js** | REST API framework |
| **Socket.io** | WebSocket realtime thi đấu |
| **cors** | Cross-Origin Resource Sharing |
| **dotenv** | Quản lý biến môi trường |

## 📁 Cấu trúc thư mục

```
Backend/
├── src/
│   ├── index.js                  # Entry point: Express + Socket.io server
│   ├── routes/
│   │   └── api.js                # Định nghĩa REST API routes
│   └── controllers/
│       └── deckController.js     # Logic xử lý tạo flashcard deck
├── .env                          # Biến môi trường (KHÔNG commit lên git)
├── .env.example                  # Template biến môi trường
├── .dockerignore                 # Loại trừ file khỏi Docker image
├── Dockerfile                    # Cấu hình Docker (Cloud Run ready)
├── package.json                  # Dependencies & scripts
└── README.md                     # Tài liệu này
```

## 🚀 Bắt đầu nhanh

### 1. Cài đặt dependencies

```bash
cd Backend
npm install
```

### 2. Chạy development server

```bash
npm run dev
```

### 3. Chạy production

```bash
npm start
```

Server sẽ chạy tại `http://localhost:8080`

## 📋 API Endpoints

### Health Check
```
GET /
GET /api/health
```

### Tạo Flashcard Deck
```
POST /api/generate-deck
Content-Type: application/json

{
  "text": "The ecosystem is abundant with diverse vocabulary...",
  "autoTranslate": true,
  "autoAudio": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Đã tạo thành công 5 flashcard từ văn bản.",
  "meta": { ... },
  "deck": [
    {
      "id": "card_001",
      "word": "Ecosystem",
      "meaning": "Hệ sinh thái",
      "pronunciation": "/ˈiːkoʊˌsɪstəm/",
      "example": "The coral reef is a diverse ecosystem.",
      "audioUrl": "/audio/ecosystem.mp3"
    }
  ]
}
```

## 🔌 WebSocket Events (Socket.io)

### Client → Server

| Event | Payload | Mô tả |
|-------|---------|-------|
| `join_battle` | `{ playerName }` | Yêu cầu tham gia thi đấu |
| `submit_answer` | `{ roomId, questionId, answerIndex }` | Gửi câu trả lời |

### Server → Client

| Event | Payload | Mô tả |
|-------|---------|-------|
| `waiting` | `{ message, queuePosition }` | Đang chờ ghép cặp |
| `game_start` | `{ roomId, players, totalQuestions }` | Trận đấu bắt đầu |
| `new_question` | `{ id, word, question, options }` | Câu hỏi mới (mỗi 10s) |
| `answer_result` | `{ isCorrect, correctIndex, pointsEarned }` | Kết quả câu trả lời |
| `update_score` | `{ scores }` | Cập nhật điểm số |
| `game_end` | `{ scores, result }` | Trận đấu kết thúc |
| `opponent_disconnected` | `{ message }` | Đối thủ ngắt kết nối |

## 🐳 Docker

### Build image

```bash
docker build -t cki-backend .
```

### Chạy container

```bash
docker run -p 8080:8080 cki-backend
```

## ☁️ Deploy lên Google Cloud Run

```bash
gcloud run deploy cki-backend \
  --source . \
  --port 8080 \
  --allow-unauthenticated
```

## 📝 Ghi chú kiến trúc MVP → Production

- **Mock API** → Thay bằng Google Cloud Translation API & Text-to-Speech API
- **setTimeout** → Thay bằng Pub/Sub + Cloud Functions
- **In-memory rooms** → Thay bằng Firebase Firestore realtime sync
- **Không auth** → Thêm Firebase Authentication middleware
