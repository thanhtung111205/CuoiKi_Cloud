const prisma = require("../db");
const hubspotService = require("../services/hubspotService");

/**
 * Helper to get local date string in UTC+7 (Vietnam time)
 * @param {Date} date 
 * @returns {string} YYYY-MM-DD
 */
function getLocalDateString(date) {
  if (!date) return null;
  const tzOffset = 7 * 60 * 60 * 1000; // 7 hours
  const localTime = new Date(date.getTime() + tzOffset);
  return localTime.toISOString().split('T')[0];
}

/**
 * Updates the user's study streak based on their activity
 * @param {string} userId 
 */
async function updateUserStreak(userId) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        currentStreak: true,
        longestStreak: true,
        lastActiveDate: true,
      }
    });

    if (!user) return null;

    const now = new Date();
    const todayStr = getLocalDateString(now);
    const lastActiveStr = getLocalDateString(user.lastActiveDate);

    let newStreak = user.currentStreak;

    if (!user.lastActiveDate) {
      // First activity
      newStreak = 1;
    } else {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = getLocalDateString(yesterday);

      if (lastActiveStr === todayStr) {
        // Already active today, streak remains the same
        return user;
      } else if (lastActiveStr === yesterdayStr) {
        // Active yesterday, increment streak
        newStreak += 1;
      } else {
        // Streak broken, reset to 1
        newStreak = 1;
      }
    }

    const newLongestStreak = Math.max(user.longestStreak, newStreak);

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        currentStreak: newStreak,
        longestStreak: newLongestStreak,
        lastActiveDate: now,
      }
    });

    console.log(`[Streak] Updated user ${userId}: currentStreak=${newStreak}, longestStreak=${newLongestStreak}, lastActiveDate=${now.toISOString()}`);

    // Sync to HubSpot (non-blocking)
    prisma.deck.count({ where: { userId } })
      .then((totalDecks) => {
        hubspotService.upsertContact({
          id: updatedUser.id,
          email: updatedUser.email,
          fullName: updatedUser.fullName,
          currentStreak: updatedUser.currentStreak,
          totalDecks,
        });
      })
      .catch((err) => console.warn("[Streak] Lỗi sync HubSpot Contact:", err.message));

    return updatedUser;
  } catch (error) {
    console.error("[StreakHelper] Error updating streak:", error);
    throw error;
  }
}

module.exports = {
  updateUserStreak,
  getLocalDateString
};
