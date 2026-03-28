<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/94cc2cfb-acf8-418b-bb34-7cbdcdf42feb

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Copy values from [.env.example](.env.example) into `.env.local`
4. Import SQL schema in MySQL (WAMP):
   `server/sql/schema.sql`
5. Run frontend:
   `npm run dev:client`
6. Run backend API (new TS server):
   `npm run dev:server`

## Security notes

- Authentication uses SQL + JWT (no Firebase auth).
- Passwords are protected with double layer hashing (SHA-256 + pepper, then bcrypt).
- All SQL queries are parameterized (`?` placeholders) to prevent SQL injection.
- API routes are role-protected (`seller` / `admin`) and require bearer token.

## Project structure

- Frontend routes are defined in [src/App.tsx](src/App.tsx) and [src/routes/AppRoutes.tsx](src/routes/AppRoutes.tsx)
- Main POS UI is in [src/pages/TerminalSystemPage.tsx](src/pages/TerminalSystemPage.tsx)
- Backend API lives in [server/src/index.ts](server/src/index.ts)

# DASHBOARD-TERMINAL
