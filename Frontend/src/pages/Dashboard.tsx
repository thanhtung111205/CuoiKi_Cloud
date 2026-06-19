import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, BookOpen, Trophy, Target, TrendingUp, Star, Plus, Edit2, Trash2, Search, X, Loader2, AlertCircle, Bell, Bug, BarChart2, RefreshCw } from "lucide-react";
import DeckCard from "@/components/DeckCard";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { requestForToken } from "@/config/firebase";
import { toast } from "sonner";

export default function Dashboard() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  // State quản lý danh sách bộ thẻ
  const [decks, setDecks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // State quản lý lịch sử đấu
  const [matchHistory, setMatchHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // State quản lý Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentDeck, setCurrentDeck] = useState<any>(null);
  
  // Form inputs
  const [deckTitle, setDeckTitle] = useState("");
  const [deckDescription, setDeckDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // State bug report modal
  const [showBugModal, setShowBugModal] = useState(false);
  const [bugIssueType, setBugIssueType] = useState("");
  const [bugDescription, setBugDescription] = useState("");
  const [submittingBug, setSubmittingBug] = useState(false);

  // State Zoho Analytics
  const [embedUrls, setEmbedUrls] = useState<Record<string, string | null>>({});
  const [analyticsConfigured, setAnalyticsConfigured] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [syncingAnalytics, setSyncingAnalytics] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

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

        // Gửi FCM Token lên Backend để lưu vào PostgreSQL
        try {
          const authToken = token || localStorage.getItem("token");
          await axios.post(`${baseUrl}/api/users/fcm-token`, { token: tokenResult }, {
            headers: { Authorization: `Bearer ${authToken}` }
          });
        } catch (apiErr) {
          console.error("Lỗi gửi FCM Token lên server:", apiErr);
        }

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

  const handleSubmitBugReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bugIssueType || bugDescription.trim().length < 10) return;

    setSubmittingBug(true);
    try {
      const authToken = token || localStorage.getItem("token");
      await axios.post(
        `${baseUrl}/api/support/bug-report`,
        { issue_type: bugIssueType, description: bugDescription.trim() },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      toast.success("Báo cáo đã được gửi!", {
        description: "Cảm ơn bạn! Chúng tôi sẽ xem xét và phản hồi sớm nhất.",
      });
      setShowBugModal(false);
      setBugIssueType("");
      setBugDescription("");
    } catch (err: any) {
      toast.error("Không thể gửi báo cáo", {
        description: err.response?.data?.message || "Lỗi kết nối máy chủ.",
      });
    } finally {
      setSubmittingBug(false);
    }
  };

  // Lấy embed URLs từ Zoho Analytics
  const fetchEmbedUrls = async () => {
    setAnalyticsLoading(true);
    try {
      const authToken = token || localStorage.getItem("token");
      const res = await axios.get(`${baseUrl}/api/analytics/embed-urls`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.data?.success) {
        setEmbedUrls(res.data.data || {});
        setAnalyticsConfigured(res.data.configured || false);
      }
    } catch (err) {
      console.warn("[Dashboard] Zoho Analytics chưa cấu hình hoặc lỗi kết nối.");
    } finally {
      setAnalyticsLoading(false);
    }
  };

  // Đồng bộ dữ liệu lên Zoho Analytics
  const handleSyncAnalytics = async () => {
    setSyncingAnalytics(true);
    try {
      const authToken = token || localStorage.getItem("token");
      await axios.post(`${baseUrl}/api/analytics/sync`, {}, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      setLastSyncedAt(new Date());
      toast.success("Đồng bộ thành công!", { description: "Dữ liệu đã được cập nhật lên Zoho Analytics." });
      fetchEmbedUrls();
    } catch (err: any) {
      toast.error("Không thể đồng bộ", { description: err.response?.data?.message || "Lỗi kết nối máy chủ." });
    } finally {
      setSyncingAnalytics(false);
    }
  };

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

  // Hàm gọi API lấy danh sách lịch sử trận đấu
  const fetchMatchHistory = async () => {
    setHistoryLoading(true);
    try {
      const authToken = token || localStorage.getItem("token");
      if (!authToken) {
        setHistoryLoading(false);
        return;
      }
      
      const response = await axios.get(`${baseUrl}/api/battle/history`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (response.data && response.data.success) {
        setMatchHistory(response.data.data || []);
      }
    } catch (error) {
      console.error("Lỗi lấy lịch sử đấu:", error);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchDecks();
    fetchMatchHistory();
    fetchEmbedUrls();

    // Tự động kiểm tra và cập nhật FCM Token nếu đã được cấp quyền trước đó
    if (Notification.permission === "granted") {
      const autoSaveFcmToken = async () => {
        try {
          const tokenResult = await requestForToken();
          if (tokenResult) {
            const authToken = token || localStorage.getItem("token");
            await axios.post(`${baseUrl}/api/users/fcm-token`, { token: tokenResult }, {
              headers: { Authorization: `Bearer ${authToken}` }
            });
            console.log("[Dashboard] Tự động cập nhật FCM Token thành công.");
          }
        } catch (err) {
          console.error("[Dashboard] Lỗi tự động cập nhật FCM Token:", err);
        }
      };
      autoSaveFcmToken();
    }
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

  // Tính toán các chỉ số thống kê động
  const totalDecks = decks.length;
  const totalMatches = matchHistory.length;
  const winsCount = matchHistory.filter(m => m.result === "win").length;
  const winRate = totalMatches > 0 ? Math.round((winsCount / totalMatches) * 100) : 0;
  const userStreak = user?.currentStreak ?? 0;

  const statsData = [
    { label: "Streak hiện tại", value: `${userStreak} ngày`, icon: Flame, color: "#FF6F61", bg: "rgba(255,111,97,0.1)" },
    { label: "Số bộ bài học", value: `${totalDecks}`, icon: BookOpen, color: "#4B0082", bg: "rgba(75,0,130,0.08)" },
    { label: "Tỉ lệ thắng Arena", value: `${winRate}%`, icon: Target, color: "#2E8B57", bg: "rgba(46,139,87,0.1)" },
    { label: "Tổng số trận đấu", value: `${totalMatches}`, icon: Trophy, color: "#0047AB", bg: "rgba(0,71,171,0.1)" },
  ];

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
          <button
            onClick={() => setShowBugModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 active:scale-95 transition-all shadow-sm"
            style={{ background: "linear-gradient(135deg, #DC2626, #B91C1C)" }}
          >
            <Bug className="w-4 h-4" />
            Báo cáo lỗi
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

      {/* Analytics Section */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
              <BarChart2 className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-base">Phân tích học tập</h2>
              {lastSyncedAt && (
                <p className="text-[11px] text-gray-400">
                  Đồng bộ lúc {lastSyncedAt.toLocaleTimeString("vi-VN")}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={handleSyncAnalytics}
            disabled={syncingAnalytics}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncingAnalytics ? "animate-spin" : ""}`} />
            {syncingAnalytics ? "Đang đồng bộ..." : "Đồng bộ"}
          </button>
        </div>

        {analyticsLoading ? (
          <div className="flex items-center justify-center py-12 gap-3 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-sm">Đang tải biểu đồ...</span>
          </div>
        ) : !analyticsConfigured ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center">
              <BarChart2 className="w-7 h-7 text-gray-300" />
            </div>
            <p className="font-semibold text-gray-500 text-sm">Zoho Analytics chưa được cấu hình</p>
            <p className="text-xs text-gray-400 max-w-xs">
              Thêm các biến <code className="bg-gray-100 px-1 rounded">ZOHO_VIEW_CHART_*</code> vào file <code className="bg-gray-100 px-1 rounded">.env</code> để hiển thị biểu đồ.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[
              { key: "chartActivity", title: "Hoạt động học theo ngày" },
              { key: "chartMastery", title: "Mức thành thạo từ vựng" },
              { key: "chartDecks", title: "Tiến độ từng bộ thẻ" },
              { key: "chartBattle", title: "Tỷ lệ thắng/thua thi đấu" },
            ].map(({ key, title }) =>
              embedUrls[key] ? (
                <div key={key} className="rounded-xl border border-gray-100 overflow-hidden">
                  <iframe
                    src={embedUrls[key]!}
                    width="100%"
                    height="300"
                    frameBorder="0"
                    title={title}
                    className="block"
                  />
                </div>
              ) : null
            )}
            {embedUrls["chartEF"] && (
              <div className="lg:col-span-2 rounded-xl border border-gray-100 overflow-hidden">
                <iframe
                  src={embedUrls["chartEF"]!}
                  width="100%"
                  height="300"
                  frameBorder="0"
                  title="Phân bố Ease Factor"
                  className="block"
                />
              </div>
            )}
          </div>
        )}
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

      {/* Main Content Layout (Grid: Decks & Match History) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left Column: Decks */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold text-gray-900 text-xl flex items-center gap-2">
              <Star className="w-5 h-5 text-rose-500" />
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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

        {/* Right Column: Match History */}
        <div className="space-y-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold text-gray-900 text-xl flex items-center gap-2">
              <Trophy className="w-5 h-5 text-indigo-700" />
              Lịch sử đấu Arena
            </h2>
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              {matchHistory.length} trận
            </span>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4 max-h-[600px] overflow-y-auto">
            {historyLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-purple-700" />
                <p className="text-gray-400 text-xs">Đang tải lịch sử đấu...</p>
              </div>
            ) : matchHistory.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center mx-auto">
                  <Trophy className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-gray-700">Chưa có trận đấu nào</h4>
                <p className="text-xs text-gray-400 max-w-[200px] mx-auto">
                  Hãy vào Arena thách đấu bạn bè và tích lũy điểm số!
                </p>
                <button
                  onClick={() => navigate("/battle")}
                  className="mt-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors"
                >
                  Vào Đấu Trường
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 space-y-4">
                {matchHistory.map((match) => {
                  const isWin = match.result === "win";
                  const isLoss = match.result === "loss";

                  let resultBadge = (
                    <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-gray-100 text-gray-600">
                      Hòa
                    </span>
                  );
                  if (isWin) {
                    resultBadge = (
                      <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-green-50 text-green-700 border border-green-100">
                        Thắng
                      </span>
                    );
                  } else if (isLoss) {
                    resultBadge = (
                      <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-red-50 text-red-700 border border-red-100">
                        Thua
                      </span>
                    );
                  }

                  return (
                    <div key={match.id} className="pt-4 first:pt-0 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center font-bold text-indigo-700 text-xs overflow-hidden border border-indigo-100">
                            {match.opponentAvatar ? (
                              <img src={match.opponentAvatar} alt={match.opponentName} className="w-full h-full object-cover" />
                            ) : (
                              match.opponentName.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-800 line-clamp-1">{match.opponentName}</p>
                            <p className="text-[10px] text-gray-400">
                              {new Date(match.endedAt).toLocaleString("vi-VN", {
                                hour: "2-digit",
                                minute: "2-digit",
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric"
                              })}
                            </p>
                          </div>
                        </div>
                        {resultBadge}
                      </div>
                      
                      <div className="flex items-center justify-between text-xs bg-gray-50 rounded-xl p-2.5 border border-gray-100">
                        <div className="text-center flex-1">
                          <p className="text-gray-400 text-[10px] uppercase font-bold tracking-wider">Bạn</p>
                          <p className={`font-black text-sm ${isWin ? "text-green-600" : isLoss ? "text-red-500" : "text-gray-700"}`}>
                            {match.myScore} HP
                          </p>
                        </div>
                        <div className="text-gray-300 font-bold text-[10px]">VS</div>
                        <div className="text-center flex-1">
                          <p className="text-gray-400 text-[10px] uppercase font-bold tracking-wider">Đối thủ</p>
                          <p className={`font-black text-sm ${isLoss ? "text-green-600" : isWin ? "text-red-500" : "text-gray-700"}`}>
                            {match.opponentScore} HP
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
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

      {/* MODAL: BÁO CÁO LỖI */}
      <AnimatePresence>
        {showBugModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl max-w-md w-full border border-gray-100 shadow-2xl p-6 relative overflow-hidden"
            >
              <button
                onClick={() => { setShowBugModal(false); setBugIssueType(""); setBugDescription(""); }}
                className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-gray-100 text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>

              <h2 className="text-xl font-bold text-gray-900 mb-1 flex items-center gap-2">
                <Bug className="w-5 h-5 text-red-600" />
                Báo cáo lỗi
              </h2>
              <p className="text-xs text-gray-500 mb-4">
                Mô tả lỗi bạn gặp phải. Chúng tôi sẽ xem xét và phản hồi qua HubSpot.
              </p>

              <form onSubmit={handleSubmitBugReport} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Loại lỗi</label>
                  <select
                    required
                    value={bugIssueType}
                    onChange={(e) => setBugIssueType(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  >
                    <option value="">-- Chọn loại lỗi --</option>
                    <option value="Lỗi đăng nhập">Lỗi đăng nhập</option>
                    <option value="Lỗi tạo bộ bài">Lỗi tạo bộ bài</option>
                    <option value="Lỗi Battle Arena">Lỗi Battle Arena</option>
                    <option value="Lỗi âm thanh">Lỗi âm thanh</option>
                    <option value="Lỗi hiển thị">Lỗi hiển thị</option>
                    <option value="Khác">Khác</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                    Mô tả chi tiết <span className="text-gray-400 font-normal normal-case">(ít nhất 10 ký tự)</span>
                  </label>
                  <textarea
                    required
                    value={bugDescription}
                    onChange={(e) => setBugDescription(e.target.value)}
                    placeholder="Mô tả lỗi bạn gặp phải, các bước tái hiện, thiết bị / trình duyệt..."
                    rows={4}
                    minLength={10}
                    maxLength={2000}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                  />
                  <p className="text-right text-xs text-gray-400 mt-1">{bugDescription.length}/2000</p>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => { setShowBugModal(false); setBugIssueType(""); setBugDescription(""); }}
                    className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-all"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={submittingBug || !bugIssueType || bugDescription.trim().length < 10}
                    className="flex-1 py-3 rounded-xl text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
                    style={{ background: "linear-gradient(135deg, #DC2626, #B91C1C)" }}
                  >
                    {submittingBug && <Loader2 className="w-4 h-4 animate-spin" />}
                    Gửi báo cáo
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
