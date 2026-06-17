// ====================================================
// CKI CLOUD G12 - ENTRY POINT
// Hệ sinh thái Học ngoại ngữ và Thi đấu Flashcard (MVP)
// ====================================================
// Kiến trúc: Express REST API + Socket.io WebSocket Server
// Deploy target: Google Cloud Run (port 8080)
// ====================================================

// --- 1. Nạp biến môi trường từ file .env ---
require("dotenv").config();

// --- 2. Import thư viện ---
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

// --- 3. Import routes ---
const apiRoutes = require("./routes/api");

// --- 4. Khởi tạo Express App ---
const app = express();

// Tạo HTTP server (cần thiết để Socket.io và Express chia sẻ cùng một server)
const server = http.createServer(app);

// Import con Worker xử lý ngầm để lắng nghe hàng đợi Pub/Sub
const { startWorker } = require("./workers/generationWorker");

const allowedOrigins = [
  "http://localhost:5173",
  "https://cuoiki-cloud.pages.dev",
  "https://nhom12c365httt.live"
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Cho phép requests không có origin (như mobile apps hoặc curl/postman)
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1 || origin.startsWith("http://localhost:")) {
        callback(null, true);
      } else {
        callback(new Error("Không được phép bởi CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// Parse JSON body từ request
app.use(express.json());

// Parse URL-encoded body (form data)
app.use(express.urlencoded({ extended: true }));

// --- 6. Đăng ký Routes ---
app.use("/api", apiRoutes);

// Health check endpoint (Cloud Run dùng để kiểm tra container còn sống)
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "CKI Cloud G12 - Backend API",
    version: "1.0.0-mvp",
    timestamp: new Date().toISOString(),
  });
});

// ====================================================
// --- 7. WEBSOCKET SERVER (Socket.io) ---
// ====================================================
// Trong thực tế, trạng thái phòng thi đấu sẽ được đồng bộ bằng Firebase Firestore
// Hiện tại dùng bộ nhớ in-memory cho MVP
// ====================================================

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// --- Dữ liệu mẫu: Ngân hàng câu hỏi trắc nghiệm ---
const sampleQuestions = [
  {
    id: "q1",
    word: "Abundant",
    question: "Từ 'Abundant' có nghĩa là gì?",
    options: ["Thiếu hụt", "Dồi dào", "Bình thường", "Hiếm có"],
    correctIndex: 1, // "Dồi dào"
  },
  {
    id: "q2",
    word: "Resilient",
    question: "Từ 'Resilient' có nghĩa là gì?",
    options: ["Yếu đuối", "Cứng nhắc", "Kiên cường", "Lười biếng"],
    correctIndex: 2, // "Kiên cường"
  },
  {
    id: "q3",
    word: "Diligent",
    question: "Từ 'Diligent' có nghĩa là gì?",
    options: ["Siêng năng", "Bất cẩn", "Thông minh", "Chậm chạp"],
    correctIndex: 0, // "Siêng năng"
  },
  {
    id: "q4",
    word: "Eloquent",
    question: "Từ 'Eloquent' có nghĩa là gì?",
    options: ["Im lặng", "Vụng về", "Hùng biện", "Nhút nhát"],
    correctIndex: 2, // "Hùng biện"
  },
  {
    id: "q5",
    word: "Pragmatic",
    question: "Từ 'Pragmatic' có nghĩa là gì?",
    options: ["Lý tưởng", "Thực dụng", "Mơ mộng", "Bảo thủ"],
    correctIndex: 1, // "Thực dụng"
  },
  {
    id: "q6",
    word: "Perseverance",
    question: "Từ 'Perseverance' có nghĩa là gì?",
    options: ["Sự bỏ cuộc", "Sự kiên trì", "Sự vội vàng", "Sự do dự"],
    correctIndex: 1, // "Sự kiên trì"
  },
  {
    id: "q7",
    word: "Ambiguous",
    question: "Từ 'Ambiguous' có nghĩa là gì?",
    options: ["Rõ ràng", "Mơ hồ", "Chính xác", "Cụ thể"],
    correctIndex: 1, // "Mơ hồ"
  },
  {
    id: "q8",
    word: "Inevitable",
    question: "Từ 'Inevitable' có nghĩa là gì?",
    options: ["Có thể tránh", "Không chắc chắn", "Không thể tránh khỏi", "Tạm thời"],
    correctIndex: 2, // "Không thể tránh khỏi"
  },
];

// --- Quản lý phòng thi đấu (in-memory cho MVP) ---
// Trong thực tế, trạng thái phòng thi đấu sẽ được đồng bộ bằng Firebase Firestore
const waitingQueue = []; // Hàng đợi người chơi đang chờ ghép cặp
const activeRooms = {}; // Các phòng đang hoạt động: { roomId: { players, scores, questionIndex, interval } }

