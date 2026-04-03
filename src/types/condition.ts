

export type Condition = ExperienceCondition | SeenCondition | AchievedCondition;

export type ExperienceCondition = {
  exp: number;
  label?: string;
}

export type SeenCondition = {
  seen: number[];
  label?: string;
}

export type AchievedCondition = {
  achieved: number[];
  label?: string;
}

export const isExperienceCondition = (cond: Condition): cond is ExperienceCondition => 'exp' in cond;
export const isSeenCondition = (cond: Condition): cond is SeenCondition => 'seen' in cond;
export const isAchievedCondition = (cond: Condition): cond is AchievedCondition => 'achieved' in cond;