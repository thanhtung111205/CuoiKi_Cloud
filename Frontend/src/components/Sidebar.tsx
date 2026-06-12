import { BookOpen, LayoutDashboard, Plus, Swords, Flame, LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

type View = "dashboard" | "create" | "study" | "battle";

interface SidebarProps {
  activeView: View;
  onNavigate: (view: View) => void;
}

const navItems = [
  { id: "dashboard" as View, label: "Dashboard", icon: LayoutDashboard },
  { id: "create" as View, label: "Tạo bộ bài", icon: Plus },
  { id: "study" as View, label: "Học từ vựng", icon: BookOpen },
  { id: "battle" as View, label: "Battle Arena", icon: Swords },
];

export default function Sidebar({ activeView, onNavigate }: SidebarProps) {
  const { user, logout } = useAuth();

  return (
    <aside className="w-64 min-h-screen flex flex-col" style={{ background: "#4B0082" }}>
      {/* Logo */}
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <Flame className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-white text-base leading-tight">FlashMaster</p>
            <p className="text-white/60 text-xs">Học ngoại ngữ thông minh</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-white text-purple-900 shadow-lg"
                  : "text-white/70 hover:text-white hover:bg-white/10"
              }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {item.label}
              {item.id === "battle" && (
                <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-orange-500 text-white font-bold">
                  LIVE
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="p-4 border-t border-white/10 space-y-2">
        <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-white/10">
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.fullName}
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white text-sm font-bold">
              {user?.fullName?.charAt(0).toUpperCase() || "U"}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{user?.fullName}</p>
            <p className="text-white/50 text-xs truncate">{user?.email}</p>
          </div>
        </div>
        
        <button
          onClick={() => {
            if (window.confirm("Bạn có chắc chắn muốn đăng xuất khỏi FlashMaster?")) {
              logout();
            }
          }}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-red-200 hover:text-white hover:bg-red-500/20 transition-all duration-200 cursor-pointer"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          Đăng xuất
        </button>
      </div>
    </aside>
  );
}

