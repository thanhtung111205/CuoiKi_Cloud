import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Flame, AlertCircle, Mail, CheckCircle, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate, Link } from "react-router-dom";

export default function ForgotPassword() {
  // Đồng bộ chuẩn tên biến loading từ AuthContext để tránh bị undefined
  const { resetPassword, loading: contextLoading } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Gộp cả 2 trạng thái loading để vô hiệu hóa nút bấm chính xác hơn
  const isProcessing = loading || contextLoading;

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("🚀 Đã bấm nút gửi! Email hiện tại là:", email); // Thêm dòng này
    if (!email) {
      setError("Vui lòng nhập email.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
    console.log("⏳ Đang gọi Firebase reset password..."); // Thêm dòng này
      await resetPassword(email);
      console.log("✅ Firebase phản hồi thành công!"); // Thêm dòng này
      setSuccess(true);
      setEmail("");
    } catch (err: any) {
        console.error("❌ Lỗi xuất hiện tại catch:", err); // Thêm dòng này
      console.error("Lỗi gửi mail reset mật khẩu:", err);
      // Giữ nguyên bộ bắt lỗi chuẩn của bạn
      if (err.code === "auth/user-not-found") {
        setError("Email này không tồn tại trong hệ thống.");
      } else if (err.code === "auth/invalid-email") {
        setError("Email không hợp lệ.");
      } else if (err.code === "auth/too-many-requests") {
        setError("Quá nhiều yêu cầu. Vui lòng thử lại sau.");
      } else {
        setError(err.message || "Gửi email reset password thất bại.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-radial from-[#1e0b36] to-[#0f051d] px-4 relative overflow-hidden">
      {/* Background Decorative Circles */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl relative z-10"
      >
        {/* Back Button */}
        <Link
          to="/login"
          className="flex items-center gap-2 text-purple-300 hover:text-white transition-colors mb-6 group"
        >
          <ArrowLeft className="w-4 h-4 transform group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm">Quay lại đăng nhập</span>
        </Link>

        {/* Logo */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-orange-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-900/40">
            <Flame className="w-8 h-8 text-white animate-pulse" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-extrabold text-white tracking-tight mb-2 text-center">
          Quên mật khẩu?
        </h1>
        <p className="text-purple-200/60 text-sm mb-8 text-center">
          {!success 
            ? "Nhập email của bạn và chúng tôi sẽ gửi hướng dẫn đặt lại mật khẩu" 
            : "Hệ thống đã gửi liên kết xác thực tới hòm thư của bạn"}
        </p>

        {/* Error Message */}
        {error && (
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full mb-6 flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-200 text-sm text-left"
          >
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400" />
            <span>{error}</span>
          </motion.div>
        )}

        {/* Giao diện động dựa trên trạng thái Success */}
        {!success ? (
          <form onSubmit={handleReset} className="space-y-4">
            {/* Email Input */}
            <div>
              <label className="block text-sm font-semibold text-purple-200 mb-2 text-left">Email</label>
              <div className="relative flex items-center">
                <Mail className="absolute left-3 w-5 h-5 text-purple-400 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 text-white placeholder-white/30 rounded-lg focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                  required
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isProcessing}
              className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold rounded-lg transition-all duration-300 transform active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
            >
              {isProcessing ? "Đang gửi..." : "Gửi email đặt lại mật khẩu"}
            </button>
          </form>
        ) : (
          <div className="space-y-6">
            {/* Success Message được đưa vào trong đây để tối ưu hiển thị */}
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full flex items-start gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-200 text-sm text-left"
            >
              <CheckCircle className="w-5 h-5 flex-shrink-0 text-green-400" />
              <div>
                <p className="font-semibold">Email đã được gửi!</p>
                <p className="text-xs mt-1 text-green-200/80">
                  Kiểm tra hộp thư của bạn để đặt lại mật khẩu. Nếu không thấy, hãy kiểm tra kỹ trong mục thư rác (Spam).
                </p>
              </div>
            </motion.div>

            {/* Thử lại button */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col items-center gap-4"
            >
              <button
                onClick={() => {
                  setSuccess(false);
                  setError(null);
                }}
                className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold rounded-lg transition-all duration-300 transform active:scale-95"
              >
                Thử với email khác
              </button>
              <p className="text-sm text-purple-300">
                Hoặc <Link to="/login" className="font-semibold text-purple-400 hover:text-white transition-colors">quay lại đăng nhập</Link>
              </p>
            </motion.div>
          </div>
        )}
      </motion.div>
    </div>
  );
}