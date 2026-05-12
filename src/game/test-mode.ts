export type DeterministicScenario = "chest" | "pause-bomb" | "bomb" | "arrow" | "bot" | "boots";

export interface DeterministicTestMode {
  enabled: boolean;
  scenario: DeterministicScenario | null;
}

const deterministicScenarios = new Set<DeterministicScenario>([
  "chest",
  "pause-bomb",
  "bomb",
  "arrow",
  "bot",
  "boots",
]);

const isDeterministicScenario = (value: string | null): value is DeterministicScenario =>
  value !== null && deterministicScenarios.has(value as DeterministicScenario);

export const getDeterministicTestMode = (): DeterministicTestMode => {
  if (typeof window === "undefined") return { enabled: false, scenario: null };

  const params = new URLSearchParams(window.location.search);
  const requested = params.get("deterministic") === "1" || params.get("deterministic") === "true";
  const allowed = import.meta.env.DEV || import.meta.env.MODE === "test";
  if (!requested || !allowed) return { enabled: false, scenario: null };

  const scenario = params.get("scenario");
  return {
    enabled: true,
    scenario: isDeterministicScenario(scenario) ? scenario : null,
  };
};
