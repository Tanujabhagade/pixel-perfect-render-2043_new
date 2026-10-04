# CivicPulse on Replit

CivicPulse is an AI-assisted civic issue reporting and municipal operations prototype for Kopargaon, Shrirampur, and Shirdi. It uses React, TanStack Start, Vite, Leaflet/OpenStreetMap, and localStorage-backed demo state.

## Run locally in Replit

The `Start application` workflow runs:

```sh
npm run dev -- --host 0.0.0.0 --port 5000
```

Open the Replit Preview to use the app. No external services, database, or production authentication are required for the demo. Mock AI is enabled by default; a real provider can be placed behind `/api/ai/analyze` without exposing credentials in the browser.

## Demo roles

- Citizen: `citizen.demo@example.com`
- Municipal officer: `authority.demo@example.com`
- Administrator: `admin.demo@example.com`

The role selector is demo authentication only. Issue state is centralized in the root page and saved under the `civicpulse-demo` localStorage key so a submitted issue is shared by the citizen dashboard, authority queue, issue detail, map, analytics, audit history, and verification flow.

## Main prototype flow

1. Open a demo role from the landing page.
2. As Citizen, create a report with an image, description, browser location or manual/demo map location, AI review, duplicate review, and submission.
3. Switch to Municipal Officer, filter the queue, open the report, assign a department/officer, override severity with a reason, request information, add notes, and submit before/after resolution evidence.
4. Switch back to Citizen and use **Yes, resolved** or **No, still exists** to update the same issue.

## Demo services

- Browser location uses `navigator.geolocation`; when permission is unavailable, the UI explicitly offers manual map selection and the three supported demo locations.
- Maps use Leaflet with OpenStreetMap tiles. No Google Maps key is required.
- AI defaults to a structured mock provider and returns editable category, severity, department, summary, confidence, reasoning, impact, and duplicate suggestions. Set the admin AI mode to server provider when `/api/ai/analyze` is available.
- AI defaults to structured mock analysis. Selecting **Server provider** in admin calls a TanStack server function; provider credentials never enter browser code.
- To enable OpenAI-compatible analysis, configure `MOCK_AI_MODE=false`, `AI_PROVIDER=openai` (or `openai-compatible`), and `AI_API_KEY` as a Replit Secret. Optionally set `AI_BASE_URL` and `AI_MODEL`. The server validates image data, applies a timeout, normalizes responses, and clearly falls back to mock analysis when needed.
- SLA targets are configurable demo values: Critical 24 hours, High 48 hours, Medium 72 hours, and Low 7 days. They are not official government SLAs.
- Status changes, assignments, severity overrides, notes, and resolution submissions are retained in issue audit history.