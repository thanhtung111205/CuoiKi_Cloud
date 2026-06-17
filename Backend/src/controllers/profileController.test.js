const { getProfile, updateProfile } = require("./profileController");
const { PrismaClient } = require("@prisma/client");

jest.mock("@prisma/client", () => {
  const mPrisma = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    studyProgress: {
      count: jest.fn(),
    },
    matchHistory: {
      count: jest.fn(),
    },
    deck: {
      count: jest.fn(),
    },
  };
  return { PrismaClient: jest.fn(() => mPrisma) };
});

describe("Profile Controller", () => {
  let prisma;
  let req;
  let res;

  beforeEach(() => {
    prisma = new PrismaClient();
    req = { user: { userId: 1 }, body: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  test("getProfile trả về 401 nếu không có token", async () => {
    req.user = null;
    await getProfile(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Không tìm thấy thông tin xác thực!",
    });
  });

  test("getProfile trả về 404 nếu user không tồn tại", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await getProfile(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("getProfile trả về dữ liệu user nếu tồn tại", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 1,
      email: "test@example.com",
      fullName: "Test User",
      avatarUrl: null,
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDate: new Date(),
      createdAt: new Date(),
    });
    prisma.studyProgress.count.mockResolvedValue(10);
    prisma.matchHistory.count.mockResolvedValue(5);
    prisma.deck.count.mockResolvedValue(2);

    await getProfile(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          email: "test@example.com",
          stats: expect.objectContaining({
            totalCardsStudied: 10,
            totalDecks: 2,
          }),
        }),
      })
    );
  });

  test("updateProfile trả về 400 nếu fullName trống", async () => {
    req.body.fullName = "   ";
    await updateProfile(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("updateProfile cập nhật thành công", async () => {
    req.body.fullName = "New Name";
    prisma.user.update.mockResolvedValue({
      id: 1,
      email: "test@example.com",
      fullName: "New Name",
      avatarUrl: null,
    });

    await updateProfile(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: "Cập nhật hồ sơ thành công.",
      })
    );
  });
});
