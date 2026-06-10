import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Trophy, RotateCcw, ArrowLeft } from "lucide-react";
import FlashcardComponent from "@/components/FlashcardComponent";
import { mockFlashcards } from "@/data/mockData";

interface StudyModeProps {
  onBack: () => void;
}

export default function StudyMode({ onBack }: StudyModeProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [ratings, setRatings] = useState<Record<number, "hard" | "good" | "easy">>({});
  const [finished, setFinished] = useState(false);

  const handleRate = (rating: "hard" | "good" | "easy") => {
    const newRatings = { ...ratings, [currentIndex]: rating };
    setRatings(newRatings);
    if (currentIndex + 1 >= mockFlashcards.length) {
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

  const easyCount = Object.values(ratings).filter((r) => r === "easy").length;
  const goodCount = Object.values(ratings).filter((r) => r === "good").length;
  const hardCount = Object.values(ratings).filter((r) => r === "hard").length;

  return (
    <div className="p-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Quay lại
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Chế độ học (Spaced Repetition)</h1>
          <p className="text-gray-500 text-sm">IELTS Vocabulary — 5 thẻ hôm nay</p>
        </div>
        <div className="flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-xl"
          style={{ background: "rgba(75,0,130,0.08)", color: "#4B0082" }}>
          <BookOpen className="w-4 h-4" />
          {mockFlashcards.length} thẻ
        </div>
      </div>

      <AnimatePresence mode="wait">
        {!finished ? (
          <motion.div
            key="study"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, x: 60 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -60 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                <FlashcardComponent
                  card={mockFlashcards[currentIndex]}
                  cardIndex={currentIndex}
                  totalCards={mockFlashcards.length}
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
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5 shadow-lg"
              style={{ background: "linear-gradient(135deg, #4B0082, #FF6F61)" }}>
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
                  <p className="text-3xl font-bold" style={{ color: item.color }}>{item.value}</p>
                  <p className="text-sm text-gray-600 mt-1">{item.label}</p>
                </div>
              ))}
            </div>

            <div className="p-4 rounded-xl text-sm text-gray-600 mb-6" style={{ background: "rgba(75,0,130,0.05)" }}>
              Hệ thống Spaced Repetition sẽ lên lịch ôn tập thẻ "Khó" sau{" "}
              <strong>1 ngày</strong>, thẻ "Ổn" sau <strong>3 ngày</strong>, thẻ "Dễ" sau{" "}
              <strong>7 ngày</strong>.
            </div>

            <button
              onClick={handleRestart}
              className="flex items-center gap-2 mx-auto px-6 py-3 rounded-xl font-semibold text-white transition-all hover:opacity-90 hover:shadow-lg"
              style={{ background: "linear-gradient(135deg, #4B0082, #7B2FBE)" }}
            >
              <RotateCcw className="w-4 h-4" />
              Học lại từ đầu
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
