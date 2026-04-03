import { Achievement, AchievementId, Condition, isAchievedCondition, isExperienceCondition, isSeenCondition, Pet, PetId, PetLevel, State, Variation } from "../types";

function meetsImmediateConditions(
  conds: Condition[] = [],
  state: State,
  achievementsMap: Map<AchievementId, Achievement>,
): boolean {
  return conds.every((cond) => {
    if (isExperienceCondition(cond)) {
      return true; // ignoramos exp para elegibilidad/prioridad
    }

    if (isSeenCondition(cond)) {
      return cond.seen.every((id) => state.seenPets.includes(id));
    }

    if (isAchievedCondition(cond)) {
      return cond.achieved
          // Only enabled achievements
          .filter(a =>  (achievementsMap.get(a)?.conds?.length ?? 0) > 0)
          .every((id) => state.achievements.includes(id));
    }

    return true;
  });
}

export function meetsConditions(
  conds: Condition[] = [],
  state: State,
  achievementsMap: Map<AchievementId, Achievement>,
): boolean {
  return conds.every((cond) => {
    if (isExperienceCondition(cond)) {
      return state.experience >= cond.exp;
    }

    if (isSeenCondition(cond)) {
      return cond.seen.every((id) => state.seenPets.includes(id));
    }

    if (isAchievedCondition(cond)) {
      return cond.achieved
          // Only enabled achievements
          .filter(a =>  (achievementsMap.get(a)?.conds?.length ?? 0) > 0).every((id) => state.achievements.includes(id));
    }

    return true;
  });
}

function isSeen(id: PetId, state: State): boolean {
  return state.seenPets.includes(id);
}

function reachableDiscoveryScore(
  pet: Pet,
  state: State,
  petMap: Map<PetId, Pet>,
  achievementsMap: Map<AchievementId, Achievement>,
  excludedPetIds: PetId[],
): number {
  const visited = new Set<PetId>();

  function walk(current: Pet, depth: number): number {
    if (visited.has(current.id)) {return 0;}
    visited.add(current.id);

    let score = 0;

    if (!isSeen(current.id, state)) {
      score += depth === 0 ? 3 : depth === 1 ? 2 : 1;
    }

    for (const evo of current.evolutions ?? []) {
      if (excludedPetIds.includes(evo.target)) {continue;}
      const target = petMap.get(evo.target);
      if (!target) {continue;}

      const baseConds = [
        ...(evo.conds ?? []),
        ...(target.conds ?? []),
      ];

      if (meetsImmediateConditions(baseConds, state, achievementsMap)) {
        score += walk(target, depth + 1);
      }

      for (const variation of target.variations ?? []) {
        if (excludedPetIds.includes(variation.id)) {continue;}
        const variationTarget = petMap.get(variation.id);
        if (!variationTarget) {continue;}

        const variationConds = [
          ...baseConds,
          ...(variation.conds ?? []),
        ];

        if (meetsImmediateConditions(variationConds, state, achievementsMap)) {
          score += walk(variationTarget, depth + 1);
        }
      }
    }

    return score;
  }

  return walk(pet, 0);
}

function normalizeChance(
  candidates: EvolutionCandidate[]
): EvolutionCandidate[] {
  const total = candidates.reduce((sum, c) => sum + c.chance, 0);

  if (total <= 0) {
    const evenChance = candidates.length ? 1 / candidates.length : 0;
    return candidates.map((c) => ({
      ...c,
      chance: evenChance,
    }));
  }

  return candidates.map((c) => ({
    ...c,
    chance: c.chance / total,
  }));
}

export type EvolutionCandidate = {
  pet: Pet;
  chance: number;
  seen: boolean;
};

export function canEvolve(
  pet: Pet | undefined,
  state: State,
  petMap: Map<PetId, Pet>,
  achievementsMap: Map<AchievementId, Achievement>,
  excludedPetIds: PetId[] = []
): EvolutionCandidate[] {
  const candidates: EvolutionCandidate[] = [];

  for (const evo of (pet?.evolutions ?? [])) {
    const isExcluded = excludedPetIds.includes(evo.target);
    if (isExcluded) {continue;}
    const target = petMap.get(evo.target);
    if (!target) {continue;}

    const baseConds = [
      ...(evo.conds ?? []),
      ...(target.conds ?? []),
    ];

    // Target como candidato
    if (meetsConditions(baseConds, state, achievementsMap)) {
      candidates.push({
        pet: target,
        seen: isSeen(target.id, state),
        chance: reachableDiscoveryScore(target, state, petMap, achievementsMap, excludedPetIds),
      });
    }

    // Variations como candidatos independientes
    for (const variation of target.variations ?? []) {
      const isExcluded = excludedPetIds.includes(variation.id);
      if (isExcluded) {continue;}
      const variationTarget = petMap.get(variation.id);
      if (!variationTarget) {continue;}


      const variationConds = [
        ...baseConds,
        ...(variation.conds ?? []),
      ];

      if (meetsConditions(variationConds, state, achievementsMap)) {
        candidates.push({
          pet: variationTarget,
          seen: isSeen(variationTarget.id, state),
          chance: reachableDiscoveryScore(variationTarget, state, petMap, achievementsMap, excludedPetIds),
        });
      }
    }
  }

  return normalizeChance(candidates).sort((a, b) => b.chance - a.chance);
}