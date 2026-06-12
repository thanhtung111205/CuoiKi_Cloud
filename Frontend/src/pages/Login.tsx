import React, { useState } from "react";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../config/firebase";
import { useAuth } from "../context/AuthContext";
import { Flame, LogIn, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

export default function Login() {
  const { loginWithGoogleToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Đăng nhập bằng Google thông qua Popup của Firebase
      const result = await signInWithPopup(auth, googleProvider);
      
      // 2. Trích xuất ID Token của Google
      const idToken = await result.user.getIdToken();

      // 3. Gửi ID Token này tới Backend để xác thực và cấp JWT nội bộ
      await loginWithGoogleToken(idToken);
      
      console.log("Đăng nhập và cấp token thành công!");
    } catch (err: any) {
      console.error("Lỗi đăng nhập Google:", err);
      // Hiển thị thông báo thân thiện
      if (err.code === "auth/popup-closed-by-user") {
        setError("Cửa sổ đăng nhập đã bị đóng trước khi hoàn tất.");
      } else if (err.code === "auth/network-request-failed") {
        setError("Lỗi kết nối mạng. Vui lòng kiểm tra lại đường truyền.");
      } else {
        setError(err.message || "Đăng nhập Google thất bại. Vui lòng thử lại.");
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
        className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl flex flex-col items-center text-center relative z-10"
      >
        {/* Logo Container */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-orange-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-900/40 mb-6">
          <Flame className="w-8 h-8 text-white animate-pulse" />
        </div>

        {/* Title & Subtitle */}
        <h1 className="text-3xl font-extrabold text-white tracking-tight mb-2">
          FlashMaster
        </h1>
        <p className="text-purple-200/60 text-sm mb-8">
          Đăng nhập bằng tài khoản Google để tham gia học từ vựng và thách đấu PvP trực tuyến.
        </p>

        {/* Error Message Box */}
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

        {/* Google Login Button */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-white hover:bg-purple-50 text-slate-800 font-bold rounded-xl shadow-lg transition-all duration-300 transform active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-slate-800 border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <svg viewBox="0 0 24 24" width="20" height="20" className="flex-shrink-0">
              <path fill="#EA4335" d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.68 1.54 14.98 1 12 1 7.35 1 3.37 3.67 1.39 7.56l3.85 2.99c.9-2.7 3.42-4.51 6.76-4.51z"/>
              <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.34H12v4.43h6.44c-.28 1.47-1.11 2.71-2.36 3.55l3.66 2.84c2.14-1.97 3.37-4.87 3.37-8.48z"/>
              <path fill="#FBBC05" d="M5.24 10.55a6.93 6.93 0 0 1 0 2.9l-3.85 2.99a11.97 11.97 0 0 1 0-8.88l3.85 2.99z"/>
              <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.92l-3.66-2.84c-1.01.67-2.3 1.08-4.3 1.08-3.34 0-5.86-1.81-6.76-4.51L1.39 16.8C3.37 20.69 7.35 23 12 23z"/>
            </svg>
          )}
          <span>{loading ? "Đang kết nối..." : "Đăng nhập với Google"}</span>
        </button>

        {/* Footer info */}
        <div className="mt-8 flex items-center gap-1.5 text-xs text-purple-300/40">
          <LogIn className="w-3.5 h-3.5" />
          <span>Bảo mật bởi Google Firebase Authentication</span>
        </div>
      </motion.div>
    </div>
  );
}
