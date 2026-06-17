import { useState } from "react";
import { motion } from "framer-motion";
import { Volume2, RotateCcw } from "lucide-react";
interface FlashcardComponentProps {
  card: {
    id: string | number;
    front: string;
    back: string;
    phonetic?: string;
    audioUrl?: string | null;
    imageUrl?: string | null;
  };
  cardIndex: number;
  totalCards: number;
  onRate: (rating: "hard" | "good" | "easy") => void;
}

export default function FlashcardComponent({
  card,
  cardIndex,
  totalCards,
  onRate,
}: FlashcardComponentProps) {
  const [flipped, setFlipped] = useState(false);

  const handleFlip = () => setFlipped((f) => !f);

  const handleRate = (rating: "hard" | "good" | "easy") => {
    setFlipped(false);
    setTimeout(() => onRate(rating), 150);
  };

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-xl mx-auto">
      {/* Progress */}
      <div className="w-full">
        <div className="flex justify-between text-sm text-gray-500 mb-2">
          <span>Thẻ {cardIndex + 1} / {totalCards}</span>
          <span>{Math.round(((cardIndex) / totalCards) * 100)}% hoàn thành</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: "linear-gradient(90deg, #4B0082, #FF6F61)" }}
            initial={{ width: 0 }}
            animate={{ width: `${(cardIndex / totalCards) * 100}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
      </div>

      {/* Card */}
      <div
        className="card-flip-container w-full"
        style={{ height: "280px" }}
        onClick={handleFlip}
      >
        <div className={`card-flip-inner ${flipped ? "flipped" : ""}`}>
          {/* Front */}
          <div className="card-front rounded-2xl shadow-xl cursor-pointer select-none"
            style={{ background: "linear-gradient(135deg, #4B0082 0%, #7B2FBE 100%)" }}
          >
            <div className="w-full h-full flex flex-col items-center justify-center p-8 gap-4">
              <span className="text-white/50 text-xs uppercase tracking-widest font-semibold">
                Nhấp để lật thẻ
              </span>
              <h2 className="text-5xl font-bold text-white text-center">{card.front}</h2>
              {card.audioUrl && (
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const audio = new Audio(card.audioUrl || undefined);
                      audio.play().catch(err => console.error("Lỗi phát audio:", err));
                    }}
                    className="flex items-center gap-1.5 text-white/70 hover:text-white transition-colors text-xs bg-white/10 px-3 py-1.5 rounded-xl hover:bg-white/20"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    Phát âm
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Back */}
          <div className="card-back rounded-2xl shadow-xl cursor-pointer select-none bg-white border-2"
            style={{ borderColor: "#4B0082" }}
          >
            <div className="w-full h-full flex flex-col items-center justify-center p-6 gap-2">
              <span className="text-xs uppercase tracking-widest font-semibold" style={{ color: "#4B0082" }}>
                Nghĩa
              </span>
              <h2 className="text-2xl font-bold text-gray-800 text-center">{card.back}</h2>
              {card.imageUrl && (
                <img
                  src={card.imageUrl}
                  alt={card.front}
                  className="w-20 h-16 object-cover rounded-xl border border-purple-100 shadow-sm mt-1"
                />
              )}
              {card.phonetic && <p className="text-sm text-gray-400 font-medium">{card.phonetic}</p>}
              <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
                <RotateCcw className="w-3 h-3" />
                Nhấp để lật lại
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Rating buttons */}
      <motion.div
        className="flex gap-4 w-full"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: flipped ? 1 : 0.3, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <button
          onClick={() => handleRate("hard")}
          disabled={!flipped}
          className="flex-1 py-3.5 rounded-xl font-semibold text-white text-sm transition-all duration-200 hover:scale-105 hover:shadow-lg active:scale-95 disabled:cursor-not-allowed"
          style={{ background: "#FA8072" }}
        >
          😓 Khó
        </button>
        <button
          onClick={() => handleRate("good")}
          disabled={!flipped}
          className="flex-1 py-3.5 rounded-xl font-semibold text-white text-sm transition-all duration-200 hover:scale-105 hover:shadow-lg active:scale-95 disabled:cursor-not-allowed"
          style={{ background: "#0047AB" }}
        >
          👍 Ổn
        </button>
        <button
          onClick={() => handleRate("easy")}
          disabled={!flipped}
          className="flex-1 py-3.5 rounded-xl font-semibold text-white text-sm transition-all duration-200 hover:scale-105 hover:shadow-lg active:scale-95 disabled:cursor-not-allowed"
          style={{ background: "#2E8B57" }}
        >
          🚀 Dễ
        </button>
      </motion.div>

      {!flipped && (
        <p className="text-xs text-gray-400">Hãy lật thẻ trước khi đánh giá</p>
      )}
    </div>
  );
}
