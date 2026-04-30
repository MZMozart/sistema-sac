// Onboarding step state persistence utility
export function saveOnboardingState(state: any) {
  localStorage.setItem('onboardingState', JSON.stringify(state));
}

export function loadOnboardingState() {
  const raw = localStorage.getItem('onboardingState');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearOnboardingState() {
  localStorage.removeItem('onboardingState');
}
