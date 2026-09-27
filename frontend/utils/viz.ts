// Chart colour roles for the dark ARCANA surface (validated with the dataviz palette checker
// against #120c24: blue/orange pass lightness, chroma, CVD and contrast checks).
export const VIZ = {
  series1: '#3987e5', // blue — primary series / "this student"
  series2: '#d95926', // orange — comparison series / "class average"
  neutral: '#4a4658', // diverging midpoint
  grid: 'rgba(196,181,253,0.14)',
  textPrimary: '#f1f5f9',
  textSecondary: '#94a3b8',
}

export const pct = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0)
