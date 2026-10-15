// Recharts SVG props need resolved colours, so read the CSS variable's computed value.
export const getCSSVariable = (varName) => {
  if (typeof window !== 'undefined') {
    return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  }
  return '';
};
