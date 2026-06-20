import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  User, Mail, Calendar, Flame, BookOpen, Trophy, Target,
  Swords, Edit2, Check, X, Loader2, Award, TrendingUp
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import StatsCard from "@/components/StatsCard";

interface ProfileData {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  createdAt: string;
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
  stats: {
    totalCardsStudied: number;
    cardsDueToday: number;
    totalDecks: number;
    totalMatches: number;
    totalWins: number;
    winRate: number;
  };
}

export default function Profile() {
  const { user, token } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Edit mode
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);

  const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:8080";


  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Kiểm tra kích thước file (ví dụ tối đa 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert("Ảnh quá lớn! Vui lòng chọn ảnh dưới 2MB.");
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      // Đây là tên Preset bạn đã chụp ảnh gửi cho tôi
      formData.append("upload_preset", "flashmaster_avatar");

      // Thay "TÊN_CLOUD_CỦA_BẠN" bằng Cloud Name của bạn trên Cloudinary
      const res = await fetch(`https://api.cloudinary.com/v1_1/drkfjfd3d/image/upload`, {
        method: "POST",
        body: formData,
      });

      const fileData = await res.json();

      if (!fileData.secure_url) {
        throw new Error("Không nhận được URL từ Cloudinary");
      }

      const newAvatarUrl = fileData.secure_url;

      // Gửi URL về Backend để cập nhật vào Database
      const updateRes = await fetch(`${baseUrl}/api/user/profile`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ avatarUrl: newAvatarUrl }),
      });

      const data = await updateRes.json();

      if (data.success) {
        // Cập nhật lại UI ngay lập tức
        setProfile((prev) => prev ? { ...prev, avatarUrl: newAvatarUrl } : prev);
        alert("Cập nhật ảnh đại diện thành công!");
      } else {
        throw new Error(data.message || "Lỗi cập nhật database");
      }
    } catch (err) {
      console.error(err);
      alert("Có lỗi xảy ra khi upload ảnh.");
    } finally {
      setSaving(false);
    }
  };
  // Gọi API lấy profile
  const fetchProfile = async () => {
    setLoading(true);
    setError("");
    try {
      const authToken = token || localStorage.getItem("token");
      const response = await fetch(`${baseUrl}/api/user/profile`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await response.json();

      if (response.ok && data.success) {
        setProfile(data.data);
        setEditName(data.data.fullName);
      } else {
        setError(data.message || "Không thể tải hồ sơ.");
      }
    } catch (err) {
      setError("Lỗi kết nối đến máy chủ.");
    } finally {
      setLoading(false);
    }
  };

  // Gọi API cập nhật profile
  const handleSave = async () => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      const authToken = token || localStorage.getItem("token");
      const response = await fetch(`${baseUrl}/api/user/profile`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fullName: editName.trim() }),
      });
      const data = await response.json();

      if (response.ok && data.success) {
        setProfile((prev) => prev ? { ...prev, fullName: editName.trim() } : prev);
        setIsEditing(false);
      } else {
        alert(data.message || "Không thể cập nhật.");
      }
    } catch (err) {
      alert("Lỗi kết nối.");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [token]);

  // Format ngày tháng
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("vi-VN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="w-10 h-10 animate-spin text-purple-700" />
        <p className="text-gray-500 text-sm">Đang tải hồ sơ...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="p-8 rounded-2xl bg-red-50 border border-red-100 text-center">
          <p className="text-red-800 font-bold">Không thể tải hồ sơ</p>
          <p className="text-sm text-red-600 mt-1">{error}</p>
          <button onClick={fetchProfile} className="mt-3 px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700">
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const statsCards = [
    { label: "Streak hiện tại", value: `${profile.currentStreak} ngày`, icon: Flame, color: "#FF6F61", bg: "rgba(255,111,97,0.1)" },
    { label: "Streak dài nhất", value: `${profile.longestStreak} ngày`, icon: TrendingUp, color: "#e05545", bg: "rgba(224,85,69,0.1)" },
    { label: "Tổng thẻ đã học", value: profile.stats.totalCardsStudied.toLocaleString(), icon: BookOpen, color: "#4B0082", bg: "rgba(75,0,130,0.08)" },
    { label: "Cần ôn hôm nay", value: profile.stats.cardsDueToday.toLocaleString(), icon: Target, color: "#2E8B57", bg: "rgba(46,139,87,0.1)" },
    { label: "Tổng bộ thẻ", value: profile.stats.totalDecks.toLocaleString(), icon: Award, color: "#0047AB", bg: "rgba(0,71,171,0.1)" },
    { label: "Tỉ lệ thắng Battle", value: `${profile.stats.winRate}%`, icon: Swords, color: "#FF8C00", bg: "rgba(255,140,0,0.1)" },
  ];

  // Tính progress bar (mục tiêu 10 thẻ mỗi ngày)
  const dailyGoal = 10;
  const progressPercent = Math.min((profile.stats.cardsDueToday > 0
    ? ((dailyGoal - profile.stats.cardsDueToday) / dailyGoal) * 100
    : 100), 100);

  return (
    <div className="p-8 space-y-8">
      {/* Header: Profile Card */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
      >
        {/* Banner gradient */}
        <div className="h-32 relative" style={{ background: "linear-gradient(135deg, #4B0082, #7B2FBE, #FF6F61)" }}>
          <div className="absolute inset-0 bg-black/10" />
        </div>

        {/* Avatar + Info */}
        <div className="px-8 pb-6 -mt-12 relative z-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">

            {/* Avatar - Có hỗ trợ Upload */}
            <div className="relative group w-28 h-28 rounded-2xl border-4 border-white shadow-lg flex-shrink-0">
              <div className="w-full h-full rounded-[12px] overflow-hidden bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center">
                {profile.avatarUrl ? (
                  <img src={profile.avatarUrl} alt={profile.fullName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white text-4xl font-bold">
                    {profile.fullName.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>

              {/* Lớp mờ (Overlay) hiện lên khi hover chuột + Nút Camera */}
              <label
                htmlFor="avatar-upload"
                className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer rounded-[12px]"
              >
                {saving ? (
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-white text-[10px] font-semibold tracking-wider">ĐỔI ẢNH</span>
                  </>
                )}
              </label>

              {/* Thẻ input ẩn để chọn file */}
              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
                disabled={saving}
              />
            </div>

            {/* Name + Email */}
            <div className="flex-1 pt-4 sm:pt-0 w-full">
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="text-2xl font-bold text-gray-900 border-b-2 border-purple-500 focus:outline-none bg-transparent"
                    autoFocus
                  />
                  <button onClick={handleSave} disabled={saving} className="p-1.5 rounded-lg bg-green-100 text-green-600 hover:bg-green-200 flex-shrink-0">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  </button>
                  <button onClick={() => { setIsEditing(false); setEditName(profile.fullName); }} className="p-1.5 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 flex-shrink-0">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-gray-900">{profile.fullName}</h1>
                  <button onClick={() => setIsEditing(true)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 flex-shrink-0">
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
              )}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 mt-1 text-sm text-gray-500">
                <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5 flex-shrink-0" /> {profile.email}</span>
                <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 flex-shrink-0" /> Tham gia {formatDate(profile.createdAt)}</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Progress bar: Tiến độ ôn tập hôm nay */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm"
      >
        <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
          <Target className="w-5 h-5 text-green-600" />
          Tiến độ hôm nay
        </h3>
        <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.max(progressPercent, 0)}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="h-full rounded-full"
            style={{ background: "linear-gradient(90deg, #4B0082, #7B2FBE)" }}
          />
        </div>
        <div className="flex justify-between mt-2 text-sm text-gray-500">
          <span>
            {profile.stats.cardsDueToday > 0
              ? `Còn ${profile.stats.cardsDueToday} thẻ cần ôn`
              : "🎉 Đã hoàn thành ôn tập hôm nay!"}
          </span>
          <span className="font-semibold text-purple-700">{Math.max(progressPercent, 0).toFixed(0)}%</span>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {statsCards.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.05 }}
          >
            <StatsCard
              label={stat.label}
              value={stat.value}
              icon={stat.icon}
              color={stat.color}
              bg={stat.bg}
            />
          </motion.div>
        ))}
      </div>

      {/* Battle Stats */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm"
      >
        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          Thống kê Quiz Battle
        </h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="p-4 bg-blue-50 rounded-xl">
            <p className="text-2xl font-bold text-blue-700">{profile.stats.totalMatches}</p>
            <p className="text-xs text-blue-600 mt-1">Tổng trận</p>
          </div>
          <div className="p-4 bg-green-50 rounded-xl">
            <p className="text-2xl font-bold text-green-700">{profile.stats.totalWins}</p>
            <p className="text-xs text-green-600 mt-1">Chiến thắng</p>
          </div>
          <div className="p-4 bg-purple-50 rounded-xl">
            <p className="text-2xl font-bold text-purple-700">{profile.stats.winRate}%</p>
            <p className="text-xs text-purple-600 mt-1">Tỉ lệ thắng</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}