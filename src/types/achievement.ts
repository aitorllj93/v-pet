import { Condition } from "./condition";


export type AchievementId = number;

export type Achievement = {
  id: AchievementId;
  name: string;
  conds: Condition[];
}