import React, { useState, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { Flame, AlertCircle, Mail, Lock, User, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate, Link } from "react-router-dom";
import { TurnstileWidget } from "../components/TurnstileWidget";
import { TurnstileInstance } from "react-turnstile";

export default function Signup() {
  const { signupWithEmail } = useAuth();
  const navigate = useNavigate();
  const turnstileRef = useRef<TurnstileInstance>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setError("Mật khẩu không khớp.");
      return;
    }

    if (password.length < 6) {
      setError("Mật khẩu phải có ít nhất 6 ký tự.");
      return;
    }

    if (!turnstileToken) {
      setError("Vui lòng hoàn thành xác thực Turnstile.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await signupWithEmail(email, password, fullName, turnstileToken);
      navigate("/dashboard");
    } catch (err: any) {
      console.error("Lỗi:", err);
      if (err.code === "auth/email-already-in-use") {
        setError("Email này đã được đăng ký.");
      } else if (err.code === "auth/weak-password") {
        setError("Mật khẩu quá yếu.");
      } else if (err.code === "auth/invalid-email") {
        setError("Email không hợp lệ.");
      } else {
        setError(err.message || "Đăng ký thất bại.");
      }
      turnstileRef.current?.reset();
      setTurnstileToken(null);
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
          className="flex items-center gap-2 text-purple-300 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Quay lại</span>
        </Link>

        {/* Logo */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-orange-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-900/40">
            <Flame className="w-8 h-8 text-white animate-pulse" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-extrabold text-white tracking-tight mb-2 text-center">
          Tạo tài khoản
        </h1>
        <p className="text-purple-200/60 text-sm mb-8 text-center">
          Đăng ký để bắt đầu học từ vựng
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

        {/* Form */}
        <form onSubmit={handleSignup} className="space-y-4">
          {/* Full Name */}
          <div>
            <label className="block text-sm font-semibold text-purple-200 mb-2">Tên đầy đủ</label>
            <div className="relative flex items-center">
              <User className="absolute left-3 w-5 h-5 text-purple-400 pointer-events-none" />
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nhập tên của bạn"
                className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 text-white placeholder-white/30 rounded-lg focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                required
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-semibold text-purple-200 mb-2">Email</label>
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

          {/* Password */}
          <div>
            <label className="block text-sm font-semibold text-purple-200 mb-2">Mật khẩu</label>
            <div className="relative flex items-center">
              <Lock className="absolute left-3 w-5 h-5 text-purple-400 pointer-events-none" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-3 bg-white/10 border border-white/20 text-white placeholder-white/30 rounded-lg focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 text-purple-400 hover:text-purple-300"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-semibold text-purple-200 mb-2">Xác nhận mật khẩu</label>
            <div className="relative flex items-center">
              <Lock className="absolute left-3 w-5 h-5 text-purple-400 pointer-events-none" />
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-3 bg-white/10 border border-white/20 text-white placeholder-white/30 rounded-lg focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 text-purple-400 hover:text-purple-300"
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Turnstile */}
          <TurnstileWidget
            onVerify={(token) => setTurnstileToken(token)}
            onError={() => setError("Xác thực Turnstile thất bại.")}
            onExpire={() => setTurnstileToken(null)}
          />

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !turnstileToken}
            className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold rounded-lg transition-all duration-300 transform active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
          >
            {loading ? "Đang đăng ký..." : "Đăng ký"}
          </button>
        </form>

        {/* Login Link */}
        <div className="text-center pt-6 border-t border-white/10 mt-6">
          <p className="text-sm text-purple-300">
            Đã có tài khoản?{" "}
            <Link
              to="/login"
              className="font-semibold text-purple-200 hover:text-white transition-colors"
            >
              Đăng nhập
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
