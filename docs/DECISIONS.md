# Decisions

| # | Decision | Why |
|---|---|---|
| 1 | Reset and reseed the Neon DB with a fresh baseline migration | User choice; the old schema had no migration history and a unique key that made attempt history impossible |
| 2 | Drop email verification and email-based password reset | User choice; no mailer existed (links were only logged). Password change requires the current password |
| 3 | Two themes (light/dark/system) instead of five | One coherent, contrast-verified system beats five loosely maintained palettes |
| 4 | Self-signup can choose Organizer, no approval queue | Keeps onboarding frictionless; Admin can change roles |
| 5 | Refresh-token rotation in httpOnly cookie, short-lived access token in memory | Removes localStorage token exposure; allows revocation |
| 6 | Pin stable Vite instead of the 8 beta override | Production builds should not depend on a beta |
| 7 | The `frontend-design` skill is not installed in this environment; design guidance comes from `artifact-design`/`dataviz` skills and DESIGN.md | Noted for transparency |
