import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Swords, Trophy, Clock, Zap, User, Bot, Shield } from "lucide-react";
import { battleQuestions } from "@/data/mockData";

export default function BattleArena() {
  const [myScore, setMyScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(10);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [battleStarted, setBattleStarted] = useState(false);
  const [battleEnded, setBattleEnded] = useState(false);
  const [combo, setCombo] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const opponentRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentQuestion = battleQuestions[currentQuestionIndex];

  const clearAllIntervals = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (opponentRef.current) clearInterval(opponentRef.current);
  };

  const startBattle = () => {
    setBattleStarted(true);
    setMyScore(0);
    setOpponentScore(0);
    setCurrentQuestionIndex(0);
    setTimeLeft(10);
    setSelectedAnswer(null);
    setBattleEnded(false);
    setCombo(0);
  };

  useEffect(() => {
    if (!battleStarted || battleEnded) return;

    // Countdown timer
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          handleTimeout();
          return 10;
        }
        return t - 1;
      });
    }, 1000);

    // Thực tế sẽ dùng Firebase Firestore realtime ở đây
    opponentRef.current = setInterval(() => {
      setOpponentScore((s) => s + Math.floor(Math.random() * 15) + 5);
    }, 5000);

    return () => clearAllIntervals();
  }, [battleStarted, currentQuestionIndex, battleEnded]);

  const handleTimeout = () => {
    clearAllIntervals();
    setSelectedAnswer(-1);
    setCombo(0);
    setTimeout(() => nextQuestion(), 1200);
  };

  const handleAnswer = (index: number) => {
    if (selectedAnswer !== null) return;
    clearAllIntervals();
    setSelectedAnswer(index);

    if (index === currentQuestion.correct) {
      const newCombo = combo + 1;
      setCombo(newCombo);
      const points = 10 + (newCombo > 1 ? (newCombo - 1) * 5 : 0);
      setMyScore((s) => s + points);
    } else {
      setCombo(0);
    }

    setTimeout(() => nextQuestion(), 1200);
  };

  const nextQuestion = () => {
    const next = currentQuestionIndex + 1;
    if (next >= battleQuestions.length) {
      setBattleEnded(true);
      setBattleStarted(false);
    } else {
      setCurrentQuestionIndex(next);
      setSelectedAnswer(null);
      setTimeLeft(10);
    }
  };

  const getButtonStyle = (index: number) => {
    if (selectedAnswer === null) {
      return { background: "white", border: "2px solid #e5e7eb", color: "#333" };
    }
    if (index === currentQuestion.correct) {
      return { background: "#2E8B57", border: "2px solid #2E8B57", color: "white" };
    }
    if (index === selectedAnswer && index !== currentQuestion.correct) {
      return { background: "#e53e3e", border: "2px solid #e53e3e", color: "white" };
    }
    return { background: "white", border: "2px solid #e5e7eb", color: "#9ca3af" };
  };

  if (!battleStarted && !battleEnded) {
    return (
      <div className="p-8 max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[80vh] text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200 }}
        >
          <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl pulse-ring"
            style={{ background: "linear-gradient(135deg, #4B0082, #FF6F61)" }}>
            <Swords className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-4xl font-black text-gray-900 mb-3">Battle Arena</h1>
          <p className="text-gray-500 mb-2">Thi đấu 1v1 — Đối đầu thời gian thực</p>
          <div className="flex items-center justify-center gap-2 text-sm text-orange-500 font-semibold mb-10">
            <Zap className="w-4 h-4" />
            5 câu hỏi — 10 giây mỗi câu — Combo bonus
          </div>
          <div className="grid grid-cols-3 gap-4 mb-10 text-sm">
            {[
              { icon: "⚡", label: "Combo x2", desc: "Trả lời đúng liên tiếp" },
              { icon: "⏱️", label: "10 giây", desc: "Giới hạn thời gian" },
              { icon: "🔥", label: "Thời gian thực", desc: "Firebase Firestore" },
            ].map((item) => (
              <div key={item.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                <div className="text-2xl mb-1">{item.icon}</div>
                <p className="font-semibold text-gray-800">{item.label}</p>
                <p className="text-gray-500 text-xs mt-0.5">{item.desc}</p>
              </div>
            ))}
          </div>
          <button
            onClick={startBattle}
            className="px-10 py-4 rounded-2xl font-bold text-white text-lg transition-all hover:scale-105 hover:shadow-xl active:scale-95 shadow-lg"
            style={{ background: "linear-gradient(135deg, #4B0082, #FF6F61)" }}
          >
            ⚔️ Bắt đầu trận đấu
          </button>
        </motion.div>
      </div>
    );
  }

  if (battleEnded) {
    const won = myScore >= opponentScore;
    return (
      <div className="p-8 max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[80vh] text-center">
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring" }}
          className="w-full"
        >
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg ${won ? "" : ""}`}
            style={{ background: won ? "linear-gradient(135deg, #FF6F61, #e05545)" : "linear-gradient(135deg, #6b7280, #4b5563)" }}>
            <Trophy className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-4xl font-black mb-1" style={{ color: won ? "#4B0082" : "#374151" }}>
            {won ? "🎉 Chiến thắng!" : "😤 Thua rồi!"}
          </h2>
          <p className="text-gray-500 mb-8">{won ? "Bạn đã đánh bại đối thủ!" : "Lần sau sẽ làm tốt hơn!"}</p>

          <div className="flex gap-6 justify-center mb-8">
            <ScoreCard name="Bạn" score={myScore} isWinner={won} color="#4B0082" />
            <div className="flex items-center text-2xl font-black text-gray-300">VS</div>
            <ScoreCard name="Bot GPT-4" score={opponentScore} isWinner={!won} color="#FF6F61" />
          </div>

          <button
            onClick={startBattle}
            className="px-8 py-3.5 rounded-xl font-bold text-white transition-all hover:opacity-90 hover:shadow-lg"
            style={{ background: "linear-gradient(135deg, #4B0082, #FF6F61)" }}
          >
            ⚔️ Trận tiếp theo
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      {/* Scoreboard */}
      <div className="grid grid-cols-3 gap-4 items-center">
        <ScoreCard name="Bạn" score={myScore} isWinner={false} color="#4B0082" />
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Swords className="w-5 h-5" style={{ color: "#FF6F61" }} />
          </div>
          <p className="text-xs text-gray-400">Câu {currentQuestionIndex + 1}/{battleQuestions.length}</p>
          {combo > 1 && (
            <motion.p
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="text-xs font-black mt-1"
              style={{ color: "#FF6F61" }}
            >
              🔥 COMBO x{combo}
            </motion.p>
          )}
        </div>
        <ScoreCard name="Bot GPT-4" score={opponentScore} isWinner={false} color="#FF6F61" opponent />
      </div>

      {/* Timer */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-600">
            <Clock className="w-4 h-4" />
            Thời gian còn lại
          </div>
          <span
            className="text-2xl font-black tabular-nums"
            style={{ color: timeLeft <= 3 ? "#e53e3e" : "#4B0082" }}
          >
            {timeLeft}s
          </span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full transition-all"
            style={{
              width: `${(timeLeft / 10) * 100}%`,
              background: timeLeft <= 3 ? "#e53e3e" : "linear-gradient(90deg, #4B0082, #FF6F61)",
              transition: "width 1s linear, background 0.3s",
            }}
          />
        </div>
      </div>

      {/* Question */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentQuestionIndex}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="bg-white rounded-2xl border border-gray-100 p-7 shadow-sm text-center"
        >
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-3 font-semibold">Câu hỏi</p>
          <h2 className="text-2xl font-bold text-gray-900">{currentQuestion.question}</h2>
        </motion.div>
      </AnimatePresence>

      {/* Options */}
      <div className="grid grid-cols-2 gap-3">
        {currentQuestion.options.map((option, index) => (
          <motion.button
            key={index}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.07 }}
            onClick={() => handleAnswer(index)}
            disabled={selectedAnswer !== null}
            className="py-4 px-5 rounded-2xl text-sm font-semibold text-left transition-all duration-200 hover:scale-102 hover:shadow-md active:scale-98 disabled:cursor-default"
            style={getButtonStyle(index)}
          >
            <span className="opacity-50 mr-2 text-xs">
              {["A", "B", "C", "D"][index]}.
            </span>
            {option}
          </motion.button>
        ))}
      </div>

      {/* Live indicator */}
      <div className="text-center text-xs text-gray-400 flex items-center justify-center gap-2">
        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        {/* Thực tế sẽ dùng Firebase Firestore realtime ở đây */}
        Điểm đối thủ cập nhật realtime qua Firebase Firestore
      </div>
    </div>
  );
}

function ScoreCard({ name, score, isWinner, color, opponent }: {
  name: string;
  score: number;
  isWinner: boolean;
  color: string;
  opponent?: boolean;
}) {
  return (
    <div className={`bg-white rounded-2xl border p-4 text-center transition-all ${isWinner ? "border-yellow-300 shadow-lg" : "border-gray-100"}`}>
      <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2"
        style={{ background: `${color}15` }}>
        {opponent
          ? <Bot className="w-5 h-5" style={{ color }} />
          : <User className="w-5 h-5" style={{ color }} />
        }
      </div>
      <p className="text-xs text-gray-500 font-medium mb-1">{name}</p>
      <motion.p
        key={score}
        initial={{ scale: 1.3 }}
        animate={{ scale: 1 }}
        className="text-3xl font-black"
        style={{ color }}
      >
        {score}
      </motion.p>
      {isWinner && (
        <div className="flex items-center justify-center gap-1 mt-1">
          <Shield className="w-3 h-3 text-yellow-500" />
          <span className="text-xs text-yellow-600 font-semibold">Dẫn trước</span>
        </div>
      )}
    </div>
  );
}