/**
 * Tạo ID phòng ngẫu nhiên
 */
function generateRoomId() {
  return `room_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Lấy câu hỏi tiếp theo cho phòng (vòng lặp nếu hết câu hỏi)
 */
function getNextQuestion(room) {
  const question = sampleQuestions[room.questionIndex % sampleQuestions.length];
  room.questionIndex++;
  return {
    id: question.id,
    word: question.word,
    question: question.question,
    options: question.options,
    questionNumber: room.questionIndex,
    // KHÔNG gửi correctIndex cho client (tránh gian lận)
  };
}

// --- Xử lý kết nối WebSocket ---
io.on("connection", (socket) => {
  console.log(`[Socket.io] Người chơi kết nối: ${socket.id}`);

  // -----------------------------------------------
  // Sự kiện: join_battle
  // Người chơi yêu cầu tham gia thi đấu
  // -----------------------------------------------
  socket.on("join_battle", (data) => {
    const playerName = data?.playerName || `Player_${socket.id.substring(0, 5)}`;
    console.log(`[Socket.io] ${playerName} (${socket.id}) yêu cầu thi đấu`);

    // Thêm vào hàng đợi
    waitingQueue.push({
      socketId: socket.id,
      playerName: playerName,
    });

    // Thông báo cho người chơi đang chờ
    socket.emit("waiting", {
      message: "Đang tìm đối thủ... Vui lòng chờ.",
      queuePosition: waitingQueue.length,
    });

    // --- Kiểm tra: Đủ 2 người → Tạo phòng ---
    if (waitingQueue.length >= 2) {
      const player1 = waitingQueue.shift();
      const player2 = waitingQueue.shift();

      const roomId = generateRoomId();

      // Khởi tạo dữ liệu phòng
      activeRooms[roomId] = {
        players: [player1, player2],
        scores: {
          [player1.socketId]: 0,
          [player2.socketId]: 0,
        },
        questionIndex: 0,
        interval: null, // Sẽ lưu setInterval reference
        totalQuestions: 5, // Số câu hỏi tối đa cho 1 trận
        answeredCurrent: 0, // Số người đã trả lời câu hiện tại
      };

      // Đưa cả 2 socket vào cùng room
      const socket1 = io.sockets.sockets.get(player1.socketId);
      const socket2 = io.sockets.sockets.get(player2.socketId);

      if (socket1) socket1.join(roomId);
      if (socket2) socket2.join(roomId);

      // Lưu roomId vào socket data để xử lý disconnect
      if (socket1) socket1.data.roomId = roomId;
      if (socket2) socket2.data.roomId = roomId;

      console.log(`[Socket.io] Phòng ${roomId} được tạo: ${player1.playerName} vs ${player2.playerName}`);

      // --- Phát sự kiện game_start cho cả 2 người chơi ---
      io.to(roomId).emit("game_start", {
        roomId: roomId,
        players: [
          { id: player1.socketId, name: player1.playerName },
          { id: player2.socketId, name: player2.playerName },
        ],
        message: "Trận đấu bắt đầu! Chúc các bạn thi đấu vui vẻ 🎮",
        totalQuestions: activeRooms[roomId].totalQuestions,
      });

      // --- Gửi câu hỏi đầu tiên ngay lập tức ---
      const firstQuestion = getNextQuestion(activeRooms[roomId]);
      io.to(roomId).emit("new_question", firstQuestion);

      // --- Phát sự kiện new_question mỗi 10 giây ---
      activeRooms[roomId].interval = setInterval(() => {
        const room = activeRooms[roomId];
        if (!room) return;

        // Kiểm tra đã hết số câu hỏi chưa
        if (room.questionIndex >= room.totalQuestions) {
          clearInterval(room.interval);

          // Xác định kết quả
          const [p1, p2] = room.players;
          const score1 = room.scores[p1.socketId];
          const score2 = room.scores[p2.socketId];

          let result;
          if (score1 > score2) {
            result = { winnerId: p1.socketId, winnerName: p1.playerName };
          } else if (score2 > score1) {
            result = { winnerId: p2.socketId, winnerName: p2.playerName };
          } else {
            result = { winnerId: null, winnerName: "Hòa" };
          }

          // Phát sự kiện kết thúc trận đấu
          io.to(roomId).emit("game_end", {
            message: "Trận đấu kết thúc! 🏆",
            scores: {
              [p1.playerName]: score1,
              [p2.playerName]: score2,
            },
            result: result,
          });

          // Dọn dẹp phòng
          delete activeRooms[roomId];
          console.log(`[Socket.io] Phòng ${roomId} kết thúc`);
          return;
        }

        // Reset số người đã trả lời cho câu mới
        room.answeredCurrent = 0;

        // Gửi câu hỏi tiếp theo
        const nextQuestion = getNextQuestion(room);
        io.to(roomId).emit("new_question", nextQuestion);
        console.log(`[Socket.io] Phòng ${roomId} - Câu hỏi #${nextQuestion.questionNumber}`);
      }, 10000); // 10 giây mỗi câu
    }
  });

  // -----------------------------------------------
  // Sự kiện: submit_answer
  // Người chơi gửi câu trả lời
  // -----------------------------------------------
  socket.on("submit_answer", (data) => {
    const { roomId, questionId, answerIndex } = data;
    const room = activeRooms[roomId];

    if (!room) {
      socket.emit("error_message", { message: "Phòng không tồn tại hoặc đã kết thúc." });
      return;
    }

    // Tìm câu hỏi tương ứng
    const question = sampleQuestions.find((q) => q.id === questionId);
    if (!question) {
      socket.emit("error_message", { message: "Câu hỏi không hợp lệ." });
      return;
    }

    // Kiểm tra đáp án
    const isCorrect = answerIndex === question.correctIndex;

    // Cập nhật điểm số nếu đúng (+10 điểm mỗi câu đúng)
    if (isCorrect && room.scores[socket.id] !== undefined) {
      room.scores[socket.id] += 10;
    }

    // Tăng số người đã trả lời
    room.answeredCurrent++;

    // Gửi kết quả cho người trả lời
    socket.emit("answer_result", {
      questionId: questionId,
      isCorrect: isCorrect,
      correctIndex: question.correctIndex,
      pointsEarned: isCorrect ? 10 : 0,
    });

    // --- Phát sự kiện update_score cho cả 2 người chơi trong room ---
    const [p1, p2] = room.players;
    io.to(roomId).emit("update_score", {
      scores: [
        { id: p1.socketId, name: p1.playerName, score: room.scores[p1.socketId] },
        { id: p2.socketId, name: p2.playerName, score: room.scores[p2.socketId] },
      ],
    });

    console.log(
      `[Socket.io] ${socket.id} trả lời ${isCorrect ? "ĐÚNG ✅" : "SAI ❌"} - Phòng ${roomId}`
    );
  });

  // -----------------------------------------------
  // Sự kiện: disconnect
  // Người chơi ngắt kết nối
  // -----------------------------------------------
  socket.on("disconnect", () => {
    console.log(`[Socket.io] Người chơi ngắt kết nối: ${socket.id}`);

    // Xóa khỏi hàng đợi nếu đang chờ
    const queueIndex = waitingQueue.findIndex((p) => p.socketId === socket.id);
    if (queueIndex !== -1) {
      waitingQueue.splice(queueIndex, 1);
      console.log(`[Socket.io] Đã xóa ${socket.id} khỏi hàng đợi`);
    }

    // Xử lý nếu đang trong phòng thi đấu
    const roomId = socket.data.roomId;
    if (roomId && activeRooms[roomId]) {
      const room = activeRooms[roomId];

      // Dừng interval gửi câu hỏi
      if (room.interval) {
        clearInterval(room.interval);
      }

      // Thông báo cho người chơi còn lại
      io.to(roomId).emit("opponent_disconnected", {
        message: "Đối thủ đã ngắt kết nối. Trận đấu kết thúc.",
      });

      // Dọn dẹp phòng
      delete activeRooms[roomId];
      console.log(`[Socket.io] Phòng ${roomId} bị hủy do người chơi rời`);
    }
  });
});

// ====================================================
// --- 8. KHỞI CHẠY SERVER ---
// ====================================================
const PORT = process.env.PORT || 8080;

server.listen(PORT, () => {
  console.log("====================================================");
  console.log(" CKI CLOUD G12 - Backend Server");
  console.log(" Hệ sinh thái Học ngoại ngữ & Thi đấu Flashcard");
  console.log("====================================================");
  console.log(`🚀 REST API:    http://localhost:${PORT}`);
  console.log(`🔌 WebSocket:   http://localhost:${PORT} (Socket.io)`);
  console.log(`📋 Health:      http://localhost:${PORT}/`);
  console.log(`🃏 Generate:    POST http://localhost:${PORT}/api/generate-deck`);
  console.log("====================================================");
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`📅 Started at:  ${new Date().toISOString()}`);
  console.log("====================================================");
  // Khởi chạy tiến trình nền lắng nghe task sinh bộ flashcard
  startWorker();
});
