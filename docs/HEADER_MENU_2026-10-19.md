# Header and mobile navigation — 2026-10-19

The header keeps search, cart and menu available on narrow phones, with a readable wordmark, distinct cart control and active desktop links. The native mobile dialog becomes a full-height panel with a labelled GET search, the existing five catalogue categories and a separate practical-help section. No new external asset or dependency is added.

The dialog has a visible close button, native Escape dismissal, the existing focus trap and explicit focus restoration. Opening locks background scrolling; closing or following a link restores it. Moving to a desktop breakpoint closes the panel. The middle section scrolls independently while the title/close control and short payment note remain accessible in portrait or short landscape.

Validation: production build, TypeScript and frontend lint pass. Browser checks cover search for a known product, category navigation, Escape, focus wrap/restoration and body overflow restoration. At 320/390/667/768/1280 px the page and menu have no horizontal overflow. The header wordmark and controls have 44 px minimum target height. Published checks and screenshots are recorded in the phase TXT report.

Scope: header component and scoped presentation only. No product, order, stock, account, database or CRM changes. Original footer social links remain. Rollback: revert this commit, no migration needed.
