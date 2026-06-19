import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Trophy, RotateCcw, ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import FlashcardComponent from "@/components/FlashcardComponent";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import axios from "axios";

export default function StudyMode() {
  const navigate = useNavigate();
  const { deckId } = useParams<{ deckId: string }>();
  const { token } = useAuth();

  const [cards, setCards] = useState<any[]>([]);
  const [deckTitle, setDeckTitle] = useState("Đang tải...");
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const [currentIndex, setCurrentIndex] = useState(0);
  const [ratings, setRatings] = useState<Record<number, "hard" | "good" | "easy">>({});
  const [finished, setFinished] = useState(false);
  const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:8080";

  useEffect(() => {
    const fetchData = async () => {
      if (!deckId) return;
      setLoading(true);
      setErrorMsg("");

      try {
        const authToken = token || localStorage.getItem("token");
        if (!authToken) {
          setErrorMsg("Bạn cần đăng nhập để thực hiện học tập.");
          setLoading(false);
          return;
        }

        // Fetch deck details and flashcards in parallel
        const [deckRes, cardsRes] = await Promise.all([
          axios.get(`${baseUrl}/api/decks/${deckId}`, {
            headers: { Authorization: `Bearer ${authToken}` },
          }),
          axios.get(`${baseUrl}/api/decks/${deckId}/flashcards?limit=100`, {
            headers: { Authorization: `Bearer ${authToken}` },
          }),
        ]);

        if (deckRes.data?.success && deckRes.data?.data) {
          setDeckTitle(deckRes.data.data.title);
        }

        if (cardsRes.data?.success && cardsRes.data?.data) {
          const formatted = cardsRes.data.data.map((c: any) => ({
            id: c.id,
            front: c.wordEn,
            back: c.meaningVi,
            phonetic: c.exampleSentence || "",
            audioUrl: c.audioUrl,
            imageUrl: c.imageUrl,
          }));
          setCards(formatted);
        } else {
          setErrorMsg("Không thể lấy dữ liệu thẻ học.");
        }
      } catch (err: any) {
        console.error("Lỗi khi tải dữ liệu học:", err);
        setErrorMsg(err.response?.data?.message || "Lỗi khi kết nối đến máy chủ.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [deckId, token]);

  const handleRate = async (rating: "hard" | "good" | "easy") => {
    const currentCard = cards[currentIndex];
    const newRatings = { ...ratings, [currentIndex]: rating };
    setRatings(newRatings);

    try {
      const authToken = token || localStorage.getItem("token");
      if (authToken && currentCard?.id) {
        axios.post(
          `${baseUrl}/api/flashcards/${currentCard.id}/review`,
          { rating },
          { headers: { Authorization: `Bearer ${authToken}` } }
        ).catch(err => console.error("Lỗi khi lưu tiến độ học tập:", err));
      }
    } catch (apiErr) {
      console.error("Lỗi lưu tiến độ học tập:", apiErr);
    }

    if (currentIndex + 1 >= cards.length) {
      setFinished(true);
    } else {
      setCurrentIndex((i) => i + 1);
    }
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setRatings({});
    setFinished(false);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="w-10 h-10 animate-spin text-purple-700" />
        <p className="text-gray-500 text-sm">Đang tải dữ liệu bộ thẻ...</p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="p-8 max-w-md mx-auto text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-gray-900">Không thể bắt đầu</h2>
        <p className="text-sm text-gray-500">{errorMsg}</p>
        <button
          onClick={() => navigate("/dashboard")}
          className="px-5 py-2.5 bg-purple-700 text-white rounded-xl text-sm font-semibold hover:bg-purple-800 transition-colors"
        >
          Quay lại Dashboard
        </button>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center space-y-5">
        <div className="w-14 h-14 rounded-full bg-purple-50 text-purple-700 flex items-center justify-center mx-auto">
          <BookOpen className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Bộ thẻ trống</h2>
        <p className="text-sm text-gray-500">
          Bộ thẻ <strong>"{deckTitle}"</strong> hiện tại chưa có flashcard nào. Bạn có thể sử dụng chức năng Tạo bộ bài thông minh bằng AI để tự động tạo từ vựng!
        </p>
        <div className="flex gap-3 justify-center pt-2">
          <button
            onClick={() => navigate("/create")}
            className="px-5 py-2.5 bg-purple-700 text-white rounded-xl text-sm font-semibold hover:bg-purple-800 transition-colors"
          >
            Tạo thẻ bằng AI
          </button>
          <button
            onClick={() => navigate("/dashboard")}
            className="px-5 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
          >
            Về Dashboard
          </button>
        </div>
      </div>
    );
  }

  const easyCount = Object.values(ratings).filter((r) => r === "easy").length;
  const goodCount = Object.values(ratings).filter((r) => r === "good").length;
  const hardCount = Object.values(ratings).filter((r) => r === "hard").length;

  return (
    <div className="p-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Quay lại
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Chế độ học (Spaced Repetition)</h1>
          <p className="text-gray-500 text-sm">{deckTitle}</p>
        </div>
        <div
          className="flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-xl"
          style={{ background: "rgba(75,0,130,0.08)", color: "#4B0082" }}
        >
          <BookOpen className="w-4 h-4" />
          {cards.length} thẻ
        </div>
      </div>

      <AnimatePresence mode="wait">
        {!finished ? (
          <motion.div key="study" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, x: 60 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -60 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                <FlashcardComponent
                  card={cards[currentIndex]}
                  cardIndex={currentIndex}
                  totalCards={cards.length}
                  onRate={handleRate}
                />
              </motion.div>
            </AnimatePresence>

            {/* Ratings so far */}
            {Object.keys(ratings).length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-8 flex justify-center gap-6 text-sm"
              >
                <span className="flex items-center gap-1.5 text-red-400">
                  <span className="w-2 h-2 rounded-full bg-red-400" />
                  Khó: {hardCount}
                </span>
                <span className="flex items-center gap-1.5 text-blue-500">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  Ổn: {goodCount}
                </span>
                <span className="flex items-center gap-1.5 text-emerald-600">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Dễ: {easyCount}
                </span>
              </motion.div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="finished"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-8"
          >
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5 shadow-lg"
              style={{ background: "linear-gradient(135deg, #4B0082, #FF6F61)" }}
            >
              <Trophy className="w-9 h-9 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Tuyệt vời!</h2>
            <p className="text-gray-500 mb-8">Bạn đã hoàn thành phiên học hôm nay</p>

            <div className="grid grid-cols-3 gap-4 mb-8">
              {[
                { label: "Khó", value: hardCount, color: "#FA8072", bg: "rgba(250,128,114,0.1)" },
                { label: "Ổn", value: goodCount, color: "#0047AB", bg: "rgba(0,71,171,0.1)" },
                { label: "Dễ", value: easyCount, color: "#2E8B57", bg: "rgba(46,139,87,0.1)" },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl p-5 text-center" style={{ background: item.bg }}>
                  <p className="text-3xl font-bold" style={{ color: item.color }}>
                    {item.value}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">{item.label}</p>
                </div>
              ))}
            </div>

            <div
              className="p-4 rounded-xl text-sm text-gray-600 mb-6"
              style={{ background: "rgba(75,0,130,0.05)" }}
            >
              Thuật toán SM-2: Bấm <strong>"Khó"</strong> (chưa nhớ) → ôn lại sau <strong>1 ngày</strong>.
              Bấm <strong>"Ổn"</strong> hoặc <strong>"Dễ"</strong> (đã nhớ) → lần đầu ôn sau <strong>1 ngày</strong>,
              lần 2 sau <strong>6 ngày</strong>, sau đó khoảng cách tăng dần.
              Bấm <strong>"Dễ"</strong> nhiều lần giúp khoảng cách ôn xa hơn, bấm <strong>"Ổn"</strong> giữ khoảng cách vừa phải.
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={handleRestart}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition-all hover:opacity-90 hover:shadow-lg"
                style={{ background: "linear-gradient(135deg, #4B0082, #7B2FBE)" }}
              >
                <RotateCcw className="w-4 h-4" />
                Học lại từ đầu
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
