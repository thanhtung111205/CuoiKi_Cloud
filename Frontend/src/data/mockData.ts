export interface Flashcard {
  id: number;
  front: string;
  back: string;
  phonetic: string;
  deckId: number;
}

export interface Deck {
  id: number;
  title: string;
  description: string;
  cardCount: number;
  lastStudied: string;
  progress: number;
  category: string;
}

export const mockDecks: Deck[] = [
  {
    id: 1,
    title: "IELTS Vocabulary",
    description: "Essential words for IELTS preparation",
    cardCount: 120,
    lastStudied: "2 giờ trước",
    progress: 68,
    category: "IELTS",
  },
  {
    id: 2,
    title: "Business English",
    description: "Professional terms for workplace communication",
    cardCount: 85,
    lastStudied: "Hôm qua",
    progress: 42,
    category: "Business",
  },
  {
    id: 3,
    title: "Daily Conversations",
    description: "Common phrases for everyday use",
    cardCount: 60,
    lastStudied: "3 ngày trước",
    progress: 90,
    category: "Daily",
  },
  {
    id: 4,
    title: "TOEIC 900+",
    description: "High-frequency TOEIC vocabulary",
    cardCount: 200,
    lastStudied: "1 tuần trước",
    progress: 25,
    category: "TOEIC",
  },
  {
    id: 5,
    title: "Academic Words",
    description: "University-level academic vocabulary",
    cardCount: 150,
    lastStudied: "5 ngày trước",
    progress: 55,
    category: "Academic",
  },
  {
    id: 6,
    title: "Idioms & Phrases",
    description: "Common English idioms and expressions",
    cardCount: 75,
    lastStudied: "2 tuần trước",
    progress: 35,
    category: "Idioms",
  },
];

export const mockFlashcards: Flashcard[] = [
  {
    id: 1,
    front: "Eloquent",
    back: "Ăn nói lưu loát, hùng hồn",
    phonetic: "/ˈɛl.ə.kwənt/",
    deckId: 1,
  },
  {
    id: 2,
    front: "Perseverance",
    back: "Sự kiên trì, bền bỉ",
    phonetic: "/ˌpɜː.sɪˈvɪər.əns/",
    deckId: 1,
  },
  {
    id: 3,
    front: "Ambiguous",
    back: "Mơ hồ, không rõ ràng",
    phonetic: "/æmˈbɪɡ.ju.əs/",
    deckId: 1,
  },
  {
    id: 4,
    front: "Meticulous",
    back: "Tỉ mỉ, cẩn thận",
    phonetic: "/məˈtɪk.jʊ.ləs/",
    deckId: 1,
  },
  {
    id: 5,
    front: "Paramount",
    back: "Tối quan trọng, hàng đầu",
    phonetic: "/ˈpær.ə.maʊnt/",
    deckId: 1,
  },
];

export const generatedFlashcards: Flashcard[] = [
  {
    id: 101,
    front: "Sustainable",
    back: "Bền vững, có thể duy trì lâu dài",
    phonetic: "/səˈsteɪ.nə.bəl/",
    deckId: 99,
  },
  {
    id: 102,
    front: "Innovation",
    back: "Sự đổi mới, cải tiến",
    phonetic: "/ˌɪn.əˈveɪ.ʃən/",
    deckId: 99,
  },
  {
    id: 103,
    front: "Collaborate",
    back: "Cộng tác, hợp tác",
    phonetic: "/kəˈlæb.ə.reɪt/",
    deckId: 99,
  },
  {
    id: 104,
    front: "Resilience",
    back: "Khả năng phục hồi, sức bật",
    phonetic: "/rɪˈzɪl.i.əns/",
    deckId: 99,
  },
  {
    id: 105,
    front: "Profound",
    back: "Sâu sắc, thâm thúy",
    phonetic: "/prəˈfaʊnd/",
    deckId: 99,
  },
];

export const battleQuestions = [
  {
    id: 1,
    question: "What does 'Ephemeral' mean?",
    options: ["Vĩnh cửu, bất biến", "Thoáng qua, ngắn ngủi", "Mạnh mẽ, kiên định", "Hỗn loạn, lộn xộn"],
    correct: 1,
  },
  {
    id: 2,
    question: "Choose the meaning of 'Tenacious'",
    options: ["Nhút nhát, e dè", "Liều lĩnh, bất cẩn", "Kiên cường, bền bỉ", "Thụ động, lười biếng"],
    correct: 2,
  },
  {
    id: 3,
    question: "What does 'Vivid' mean?",
    options: ["Nhạt nhẽo, buồn tẻ", "Sinh động, rực rỡ", "Mờ nhạt, nhạt nhòa", "Nghiêm túc, cứng nhắc"],
    correct: 1,
  },
  {
    id: 4,
    question: "Choose the meaning of 'Pragmatic'",
    options: ["Thực dụng, thực tế", "Lý tưởng, viển vông", "Bốc đồng, hấp tấp", "Bi quan, chán nản"],
    correct: 0,
  },
  {
    id: 5,
    question: "What does 'Eloquent' mean?",
    options: ["Rụt rè, ít nói", "Lắp bắp, khó hiểu", "Ăn nói lưu loát, hùng hồn", "Khắc nghiệt, lạnh lùng"],
    correct: 2,
  },
];
