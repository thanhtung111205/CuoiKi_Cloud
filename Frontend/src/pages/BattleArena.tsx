import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Swords, Trophy, Clock, User, Shield, Key, ArrowRight, Play, Loader2, LogOut, Mail, Heart } from "lucide-react";
import { battleQuestions } from "@/data/mockData";
import { useAuth } from "@/context/AuthContext";
import { db, requestForToken, messaging } from "@/config/firebase";
import { doc, setDoc, updateDoc, onSnapshot, getDoc } from "firebase/firestore";
import { onMessage } from "firebase/messaging";
import Turnstile from "react-turnstile";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

export default function BattleArena() {
  const { user, token } = useAuth();

  // Game states
  const [role, setRole] = useState<"host" | "guest" | null>(null);
  const [pin, setPin] = useState("");
  const [battleData, setBattleData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(15);
  const [showAnswerFeedback, setShowAnswerFeedback] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [historySaved, setHistorySaved] = useState(false);
  const [cheatingReported, setCheatingReported] = useState(false);

  // Fraud detection: đếm số lần chuyển tab trong phiên Battle
  const tabSwitchCountRef = useRef(0);
  const fraudReportedRef = useRef(false);

  // Decks selection state
  const [decks, setDecks] = useState<any[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState("");

  // Screen shake & damage popups
  const [shakeSelf, setShakeSelf] = useState(false);
  const [hostDmgPopup, setHostDmgPopup] = useState<string | null>(null);
  const [guestDmgPopup, setGuestDmgPopup] = useState<string | null>(null);

  // Refs for tracking previous HP values to trigger effects
  const prevHostHPRef = useRef(1000);
  const prevGuestHPRef = useRef(1000);

  // Refs for timers
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nextQuestionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs for unmount listener
  const pinRef = useRef(pin);
  const roleRef = useRef(role);
  const battleDataRef = useRef(battleData);

  useEffect(() => {
    pinRef.current = pin;
    roleRef.current = role;
    battleDataRef.current = battleData;
  }, [pin, role, battleData]);

  // Lắng nghe và hiển thị thông báo FCM ở chế độ foreground (khi trình duyệt đang hoạt động/mở tab khác)
  useEffect(() => {
    const unsubscribe = onMessage(messaging, (payload) => {
      console.log("[FCM] Nhận thông báo ở foreground:", payload);
      if (Notification.permission === "granted") {
        new Notification(payload.notification?.title || "Đấu trường 1v1", {
          body: payload.notification?.body,
          icon: "/favicon.svg",
        });
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch user decks list
  useEffect(() => {
    const fetchDecks = async () => {
      if (!token) return;
      try {
        const response = await axios.get(`${API_URL}/api/decks?limit=100`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.data?.success) {
          const decksList = response.data.data || [];
          setDecks(decksList);
          if (decksList.length > 0) {
            setSelectedDeckId(decksList[0].id);
          }
        }
      } catch (err) {
        console.error("Lỗi lấy danh sách bộ thẻ:", err);
      }
    };
    fetchDecks();
  }, [token]);

  // Clean timers
  const clearTimers = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (nextQuestionTimeoutRef.current) clearTimeout(nextQuestionTimeoutRef.current);
  };

  // 1. Host creates room
  const handleHostCreateRoom = async () => {
    if (!user || !selectedDeckId) {
      alert("Vui lòng chọn bộ thẻ thi đấu!");
      return;
    }
    setLoading(true);
    try {
      // Fetch cards of the selected deck
      const cardsResponse = await axios.get(`${API_URL}/api/decks/${selectedDeckId}/flashcards?limit=100`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const cardsList = cardsResponse.data?.data || [];
      if (cardsList.length < 4) {
        alert("Bộ thẻ này cần tối thiểu 4 từ vựng để tạo phòng đấu trắc nghiệm! Vui lòng chọn bộ thẻ khác hoặc thêm từ vựng.");
        setLoading(false);
        return;
      }

      // Generate dynamic MCQ questions from flashcards list
      const shuffledCards = [...cardsList].sort(() => 0.5 - Math.random());
      const activeCards = shuffledCards.slice(0, 5); // Max 5 questions

      const generatedQuestions = activeCards.map((card, idx) => {
        const correctText = card.meaningVi;

        // Exclude correct answer to find wrong answers
        const wrongAnswers = cardsList
          .filter((c: any) => c.id !== card.id)
          .map((c: any) => c.meaningVi);

        // Take 3 unique wrong answers
        const uniqueWrongAnswers = [...new Set(wrongAnswers)].sort(() => 0.5 - Math.random()).slice(0, 3);

        // Fallback mock wrong answers if deck has duplicated values
        while (uniqueWrongAnswers.length < 3) {
          uniqueWrongAnswers.push(`Đáp án giả lập ${uniqueWrongAnswers.length + 1}`);
        }

        // Shuffle 4 options
        const options = [correctText, ...uniqueWrongAnswers].sort(() => 0.5 - Math.random());
        const correctIdx = options.indexOf(correctText);

        return {
          id: idx,
          question: `Từ '${card.wordEn}' có nghĩa là gì?`,
          options: options,
          correct: correctIdx
        };
      });

      const generatedPin = Math.floor(100000 + Math.random() * 900000).toString();

      // Yêu cầu quyền nhận thông báo FCM và lấy Token để gửi khi đổi tab
      let hostFCMToken: string | null = null;
      try {
        hostFCMToken = await requestForToken();
        console.log("Host FCM Token:", hostFCMToken);
        if (hostFCMToken) {
          // Gửi Token lên PostgreSQL để lưu trữ cho Host
          await axios.post(`${API_URL}/api/users/fcm-token`, { token: hostFCMToken }, {
            headers: { Authorization: `Bearer ${token}` }
          });
          console.log("Đã cập nhật FCM Token của Host vào PostgreSQL.");
        }
      } catch (fcmErr) {
        console.warn("Không lấy được FCM Token cho Host:", fcmErr);
      }

      const roomRef = doc(db, "battles", generatedPin);
      await setDoc(roomRef, {
        pin: generatedPin,
        hostId: user.id,
        hostName: user.fullName,
        hostEmail: user.email,
        hostHP: 1000,
        hostCombo: 0,
        hostSelectedAnswer: null,
        hostFCMToken: hostFCMToken,
        guestId: null,
        guestName: null,
        guestEmail: null,
        guestHP: 1000,
        guestCombo: 0,
        guestSelectedAnswer: null,
        status: "waiting",
        currentQuestionIndex: 0,
        questions: generatedQuestions,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      setPin(generatedPin);
      setRole("host");
      prevHostHPRef.current = 1000;
      prevGuestHPRef.current = 1000;
    } catch (err: any) {
      console.error("Lỗi khi tạo phòng đấu:", err);
      alert("Không thể tạo phòng đấu. Vui lòng kiểm tra cấu hình Firestore hoặc kết nối API.");
    } finally {
      setLoading(false);
    }
  };

  // 2. Guest joins room
  const handleGuestJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !pin) return;

    if (!turnstileToken) {
      alert("Vui lòng hoàn thành CAPTCHA Turnstile để tham gia phòng đấu.");
      return;
    }

    setLoading(true);
    try {
      const roomRef = doc(db, "battles", pin);
      const roomDoc = await getDoc(roomRef);

      if (!roomDoc.exists()) {
        alert("Không tìm thấy mã phòng này! Vui lòng kiểm tra lại.");
        setLoading(false);
        return;
      }

      const data = roomDoc.data();
      if (data.status !== "waiting") {
        alert("Phòng đấu này đã đầy, đã bắt đầu hoặc đã kết thúc.");
        setLoading(false);
        return;
      }

      await updateDoc(roomRef, {
        guestId: user.id,
        guestName: user.fullName,
        guestEmail: user.email,
        status: "waiting_for_start",
        updatedAt: Date.now(),
      });

      // Gửi yêu cầu FCM tới Host báo có Guest tham gia
      try {
        await axios.post(`${API_URL}/api/battle/notify-opponent-joined`, {
          pin: pin,
          guestName: user.fullName
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (fcmErr) {
        console.warn("Lỗi gửi thông báo join cho Host qua FCM:", fcmErr);
      }

      setRole("guest");
      prevHostHPRef.current = 1000;
      prevGuestHPRef.current = 1000;
    } catch (err: any) {
      console.error("Lỗi khi tham gia phòng đấu:", err);
      alert("Không thể tham gia phòng. Vui lòng kiểm tra lại mã PIN.");
    } finally {
      setLoading(false);
    }
  };

  // 3. Host starts game
  const handleHostStartGame = async () => {
    if (role !== "host" || !pin) return;
    try {
      const roomRef = doc(db, "battles", pin);
      await updateDoc(roomRef, {
        status: "playing",
        currentQuestionIndex: 0,
        hostHP: 1000,
        guestHP: 1000,
        hostSelectedAnswer: null,
        guestSelectedAnswer: null,
        roundStartedAt: Date.now(),
        updatedAt: Date.now(),
      });
    } catch (err) {
      console.error("Lỗi bắt đầu trận đấu:", err);
    }
  };

  // 4. Submit answer to Backend
  const handleAnswerSelection = async (index: number) => {
    if (selectedAnswer !== null || !battleData || battleData.status !== "playing") return;
    setSelectedAnswer(index);
    clearTimers();

    const currentQuestion = battleData.questions[battleData.currentQuestionIndex];

    try {
      const response = await fetch(`${API_URL}/api/battle/submit-answer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          pin: pin,
          questionId: currentQuestion.id,
          selectedAnswer: index,
          timeLeft: timeLeft,
        }),
      });

      const resData = await response.json();
      if (!response.ok || !resData.success) {
        throw new Error(resData.message || "Lỗi xử lý sát thương từ Backend");
      }
    } catch (err) {
      console.error("Lỗi khi submit answer lên backend:", err);
      // Fallback
      const isCorrect = index === currentQuestion.correct;
      const roomRef = doc(db, "battles", pin);
      const updateData: any = {};
      if (role === "host") {
        updateData.hostSelectedAnswer = index;
        if (isCorrect) {
          updateData.guestHP = Math.max(0, (battleData.guestHP || 1000) - 50);
          updateData.guestDamageIndicator = "-50";
        } else {
          updateData.hostHP = Math.max(0, (battleData.hostHP || 1000) - 25);
          updateData.hostDamageIndicator = "💥 -25";
        }
      } else {
        updateData.guestSelectedAnswer = index;
        if (isCorrect) {
          updateData.hostHP = Math.max(0, (battleData.hostHP || 1000) - 50);
          updateData.hostDamageIndicator = "-50";
        } else {
          updateData.guestHP = Math.max(0, (battleData.guestHP || 1000) - 25);
          updateData.guestDamageIndicator = "💥 -25";
        }
      }
      await updateDoc(roomRef, updateData).catch(e => console.error(e));
    }
  };

  // 5. Send result summary email via Backend
  const sendResultEmail = async () => {
    if (!pin || isSendingEmail || emailSent) return;
    setIsSendingEmail(true);
    try {
      const response = await fetch(`${API_URL}/api/battle/send-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ pin }),
      });
      const data = await response.json();
      if (data.success) {
        setEmailSent(true);
      }
    } catch (err) {
      console.error("Lỗi gửi mail:", err);
    } finally {
      setIsSendingEmail(false);
    }
  };

  // 6. Handle timeout for current question
  const handleQuestionTimeout = async () => {
    if (selectedAnswer !== null || role === null || !battleData) return;
    setSelectedAnswer(-1);

    const currentQuestion = battleData.questions[battleData.currentQuestionIndex];
    try {
      await fetch(`${API_URL}/api/battle/submit-answer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          pin: pin,
          questionId: currentQuestion.id,
          selectedAnswer: -1,
          timeLeft: 0,
        }),
      });
    } catch (e) {
      // Client fallback
      const roomRef = doc(db, "battles", pin);
      const updateData: any = {};
      if (role === "host") {
        updateData.hostSelectedAnswer = -1;
        updateData.hostHP = Math.max(0, (battleData.hostHP || 1000) - 100);
        updateData.hostDamageIndicator = "💥 -100";
      } else {
        updateData.guestSelectedAnswer = -1;
        updateData.guestHP = Math.max(0, (battleData.guestHP || 1000) - 100);
        updateData.guestDamageIndicator = "💥 -100";
      }
      await updateDoc(roomRef, updateData).catch(err => console.error(err));
    }
  };

  // 7. Subscribe to Firestore Battle Document
  useEffect(() => {
    if (!pin) return;

    const roomRef = doc(db, "battles", pin);
    const unsubscribe = onSnapshot(roomRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setBattleData(data);

        const currentHostHP = data.hostHP !== undefined ? data.hostHP : 1000;
        const currentGuestHP = data.guestHP !== undefined ? data.guestHP : 1000;

        // Host bị trừ máu
        if (currentHostHP < prevHostHPRef.current) {
          const diff = prevHostHPRef.current - currentHostHP;
          setHostDmgPopup(`-${diff}`);
          setTimeout(() => setHostDmgPopup(null), 1500);

          if (roleRef.current === "host") {
            setShakeSelf(true);
            setTimeout(() => setShakeSelf(false), 500);
          }
        }
        prevHostHPRef.current = currentHostHP;

        // Guest bị trừ máu
        if (currentGuestHP < prevGuestHPRef.current) {
          const diff = prevGuestHPRef.current - currentGuestHP;
          setGuestDmgPopup(`-${diff}`);
          setTimeout(() => setGuestDmgPopup(null), 1500);

          if (roleRef.current === "guest") {
            setShakeSelf(true);
            setTimeout(() => setShakeSelf(false), 500);
          }
        }
        prevGuestHPRef.current = currentGuestHP;

        // Nếu đối thủ thoát
        if (data.status === "disconnected") {
          clearTimers();
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [pin]);

  // 7b. Handle unmounting/disconnecting separately
  useEffect(() => {
    const handleDisconnect = async () => {
      const currentPin = pinRef.current;
      const currentRole = roleRef.current;
      const currentData = battleDataRef.current;

      if (currentPin && currentRole && currentData &&
        (currentData.status === "playing" || currentData.status === "waiting" || currentData.status === "waiting_for_start")) {
        try {
          const roomRef = doc(db, "battles", currentPin);
          await updateDoc(roomRef, {
            status: "disconnected",
            updatedAt: Date.now(),
          });
        } catch (err) {
          console.error("Lỗi ngắt kết nối tự động:", err);
        }
      }
    };

    window.addEventListener("beforeunload", handleDisconnect);

    return () => {
      window.removeEventListener("beforeunload", handleDisconnect);
      handleDisconnect();
      clearTimers();
    };
  }, []);

  // 7b2. Fraud detection: theo dõi visibilitychange trong phiên playing
  useEffect(() => {
    if (!battleData || battleData.status !== "playing" || !pin || !token) return;

    const THRESHOLD = 3;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        tabSwitchCountRef.current += 1;

        if (tabSwitchCountRef.current >= THRESHOLD && !fraudReportedRef.current) {
          fraudReportedRef.current = true;
          fetch(`${API_URL}/api/battle/report-fraud`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              pin,
              tabSwitchCount: tabSwitchCountRef.current,
              questionIndex: battleData.currentQuestionIndex ?? 0,
            }),
          }).catch((err) => console.warn("[BattleArena] Lỗi report-fraud:", err));
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [battleData?.status, pin, token]);

  // 7c. Tự động lưu lịch sử + gửi email kết quả khi trận đấu kết thúc (status === "finished")
  useEffect(() => {
    if (battleData && battleData.status === "finished" && !historySaved && pin) {
      setHistorySaved(true);

      const saveHistory = async () => {
        try {
          const response = await fetch(`${API_URL}/api/battle/save-history`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify({ pin }),
          });
          const resData = await response.json();
          if (response.ok && resData.success) {
            console.log("[BattleArena] Lưu lịch sử trận đấu thành công!", resData.data);
          } else {
            console.warn("[BattleArena] Lưu lịch sử thất bại:", resData.message);
          }
        } catch (err) {
          console.error("[BattleArena] Lỗi gọi API lưu lịch sử trận đấu:", err);
        }
      };

      saveHistory();
      if (role === "host") sendResultEmail();
    }
  }, [battleData?.status, pin, historySaved, token]);

  // 7d. Tự động báo cáo gian lận (chuyển tab) khi đang thi đấu
  useEffect(() => {
    if (!battleData || battleData.status !== "playing" || cheatingReported || !token) return;

    const reportCheating = async (reasonText: string) => {
      try {
        setCheatingReported(true); // Đánh dấu đã báo cáo để tránh spam
        console.warn(`[BattleArena] 🚨 Phát hiện hành vi rời màn hình thi đấu! Lý do: ${reasonText}`);
        
        const response = await fetch(`${API_URL}/api/battle/report-cheating`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ reason: reasonText })
        });
        
        const resData = await response.json();
        if (response.ok && resData.success) {
          console.log("[BattleArena] Đã gửi cảnh báo gian lận lên HubSpot thành công! ID Ticket:", resData.ticketId);
        } else {
          console.warn("[BattleArena] Gửi báo cáo gian lận thất bại:", resData.message);
        }
      } catch (err) {
        console.error("[BattleArena] Lỗi gọi API báo cáo gian lận:", err);
      }
    };

    // Tự động phát hiện khi chuyển tab hoặc ẩn cửa sổ
    const handleVisibilityChange = () => {
      if (document.hidden) {
        reportCheating("Học viên chuyển sang tab khác trong quá trình Quiz Battle");
      }
    };

    // Tự động phát hiện khi người dùng rời tiêu điểm khỏi cửa sổ bài thi (ví dụ mở app khác đè lên)
    const handleBlur = () => {
      reportCheating("Học viên click ra ngoài hoặc chuyển hướng tiêu điểm khỏi màn hình thi đấu Quiz Battle");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
    };
  }, [battleData?.status, cheatingReported, token]);

  // 8. Game play logic loop (synchronizing questions)
  useEffect(() => {
    if (!battleData || battleData.status !== "playing") return;

    const hostAns = battleData.hostSelectedAnswer;
    const guestAns = battleData.guestSelectedAnswer;
    const currentQuestionIndex = battleData.currentQuestionIndex;
    const bothAnswered = hostAns !== null && guestAns !== null;

    // Reset các trạng thái local về mặc định khi câu hỏi mới bắt đầu (cả hai đáp án trên DB đều được reset về null)
    if (hostAns === null && guestAns === null) {
      setSelectedAnswer(null);
      setShowAnswerFeedback(false);
    }

    clearTimers();

    // Tính toán thời gian còn lại dựa trên roundStartedAt tuyệt đối từ Firestore
    const calculateTimeLeft = () => {
      if (!battleData.roundStartedAt) return 15;
      const elapsed = Math.floor((Date.now() - battleData.roundStartedAt) / 1000);
      return Math.max(0, 15 - elapsed);
    };

    const initialTime = calculateTimeLeft();
    setTimeLeft(initialTime);

    // Chạy đếm ngược thời gian đồng bộ cho cả hai client
    timerRef.current = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);

      if (remaining <= 0) {
        clearInterval(timerRef.current!);

        // Tự động timeout cho bản thân nếu chưa trả lời
        if (role === "host" && hostAns === null) {
          handleQuestionTimeout();
        } else if (role === "guest" && guestAns === null) {
          handleQuestionTimeout();
        }

        // Tự động force các đối thủ chưa trả lời về -1 để tránh đơ trận đấu (kể cả khi một bên offline/lag)
        if (!bothAnswered && !showAnswerFeedback) {
          const roomRef = doc(db, "battles", pin);
          const updateData: any = {};
          let needsUpdate = false;

          if (hostAns === null) {
            updateData.hostSelectedAnswer = -1;
            updateData.hostHP = Math.max(0, (battleData.hostHP || 1000) - 100);
            updateData.hostDamageIndicator = "💥 -100";
            needsUpdate = true;
          }
          if (guestAns === null) {
            updateData.guestSelectedAnswer = -1;
            updateData.guestHP = Math.max(0, (battleData.guestHP || 1000) - 100);
            updateData.guestDamageIndicator = "💥 -100";
            needsUpdate = true;
          }

          if (needsUpdate) {
            console.log("Force timeout for missing answers to prevent freeze");
            updateDoc(roomRef, updateData).catch(e => console.error(e));
          }
        }
      }
    }, 1000);

    if (bothAnswered) {
      clearTimers();
      setShowAnswerFeedback(true);

      nextQuestionTimeoutRef.current = setTimeout(async () => {
        setShowAnswerFeedback(false);

        const nextIndex = currentQuestionIndex + 1;
        const roomRef = doc(db, "battles", pin);

        if (nextIndex >= battleData.questions.length) {
          // Cả Host và Guest đều có quyền kết thúc trận đấu để tránh bị đơ nếu một bên bị lag/background throttling
          await updateDoc(roomRef, {
            status: "finished",
            updatedAt: Date.now(),
          });
        } else {
          // Chỉ Host chuyển câu hỏi tiếp theo để reset đáp án đồng bộ về null
          if (role === "host") {
            await updateDoc(roomRef, {
              currentQuestionIndex: nextIndex,
              hostSelectedAnswer: null,
              guestSelectedAnswer: null,
              roundStartedAt: Date.now(), // Thiết lập mốc thời gian bắt đầu câu mới
              updatedAt: Date.now(),
            });
          }
        }
      }, 2500);
    }

    return () => clearTimers();
  }, [
    battleData?.currentQuestionIndex,
    battleData?.hostSelectedAnswer,
    battleData?.guestSelectedAnswer,
    battleData?.status,
    role,
    pin,
    showAnswerFeedback
  ]);

  // Exit Room helper
  const handleExitRoom = async () => {
    if (pin) {
      try {
        const roomRef = doc(db, "battles", pin);
        await updateDoc(roomRef, {
          status: "disconnected",
          updatedAt: Date.now(),
        });
      } catch (err) {
        console.error(err);
      }
    }
    setRole(null);
    setPin("");
    setBattleData(null);
    setTurnstileToken("");
    setSelectedAnswer(null);
    setEmailSent(false);
    setHistorySaved(false);
    setCheatingReported(false);
  };

  // Neon custom styles for A, B, C, D buttons
  const getButtonFeedbackStyle = (index: number) => {
    const currentQuestion = battleData.questions[battleData.currentQuestionIndex];

    if (!showAnswerFeedback) {
      if (selectedAnswer === index) {
        return {
          background: "linear-gradient(135deg, #6366F1, #4F46E5)",
          border: "2px solid #6366F1",
          color: "white",
          boxShadow: "0 0 15px rgba(99, 102, 241, 0.6)",
        };
      }
      if (selectedAnswer !== null) {
        return {
          opacity: 0.5,
          filter: "grayscale(50%)",
        };
      }
      return {};
    }

    const isCorrectIndex = index === currentQuestion.correct;
    const isMySelection = selectedAnswer === index;

    if (isCorrectIndex) {
      return {
        background: "linear-gradient(135deg, #10B981, #059669)",
        border: "2px solid #10B981",
        color: "white",
        boxShadow: "0 0 15px #10B981",
      };
    }

    if (isMySelection && !isCorrectIndex) {
      return {
        background: "linear-gradient(135deg, #EF4444, #DC2626)",
        border: "2px solid #EF4444",
        color: "white",
        boxShadow: "0 0 15px #EF4444",
      };
    }

    return { opacity: 0.4, filter: "grayscale(100%)" };
  };

  // Base custom shadow styles for left (A,C - Blue) vs right (B,D - Red) buttons
  const getButtonBaseNeonStyle = (index: number) => {
    if (showAnswerFeedback || selectedAnswer !== null) return {}; // Override on feedback or selection

    const isLeftColumn = index === 0 || index === 2; // A and C
    if (isLeftColumn) {
      return {
        boxShadow: "0 0 10px rgba(0, 191, 255, 0.4), inset 0 0 5px rgba(0, 191, 255, 0.2)",
        borderColor: "rgba(0, 191, 255, 0.5)",
      };
    } else {
      return {
        boxShadow: "0 0 10px rgba(255, 51, 51, 0.4), inset 0 0 5px rgba(255, 51, 51, 0.2)",
        borderColor: "rgba(255, 51, 51, 0.5)",
      };
    }
  };

  // HP Color Picker helper
  const getHpColor = (hp: number) => {
    if (hp > 500) return "linear-gradient(90deg, #10B981, #059669)";
    if (hp > 200) return "linear-gradient(90deg, #F59E0B, #D97706)";
    return "linear-gradient(90deg, #EF4444, #DC2626)";
  };

  // Custom Wire Grid Background for Light Radiant Arena
  const GridBackground = () => (
    <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
      {/* Wire Mesh Grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage: `
            radial-gradient(circle, #64748b 1px, transparent 1px),
            linear-gradient(to right, rgba(100, 116, 139, 0.1) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(100, 116, 139, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: "24px 24px, 48px 48px, 48px 48px",
        }}
      />

      {/* Light Radiant Diagonal beams */}
      <div className="absolute -top-[30%] -left-[30%] w-[70%] h-[70%] rounded-full bg-sky-200/20 blur-[100px] pointer-events-none" />
      <div className="absolute -bottom-[30%] -right-[30%] w-[70%] h-[70%] rounded-full bg-red-200/20 blur-[100px] pointer-events-none" />
    </div>
  );

  // ==========================================
  // VIEW 1: CHỌN VAI TRÒ (HOST / GUEST)
  // ==========================================
  if (role === null) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center p-6 relative bg-slate-50">
        <GridBackground />

        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 100 }}
          className="w-full max-w-2xl bg-gradient-to-b from-white to-gray-200 border-2 border-gray-400 rounded-3xl shadow-xl p-10 relative z-10 overflow-hidden"
        >
          {/* Rivets in 4 corners */}
          <div className="absolute top-3 left-3 w-3.5 h-3.5 rounded-full bg-gray-400 border border-gray-500 flex items-center justify-center"><div className="w-1 h-1 rounded-full bg-gray-600" /></div>
          <div className="absolute top-3 right-3 w-3.5 h-3.5 rounded-full bg-gray-400 border border-gray-500 flex items-center justify-center"><div className="w-1 h-1 rounded-full bg-gray-600" /></div>
          <div className="absolute bottom-3 left-3 w-3.5 h-3.5 rounded-full bg-gray-400 border border-gray-500 flex items-center justify-center"><div className="w-1 h-1 rounded-full bg-gray-600" /></div>
          <div className="absolute bottom-3 right-3 w-3.5 h-3.5 rounded-full bg-gray-400 border border-gray-500 flex items-center justify-center"><div className="w-1 h-1 rounded-full bg-gray-600" /></div>

          <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg border border-gray-300"
            style={{ background: "linear-gradient(135deg, #4B0082, #FF6F61)" }}>
            <Swords className="w-10 h-10 text-white" />
          </div>

          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-2 uppercase text-center">Quiz Battle 1v1</h1>
          <p className="text-gray-600 mb-8 max-w-md mx-auto text-sm font-semibold text-center">
            Võ đài ánh sáng kim loại (Light Radiant Arena). Tạo phòng đấu máu HP hoặc nhập mã PIN thách đấu ngay lập tức!
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
            {/* Host Section */}
            <div className="bg-white/80 border border-gray-300 rounded-2xl p-6 flex flex-col items-center justify-between shadow-sm">
              <div className="mb-4 w-full">
                <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center mx-auto mb-3 border border-purple-100">
                  <Play className="w-6 h-6 text-purple-700" />
                </div>
                <h3 className="font-extrabold text-gray-800 text-lg mb-1 uppercase text-center">Tạo Phòng Đấu</h3>
                <p className="text-xs text-gray-500 text-center font-medium mb-3">
                  Nhận mã PIN phòng đấu RPG. Tấn công đối thủ và bảo vệ thanh máu của mình.
                </p>

                {/* Dropdown chọn bộ bài thi đấu */}
                <div className="w-full text-left">
                  <label className="block text-[10px] font-black text-gray-500 mb-1 uppercase tracking-wider">
                    Chọn bộ thẻ học thi đấu
                  </label>
                  {decks.length === 0 ? (
                    <div className="text-[11px] text-red-500 font-bold bg-red-50 border border-red-200 rounded-xl p-2.5 text-center">
                      ⚠️ Bạn chưa có bộ thẻ học nào! Hãy tạo bộ bài trước.
                    </div>
                  ) : (
                    <select
                      value={selectedDeckId}
                      onChange={(e) => setSelectedDeckId(e.target.value)}
                      className="w-full px-3 py-2 bg-gradient-to-b from-white to-gray-100 border border-gray-300 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      {decks.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.title} ({d._count?.flashcards ?? 0} thẻ)
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
              <button
                onClick={handleHostCreateRoom}
                disabled={loading || decks.length === 0}
                className="w-full py-3.5 bg-purple-700 hover:bg-purple-800 text-white font-extrabold rounded-xl shadow transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 uppercase text-xs tracking-wider"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Tạo phòng đấu HP"}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Guest Section */}
            <form onSubmit={handleGuestJoinRoom} className="bg-white/80 border border-gray-300 rounded-2xl p-6 flex flex-col justify-between items-center shadow-sm">
              <div className="w-full">
                <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center mx-auto mb-3 border border-orange-100">
                  <Key className="w-6 h-6 text-orange-600" />
                </div>
                <h3 className="font-extrabold text-gray-800 text-lg mb-1 uppercase text-center">Nhập PIN Đấu</h3>

                <input
                  type="text"
                  maxLength={6}
                  placeholder="MÃ PIN (6 SỐ)"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  className="w-full px-4 py-2 text-center text-lg font-black border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white mb-3 tracking-widest placeholder:tracking-normal placeholder:font-bold"
                />
              </div>

              <div className="mb-3 transform scale-90">
                <Turnstile
                  sitekey={import.meta.env.VITE_TURNSTILE_SITE_KEY || "1x00000000000000000000AA"}
                  onVerify={(token) => setTurnstileToken(token)}
                />
              </div>

              <button
                type="submit"
                disabled={loading || pin.length < 6 || !turnstileToken}
                className="w-full py-3.5 bg-orange-600 hover:bg-orange-700 text-white font-extrabold rounded-xl shadow transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 flex items-center justify-center gap-2 uppercase text-xs tracking-wider"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Vào đấu võ đài"}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    );
  }

  // ==========================================
  // VIEW 2: PHÒNG CHỜ (LOBBY - WAITING)
  // ==========================================
  if (battleData && (battleData.status === "waiting" || battleData.status === "waiting_for_start")) {
    const isGuestJoined = battleData.guestId !== null;

    return (
      <div className="min-h-[85vh] flex items-center justify-center p-6 relative bg-slate-50">
        <GridBackground />

        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full max-w-xl bg-gradient-to-b from-white to-gray-200 border-2 border-gray-400 rounded-3xl shadow-xl p-8 text-center relative z-10"
        >
          {/* Rivets */}
          <div className="absolute top-3 left-3 w-3.5 h-3.5 rounded-full bg-gray-400 border border-gray-500 flex items-center justify-center"><div className="w-1 h-1 rounded-full bg-gray-600" /></div>
          <div className="absolute top-3 right-3 w-3.5 h-3.5 rounded-full bg-gray-400 border border-gray-500 flex items-center justify-center"><div className="w-1 h-1 rounded-full bg-gray-600" /></div>
          <div className="absolute bottom-3 left-3 w-3.5 h-3.5 rounded-full bg-gray-400 border border-gray-500 flex items-center justify-center"><div className="w-1 h-1 rounded-full bg-gray-600" /></div>
          <div className="absolute bottom-3 right-3 w-3.5 h-3.5 rounded-full bg-gray-400 border border-gray-500 flex items-center justify-center"><div className="w-1 h-1 rounded-full bg-gray-600" /></div>

          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-black text-gray-800 flex items-center gap-2 uppercase tracking-wide">
              <Swords className="w-5 h-5 text-purple-700 animate-pulse" />
              Sảnh chờ võ đài
            </h2>
            <button
              onClick={handleExitRoom}
              className="px-3 py-1.5 hover:bg-red-50 text-red-500 border border-red-200 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold uppercase tracking-wider"
            >
              <LogOut className="w-3.5 h-3.5" />
              Rời phòng
            </button>
          </div>

          <div className="bg-white border-2 border-purple-400 rounded-2xl p-6 mb-6 shadow-inner relative overflow-hidden">
            {/* Digital light effect on PIN box */}
            <div className="absolute inset-0 bg-purple-400/5 pointer-events-none" />
            <p className="text-xs text-purple-700 font-extrabold mb-1 tracking-widest uppercase">MÃ PIN TRẬN ĐẤU</p>
            <p className="text-5xl font-black tracking-widest text-purple-900 select-all font-mono drop-shadow-[0_0_8px_rgba(168,85,247,0.3)]">{pin}</p>
            <p className="text-xs text-purple-500 mt-2 font-medium">Chia sẻ mã PIN cho đối thủ để cùng kết nối võ đài</p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-white border border-gray-300 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
              <User className="w-6 h-6 text-purple-700 mx-auto mb-2" />
              <p className="text-[10px] text-gray-400 font-bold uppercase">CHỦ PHÒNG (HOST)</p>
              <p className="font-extrabold text-gray-800 truncate mt-1">{battleData.hostName}</p>
              <div className="mt-2 inline-flex items-center justify-center gap-1 text-[10px] font-black text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded">
                <Heart className="w-3 h-3 text-red-500 fill-current" /> 1000 HP
              </div>
            </div>

            <div className="bg-white border border-gray-300 rounded-2xl p-4 shadow-sm flex flex-col justify-center items-center">
              {isGuestJoined ? (
                <>
                  <User className="w-6 h-6 text-orange-600 mb-2" />
                  <p className="text-[10px] text-gray-400 font-bold uppercase">ĐẤU THỦ (GUEST)</p>
                  <p className="font-extrabold text-gray-800 truncate mt-1">{battleData.guestName}</p>
                  <div className="mt-2 inline-flex items-center justify-center gap-1 text-[10px] font-black text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded">
                    <Heart className="w-3 h-3 text-red-500 fill-current" /> 1000 HP
                  </div>
                </>
              ) : (
                <div className="py-2">
                  <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-xs text-gray-400 font-extrabold uppercase tracking-wide">Chờ kết nối...</p>
                </div>
              )}
            </div>
          </div>

          {role === "host" ? (
            <button
              onClick={handleHostStartGame}
              disabled={!isGuestJoined}
              className="w-full py-4 bg-purple-700 hover:bg-purple-800 disabled:opacity-40 disabled:hover:bg-purple-700 text-white font-extrabold rounded-2xl shadow-lg transition-all hover:scale-[1.01] flex items-center justify-center gap-2 uppercase tracking-wide"
            >
              <Play className="w-5 h-5 fill-current" />
              Khởi Trận đấu HP
            </button>
          ) : (
            <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 text-orange-700 text-sm font-bold flex items-center justify-center gap-2 shadow-inner">
              <Loader2 className="w-5 h-5 animate-spin" />
              Đang chờ chủ phòng khởi trận...
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  // ==========================================
  // VIEW 3: TRẬN ĐẤU ĐANG DIỄN RA (PLAYING - RADIANT ARENA)
  // ==========================================
  if (battleData && battleData.status === "playing") {
    const currentQuestionIndex = battleData.currentQuestionIndex;
    const currentQuestion = battleData.questions[currentQuestionIndex];
    const isHost = role === "host";

    const myHP = isHost ? (battleData.hostHP ?? 1000) : (battleData.guestHP ?? 1000);
    const oppHP = isHost ? (battleData.guestHP ?? 1000) : (battleData.hostHP ?? 1000);
    const oppName = isHost ? battleData.guestName : battleData.hostName;
    const myCombo = isHost ? battleData.hostCombo : battleData.guestCombo;

    const myAnswered = isHost ? battleData.hostSelectedAnswer !== null : battleData.guestSelectedAnswer !== null;
    const oppAnswered = isHost ? battleData.guestSelectedAnswer !== null : battleData.hostSelectedAnswer !== null;

    // HP Percentage values
    const myHpPercent = (myHP / 1000) * 100;
    const oppHpPercent = (oppHP / 1000) * 100;

    return (
      <div className="min-h-[90vh] p-6 relative bg-slate-50 flex flex-col justify-center overflow-hidden">
        <GridBackground />

        {/* Combat Box wrapper */}
        <div className={`w-full max-w-4xl mx-auto space-y-6 relative z-10 transition-transform duration-100 ${shakeSelf ? "animate-bounce" : ""}`}>

          {/* TOP SECTION: Players HP Steel Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">

            {/* Left Player: You (Steel card style with HP bar) */}
            <div className="bg-gradient-to-b from-white to-gray-200 border-2 border-gray-400 rounded-2xl p-5 relative shadow-md flex flex-col justify-between min-h-[110px]">
              {/* Corner rivets */}
              <div className="absolute top-2 left-2 w-2 h-2 rounded-full bg-gray-400 border border-gray-500" />
              <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-gray-400 border border-gray-500" />
              <div className="absolute bottom-2 left-2 w-2 h-2 rounded-full bg-gray-400 border border-gray-500" />
              <div className="absolute bottom-2 right-2 w-2 h-2 rounded-full bg-gray-400 border border-gray-500" />

              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-black text-gray-800 flex items-center gap-1 uppercase tracking-wider">
                  <User className="w-3.5 h-3.5 text-purple-700" />
                  Bạn ({role === "host" ? "HOST" : "GUEST"})
                </span>
                <span className="text-xs font-black text-purple-900 font-mono tracking-wider">{myHP}/1000 HP</span>
              </div>

              {/* HP Bar in a dark inner groove */}
              <div className="h-5 w-full bg-gray-900 rounded-md overflow-hidden relative shadow-[inset_0_2px_4px_rgba(0,0,0,0.8)] border border-gray-700 p-[2px]">
                <div
                  className="h-full rounded-sm bg-gradient-to-r from-green-400 to-green-600 transition-all duration-500 ease-out"
                  style={{
                    width: `${myHpPercent}%`,
                  }}
                />
                {/* Embedded HP Value inside the bar */}
                <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white tabular-nums drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] font-mono">
                  {myHP} HP
                </div>
              </div>

              {/* Damage Popup Indicator */}
              <AnimatePresence>
                {isHost ? (
                  hostDmgPopup && (
                    <motion.div
                      initial={{ opacity: 0, y: 5, scale: 0.7 }}
                      animate={{ opacity: 1, y: -25, scale: 1.3 }}
                      exit={{ opacity: 0 }}
                      className="absolute top-1/3 left-1/2 transform -translate-x-1/2 text-2xl font-black text-red-600 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] font-mono"
                    >
                      {hostDmgPopup}
                    </motion.div>
                  )
                ) : (
                  guestDmgPopup && (
                    <motion.div
                      initial={{ opacity: 0, y: 5, scale: 0.7 }}
                      animate={{ opacity: 1, y: -25, scale: 1.3 }}
                      exit={{ opacity: 0 }}
                      className="absolute top-1/3 left-1/2 transform -translate-x-1/2 text-2xl font-black text-red-600 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] font-mono"
                    >
                      {guestDmgPopup}
                    </motion.div>
                  )
                )}
              </AnimatePresence>

              <div className="flex justify-between items-center mt-2 text-[10px] text-gray-700 font-bold uppercase tracking-wider">
                <span>Trạng thái: {myAnswered ? "Đã chọn đáp án" : "Đang suy nghĩ..."}</span>
                {myCombo > 1 && (
                  <span className="text-orange-600 font-black animate-pulse">🔥 Combo x{myCombo} (+{(myCombo - 1) * 25} ATK)</span>
                )}
              </div>
            </div>

            {/* Right Player: Opponent (Crimson HP card) */}
            <div className="bg-gradient-to-b from-white to-gray-200 border-2 border-gray-400 rounded-2xl p-5 relative shadow-md flex flex-col justify-between min-h-[110px]">
              {/* Corner rivets */}
              <div className="absolute top-2 left-2 w-2 h-2 rounded-full bg-gray-400 border border-gray-500" />
              <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-gray-400 border border-gray-500" />
              <div className="absolute bottom-2 left-2 w-2 h-2 rounded-full bg-gray-400 border border-gray-500" />
              <div className="absolute bottom-2 right-2 w-2 h-2 rounded-full bg-gray-400 border border-gray-500" />

              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-black text-gray-800 flex items-center gap-1 uppercase tracking-wider">
                  <User className="w-3.5 h-3.5 text-orange-600" />
                  Đối thủ ({oppName})
                </span>
                <span className="text-xs font-black text-red-900 font-mono tracking-wider">{oppHP}/1000 HP</span>
              </div>

              {/* Crimson/Red HP bar in dark groove */}
              <div className="h-5 w-full bg-gray-900 rounded-md overflow-hidden relative shadow-[inset_0_2px_4px_rgba(0,0,0,0.8)] border border-gray-700 p-[2px]">
                <div
                  className="h-full rounded-sm bg-gradient-to-r from-red-500 to-red-800 transition-all duration-500 ease-out"
                  style={{
                    width: `${oppHpPercent}%`,
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white tabular-nums drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] font-mono">
                  {oppHP} HP
                </div>
              </div>

              {/* Opponent Damage indicators */}
              <AnimatePresence>
                {!isHost ? (
                  hostDmgPopup && (
                    <motion.div
                      initial={{ opacity: 0, y: 5, scale: 0.7 }}
                      animate={{ opacity: 1, y: -25, scale: 1.3 }}
                      exit={{ opacity: 0 }}
                      className="absolute top-1/3 left-1/2 transform -translate-x-1/2 text-2xl font-black text-red-600 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] font-mono"
                    >
                      {hostDmgPopup}
                    </motion.div>
                  )
                ) : (
                  guestDmgPopup && (
                    <motion.div
                      initial={{ opacity: 0, y: 5, scale: 0.7 }}
                      animate={{ opacity: 1, y: -25, scale: 1.3 }}
                      exit={{ opacity: 0 }}
                      className="absolute top-1/3 left-1/2 transform -translate-x-1/2 text-2xl font-black text-red-600 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] font-mono"
                    >
                      {guestDmgPopup}
                    </motion.div>
                  )
                )}
              </AnimatePresence>

              <div className="flex justify-between items-center mt-2 text-[10px] text-gray-700 font-bold uppercase tracking-wider">
                <span>Trạng thái: {oppAnswered ? "Đã chọn xong" : "Đang suy nghĩ..."}</span>
                <span>Câu: {currentQuestionIndex + 1}/{battleData.questions.length}</span>
              </div>
            </div>

          </div>

          {/* MIDDLE SECTION: Neon Purple Energy Timer */}
          <div className="bg-white/80 border border-gray-300 rounded-2xl p-4 shadow-sm flex flex-col gap-1.5 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-purple-900 tracking-wider uppercase">
                Tốc độ quyết định sát thương
              </span>
              <span className="text-2xl font-black font-mono text-purple-600 animate-pulse drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]">
                {timeLeft}s
              </span>
            </div>

            {/* Neon glowing progress bar */}
            <div className="h-6 w-full bg-gray-800 rounded-full overflow-hidden p-[3px] shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)] border border-gray-700 flex items-center">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-purple-400 to-purple-600 shadow-[0_0_12px_rgba(168,85,247,0.8)]"
                style={{
                  width: `${(timeLeft / 15) * 100}%`,
                  transition: "width 1s linear",
                }}
              />
            </div>
          </div>

          {/* CENTER SECTION: Question Card (Steel sheet with rivets) */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuestionIndex}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="bg-gradient-to-b from-gray-50 to-gray-200 border-2 border-gray-400 rounded-3xl p-8 shadow-lg text-center relative overflow-hidden"
            >
              {/* Corner rivets */}
              <div className="absolute top-3 left-3 w-3.5 h-3.5 rounded-full bg-gray-400 border border-gray-500 flex items-center justify-center"><div className="w-1 h-1 rounded-full bg-gray-600" /></div>
              <div className="absolute top-3 right-3 w-3.5 h-3.5 rounded-full bg-gray-400 border border-gray-500 flex items-center justify-center"><div className="w-1 h-1 rounded-full bg-gray-600" /></div>
              <div className="absolute bottom-3 left-3 w-3.5 h-3.5 rounded-full bg-gray-400 border border-gray-500 flex items-center justify-center"><div className="w-1 h-1 rounded-full bg-gray-600" /></div>
              <div className="absolute bottom-3 right-3 w-3.5 h-3.5 rounded-full bg-gray-400 border border-gray-500 flex items-center justify-center"><div className="w-1 h-1 rounded-full bg-gray-600" /></div>

              <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-2 font-black">Nội dung câu hỏi</p>
              <h2 className="text-2xl font-black text-gray-900 drop-shadow-sm px-6">{currentQuestion.question}</h2>
            </motion.div>
          </AnimatePresence>

          {/* BOTTOM SECTION: Neon-bordered answer buttons */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {currentQuestion.options.map((option: string, index: number) => {
              const isLeftColumn = index === 0 || index === 2; // A and C (Blue)
              return (
                <motion.button
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => handleAnswerSelection(index)}
                  disabled={selectedAnswer !== null}
                  className="py-4 px-5 bg-gradient-to-br from-gray-100 to-gray-200 border-2 rounded-xl text-sm font-black text-gray-800 text-left transition-all duration-200 hover:scale-[1.03] disabled:cursor-default flex items-center justify-between"
                  style={{
                    ...getButtonBaseNeonStyle(index),
                    ...getButtonFeedbackStyle(index),
                  }}
                >
                  <span className="flex-1">
                    <span className="opacity-50 mr-2 text-xs font-extrabold">
                      {["A", "B", "C", "D"][index]}.
                    </span>
                    {option}
                  </span>

                  {/* Protruding tail button indicator (Xanh lơ cho A,C - Đỏ cho B,D) */}
                  {!showAnswerFeedback && selectedAnswer === null && (
                    <div
                      className={`w-4 h-4 rounded-full border border-white ml-2 flex-shrink-0 animate-pulse ${isLeftColumn
                        ? "bg-sky-400 shadow-[0_0_8px_#00bfff]"
                        : "bg-red-500 shadow-[0_0_8px_#ff3333]"
                        }`}
                    />
                  )}
                </motion.button>
              );
            })}
          </div>

          {/* FOOTER: Static PIN & Sync Alert */}
          <div className="text-center text-[10px] text-gray-600 flex items-center justify-center gap-2 py-2 font-bold uppercase tracking-wider relative z-10">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse border border-white" />
            Võ đài PIN: {pin} — Sát thương được đồng bộ tính toán trực tuyến qua Firebase Firestore
          </div>

        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 4: ĐỐI THỦ NGẮT KẾT NỐI (DISCONNECTED)
  // ==========================================
  if (battleData && battleData.status === "disconnected") {
    return (
      <div className="min-h-[85vh] flex items-center justify-center p-6 relative bg-slate-50">
        <GridBackground />

        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-gradient-to-b from-white to-gray-200 border-2 border-gray-400 rounded-3xl p-8 shadow-xl text-center relative z-10 max-w-md"
        >
          {/* Rivets */}
          <div className="absolute top-3 left-3 w-3.5 h-3.5 rounded-full bg-gray-400 border border-gray-500 flex items-center justify-center"><div className="w-1 h-1 rounded-full bg-gray-600" /></div>
          <div className="absolute top-3 right-3 w-3.5 h-3.5 rounded-full bg-gray-400 border border-gray-500 flex items-center justify-center"><div className="w-1 h-1 rounded-full bg-gray-600" /></div>
          <div className="absolute bottom-3 left-3 w-3.5 h-3.5 rounded-full bg-gray-400 border border-gray-500 flex items-center justify-center"><div className="w-1 h-1 rounded-full bg-gray-600" /></div>
          <div className="absolute bottom-3 right-3 w-3.5 h-3.5 rounded-full bg-gray-400 border border-gray-500 flex items-center justify-center"><div className="w-1 h-1 rounded-full bg-gray-600" /></div>

          <div className="w-16 h-16 rounded-full bg-red-50 border border-red-200 flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-2 uppercase tracking-wide">Đấu trường bị ngắt</h2>
          <p className="text-gray-600 text-xs font-semibold mb-6">
            Đấu thủ đối kháng đã rời trận hoặc ngắt kết nối mạng đột ngột. Trận đấu buộc phải chấm dứt sớm.
          </p>
          <button
            onClick={handleExitRoom}
            className="w-full py-3 bg-purple-700 hover:bg-purple-800 text-white font-extrabold rounded-xl transition-all shadow-md uppercase tracking-wider text-xs"
          >
            Quay lại Đấu Trường
          </button>
        </motion.div>
      </div>
    );
  }

  // ==========================================
  // VIEW 5: TRẬN ĐẤU KẾT THÚC (FINISHED - HP RESULT)
  // ==========================================
  if (battleData && battleData.status === "finished") {
    const isHost = role === "host";
    const myHP = isHost ? (battleData.hostHP ?? 1000) : (battleData.guestHP ?? 1000);
    const oppHP = isHost ? (battleData.guestHP ?? 1000) : (battleData.hostHP ?? 1000);
    const oppName = isHost ? battleData.guestName : battleData.hostName;
    const won = myHP > oppHP;
    const draw = myHP === oppHP;

    return (
      <div className="min-h-[85vh] flex items-center justify-center p-6 relative bg-slate-50">
        <GridBackground />

        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full max-w-xl bg-gradient-to-b from-white to-gray-200 border-2 border-gray-400 rounded-3xl shadow-xl p-8 text-center relative z-10"
        >
          {/* Rivets */}
          <div className="absolute top-3 left-3 w-3.5 h-3.5 rounded-full bg-gray-400 border border-gray-500 flex items-center justify-center"><div className="w-1 h-1 rounded-full bg-gray-600" /></div>
          <div className="absolute top-3 right-3 w-3.5 h-3.5 rounded-full bg-gray-400 border border-gray-500 flex items-center justify-center"><div className="w-1 h-1 rounded-full bg-gray-600" /></div>
          <div className="absolute bottom-3 left-3 w-3.5 h-3.5 rounded-full bg-gray-400 border border-gray-500 flex items-center justify-center"><div className="w-1 h-1 rounded-full bg-gray-600" /></div>
          <div className="absolute bottom-3 right-3 w-3.5 h-3.5 rounded-full bg-gray-400 border border-gray-500 flex items-center justify-center"><div className="w-1 h-1 rounded-full bg-gray-600" /></div>

          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg border border-gray-300 animate-bounce"
            style={{
              background: draw
                ? "linear-gradient(135deg, #6B7280, #4B5563)"
                : won
                  ? "linear-gradient(135deg, #10B981, #059669)"
                  : "linear-gradient(135deg, #EF4444, #DC2626)"
            }}>
            <Trophy className="w-10 h-10 text-white" />
          </div>

          <h2 className="text-3xl font-black text-gray-900 mb-1 uppercase tracking-tight">
            {draw ? "🤝 KẾT QUẢ HÒA!" : won ? "🎉 BẠN CHIẾN THẮNG!" : "😤 THUA CUỘC RỒI!"}
          </h2>
          <p className="text-gray-600 text-xs font-bold mb-6">
            {draw
              ? "Hai người có lượng HP bằng nhau sau khi trả lời hết các câu hỏi!"
              : (won ? "Bạn giành thắng lợi nhờ giữ lượng máu HP cao hơn!" : "Đối thủ thắng cuộc nhờ lượng máu HP nhỉnh hơn!")
            }
          </p>

          {/* Scores Panel displaying remaining HP */}
          <div className="grid grid-cols-3 gap-4 items-center mb-6">
            <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4">
              <p className="text-[10px] font-black text-purple-700 uppercase">BẠN</p>
              <p className="text-3xl font-black text-purple-900 mt-1 font-mono">{myHP} HP</p>
            </div>

            <div className="text-red-500 font-extrabold text-xl animate-pulse">VS</div>

            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
              <p className="text-[10px] font-black text-orange-700 truncate max-w-[100px] mx-auto uppercase">{oppName}</p>
              <p className="text-3xl font-black text-orange-900 mt-1 font-mono">{oppHP} HP</p>
            </div>
          </div>

          {/* Email Result Status */}
          <div className="mb-6 bg-white border border-gray-300 rounded-xl p-4 text-left">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                <Mail className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-black text-gray-800 uppercase">Email Báo Cáo Võ Đài</p>
                <p className="text-[10px] text-gray-400 font-medium">Kết quả trận đấu tự động gửi tới cả hai người chơi qua Resend API.</p>
              </div>
            </div>

            <div className={`mt-3 text-center py-2 text-xs font-bold rounded-lg border flex items-center justify-center gap-1.5 ${
              emailSent
                ? "bg-green-50 text-green-700 border-green-200"
                : "bg-indigo-50 text-indigo-600 border-indigo-200"
            }`}>
              {emailSent ? (
                "✅ Đã gửi email kết quả thành công!"
              ) : (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Đang gửi email kết quả...
                </>
              )}
            </div>
          </div>

          {/* Return Home */}
          <button
            onClick={handleExitRoom}
            className="w-full py-4 bg-gray-900 hover:bg-black text-white font-extrabold rounded-2xl shadow-md transition-all hover:scale-[1.01] uppercase tracking-wider text-xs"
          >
            Quay lại Đấu Trường
          </button>
        </motion.div>
      </div>
    );
  }

  return null;
}
