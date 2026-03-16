# RFC 0020: High-Fidelity Design System (Exaggerated Minimalism)

## 1. Context & Motivation
To reach a "Good Taste" standard, the Video Manager needs a cohesive, premium visual identity. The current "Solarized Dark" theme is functional but lacks the modern, cinematic feel required for a high-fidelity media management tool. This RFC formalizes the move to an **Exaggerated Minimalism** aesthetic.

## 2. Technical Specification

### 2.1 Color Palette (Cinema Dark)

| Role | Hex | CSS Variable |
|------|-----|--------------|
| **Primary** | `#0F0F23` | `--color-primary` |
| **Secondary** | `#1E1B4B` | `--color-secondary` |
| **CTA/Accent** | `#E11D48` | `--color-cta` |
| **Background** | `#000000` | `--color-background` |
| **Text** | `#F8FAFC` | `--color-text` |

**Directive**: Use a consistent dark background with "Play Red" as the primary action color.

### 2.2 Typography (Swiss Functional)
- **Selection**: [Inter](https://fonts.google.com/specimen/Inter) for both Headings and Body.
- **Mood**: Clean, swiss, functional, neutral, professional.
- **Import**:
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
```

### 2.3 Spacing & Elevation

| Token | Value | usage |
|-------|-------|-------|
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.1)` | Cards, buttons |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Active state / Modals |

## 3. Implementation Rules (Good Taste Standard)

### 3.1 Component Constraints
- **Absolute No-Emojis**: All icons must be SVG (Lucide or Heroicons).
- **Smooth State Transitions**: All interactive elements MUST have a `150-300ms` transition.
- **Stable Hovers**: Avoid scale transforms that shift layout. Use opacity or color shifts.
- **Interactivity**: All clickable cards must have `cursor-pointer`.

### 3.2 Performance & Scale
- **Virtualization Required**: Use `@tanstack/react-virtual` for all lists exceeding 50 items (Sidecar and Gallery).
- **A11y**: Ensure 4.5:1 minimum contrast and visible focus states.

## 4. Operational Policies
- **RFC Supremacy**: This document is the source of truth for UI implementation.
- **Hierarchy**: Page-specific deviations should be proposed as updates to this RFC or separate sub-RFCs.

## 5. Implementation Plan
1. Update `src/styles.css` with the new Cinema Dark tokens.
2. Integrate Inter font in `src/main.tsx`.
3. Refactor `VideoGallery.tsx` and `LibrarySidebar.tsx` to use the new tokens and virtualization.
