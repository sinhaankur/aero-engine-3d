import { resolveTheme } from 'anatomy-figures/themes'

/**
 * Resolve an anatomy-figures theme to `{ base, tokens }`, with a contrast lift
 * for the DARK theme.
 *
 * Why: the stock dark palette sets every solid face (`--anatomy-shade-0..3`,
 * `--anatomy-face`, `--anatomy-top`) to ~#0f–#1c — barely above the #131313 card.
 * On a filled figure (the jet's fan especially) the faces then read as a black
 * void; only the outlines show. We lift those face tokens so parts sit clearly
 * above the ground while staying dark/monochrome. The other themes
 * (blueprint/light/paper/sepia) already read well and pass through untouched.
 */
const DARK_LIFT = {
  '--anatomy-card': '#15171a',
  '--anatomy-paper': '#15171a',
  '--anatomy-face': '#30343b',
  '--anatomy-top': '#3a3f47',
  '--anatomy-shade-0': '#22252a',
  '--anatomy-shade-1': '#292d33',
  '--anatomy-shade-2': '#30343b',
  '--anatomy-shade-3': '#373c44',
  '--anatomy-lit-top': '#4a5058',
  '--anatomy-lit-shade': '#2c3038',
  '--anatomy-mid': '#8a919b',
  '--anatomy-lo': '#555b63',
  '--anatomy-faint': '#3a3f47',
}

export function figureTheme(name = 'blueprint') {
  let resolved
  try {
    resolved = resolveTheme(name)
  } catch {
    resolved = { base: 'dark', tokens: {} }
  }
  if (name === 'dark') {
    return { base: 'dark', tokens: { ...resolved.tokens, ...DARK_LIFT } }
  }
  return resolved
}
