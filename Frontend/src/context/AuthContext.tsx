import React, { createContext, useContext, useState, useEffect } from "react";
import { signOut, User as FirebaseUser } from "firebase/auth";
import { auth } from "../config/firebase";

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  loading: boolean;
  loginWithGoogleToken: (idToken: string) => Promise<void>;
  logout: () => Promise<void>;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Khôi phục session từ localStorage khi load trang
  useEffect(() => {
    const initAuth = async () => {
      const savedToken = localStorage.getItem("token");
      if (!savedToken) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_URL}/api/auth/me`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${savedToken}`,
            "Content-Type": "application/json",
          },
        });

        const data = await response.json();
        if (response.ok && data.success) {
          setToken(savedToken);
          setUser(data.user);
        } else {
          // Token hết hạn hoặc không hợp lệ -> xóa đi
          localStorage.removeItem("token");
          localStorage.removeItem("user");
        }
      } catch (err) {
        console.error("Lỗi khôi phục phiên đăng nhập:", err);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  // Hàm xử lý gửi Google ID Token từ Firebase lên Backend của ta
  const loginWithGoogleToken = async (idToken: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/auth/google-login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ idToken }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Đăng nhập thất bại từ hệ thống Backend.");
      }

      // Lưu token và user nhận được từ Backend vào State và LocalStorage
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
    } catch (err: any) {
      console.error("Lỗi trong loginWithGoogleToken:", err);
      setError(err.message || "Không thể kết nối đến server.");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Hàm Đăng xuất
  const logout = async () => {
    setLoading(true);
    try {
      // Đăng xuất khỏi Firebase Auth
      await signOut(auth);
    } catch (firebaseErr) {
      console.warn("Lỗi khi đăng xuất khỏi Firebase Auth:", firebaseErr);
    }

    // Xóa Local Storage và state
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
    setLoading(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        loginWithGoogleToken,
        logout,
        error,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth phải được đặt bên trong một AuthProvider");
  }
  return context;
};
