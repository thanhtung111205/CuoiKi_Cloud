import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Volume2, Languages, Loader2, CheckCircle2, RotateCcw } from "lucide-react";
import { generatedFlashcards } from "@/data/mockData";

export default function CreateDeck() {
  const [text, setText] = useState("");
  const [autoTranslate, setAutoTranslate] = useState(true);
  const [autoAudio, setAutoAudio] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cards, setCards] = useState<typeof generatedFlashcards>([]);
  const [deckName, setDeckName] = useState("");

  const handleCreate = () => {
    if (!text.trim()) return;
    setLoading(true);
    setCards([]);
    setTimeout(() => {
      setLoading(false);
      setCards(generatedFlashcards);
    }, 2500);
  };

  const handleReset = () => {
    setCards([]);
    setText("");
    setDeckName("");
  };

  return (
    <div className="p-8 space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Tạo bộ bài thông minh</h1>
        <p className="text-gray-500 mt-1">Dán văn bản và để AI tự động tạo flashcard cho bạn</p>
      </div>

      {/* Main form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5 shadow-sm"
      >
        {/* Deck name */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Tên bộ bài</label>
          <input
            type="text"
            value={deckName}
            onChange={(e) => setDeckName(e.target.value)}
            placeholder="VD: IELTS Vocabulary - Week 3"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-all"
            style={{ "--tw-ring-color": "#4B0082" } as React.CSSProperties}
            onFocus={(e) => (e.target.style.borderColor = "#4B0082")}
            onBlur={(e) => (e.target.style.borderColor = "#e5e7eb")}
          />
        </div>

        {/* Text area */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Văn bản nguồn
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Dán văn bản tiếng Anh vào đây... AI sẽ tự động trích xuất các từ quan trọng và tạo flashcard cho bạn.

Ví dụ: The concept of sustainable development emerged as a paramount concern in the late 20th century. Nations collaborated to find pragmatic solutions to environmental challenges, demonstrating remarkable resilience..."
            rows={8}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none transition-all"
            onFocus={(e) => (e.target.style.borderColor = "#4B0082")}
            onBlur={(e) => (e.target.style.borderColor = "#e5e7eb")}
          />
          <p className="text-xs text-gray-400 mt-1.5">{text.length} ký tự</p>
        </div>

        {/* Toggles */}
        <div className="flex gap-6">
          <Toggle
            label="Tự động dịch"
            icon={<Languages className="w-4 h-4" />}
            value={autoTranslate}
            onChange={setAutoTranslate}
            color="#4B0082"
          />
          <Toggle
            label="Sinh âm thanh"
            icon={<Volume2 className="w-4 h-4" />}
            value={autoAudio}
            onChange={setAutoAudio}
            color="#0047AB"
          />
        </div>

        {/* AI info */}
        <div className="flex items-start gap-3 p-4 rounded-xl text-sm" style={{ background: "rgba(75,0,130,0.05)" }}>
          <Sparkles className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#4B0082" }} />
          <p className="text-gray-600">
            AI sẽ sử dụng <strong>Google Cloud Translation API</strong> để dịch và{" "}
            <strong>Text-to-Speech API</strong> để sinh âm thanh (giả lập trong MVP này).
          </p>
        </div>

        {/* Submit */}
        <button
          onClick={handleCreate}
          disabled={!text.trim() || loading}
          className="w-full py-4 rounded-xl font-bold text-white text-base transition-all duration-200 hover:opacity-90 hover:shadow-lg active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          style={{ background: "linear-gradient(135deg, #4B0082, #7B2FBE)" }}
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Đang xử lý với AI...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Tạo bộ bài
            </>
          )}
        </button>
      </motion.div>

      {/* Loading animation */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-2xl border border-purple-100 p-8 text-center shadow-sm"
          >
            <div className="flex justify-center mb-4">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 rounded-full border-4 border-purple-100" />
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-purple-700 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Sparkles className="w-6 h-6" style={{ color: "#4B0082" }} />
                </div>
              </div>
            </div>
            <h3 className="font-bold text-gray-800 text-lg mb-2">AI đang phân tích văn bản</h3>
            <div className="space-y-2 text-sm text-gray-500">
              {[
                "Trích xuất từ vựng quan trọng...",
                "Gọi Google Cloud Translation API...",
                "Sinh phiên âm và ví dụ...",
              ].map((step, i) => (
                <motion.p
                  key={step}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.7 }}
                  className="flex items-center justify-center gap-2"
                >
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {step}
                </motion.p>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Generated cards */}
      <AnimatePresence>
        {cards.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <h2 className="font-bold text-gray-900">
                  Đã tạo {cards.length} flashcard
                </h2>
              </div>
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Tạo lại
              </button>
            </div>

            <div className="space-y-3">
              {cards.map((card, i) => (
                <motion.div
                  key={card.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-5 hover:border-purple-200 transition-all hover:shadow-sm"
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                    style={{ background: "linear-gradient(135deg, #4B0082, #7B2FBE)" }}
                  >
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-3">
                      <span className="font-bold text-gray-900">{card.front}</span>
                      <span className="text-sm text-gray-400">{card.phonetic}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5">{card.back}</p>
                  </div>
                  <Volume2 className="w-4 h-4 text-gray-300 flex-shrink-0" />
                </motion.div>
              ))}
            </div>

            <button
              className="w-full py-3.5 rounded-xl font-semibold text-white text-sm transition-all hover:opacity-90 hover:shadow-lg"
              style={{ background: "linear-gradient(135deg, #2E8B57, #3aad6d)" }}
            >
              Lưu bộ bài ({cards.length} thẻ)
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Toggle({
  label,
  icon,
  value,
  onChange,
  color,
}: {
  label: string;
  icon: React.ReactNode;
  value: boolean;
  onChange: (v: boolean) => void;
  color: string;
}) {
  return (
    <div
      className="flex items-center gap-3 cursor-pointer select-none"
      onClick={() => onChange(!value)}
    >
      <div
        className="relative w-11 h-6 rounded-full transition-all duration-200"
        style={{ background: value ? color : "#e5e7eb" }}
      >
        <div
          className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200"
          style={{ transform: value ? "translateX(20px)" : "translateX(0)" }}
        />
      </div>
      <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
        <span style={{ color: value ? color : "#6b7280" }}>{icon}</span>
        {label}
      </div>
    </div>
  );
}
