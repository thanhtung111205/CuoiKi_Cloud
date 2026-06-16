import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, BookOpen, Trophy, Target, TrendingUp, Star, Plus, Edit2, Trash2, Search, X, Loader2, AlertCircle, Bell } from "lucide-react";
import DeckCard from "@/components/DeckCard";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { requestForToken } from "@/config/firebase";
import { toast } from "sonner";

const statsData = [
  { label: "Streak hiện tại", value: "12 ngày", icon: Flame, color: "#FF6F61", bg: "rgba(255,111,97,0.1)" },
  { label: "Tổng từ đã học", value: "1,247", icon: BookOpen, color: "#4B0082", bg: "rgba(75,0,130,0.08)" },
  { label: "Độ chính xác", value: "87%", icon: Target, color: "#2E8B57", bg: "rgba(46,139,87,0.1)" },
  { label: "Xếp hạng", value: "#23", icon: Trophy, color: "#0047AB", bg: "rgba(0,71,171,0.1)" },
];

export default function Dashboard() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  // State quản lý danh sách bộ thẻ
  const [decks, setDecks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // State quản lý Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentDeck, setCurrentDeck] = useState<any>(null);
  
  // Form inputs
  const [deckTitle, setDeckTitle] = useState("");
  const [deckDescription, setDeckDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Trạng thái quyền thông báo FCM
  const [notificationPermission, setNotificationPermission] = useState<string>(
    typeof window !== "undefined" ? Notification.permission : "default"
  );
  const [permissionLoading, setPermissionLoading] = useState(false);

  // Hàm xin quyền thông báo
  const handleRequestPermission = async () => {
    setPermissionLoading(true);
    try {
      const tokenResult = await requestForToken();
      if (tokenResult) {
        setNotificationPermission("granted");
        toast.success("Đã bật thông báo thành công!", {
          description: "Giờ đây bạn có thể nhận thông báo học tập & thách đấu thời gian thực.",
        });
      } else {
        const currentPerm = typeof window !== "undefined" ? Notification.permission : "default";
        setNotificationPermission(currentPerm);
        if (currentPerm === "denied") {
          toast.error("Không thể kích hoạt thông báo", {
            description: "Bạn đã chặn quyền thông báo. Vui lòng mở lại trong cài đặt trang web.",
          });
        } else {
          toast.warning("Thông báo chưa được kích hoạt", {
            description: "Quyền thông báo chưa được cấp.",
          });
        }
      }
    } catch (error) {
      console.error("Lỗi xin quyền nhận thông báo:", error);
      toast.error("Đã xảy ra lỗi khi xin quyền nhận thông báo.");
    } finally {
      setPermissionLoading(false);
    }
  };

  const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:8080";

  // Hàm gọi API lấy danh sách bộ thẻ
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
      setErrorMsg(error.response?.data?.message || "Lỗi khi kết nối đến máy chủ.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDecks();
  }, [token]);

  // Chào buổi
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Chào buổi sáng";
    if (hour < 18) return "Chào buổi chiều";
    return "Chào buổi tối";
  };

  // Tạo bộ thẻ thủ công
  const handleCreateDeck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deckTitle.trim()) return;

    setSubmitting(true);
    try {
      const authToken = token || localStorage.getItem("token");
      const response = await axios.post(
        `${baseUrl}/api/decks`,
        {
          title: deckTitle.trim(),
          description: deckDescription.trim(),
        },
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      if (response.data && response.data.success) {
        setShowCreateModal(false);
        setDeckTitle("");
        setDeckDescription("");
        fetchDecks(); // Tải lại danh sách
      }
    } catch (err: any) {
      alert(`Không thể tạo bộ thẻ: ${err.response?.data?.message || err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Cập nhật bộ thẻ
  const handleEditDeck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deckTitle.trim() || !currentDeck) return;

    setSubmitting(true);
    try {
      const authToken = token || localStorage.getItem("token");
      const response = await axios.put(
        `${baseUrl}/api/decks/${currentDeck.id}`,
        {
          title: deckTitle.trim(),
          description: deckDescription.trim(),
        },
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      if (response.data && response.data.success) {
        setShowEditModal(false);
        setCurrentDeck(null);
        setDeckTitle("");
        setDeckDescription("");
        fetchDecks();
      }
    } catch (err: any) {
      alert(`Không thể cập nhật: ${err.response?.data?.message || err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Xóa bộ thẻ
  const handleDeleteDeck = async (deckId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Bạn có chắc chắn muốn xóa bộ thẻ này không? Tất cả các flashcard bên trong cũng sẽ bị xóa vĩnh viễn.")) return;

    try {
      const authToken = token || localStorage.getItem("token");
      const response = await axios.delete(`${baseUrl}/api/decks/${deckId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (response.data && response.data.success) {
        fetchDecks();
      }
    } catch (err: any) {
      alert(`Không thể xóa bộ thẻ: ${err.response?.data?.message || err.message}`);
    }
  };

  // Mở modal sửa bộ thẻ
  const openEditModal = (deck: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentDeck(deck);
    setDeckTitle(deck.title);
    setDeckDescription(deck.description || "");
    setShowEditModal(true);
  };

  // Lọc bộ thẻ theo thanh tìm kiếm
  const filteredDecks = decks.filter((deck) =>
    deck.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (deck.description && deck.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-bold text-gray-900"
          >
            {getGreeting()}, {user?.fullName || "bạn"}! 👋
          </motion.h1>
          <p className="text-gray-500 mt-1">Chào mừng bạn quay lại hệ thống học thông minh</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 active:scale-95 transition-all shadow-sm"
            style={{ background: "linear-gradient(135deg, #4B0082, #7B2FBE)" }}
          >
            <Plus className="w-4 h-4" />
            Tạo bộ bài thủ công
          </button>
          <button
            onClick={() => navigate("/create")}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 active:scale-95 transition-all shadow-sm"
            style={{ background: "linear-gradient(135deg, #FF6F61, #e05545)" }}
          >
            <Star className="w-4 h-4" />
            Tạo bằng AI
          </button>
        </div>
      </div>

      {/* Banner xin quyền thông báo */}
      <AnimatePresence>
        {notificationPermission === "default" && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -20 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -20 }}
            className="bg-gradient-to-r from-purple-900 to-indigo-900 rounded-2xl p-5 text-white flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg overflow-hidden"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                <Bell className="w-6 h-6 text-yellow-300 animate-pulse" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Bật thông báo ứng dụng</h3>
                <p className="text-white/80 text-sm mt-0.5">
                  Đừng bỏ lỡ các thử thách thi đấu thời gian thực (Battle Arena) và nhắc nhở học tập hàng ngày.
                </p>
              </div>
            </div>
            <button
              onClick={handleRequestPermission}
              disabled={permissionLoading}
              className="px-5 py-2.5 bg-white text-purple-950 rounded-xl text-sm font-bold hover:bg-purple-50 active:scale-95 transition-all shadow-md flex items-center gap-2 whitespace-nowrap cursor-pointer disabled:opacity-50"
            >
              {permissionLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-purple-900" />
              ) : (
                <Bell className="w-4 h-4 text-purple-900" />
              )}
              Cho phép nhận tin
            </button>
          </motion.div>
        )}
      </AnimatePresence>

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

      {/* Search Bar */}
      <div className="relative w-full max-w-md bg-white rounded-2xl border border-gray-150 p-1 flex items-center gap-2 shadow-sm">
        <Search className="w-5 h-5 text-gray-400 ml-3 flex-shrink-0" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Tìm kiếm bộ bài..."
          className="w-full py-2 bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="p-1 rounded-full hover:bg-gray-100 mr-2 text-gray-400"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Recent Decks section */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-gray-900 text-xl flex items-center gap-2">
            <Star className="w-5 h-5" style={{ color: "#FF6F61" }} />
            Bộ bài của bạn
          </h2>
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            {filteredDecks.length} bộ bài
          </span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="w-10 h-10 animate-spin text-purple-700" />
            <p className="text-gray-500 text-sm">Đang tải danh sách bộ thẻ của bạn...</p>
          </div>
        ) : errorMsg ? (
          <div className="p-8 rounded-2xl bg-red-50 border border-red-100 flex items-start gap-4">
            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-red-800">Không thể tải dữ liệu bộ thẻ</p>
              <p className="text-sm text-red-700 mt-1">{errorMsg}</p>
              <button
                onClick={fetchDecks}
                className="mt-3 px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-semibold hover:bg-red-700 transition-colors"
              >
                Tải lại trang
              </button>
            </div>
          </div>
        ) : filteredDecks.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center max-w-lg mx-auto shadow-sm space-y-4">
            <div className="w-16 h-16 rounded-full bg-purple-50 text-purple-700 flex items-center justify-center mx-auto">
              <BookOpen className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-gray-800">Chưa có bộ bài nào</h3>
            <p className="text-sm text-gray-500">
              Hãy bắt đầu hành trình học tập bằng cách tạo bộ bài thủ công hoặc sinh tự động bằng AI!
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-purple-700 text-white rounded-xl text-sm font-semibold hover:bg-purple-800 transition-colors"
              >
                Tạo thủ công
              </button>
              <button
                onClick={() => navigate("/create")}
                className="px-4 py-2 bg-rose-500 text-white rounded-xl text-sm font-semibold hover:bg-rose-600 transition-colors"
              >
                Tạo bằng AI
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredDecks.map((deck, i) => (
              <motion.div
                key={deck.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <DeckCard
                  deck={deck}
                  onStudy={(id) => navigate(`/study/${id}`)}
                  onEdit={openEditModal}
                  onDelete={handleDeleteDeck}
                />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL: TẠO BỘ BÀI THỦ CÔNG */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl max-w-md w-full border border-gray-100 shadow-2xl p-6 relative overflow-hidden"
            >
              <button
                onClick={() => { setShowCreateModal(false); setDeckTitle(""); setDeckDescription(""); }}
                className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-gray-100 text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>

              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Plus className="w-5 h-5 text-purple-700" />
                Tạo bộ bài mới
              </h2>

              <form onSubmit={handleCreateDeck} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Tên bộ bài</label>
                  <input
                    type="text"
                    required
                    value={deckTitle}
                    onChange={(e) => setDeckTitle(e.target.value)}
                    placeholder="VD: Từ vựng Du lịch"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Mô tả (Không bắt buộc)</label>
                  <textarea
                    value={deckDescription}
                    onChange={(e) => setDeckDescription(e.target.value)}
                    placeholder="VD: Các từ hay gặp khi đi sân bay, khách sạn..."
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => { setShowCreateModal(false); setDeckTitle(""); setDeckDescription(""); }}
                    className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-all"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !deckTitle.trim()}
                    className="flex-1 py-3 rounded-xl text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
                    style={{ background: "linear-gradient(135deg, #4B0082, #7B2FBE)" }}
                  >
                    {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    Tạo bộ bài
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: CHỈNH SỬA BỘ BÀI */}
      <AnimatePresence>
        {showEditModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl max-w-md w-full border border-gray-100 shadow-2xl p-6 relative overflow-hidden"
            >
              <button
                onClick={() => { setShowEditModal(false); setCurrentDeck(null); setDeckTitle(""); setDeckDescription(""); }}
                className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-gray-100 text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>

              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-purple-700" />
                Chỉnh sửa bộ bài
              </h2>

              <form onSubmit={handleEditDeck} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Tên bộ bài</label>
                  <input
                    type="text"
                    required
                    value={deckTitle}
                    onChange={(e) => setDeckTitle(e.target.value)}
                    placeholder="VD: Từ vựng Du lịch"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Mô tả (Không bắt buộc)</label>
                  <textarea
                    value={deckDescription}
                    onChange={(e) => setDeckDescription(e.target.value)}
                    placeholder="Mô tả..."
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => { setShowEditModal(false); setCurrentDeck(null); setDeckTitle(""); setDeckDescription(""); }}
                    className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-all"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !deckTitle.trim()}
                    className="flex-1 py-3 rounded-xl text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
                    style={{ background: "linear-gradient(135deg, #4B0082, #7B2FBE)" }}
                  >
                    {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    Lưu thay đổi
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
