// Chart colour roles. Charts are shown on the teacher pages, which use the formal light theme
// (white cards): blue vs. orange stay distinguishable for colour-blind readers and both keep
// ≥ 3:1 contrast against white; text/grid use the staff theme's slate tones.
export const VIZ = {
  series1: '#2563c9', // blue — primary series / "this student"
  series2: '#c4501c', // orange — comparison series / "class average"
  neutral: '#9aa3b2', // diverging midpoint
  grid: 'rgba(36,50,74,0.12)',
  textPrimary: '#142033',
  textSecondary: '#55637a',
  surface: '#ffffff',
  tooltipBg: '#142033',
}

export const pct = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0)
