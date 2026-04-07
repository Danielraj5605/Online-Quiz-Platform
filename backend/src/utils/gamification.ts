import prisma from '../db';

// XP calculation: base XP + bonus for score + time bonus
export const calculateXP = (score: number, total: number, timeTaken: number, timeLimit: number): number => {
  const baseXP = 50;
  const scorePercent = score / total;
  const scoreXP = Math.round(score * 50 * scorePercent); // Score * 50 * percentage
  const timeBonus = timeTaken < timeLimit * 0.5 ? 50 : timeTaken < timeLimit ? 25 : 0; // Speed bonus
  const perfectBonus = score === total ? 100 : 0; // Perfect score bonus

  return baseXP + scoreXP + timeBonus + perfectBonus;
};

// Tier thresholds
const TIERS = [
  { name: 'Bronze', minXP: 0 },
  { name: 'Silver', minXP: 1000 },
  { name: 'Gold', minXP: 2500 },
  { name: 'Platinum', minXP: 5000 },
  { name: 'Diamond', minXP: 10000 },
];

export const calculateTier = (xp: number): string => {
  let tier = TIERS[0].name;
  for (const t of TIERS) {
    if (xp >= t.minXP) tier = t.name;
  }
  return tier;
};

// Badge definitions
const BADGE_DEFINITIONS = [
  { name: 'First Quiz', description: 'Complete your first quiz', icon: '🎯', criteria: { quizzesCompleted: 1 } },
  { name: 'Quiz Master', description: 'Complete 10 quizzes', icon: '🏆', criteria: { quizzesCompleted: 10 } },
  { name: 'Quiz Legend', description: 'Complete 50 quizzes', icon: '👑', criteria: { quizzesCompleted: 50 } },
  { name: 'Perfect Score', description: 'Get 100% on a quiz', icon: '💯', criteria: { perfectScores: 1 } },
  { name: 'Speed Demon', description: 'Complete a quiz in under 25% of the time limit', icon: '⚡', criteria: { speedBonuses: 1 } },
  { name: 'Streak Starter', description: 'Complete quizzes 3 days in a row', icon: '🔥', criteria: { dailyStreak: 3 } },
  { name: 'Early Bird', description: 'Complete a quiz before noon', icon: '🌅', criteria: { earlyCompletions: 1 } },
  { name: 'Night Owl', description: 'Complete a quiz after 10 PM', icon: '🦉', criteria: { lateCompletions: 1 } },
  { name: 'Century Club', description: 'Earn 100 XP in a single quiz', icon: '💫', criteria: { xpInOneQuiz: 100 } },
  { name: 'Rising Star', description: 'Reach 1000 XP total', icon: '⭐', criteria: { totalXP: 1000 } },
  { name: 'Quiz Champion', description: 'Reach 5000 XP total', icon: '🏅', criteria: { totalXP: 5000 } },
];

// Initialize badges in database
export const initializeBadges = async () => {
  for (const def of BADGE_DEFINITIONS) {
    await prisma.badge.upsert({
      where: { name: def.name },
      update: {},
      create: {
        name: def.name,
        description: def.description,
        icon: def.icon,
        criteria: JSON.stringify(def.criteria),
      },
    });
  }
};

// Check and award badges after quiz completion
export const checkAndAwardBadges = async (
  userId: number,
  score: number,
  total: number,
  timeTaken: number,
  timeLimit: number,
  xpEarned: number
): Promise<{ newBadges: string[] }> => {
  const newBadges: string[] = [];

  // Get user stats
  const userStats = await getUserStats(userId);
  const badges = await prisma.badge.findMany();
  const userBadges = await prisma.userBadge.findMany({ where: { userId } });
  const earnedBadgeIds = new Set(userBadges.map((ub) => ub.badgeId));

  for (const badge of badges) {
    if (earnedBadgeIds.has(badge.id)) continue; // Already earned

    const criteria = JSON.parse(badge.criteria);
    let earned = false;

    // Check various criteria
    if (criteria.quizzesCompleted && userStats.totalQuizzes >= criteria.quizzesCompleted) earned = true;
    if (criteria.perfectScores && score === total && !earned) earned = true;
    if (criteria.speedBonuses && timeTaken < timeLimit * 0.25 && !earned) earned = true;
    if (criteria.xpInOneQuiz && xpEarned >= criteria.xpInOneQuiz && !earned) earned = true;
    if (criteria.totalXP && userStats.totalXP + xpEarned >= criteria.totalXP && !earned) earned = true;

    // Check time-based badges
    const now = new Date();
    const hour = now.getHours();
    if (criteria.earlyCompletions && hour < 12 && !earned) earned = true;
    if (criteria.lateCompletions && hour >= 22 && !earned) earned = true;

    // Check daily streak (simplified - just check if completed today)
    if (criteria.dailyStreak) {
      const todayStart = new Date(now.setHours(0, 0, 0, 0));
      const todayEnd = new Date(now.setHours(23, 59, 59, 999));
      const completedToday = await prisma.result.count({
        where: {
          userId,
          createdAt: { gte: todayStart, lte: todayEnd },
        },
      });
      if (completedToday >= criteria.dailyStreak) earned = true;
    }

    if (earned) {
      await prisma.userBadge.create({
        data: { userId, badgeId: badge.id },
      });
      newBadges.push(badge.name);
    }
  }

  return { newBadges };
};

// Get user stats for badge checking
export const getUserStats = async (userId: number) => {
  const [totalQuizzes, totalXP, results] = await Promise.all([
    prisma.result.count({ where: { userId } }),
    prisma.user.findUnique({ where: { id: userId }, select: { xp: true } }),
    prisma.result.findMany({
      where: { userId },
      select: { score: true, total: true, timeTaken: true, quiz: { select: { timeLimit: true } } },
    }),
  ]);

  const perfectScores = results.filter((r) => r.score === r.total).length;
  const speedBonuses = results.filter((r) => r.timeTaken < r.quiz!.timeLimit * 0.25).length;

  return {
    totalQuizzes,
    totalXP: totalXP?.xp || 0,
    perfectScores,
    speedBonuses,
  };
};

// Update user XP after quiz
export const updateUserXP = async (userId: number, xpEarned: number) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  const newXP = user.xp + xpEarned;
  const newTier = calculateTier(newXP);

  await prisma.user.update({
    where: { id: userId },
    data: { xp: newXP, tier: newTier },
  });

  return { newXP, newTier };
};
