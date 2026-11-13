# ExamPulse AI — GitHub, Vercel & Google/Firebase Deployment Guide

ExamPulse AI is a full-stack Computer-Based Testing (CBT) & AI Assessment platform built with **React + Vite + Tailwind CSS**, **Express (`server.ts`)**, **Firebase Authentication & Cloud Firestore**, and the **Google Gemini API (`@google/genai`)**.

---

## Project Architecture & Identifiers

| Setting | Value / Details |
| :--- | :--- |
| **Frontend Build** | Vite SPA (`dist/`) |
| **Backend API** | Express (`server.ts`, routed via `/api/index.ts` on Vercel) |
| **Firebase / GCP Project ID** | `amazing-centaur-462112-n5` |
| **Firestore Database ID** | `ai-studio-821afd27-84e2-43ab-b5af-651da3cbc0da` |
| **Firebase Auth Domain** | `amazing-centaur-462112-n5.firebaseapp.com` |
| **Immutable Main Admin** | `rajanprasaila@gmail.com` |

---

## 1. Local Development Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```
2. **Create a `.env` file** (copy from `.env.example` — never commit `.env`):
   ```env
   GEMINI_API_KEY="your_gemini_api_key"
   APP_URL="http://localhost:3000"
   FIREBASE_SERVICE_ACCOUNT_KEY=""
   ```
3. **Run the dev server (Express + Vite middleware on port 3000):**
   ```bash
   npm run dev
   ```
4. **Type-check & production build check:**
   ```bash
   npm run lint
   npm run build
   ```

---

## 2. Push the Project to GitHub

1. **Verify sensitive files are NOT tracked** (`.gitignore` already excludes `.env*`, `node_modules/`, `dist/`, `.vercel/`, `*-firebase-adminsdk-*.json`, and `service-account*.json`).
   - `firebase-applet-config.json` contains **public** Firebase Web App config (not private credentials) and is safe to keep in the repository, provided you apply HTTP referrer restrictions in Google Cloud Console (Step 3 below).
2. **Initialize and push to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit: ExamPulse AI"
   git branch -M main
   git remote add origin https://github.com/<YOUR_USERNAME>/<YOUR_REPO>.git
   git push -u origin main
   ```

---

## 3. Configure Google Cloud Console (`amazing-centaur-462112-n5`)

Open [Google Cloud Console](https://console.cloud.google.com/) and make sure project **`amazing-centaur-462112-n5`** is selected in the top project switcher.

### A. Enable Required APIs
Go to **APIs & Services → Enabled APIs & Services** and verify these are enabled:
- **Identity Toolkit API** (required for Firebase Auth / Google Sign-In)
- **Cloud Firestore API** (required for Firestore database reads/writes)
- **Generative Language API** (if your `GEMINI_API_KEY` is created in this project)

### B. Configure Google Auth Platform / OAuth Consent Screen
Go to **APIs & Services → OAuth consent screen** (or **Google Auth Platform → Branding / Audience**):
1. **User Type:** `External`
2. **Publishing status:**
   - While **In Testing**, *only* Gmail accounts explicitly added to **Test users** can sign in.
   - To allow any candidate/student with a Gmail account to sign in, either add their emails under **Test users** or click **Publish App** (**In production**).
3. **Authorized domains:** Add:
   - `vercel.app` (or your custom domain, e.g., `yourdomain.com`)
   - `amazing-centaur-462112-n5.firebaseapp.com`
4. **Scopes:** Ensure `openid`, `.../auth/userinfo.email`, and `.../auth/userinfo.profile` are included.

### C. Update OAuth 2.0 Client ID Origins & Redirect URIs
Go to **APIs & Services → Credentials → OAuth 2.0 Client IDs** and open the Web client used by Firebase (`468903270383-utg6hcoft631q2tina3g2npb2t37tohn.apps.googleusercontent.com` or your Web Client):
1. **Authorized JavaScript origins** — add:
   - `https://<your-vercel-project>.vercel.app`
   - `https://<your-custom-domain>` *(if using a custom domain)*
   - `https://amazing-centaur-462112-n5.firebaseapp.com`
   - `http://localhost:3000` *(for local testing)*
2. **Authorized redirect URIs** — ensure this Firebase handler URI is present:
   - `https://amazing-centaur-462112-n5.firebaseapp.com/__/auth/handler`

### D. Restrict Your Browser Firebase API Key (Recommended)
Go to **APIs & Services → Credentials → API Keys** and open the Firebase Browser Key (`AIzaSy...` from `firebase-applet-config.json`):
- **Application restrictions → Websites (HTTP referrers):**
  - `https://<your-vercel-project>.vercel.app/*`
  - `https://*.vercel.app/*` *(optional, if you test Vercel preview URLs)*
  - `http://localhost:3000/*`
- **API restrictions:** Allow **Identity Toolkit API**, **Token Service API**, and **Cloud Firestore API**.

---

## 4. Configure Firebase Console (`amazing-centaur-462112-n5`)

