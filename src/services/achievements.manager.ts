

import { Achievement, AchievementId, isAchievedCondition, isExperienceCondition, isSeenCondition, type State } from "../types";

export class AchievementsManager {
  private achievements: Map<AchievementId, Achievement> | undefined;

  getAchievement(achievementId: AchievementId) {
    return this.achievements?.get(achievementId);
  }

  getAchievements() {
    return Array.from(this.achievements?.values() ?? []).sort((a, b) => a.id - b.id);
  }

  getAchievementsMap() {
    return this.achievements;
  }

  hasAchieved(state: State): Achievement[] {
    const achievements: Achievement[] = [];

    for (const achievement of (this.achievements?.values() ?? [])) {
      const hasAlreadyAchieved = state.achievements.includes(achievement.id);

      if (hasAlreadyAchieved) {
        continue;
      }

      if (this.hasAchievedAchievement(achievement, state)) {
        achievements.push(achievement);
      }
    }

    return achievements;
  }

  hasAchievedAchievement(achievement: Achievement, state: State): boolean {
    if (!achievement.conds) {
      return false;
    }

    return achievement.conds.every(cond => {
      if (isExperienceCondition(cond)) {
        return cond.exp < state.experience;
      }

      if (isSeenCondition(cond)) {
        return cond.seen.every(id => state.seenPets.includes(id));
      }

      if (isAchievedCondition(cond)) {
        return cond.achieved.every(id => state.achievements.includes(id));
      }

      return false;
    });
  }

  setAchievements(achievements: Achievement[]) {
    this.achievements = new Map(achievements.map(d => ([d.id, d])));
  }
}