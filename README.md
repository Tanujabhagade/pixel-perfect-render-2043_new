# CivicPulse

From Citizen Reports to Smarter Cities

AI-assisted civic issue reporting and municipal infrastructure management for smarter cities.

## Run locally

Requires Node.js and npm.

```sh
npm install
npm run dev -- --host 0.0.0.0 --port 5000
```

## Demo mode

The prototype runs with seeded civic data and mock AI; no AI credentials, external AI service, or database are required. Set `MOCK_AI_MODE=true` and `VITE_MOCK_AI_MODE=true` to explicitly enable mock mode. Browser location can be declined; manual demo locations remain available.

An optional server-side AI provider can be configured through environment variables. Its credentials are not required for the demonstration.
