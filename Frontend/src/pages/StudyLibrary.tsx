import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Search, Plus, Loader2, AlertCircle, X, Sparkles, CheckCircle2, Volume2 } from "lucide-react";
import DeckCard from "@/components/DeckCard";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import axios from "axios";

export default function StudyLibrary() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [decks, setDecks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal state for creating a single flashcard
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedDeckId, setSelectedDeckId] = useState("");
  const [newWord, setNewWord] = useState("");
  const [creating, setCreating] = useState(false);
  const [createResult, setCreateResult] = useState<any>(null);
  const [createError, setCreateError] = useState("");

  const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:8080";

  const fetchDecks = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const authToken = token || localStorage.getItem("token");
      if (!authToken) {
        setErrorMsg("Vui lòng đăng nhập để xem các bộ thẻ.");
        setLoading(false);
        return;
      }

      const response = await axios.get(`${baseUrl}/api/decks?limit=100`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (response.data && response.data.success) {
        setDecks(response.data.data || []);
      } else {
        setErrorMsg("Không thể tải danh sách bộ thẻ.");
      }
    } catch (error: any) {
      console.error("Lỗi lấy danh sách bộ thẻ:", error);
      setErrorMsg(error.response?.data?.message || "Lỗi kết nối đến máy chủ.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDecks();
  }, [token]);

  const filteredDecks = decks.filter((d) =>
    d.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleStudy = (deckId: string) => {
    navigate(`/study/${deckId}`);
  };

  const handleCreateFlashcard = async () => {
    if (!selectedDeckId || !newWord.trim()) return;

    setCreating(true);
    setCreateError("");
    setCreateResult(null);

    try {
      const authToken = token || localStorage.getItem("token");
      const response = await axios.post(
        `${baseUrl}/api/flashcards/generate-single`,
        { deckId: selectedDeckId, word: newWord.trim() },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );

      if (response.data?.success) {
        setCreateResult(response.data.data);
        setNewWord("");
        // Refresh decks to update card count
        fetchDecks();
      } else {
        setCreateError(response.data?.message || "Không thể tạo thẻ.");
      }
    } catch (error: any) {
      console.error("Lỗi tạo thẻ:", error);
      setCreateError(error.response?.data?.message || "Lỗi kết nối đến máy chủ.");
    } finally {
      setCreating(false);
    }
  };

  const playAudio = (audioUrl: string) => {
    if (!audioUrl) return;
    const audio = new Audio(audioUrl);
    audio.play().catch((err) => console.error("Lỗi phát audio:", err));
  };

  const openCreateModal = () => {
    setShowCreateModal(true);
    setCreateResult(null);
    setCreateError("");
    setNewWord("");
    if (decks.length > 0 && !selectedDeckId) {
      setSelectedDeckId(decks[0].id);
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-purple-700" />
            Học từ vựng
          </h1>
          <p className="text-gray-500 mt-1">
            Chọn bộ thẻ để bắt đầu ôn tập với Spaced Repetition
          </p>
        </div>
        <button
          onClick={openCreateModal}
          disabled={decks.length === 0}
          className="flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-white transition-all hover:opacity-90 hover:shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: "linear-gradient(135deg, #4B0082, #7B2FBE)" }}
        >
          <Plus className="w-5 h-5" />
          Tạo thẻ thủ công
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Tìm kiếm bộ bài..."
          className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 bg-white shadow-sm transition-all"
        />
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="w-10 h-10 animate-spin text-purple-700" />
          <p className="text-gray-500 text-sm">Đang tải danh sách bộ thẻ...</p>
        </div>
      )}

      {/* Error */}
      {errorMsg && !loading && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-100">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-600">{errorMsg}</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && !errorMsg && decks.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-16"
        >
          <div className="w-20 h-20 rounded-full bg-purple-50 text-purple-700 flex items-center justify-center mx-auto mb-5">
            <BookOpen className="w-9 h-9" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Chưa có bộ thẻ nào
          </h2>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            Bạn cần tạo bộ thẻ trước khi bắt đầu học. Hãy sử dụng chức năng
            "Tạo bộ bài" để bắt đầu!
          </p>
          <button
            onClick={() => navigate("/create")}
            className="px-6 py-3 rounded-xl font-semibold text-white transition-all hover:opacity-90 hover:shadow-lg"
            style={{ background: "linear-gradient(135deg, #4B0082, #7B2FBE)" }}
          >
            <Sparkles className="w-4 h-4 inline-block mr-2" />
            Tạo bộ bài bằng AI
          </button>
        </motion.div>
      )}

      {/* Deck Grid */}
      {!loading && !errorMsg && filteredDecks.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500 font-medium">
              {filteredDecks.length} bộ thẻ
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredDecks.map((deck, i) => (
              <motion.div
                key={deck.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <DeckCard deck={deck} onStudy={handleStudy} />
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* No search results */}
      {!loading &&
        !errorMsg &&
        decks.length > 0 &&
        filteredDecks.length === 0 && (
          <div className="text-center py-12">
            <Search className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">
              Không tìm thấy bộ thẻ nào khớp với "{searchQuery}"
            </p>
          </div>
        )}

      {/* Create Flashcard Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-5"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
                    style={{
                      background: "linear-gradient(135deg, #4B0082, #7B2FBE)",
                    }}
                  >
                    <Plus className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">
                      Tạo thẻ thủ công
                    </h2>
                    <p className="text-xs text-gray-500">
                      Nhập từ tiếng Anh → Hệ thống tự sinh nghĩa, audio, ảnh
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Deck Selector */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Chọn bộ thẻ
                </label>
                <select
                  value={selectedDeckId}
                  onChange={(e) => setSelectedDeckId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 bg-white"
                >
                  {decks.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title} ({d._count?.flashcards ?? 0} thẻ)
                    </option>
                  ))}
                </select>
              </div>

              {/* Word Input */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Từ vựng tiếng Anh
                </label>
                <input
                  type="text"
                  value={newWord}
                  onChange={(e) => setNewWord(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !creating) handleCreateFlashcard();
                  }}
                  placeholder="VD: beautiful, resilient, abundant..."
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400"
                  autoFocus
                />
              </div>

              {/* AI Info */}
              <div
                className="flex items-start gap-3 p-3.5 rounded-xl text-xs"
                style={{ background: "rgba(75,0,130,0.05)" }}
              >
                <Sparkles
                  className="w-4 h-4 mt-0.5 flex-shrink-0"
                  style={{ color: "#4B0082" }}
                />
                <p className="text-gray-600">
                  Hệ thống sẽ sử dụng <strong>Google Cloud Translation</strong>{" "}
                  để dịch nghĩa, <strong>Text-to-Speech</strong> để sinh audio
                  phát âm, và tự động tìm ảnh minh họa.
                </p>
              </div>

              {/* Error */}
              {createError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {createError}
                </div>
              )}

              {/* Success Result */}
              {createResult && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/50 space-y-2"
                >
                  <div className="flex items-center gap-2 text-emerald-700 text-sm font-semibold">
                    <CheckCircle2 className="w-4 h-4" />
                    Tạo thẻ thành công!
                  </div>
                  <div className="flex items-center gap-3 bg-white rounded-lg p-3 border border-gray-100">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900">
                        {createResult.wordEn}
                      </p>
                      <p className="text-sm text-gray-600">
                        {createResult.meaningVi}
                      </p>
                    </div>
                    {createResult.audioUrl && (
                      <button
                        onClick={() => playAudio(createResult.audioUrl)}
                        className="p-2 rounded-lg hover:bg-purple-50 transition-colors"
                      >
                        <Volume2
                          className="w-4 h-4"
                          style={{ color: "#4B0082" }}
                        />
                      </button>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Submit Button */}
              <button
                onClick={handleCreateFlashcard}
                disabled={!newWord.trim() || !selectedDeckId || creating}
                className="w-full py-3.5 rounded-xl font-bold text-white text-sm transition-all duration-200 hover:opacity-90 hover:shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{
                  background: "linear-gradient(135deg, #4B0082, #7B2FBE)",
                }}
              >
                {creating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Đang tạo thẻ với AI...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Tạo thẻ
                  </>
                )}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
