import { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import Dashboard from "@/pages/Dashboard";
import CreateDeck from "@/pages/CreateDeck";
import StudyMode from "@/pages/StudyMode";
import StudyLibrary from "@/pages/StudyLibrary";
import BattleArena from "@/pages/BattleArena";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import ForgotPassword from "@/pages/ForgotPassword";
import { AuthProvider, useAuth } from "@/context/AuthContext";

function MainApp() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f051d]">
        <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Authentication Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      {/* Protected Routes */}
      {user ? (
        <>
          <Route
            path="/"
            element={<Navigate to="/dashboard" replace />}
          />
          <Route
            path="/dashboard"
            element={
              <div className="flex min-h-screen" style={{ background: "#f8f6fc" }}>
                <Sidebar />
                <main className="flex-1 overflow-y-auto">
                  <Dashboard />
                </main>
              </div>
            }
          />
          <Route
            path="/create"
            element={
              <div className="flex min-h-screen" style={{ background: "#f8f6fc" }}>
                <Sidebar />
                <main className="flex-1 overflow-y-auto">
                  <CreateDeck />
                </main>
              </div>
            }
          />
          <Route
            path="/study"
            element={
              <div className="flex min-h-screen" style={{ background: "#f8f6fc" }}>
                <Sidebar />
                <main className="flex-1 overflow-y-auto">
                  <StudyLibrary />
                </main>
              </div>
            }
          />
          <Route
            path="/study/:deckId"
            element={
              <div className="flex min-h-screen" style={{ background: "#f8f6fc" }}>
                <Sidebar />
                <main className="flex-1 overflow-y-auto">
                  <StudyMode />
                </main>
              </div>
            }
          />
          <Route
            path="/battle"
            element={
              <div className="flex min-h-screen" style={{ background: "#f8f6fc" }}>
                <Sidebar />
                <main className="flex-1 overflow-y-auto">
                  <BattleArena />
                </main>
              </div>
            }
          />
        </>
      ) : (
        <Route path="*" element={<Navigate to="/login" replace />} />
      )}
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}