Open [Firebase Console](https://console.firebase.google.com/project/amazing-centaur-462112-n5):

### A. Authorize Your Vercel Domain for Google Sign-In
1. Go to **Authentication → Settings → Authorized domains**.
2. Click **Add domain** and add:
   - `<your-vercel-project>.vercel.app`
   - Any custom domain (e.g., `exam.yourdomain.com`)
   - Keep `localhost` for local development.
3. Go to **Authentication → Sign-in method** and confirm **Google** is **Enabled** with `rajanprasaila@gmail.com` (or your support email) configured.

> If users see `auth/unauthorized-domain` after deploying to Vercel, the exact Vercel hostname is missing from **Authentication → Settings → Authorized domains**.

### B. Verify Firestore Security Rules
1. Go to **Firestore Database** and select database **`ai-studio-821afd27-84e2-43ab-b5af-651da3cbc0da`**.
2. Confirm the rules from `firestore.rules` in this repo are published to that database.
   - Before sharing publicly, review and verify `firestore.rules` in the Firebase Console Rules editor.

### C. Generate a Firebase Service Account Key (Recommended for Vercel)
On Vercel, serverless functions do not share a persistent local disk, so setting `FIREBASE_SERVICE_ACCOUNT_KEY` ensures server-side grading (`/api/exam/grade`) and answer-key unlocking (`/api/exam/unlock-solutions`) read/write directly to Firestore (`tests/{testId}/answerKeys/{questionId}`) across all serverless instances.

1. In Firebase Console, go to **Project Settings → Service accounts**.
2. Click **Generate new private key** → download the JSON file *(do NOT commit this file to GitHub)*.
3. Copy the entire JSON content (or minify it into one line) to paste into Vercel's `FIREBASE_SERVICE_ACCOUNT_KEY` environment variable in Step 5.

---

## 5. Deploy from GitHub to Vercel

This repository includes `vercel.json` and `api/index.ts`, which build the Vite frontend (`dist/`) and automatically route `/api/*` and `/uploads/*` requests to Express via Vercel Serverless Functions.

1. Log in to [Vercel](https://vercel.com/) and click **Add New… → Project**.
2. **Import Git Repository:** Select your GitHub repository.
3. **Configure Project Settings:**
   - **Framework Preset:** `Vite`
   - **Root Directory:** `./`
   - **Build Command:** `npm run build` *(pre-configured in `vercel.json`)*
   - **Output Directory:** `dist` *(pre-configured in `vercel.json`)*
   - **Install Command:** `npm install`
   - **Node.js Version:** `20.x` or `22.x` *(Project Settings → General)*
4. **Add Environment Variables** (**Settings → Environment Variables** for **Production** and **Preview**):

   | Variable | Required | Value |
   | :--- | :--- | :--- |
   | `GEMINI_API_KEY` | **Yes** | Your Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey) |
   | `FIREBASE_SERVICE_ACCOUNT_KEY` | **Recommended** | Raw JSON string (or Base64-encoded JSON) of your Firebase Service Account key |
   | `APP_URL` | Optional | Your deployed URL, e.g. `https://your-project.vercel.app` |

5. Click **Deploy**.
6. Once deployed, copy your live `https://your-project.vercel.app` domain and make sure it is added to:
   - **Firebase Console → Authentication → Settings → Authorized domains**
   - **Google Cloud Console → Credentials → OAuth 2.0 Client → Authorized JavaScript origins**

---

## 6. Post-Deploy Verification & Vercel Notes

1. **Health check:** Visit `https://<your-app>.vercel.app/api/health` — verify `{ "ok": true, "serverAdminFirestore": true }`.
   - If `"serverAdminFirestore": false`, double-check `FIREBASE_SERVICE_ACCOUNT_KEY` in Vercel Environment Variables and redeploy.
2. **Multi-Gmail Sign-In:** Click **Sign in / Choose Gmail Account** on desktop and mobile — confirm the Google account picker opens and signs in cleanly.
3. **Uploaded Diagrams on Serverless:**
   - On Vercel, `/api/upload-image` stores newly uploaded files in `/tmp/exampulse/uploads`, which is **ephemeral** across serverless cold starts and instances.
   - For permanent diagrams across deployments on Vercel, either paste persistent `https://` image URLs (Firebase Storage, Cloudinary, Cloudflare R2, etc.) into the question/option image URL field or commit static diagram files under `public/`.
4. **Gemini Rate Limits:** If Gemini returns HTTP `429` (`RESOURCE_EXHAUSTED`) on the Free Tier (5 requests/min), wait ~40 seconds or upgrade the billing tier of your `GEMINI_API_KEY` project.

---

## Troubleshooting

| Symptom | Fix |
| :--- | :--- |
| `auth/unauthorized-domain` on login | Add your exact Vercel/custom domain in **Firebase Console → Auth → Settings → Authorized domains**. |
| `Access blocked: app has not completed Google verification` | In **GCP Console → OAuth consent screen**, add user emails to **Test users** or publish to **In production**. |
| `404` on `/api/*` endpoints | Confirm `vercel.json` and `api/index.ts` are pushed to GitHub and redeploy. |
| `"serverAdminFirestore": false` on `/api/health` | Set `FIREBASE_SERVICE_ACCOUNT_KEY` (valid JSON or Base64 JSON) in Vercel Environment Variables and redeploy. |
| `auth/popup-blocked` on mobile Safari/Chrome | Allow popups for your Vercel domain in browser settings, or open directly in Chrome/Safari instead of an in-app webview. |
