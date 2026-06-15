import { BookOpen, Clock, ChevronRight } from "lucide-react";
import type { Deck } from "@/data/mockData";

interface DeckCardProps {
  deck: Deck;
  onStudy: (deckId: number) => void;
}

const categoryColors: Record<string, string> = {
  IELTS: "bg-purple-100 text-purple-700",
  Business: "bg-blue-100 text-blue-700",
  Daily: "bg-emerald-100 text-emerald-700",
  TOEIC: "bg-orange-100 text-orange-700",
  Academic: "bg-cyan-100 text-cyan-700",
  Idioms: "bg-pink-100 text-pink-700",
};

export default function DeckCard({ deck, onStudy }: DeckCardProps) {
  const colorClass = categoryColors[deck.category] ?? "bg-gray-100 text-gray-700";

  return (
    <div className="bg-white rounded-2xl border border-purple-100 p-5 hover:shadow-lg hover:border-purple-300 transition-all duration-200 group cursor-pointer"
      onClick={() => onStudy(deck.id)}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: "rgba(75,0,130,0.08)" }}>
          <BookOpen className="w-5 h-5" style={{ color: "#4B0082" }} />
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${colorClass}`}>
          {deck.category}
        </span>
      </div>

      <h3 className="font-bold text-gray-900 text-base mb-1 group-hover:text-purple-800 transition-colors">
        {deck.title}
      </h3>
      <p className="text-sm text-gray-500 mb-4 line-clamp-2">{deck.description}</p>

      <div className="mb-3">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-xs text-gray-500">Tiến độ</span>
          <span className="text-xs font-semibold" style={{ color: "#4B0082" }}>{deck.progress}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${deck.progress}%`, background: "linear-gradient(90deg, #4B0082, #7B2FBE)" }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <BookOpen className="w-3.5 h-3.5" />
            {deck.cardCount} thẻ
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {deck.lastStudied}
          </span>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-purple-500 transition-colors" />
      </div>
    </div>
  );
}
