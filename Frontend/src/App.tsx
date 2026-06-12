import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import Dashboard from "@/pages/Dashboard";
import CreateDeck from "@/pages/CreateDeck";
import StudyMode from "@/pages/StudyMode";
import BattleArena from "@/pages/BattleArena";
import Login from "@/pages/Login";
import { AuthProvider, useAuth } from "@/context/AuthContext";

type View = "dashboard" | "create" | "study" | "battle";

function MainApp() {
  const { user, loading } = useAuth();
  const [activeView, setActiveView] = useState<View>("dashboard");

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f051d]">
        <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Nếu chưa đăng nhập, kết xuất màn hình đăng nhập
  if (!user) {
    return <Login />;
  }

  const handleStudy = (_deckId: number) => {
    setActiveView("study");
  };

  const renderContent = () => {
    switch (activeView) {
      case "dashboard":
        return <Dashboard onStudy={handleStudy} />;
      case "create":
        return <CreateDeck />;
      case "study":
        return <StudyMode onBack={() => setActiveView("dashboard")} />;
      case "battle":
        return <BattleArena />;
      default:
        return <Dashboard onStudy={handleStudy} />;
    }
  };

  return (
    <div className="flex min-h-screen" style={{ background: "#f8f6fc" }}>
      <Sidebar activeView={activeView} onNavigate={setActiveView} />
      <main className="flex-1 overflow-y-auto">
        {renderContent()}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}

