# Design System: LockedIn Minimalist (Pillbox & Bento)

## 1. Visual Philosophy
The design shifts from "Brutalist Accountability" (sharp, industrial, harsh) to "Minimalist Authority" (clean, soft, structured). The goal is to make the interface feel like a premium, high-end "Discipline Instrument" rather than a terminal.

## 2. Layout Patterns
### Bento Grid Dashboard
- **Grid Structure**: 12-column grid system.
- **Card Spans**: 
    - Large (Main Stats/Mandate): `span 6-8`
    - Medium (Vision Verification): `span 3-4`
    - Small (Quick Actions/Status): `span 2`
- **Gap**: `1.5rem` to `2rem` for maximum breathing room.

### Pillbox Cards
- **Border Radius**: `2.5rem` (Extremely rounded).
- **Padding**: `2rem` internal padding.
- **Background**: Glassmorphism or solid off-white/dark-grey.
    - Light Mode: `rgba(255, 255, 255, 0.8)` with `backdrop-filter: blur(10px)`.
    - Dark Mode: `rgba(18, 18, 18, 0.8)` with `backdrop-filter: blur(10px)`.
- **Shadows**: Soft, multi-layered shadows (e.g., `box-shadow: 0 10px 30px rgba(0,0,0,0.05)`).

## 3. Typography
- **Primary Font**: **Outfit** (Sans-serif, geometric, premium).
- **Secondary Font**: **Inter** (For high-readability body text).
- **Monospaced (Accent)**: **JetBrains Mono** - ONLY for logs or code-like data (Integrity Factor).

## 4. Color Palette (Discipline Neutrals)
- **Primary Base**: `#F9F9FB` (Light) / `#0A0A0B` (Dark).
- **Accent (The Authority)**: `#6366F1` (Indigo) or `#10B981` (Emerald) for Compliance.
- **Warning (The Breach)**: `#F43F5E` (Rose) - used sparingly for penalties.
- **Neutral Accents**: `#E2E8F0` / `#1E293B`.

## 5. Components
- **Buttons**: Full-radius pill shapes, generous horizontal padding, subtle scale-up on hover.
- **Inputs**: Minimalist borders (bottom-only or faint outline), focused with a soft outer glow.
- **Progress Bars**: Thick, rounded bars with a "liquid" fill animation.
