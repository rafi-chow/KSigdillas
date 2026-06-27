import { scoreUpdateLimits } from "@/lib/scoringConfig";
import {
  scoreCategories,
  type ScoreCategory,
  type ScoreUpdate,
  type TeamInput,
} from "@/types/leaderboard";

type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function validateTeamInput(value: unknown): ValidationResult<TeamInput> {
  if (!isRecord(value)) {
    return { success: false, error: "Invalid team details." };
  }

  const name = typeof value.name === "string" ? value.name.trim() : "";
  const displayName =
    typeof value.displayName === "string" ? value.displayName.trim() : "";
  const accentColor =
    typeof value.accentColor === "string"
      ? value.accentColor.trim().toUpperCase()
      : "";

  if (name.length < 2 || name.length > 80) {
    return { success: false, error: "Team name must be 2–80 characters." };
  }
  if (displayName.length < 2 || displayName.length > 80) {
    return { success: false, error: "Display name must be 2–80 characters." };
  }
  if (!/^#[0-9A-F]{6}$/.test(accentColor)) {
    return { success: false, error: "Accent color must be a six-digit hex color." };
  }

  return { success: true, data: { name, displayName, accentColor } };
}

export function validateScoreUpdate(
  value: unknown,
): ValidationResult<ScoreUpdate> {
  if (!isRecord(value)) {
    return { success: false, error: "Invalid score update." };
  }

  const teamId = typeof value.teamId === "string" ? value.teamId : "";
  const category = value.category;
  const amount = value.amount;

  if (!teamId || teamId.length > 100) {
    return { success: false, error: "A valid team is required." };
  }
  if (
    typeof category !== "string" ||
    !scoreCategories.includes(category as (typeof scoreCategories)[number])
  ) {
    return { success: false, error: "A valid score category is required." };
  }
  if (
    typeof amount !== "number" ||
    !Number.isSafeInteger(amount) ||
    amount === 0 ||
    amount < scoreUpdateLimits.min ||
    amount > scoreUpdateLimits.max
  ) {
    return {
      success: false,
      error: `Point change must be a non-zero whole number between ${scoreUpdateLimits.min} and ${scoreUpdateLimits.max}.`,
    };
  }

  return {
    success: true,
    data: { teamId, category: category as ScoreCategory, amount },
  };
}
