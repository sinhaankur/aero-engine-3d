/**
 * Shared motion vocabulary. One place defines the site's spring feel and the
 * common variants, so every page animates consistently and we don't scatter
 * magic numbers. Built on framer-motion's lightweight `m` component (the app is
 * wrapped in <LazyMotion features={domAnimation}> in App.jsx), so importing from
 * here never drags in the full motion feature bundle.
 *
 * Everything degrades under prefers-reduced-motion: the Reveal/Stagger helpers
 * fall back to a plain fade with no transform, and callers can read `useReduced`
 * to skip transforms entirely.
 */
import { m, useReducedMotion } from 'framer-motion'

// Resolve the `as` prop to a motion component. A string ('div', 'section', 'ul')
// maps to the built-in m.<tag>; a component (e.g. a motion-wrapped react-router
// Link created with m(Link)) is used directly. Falls back to m.div.
function resolve(as) {
  if (!as) return m.div
  if (typeof as === 'string') return m[as] || m.div
  return as
}

// the site's standard easing — matches the cubic-bezier used across the CSS
export const EASE = [0.2, 0.7, 0.3, 1]

// a soft, slightly springy transition for entrances and layout shifts
export const spring = { type: 'spring', stiffness: 260, damping: 30, mass: 0.9 }

// container that staggers its children in; pair with `item`
export const container = (stagger = 0.06, delay = 0) => ({
  hidden: {},
  show: { transition: { staggerChildren: stagger, delayChildren: delay } },
})

export const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
}

export const itemReduced = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.3 } },
}

/**
 * Reveal a block as it scrolls into view (once). A drop-in wrapper that replaces
 * the IntersectionObserver + .will-reveal CSS dance for new code. `as` lets it
 * render any element; extra props (className, style, onClick…) pass through.
 */
export function Reveal({ as = 'div', children, delay = 0, y = 18, once = true, ...rest }) {
  const reduce = useReducedMotion()
  const Comp = resolve(as)
  return (
    <Comp
      initial={reduce ? { opacity: 0 } : { opacity: 0, y }}
      whileInView={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
      viewport={{ once, amount: 0.15 }}
      transition={{ duration: reduce ? 0.3 : 0.55, ease: EASE, delay }}
      {...rest}
    >
      {children}
    </Comp>
  )
}

/**
 * Stagger a set of children in on scroll-into-view. Wrap items in <StaggerItem>.
 */
export function Stagger({ as = 'div', children, stagger = 0.06, delay = 0, once = true, ...rest }) {
  const Comp = resolve(as)
  return (
    <Comp
      variants={container(stagger, delay)}
      initial="hidden"
      whileInView="show"
      viewport={{ once, amount: 0.1 }}
      {...rest}
    >
      {children}
    </Comp>
  )
}

export function StaggerItem({ as = 'div', children, ...rest }) {
  const reduce = useReducedMotion()
  const Comp = resolve(as)
  return (
    <Comp variants={reduce ? itemReduced : item} {...rest}>
      {children}
    </Comp>
  )
}
