---
applyTo: "admin-ui/**,browse-ui/**,ui/**"
---

# Frontend Instructions

- Admin UI should be operational and information-dense. Prioritize repository state, permissions, storage health, migration progress, and audit visibility.
- Browse UI should be fast, clear, and predictable for artifact discovery and download workflows.
- Avoid decorative marketing layouts in operational screens.
- **MICL Component Library Integration**: 
  - All input fields, selectors, buttons, and form components are built upon the **MICL component library** located within `ui/**`.
  - **Strict Constraint**: Never modify the internal DOM structure, core logic, or internal styling of MICL components. All UI overhauls, layout alignments, spacing, and styling adjustments must be strictly limited to outer wrappers, containers, grid/flex layouts, and theme-driven surface color hierarchies.
  - Ensure all MICL component focus/blur transitions, animations, and micro-interactions remain fully functional without interference.
- Preserve existing static-resource structure served by Spring Boot.
- If static assets are changed, run resource processing or a server compile so `target/classes` reflects the change before live verification.
- Keep text concise and domain-specific. Do not add visible instructions for obvious UI controls.