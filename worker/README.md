# שרת המאמן (Cloudflare Worker)

הקוד בקובץ `worker.js`. **אין בו שום מפתח.** כל הסודות וההגדרות מוגדרים בלוח הבקרה של Cloudflare.

## מה השרת עושה
1. מקבל בקשות רק מכתובות האתר שמופיעות ב-`ALLOWED_ORIGINS`.
2. בודק שהמשתמש מחובר (Firebase ID token) ושהוא ברשימת `ALLOWED_UIDS`.
3. אוכף מגבלה יומית לכל משתמש ולכל האתר. ב-KV נשמרים רק מספרים, לא שאלות ולא תשובות.
4. בודק את גודל הבקשה והתמונה (JPEG, PNG או WebP בלבד).
5. שולח ל-Gemini את השאלה, העסקאות הרלוונטיות והתמונה. לא את המזהה, השם או המייל.

## הגדרות ב-Cloudflare (Settings > Variables and Secrets)
| שם | סוג | ערך |
|---|---|---|
| `GEMINI_API_KEY` | Secret | המפתח מ-Google AI Studio |
| `GEMINI_MODEL` | Variable | שם המודל מ-AI Studio |
| `FIREBASE_PROJECT` | Variable | `trading-journal-58021` |
| `ALLOWED_UIDS` | Variable | ה-User UID שלך מ-Firebase (ריק = אף אחד) |
| `ALLOWED_ORIGINS` | Variable | `https://dikmanguy1-svg.github.io` |
| `MAX_MSG` / `MAX_IMG` / `MAX_GLOBAL` | Variable | `20` / `5` / `200` |
| `USAGE` | KV binding | מרחב KV בשם `coach-usage` |

## מעבר ל-Claude לפני שיווק
מחליפים רק את הפונקציה `callModel()` ואת הסוד (`ANTHROPIC_API_KEY`).
