# ExamPulse AI Leak-Proof Security Specification

## 1. Core Security Invariants
1. **Immutable Main Admin (`rajanprasaila@gmail.com`)**: Verified `rajanprasaila@gmail.com` is permanently hardcoded in both `firestore.rules` (`isMainAdmin()`) and `server.ts` (`MAIN_ADMIN_EMAIL`). Nobody—not even secondary admins—can replace, remove, or demote the main admin via frontend or backend APIs.
2. **Zero DevTools Answer Leak (Split Collection + Server Stripping)**:
   - `/tests/{testId}/questions/{questionId}` stores **only** question stems, diagram URLs, options, and marks.
   - `/tests/{testId}/answerKeys/{questionId}` stores `correctOptionId`, `shortExplanation`, and `stepByStepSolution` with `allow read, write: if isAdmin();` in `firestore.rules`.
   - During live exams, backend route `/api/exam/questions/:testId` strips answer keys and explanations before sending payloads to the browser.
3. **Server-Verified Grading, Timers & Monotonic Strikes**:
   - Attempts are persisted via server routes (`/api/exam/start-or-resume`, `/api/exam/save-progress`, `/api/exam/strike`, `/api/exam/submit`).
   - `firestore.rules` enforces monotonic strike growth (`incoming().strikeCount >= existing().strikeCount` and `incoming().strikes.size() >= existing().strikes.size()`) and terminal state locking once `status != 'in_progress'`.
   - Answer keys and step-by-step solutions are unlocked by `/api/exam/results/:attemptId` strictly after `status` reaches `submitted` or `auto_submitted_strike`.
4. **PII Isolation**: `/users/{userId}` is strictly isolated to `isOwner(userId) || isAdmin()`.
5. **Server-Only Secrets**: `GEMINI_API_KEY` and optional `FIREBASE_SERVICE_ACCOUNT_KEY` exist solely on the Express server (`process.env`), never in client bundles.

## 2. Adversarial Payloads Blocked
- **DevTools F12 Question Inspection**: Querying `/tests/{testId}/questions` returns zero `correctOptionId` or solution fields; querying `/tests/{testId}/answerKeys` as a student returns `PERMISSION_DENIED`.
- **Main Admin Replacement**: Attempting to overwrite or delete `rajanprasaila@gmail.com` or elevate oneself via `/admins/{uid}` returns `PERMISSION_DENIED` in Firestore and HTTP `403` on Express.
- **Strike Reset / Erasure**: Updating an attempt with `strikeCount < existing().strikeCount` returns `PERMISSION_DENIED`.
- **Post-Submission Score Forgery**: Updating an attempt whose `status != 'in_progress'` returns `PERMISSION_DENIED`.
