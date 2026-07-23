/**
 * Light math typography for the design-layer equations. Turns the plain-text
 * formula strings in the components / engine-parts data into properly set
 * formulas — real superscripts, subscripts and tidy spacing — WITHOUT a heavy
 * LaTeX dependency, and WITHOUT needing the source strings rewritten.
 *
 * It recognises the notation the data already uses:
 *   • unicode superscripts  V² Vsink²  → styled <sup>
 *   • caret superscripts    x^2  (…)^((γ−1)/γ)  → <sup>
 *   • inline subscripts      σθ  Fc  Utip  P3  ṁfuel  Tgas  → <sub>
 *     (a variable letter followed by a known subscript token or digits)
 */

// subscript tokens that trail a variable in the source data
const SUB = 'exit|inlet|fuel|gas|metal|sink|tip|flame|air|turbine|fan|blades|root|jet|loss|max|θ|c|x|f|H|V|1|2|3'
// a variable "head" that can carry a subscript
const HEAD = 'σ|τ|ρ|ṁ|V|P|T|F|N|G|H|U|S|c|C|Q|W'
const SUPMAP = { '²': '2', '³': '3', '⁴': '4', '¹': '1', 'ⁿ': 'n' }

// find a subscript inside a plain string: HEAD immediately followed by a SUB token
function renderInline(str, k) {
  const re = new RegExp(`(${HEAD})(${SUB})(?=$|[^A-Za-z0-9])`)
  const m = str.match(re)
  if (!m) return str
  const i = m.index
  return (
    <span key={k}>
      {str.slice(0, i)}{m[1]}<sub>{m[2]}</sub>{renderInline(str.slice(i + m[0].length), k + 'r')}
    </span>
  )
}

// render one whitespace-delimited token into base + sub/sup spans
function renderToken(tok, k) {
  // caret superscript: base^sup or base^(group)
  const caret = tok.match(/^(.*?)\^\(?([^()\s]+)\)?(.*)$/)
  if (caret) {
    return (
      <span key={k}>
        {renderInline(caret[1], k + 'a')}<sup>{caret[2]}</sup>{renderToken(caret[3], k + 'b')}
      </span>
    )
  }
  // trailing unicode superscript on the token (V², Vsink²)
  const sup = tok.match(/^(.+?)([²³⁴¹ⁿ])(\W*)$/)
  if (sup) {
    return (
      <span key={k}>
        {renderInline(sup[1], k + 's')}<sup>{SUPMAP[sup[2]] || sup[2]}</sup>{sup[3]}
      </span>
    )
  }
  return <span key={k}>{renderInline(tok, k + 'i')}</span>
}

export default function Formula({ children, className = '' }) {
  const text = String(children ?? '')
  const parts = text.split(/(\s+)/)
  return (
    <span className={`formula ${className}`}>
      {parts.map((p, i) => (/^\s+$/.test(p) ? p : renderToken(p, `t${i}`)))}
    </span>
  )
}
