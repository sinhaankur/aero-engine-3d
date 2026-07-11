# Roadmap — from archive to an open aviation knowledge base

This project started as an interactive archive of Airbus families (3D models,
blueprints, engines, systems, safety). The **north star** is bigger: open-source
the knowledge and tooling required to understand — and eventually help build —
aircraft and their engines, and use that structured knowledge to power an
**aviation-domain LLM**.

Everything below is framed against the three forces that decide whether any real
aircraft program survives:

> **Funds vs. Market vs. Safety** — you can optimise any two, but the third always
> pushes back. Cheaper and faster fights safety; safer and cheaper fights the
> market; safer and faster fights the budget. Good aviation engineering is the art
> of holding all three in tension.

---

## Where we are today (shipped)

- **6 Airbus families, 18 variants** — researched data, generated 3D models,
  per-variant blueprints, timelines, attributed safety records.
- **A parametric model generator** (`blender/generate_airframe.py`) that builds a
  consistent airframe from a spec dict — the seed of "buildable" tooling.
- **Interactive engine explorer** — exploded turbofan + working-cycle walkthrough.
- **Systems explainers** — electrical, hydraulics, fly-by-wire, fuel, bleed, gear.
- A **marketing site** and public deploy on GitHub Pages.

## Guiding principles

1. **Open and attributed.** Every figure cites a public source. Never commit
   scraped/proprietary CAD or copyrighted models — generate from public specs.
2. **Buildable, not just browsable.** Prefer features that show *how* something is
   made or *why* a design choice was made, not just *what* it is.
3. **Consistency beats fidelity.** A coherent family reads as trustworthy; a
   grab-bag of mismatched detail reads as broken.
4. **Data first.** Content lives as diffable data/JS, not in a database, so the
   whole archive is reviewable in git.

---

## Phase 1 — Deepen the "how it's designed" layer  *(near term)*

Turn each system/engine page from *description* into *design reasoning*.

- Add a **"design tradeoffs"** block to each system: what it costs (funds), what it
  enables (market), how it fails safe (safety).
- **Interactive test models** (the user's stated next step): small, focused,
  manipulable sub-models — e.g. a slider that shows how bypass ratio trades thrust
  vs. fuel burn, or how wing sweep trades cruise speed vs. low-speed handling.
- Extend the generator with a **parts/assembly breakdown** so an airframe can be
  shown exploded, like the engine already is.

## Phase 2 — Structured open knowledge base  *(the LLM substrate)*

Make the archive machine-readable so it can ground a model.

- Define a **schema for engineering facts** (component → function → constraints →
  tradeoffs → sources), extending the current `schema.js`.
- Publish the whole dataset as **open JSON/JSONL** with per-fact provenance.
- Add a **glossary + first-principles explainers** (lift, thrust, structures,
  pressurisation, certification) as reusable knowledge units.

## Phase 3 — Aviation LLM  *(the ambition)*

Use the structured base to build/serve a domain assistant.

- **Retrieval-first**: ground answers in the open dataset with citations, so the
  model never fabricates a spec — it quotes an attributed one.
- **Evaluation harness**: a question set with known-correct, sourced answers to
  measure accuracy (safety-critical domain → correctness must be measurable).
- **Scope honestly**: an explainer/tutor and design-reasoning aid — *not* a source
  of certified engineering data. State that limit prominently.

## Phase 4 — Toward "how to build one"  *(long horizon)*

The open-source "build a plane / build an engine" goal.

- Document the **program lifecycle**: concept → configuration → detailed design →
  certification → production → in-service, each with its funds/market/safety
  pressures.
- Curate **open references** (public standards, textbooks, NASA/FAA/EASA material)
  rather than restating proprietary data.
- Keep a hard line between **educational modelling** (what this repo does well) and
  **engineering-grade CAD/analysis** (a different, heavier track requiring real
  tools and, for anything airworthy, certification).

---

## Honest constraints

- **This is a learning tool, not an engineering authority.** The generated models
  are accurate-looking, not CAD; the specs are nominal public figures. Any move
  toward real buildability needs real engineering tooling and review.
- **Safety domain ⇒ correctness is non-negotiable.** An LLM here must be
  retrieval-grounded and evaluated, or it's worse than nothing.
- **Scope is effectively unbounded** ("there is no limit to it") — so the risk is
  spreading thin. Each phase should ship something usable on its own.

---

*This roadmap is a living document. It captures direction, not commitment; pick a
phase and we scope it into concrete tasks.*
