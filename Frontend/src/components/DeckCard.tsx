import { BookOpen, Clock, ChevronRight, Edit3, Trash2, Loader2 } from "lucide-react";

interface DeckCardProps {
  deck: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    progress?: number;
    createdAt?: string;
    _count?: {
      flashcards: number;
    };
  };
  onStudy: (deckId: string) => void;
  onEdit?: (deck: any, e: React.MouseEvent) => void;
  onDelete?: (deckId: string, e: React.MouseEvent) => void;
}

export default function DeckCard({ deck, onStudy, onEdit, onDelete }: DeckCardProps) {
  const cardCount = deck._count?.flashcards ?? 0;
  const isProcessing = deck.status === "processing";
  const isFailed = deck.status === "failed";

  // Định dạng thời gian tương đối đơn giản
  const getRelativeTime = (dateStr?: string) => {
    if (!dateStr) return "Mới tạo";
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return "Vừa xong";
      if (diffMins < 60) return `${diffMins} phút trước`;
      if (diffHours < 24) return `${diffHours} giờ trước`;
      return `${diffDays} ngày trước`;
    } catch {
      return "Mới tạo";
    }
  };

  return (
    <div
      onClick={() => !isProcessing && onStudy(deck.id)}
      className={`bg-white rounded-2xl border p-5 transition-all duration-300 group shadow-sm flex flex-col justify-between h-[230px] relative ${
        isProcessing
          ? "border-yellow-200 bg-yellow-50/10 cursor-not-allowed"
          : isFailed
          ? "border-red-100 bg-red-50/10"
          : "border-purple-100 hover:shadow-xl hover:border-purple-300 cursor-pointer"
      }`}
    >
      <div>
        {/* Top Header Actions */}
        <div className="flex items-start justify-between mb-3.5">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
              isProcessing
                ? "bg-yellow-100 text-yellow-700 animate-pulse"
                : isFailed
                ? "bg-red-100 text-red-700"
                : "bg-purple-100 text-purple-700 group-hover:scale-110"
            }`}
          >
            {isProcessing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <BookOpen className="w-5 h-5" />
            )}
          </div>

          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            {/* Badges */}
            {isProcessing && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 animate-pulse">
                Đang tạo AI
              </span>
            )}
            {isFailed && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-800">
                Thất bại
              </span>
            )}
            {!isProcessing && !isFailed && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                Sẵn sàng
              </span>
            )}

            {/* Management Actions */}
            {onEdit && (
              <button
                onClick={(e) => onEdit(deck, e)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-purple-700 hover:bg-purple-50 transition-colors"
                title="Chỉnh sửa bộ thẻ"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => onDelete(deck.id, e)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Xóa bộ thẻ"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Title & Description */}
        <h3
          className={`font-bold text-gray-900 text-base mb-1 transition-colors ${
            !isProcessing && "group-hover:text-purple-800"
          }`}
        >
          {deck.title}
        </h3>
        <p className="text-xs text-gray-500 mb-4 line-clamp-2">
          {deck.description || "Không có mô tả"}
        </p>
      </div>

      {/* Progress & Bottom Area */}
      <div className="mt-auto space-y-3">
        {isProcessing ? (
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] text-gray-400">Tiến độ sinh thẻ</span>
              <span className="text-[10px] font-bold text-yellow-700">Đang chạy...</span>
            </div>
            <div className="h-1.5 bg-yellow-100 rounded-full overflow-hidden">
              <div className="h-full bg-yellow-500 rounded-full w-2/3 animate-[shimmer_1.5s_infinite_linear]" 
                style={{
                  backgroundImage: "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)",
                  backgroundSize: "200px 100%"
                }}
              />
            </div>
          </div>
        ) : (
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] text-gray-400">Tiến độ học</span>
              <span className="text-[10px] font-semibold text-purple-700">{deck.progress ?? 0}%</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${deck.progress ?? 0}%`, background: "linear-gradient(90deg, #4B0082, #7B2FBE)" }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-1 border-t border-gray-50">
          <div className="flex items-center gap-3 text-[11px] text-gray-400">
            <span className="flex items-center gap-1 font-medium">
              <BookOpen className="w-3 h-3 text-purple-400" />
              {cardCount} thẻ
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-gray-300" />
              {getRelativeTime(deck.createdAt)}
            </span>
          </div>
          {!isProcessing && (
            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-purple-500 group-hover:translate-x-1 transition-all" />
          )}
        </div>
      </div>
    </div>
  );
}
