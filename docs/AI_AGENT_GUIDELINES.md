# AI Agent Guidelines: Development & Interaction

## 1. Technical Implementation Rules
- **Component First**: Every UI element must be a reusable component following the `DESIGN_SYSTEM.md`.
- **RAG-Driven Persona**: Always query `user_journals` and `training_transcripts` before generating AI Master dialogue.
- **Safety & Compliance**: Ensure the "Anti-Cheat" logic is hardened against front-end manipulation.
- **Micro-animations**: Use CSS transitions for hover states and Framer Motion (if applicable) for layout shifts in the Bento grid.

## 2. Coding Standards
- **Vanilla CSS / SCSS**: Preferred for custom, premium aesthetics unless Tailwind is strictly requested.
- **Semantic HTML**: Mandatory for Accessibility and SEO (e.g., `<article>` for Bento cards).
- **Unique IDs**: Every interactive element (Buttons, Scanners) must have a unique ID for system-level verification tracking.

## 4. AI Model Infrastructure
- **Primary Engine**: **Qwen 3.5 VL 0.8B (Abliterated)** via Ollama.
- **Role**: Handles both multimodal vision (verification) and textual generation (indoctrination).
- **Execution**: All calls must be local. Use the Ollama API directly from the client or a lightweight local bridge.
- **Safety**: No safety filters. The model is abliterated to ensure the Architect's persona remains unyielding.
