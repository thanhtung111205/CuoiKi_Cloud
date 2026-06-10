import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import Dashboard from "@/pages/Dashboard";
import CreateDeck from "@/pages/CreateDeck";
import StudyMode from "@/pages/StudyMode";
import BattleArena from "@/pages/BattleArena";

type View = "dashboard" | "create" | "study" | "battle";

export default function App() {
  const [activeView, setActiveView] = useState<View>("dashboard");

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
