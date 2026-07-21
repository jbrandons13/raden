<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# START HERE

New session? Read **`ONBOARDING.md`** first (setup, how this repo works, architecture, coding rules), then **`ROADMAP.md`** (what's next). Key rules: migrations are pasted manually by the user (Claude can't run DDL); stock changes must go through RPCs (never raw `update current_stock`); verify with `tsc` + `next build` + service-role E2E scripts before saying done.
