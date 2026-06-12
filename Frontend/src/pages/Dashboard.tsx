import { motion } from "framer-motion";
import { Flame, BookOpen, Trophy, Target, TrendingUp, Star } from "lucide-react";
import DeckCard from "@/components/DeckCard";
import { mockDecks } from "@/data/mockData";
import { useAuth } from "@/context/AuthContext";

interface DashboardProps {
  onStudy: (deckId: number) => void;
}

const statsData = [
  { label: "Streak hiện tại", value: "12 ngày", icon: Flame, color: "#FF6F61", bg: "rgba(255,111,97,0.1)" },
  { label: "Tổng từ đã học", value: "1,247", icon: BookOpen, color: "#4B0082", bg: "rgba(75,0,130,0.08)" },
  { label: "Độ chính xác", value: "87%", icon: Target, color: "#2E8B57", bg: "rgba(46,139,87,0.1)" },
  { label: "Xếp hạng", value: "#23", icon: Trophy, color: "#0047AB", bg: "rgba(0,71,171,0.1)" },
];

export default function Dashboard({ onStudy }: DashboardProps) {
  const { user } = useAuth();

  // Hàm xác định buổi trong ngày
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Chào buổi sáng";
    if (hour < 18) return "Chào buổi chiều";
    return "Chào buổi tối";
  };

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-bold text-gray-900"
          >
            {getGreeting()}, {user?.fullName || "bạn"}! 👋
          </motion.h1>
          <p className="text-gray-500 mt-1">Hãy tiếp tục chuỗi học tập của bạn hôm nay</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold"
          style={{ background: "linear-gradient(135deg, #FF6F61, #e05545)" }}>
          <Flame className="w-4 h-4" />
          12 ngày streak
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statsData.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="bg-white rounded-2xl p-5 border border-gray-100 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: stat.bg }}>
                  <Icon className="w-5 h-5" style={{ color: stat.color }} />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Weekly progress */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white rounded-2xl border border-gray-100 p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-bold text-gray-900 text-lg">Tiến độ tuần này</h2>
            <p className="text-sm text-gray-500">Số từ học mỗi ngày</p>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-600 text-sm font-semibold">
            <TrendingUp className="w-4 h-4" />
            +18% so với tuần trước
          </div>
        </div>
        <div className="flex items-end gap-2 h-24">
          {[45, 62, 38, 80, 55, 90, 72].map((val, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${(val / 100) * 80}px` }}
                transition={{ delay: 0.4 + i * 0.06, duration: 0.5, ease: "easeOut" }}
                className="w-full rounded-t-lg"
                style={{
                  background: i === 6 ? "linear-gradient(180deg, #FF6F61, #e05545)" : "linear-gradient(180deg, #4B0082, #7B2FBE)",
                  opacity: i === 6 ? 1 : 0.7,
                }}
              />
              <span className="text-xs text-gray-400">
                {["T2", "T3", "T4", "T5", "T6", "T7", "CN"][i]}
              </span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Recent Decks */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-900 text-xl flex items-center gap-2">
            <Star className="w-5 h-5" style={{ color: "#FF6F61" }} />
            Bộ bài gần đây
          </h2>
          <button className="text-sm font-medium hover:underline" style={{ color: "#4B0082" }}>
            Xem tất cả
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {mockDecks.map((deck, i) => (
            <motion.div
              key={deck.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.07 }}
            >
              <DeckCard deck={deck} onStudy={onStudy} />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
