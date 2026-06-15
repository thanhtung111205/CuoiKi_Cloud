import React, { useState, useRef } from "react";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../config/firebase";
import { useAuth } from "../context/AuthContext";
import { Flame, LogIn, AlertCircle, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate, Link } from "react-router-dom";
import { TurnstileWidget } from "../components/TurnstileWidget";
import { TurnstileInstance } from "react-turnstile";

export default function Login() {
  const { loginWithGoogleToken, loginWithEmail } = useAuth();
  const navigate = useNavigate();
  const turnstileRef = useRef<TurnstileInstance>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [loginMethod, setLoginMethod] = useState<"google" | "email">("google");

  // Google Login
  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const idToken = await result.user.getIdToken();
      await loginWithGoogleToken(idToken);
      navigate("/dashboard");
    } catch (err: any) {
      console.error("Lỗi đăng nhập Google:", err);
      if (err.code === "auth/popup-closed-by-user") {
        setError("Cửa sổ đăng nhập đã bị đóng.");
      } else if (err.code === "auth/network-request-failed") {
        setError("Lỗi kết nối mạng.");
      } else {
        setError(err.message || "Đăng nhập Google thất bại.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Email/Password Login
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!turnstileToken) {
      setError("Vui lòng hoàn thành xác thực Turnstile.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await loginWithEmail(email, password, turnstileToken);
      navigate("/dashboard");
    } catch (err: any) {
      console.error("Lỗi:", err);
      if (err.code === "auth/user-not-found") {
        setError("Email không tồn tại.");
      } else if (err.code === "auth/wrong-password") {
        setError("Mật khẩu không đúng.");
      } else if (err.code === "auth/invalid-email") {
        setError("Email không hợp lệ.");
      } else {
        setError(err.message || "Đăng nhập thất bại.");
      }
      // Reset Turnstile
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
        className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl flex flex-col items-center text-center relative z-10"
      >
        {/* Logo Container */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-orange-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-900/40 mb-6">
          <Flame className="w-8 h-8 text-white animate-pulse" />
        </div>

        {/* Title */}
        <h1 className="text-3xl font-extrabold text-white tracking-tight mb-2">
          FlashMaster
        </h1>
        <p className="text-purple-200/60 text-sm mb-8">
          Đăng nhập để tham gia học từ vựng và thách đấu PvP
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

        {/* Login Method Tabs */}
        <div className="w-full flex gap-2 mb-6 bg-white/5 p-1 rounded-lg">
          <button
            onClick={() => {
              setLoginMethod("google");
              setError(null);
            }}
            className={`flex-1 py-2 px-4 rounded-md font-semibold transition-all ${
              loginMethod === "google"
                ? "bg-purple-600 text-white"
                : "text-purple-300 hover:text-white"
            }`}
          >
            Google
          </button>
          <button
            onClick={() => {
              setLoginMethod("email");
              setError(null);
            }}
            className={`flex-1 py-2 px-4 rounded-md font-semibold transition-all ${
              loginMethod === "email"
                ? "bg-purple-600 text-white"
                : "text-purple-300 hover:text-white"
            }`}
          >
            Email
          </button>
        </div>

        {/* Google Login */}
        {loginMethod === "google" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full"
          >
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
          </motion.div>
        )}

        {/* Email/Password Login */}
        {loginMethod === "email" && (
          <motion.form
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={handleEmailLogin}
            className="w-full space-y-4"
          >
            {/* Email Input */}
            <div className="relative">
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

            {/* Password Input */}
            <div className="relative">
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

            {/* Turnstile CAPTCHA */}
            <TurnstileWidget
              onVerify={(token) => setTurnstileToken(token)}
              onError={() => setError("Xác thực Turnstile thất bại.")}
              onExpire={() => setTurnstileToken(null)}
            />

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading || !turnstileToken}
              className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold rounded-lg transition-all duration-300 transform active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
            >
              {loading ? "Đang đăng nhập..." : "Đăng nhập"}
            </button>

            {/* Forgot Password Link */}
            <div className="text-center">
              <Link
                to="/forgot-password"
                className="text-sm text-purple-300 hover:text-purple-200 transition-colors"
              >
                Quên mật khẩu?
              </Link>
            </div>

            {/* Signup Link */}
            <div className="text-center pt-2 border-t border-white/10">
              <p className="text-sm text-purple-300">
                Chưa có tài khoản?{" "}
                <Link
                  to="/signup"
                  className="font-semibold text-purple-200 hover:text-white transition-colors"
                >
                  Đăng ký ngay
                </Link>
              </p>
            </div>
          </motion.form>
        )}

        {/* Footer */}
        <div className="mt-8 flex items-center gap-1.5 text-xs text-purple-300/40">
          <LogIn className="w-3.5 h-3.5" />
          <span>Bảo vệ bởi Firebase & Cloudflare Turnstile</span>
        </div>
      </motion.div>
    </div>
  );
}
