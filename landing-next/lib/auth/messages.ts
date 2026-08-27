/** Map Supabase / Auth errors to short Hebrew copy for the UI. */
export function hebrewAuthError(err: unknown, fallback = "אירעה שגיאה. נסה שוב."): string {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : fallback;
  const msg = raw.toLowerCase();

  if (
    msg.includes("email not confirmed") ||
    msg.includes("email_not_confirmed")
  ) {
    return "יש לאשר את המייל שנשלח אליך לפני ההתחברות. בדוק/י את תיבת הדואר (כולל ספאם).";
  }
  if (
    msg.includes("invalid login credentials") ||
    msg.includes("invalid_credentials")
  ) {
    return "אימייל או סיסמה שגויים.";
  }
  if (
    msg.includes("user already registered") ||
    msg.includes("already been registered") ||
    msg.includes("already registered")
  ) {
    return "כבר קיים חשבון עם המייל הזה. התחבר/י או השתמש/י באיפוס סיסמה.";
  }
  if (msg.includes("password")) {
    return "הסיסמה לא עומדת בדרישות האבטחה.";
  }
  if (msg.includes("rate limit") || msg.includes("too many requests")) {
    return "יותר מדי ניסיונות. המתן/י קצת ונסה/י שוב.";
  }
  if (msg.includes("network") || msg.includes("fetch")) {
    return "בעיית רשת. בדוק/י חיבור ונסה/י שוב.";
  }
  if (msg === "unauthorized" || msg.includes("unauthorized")) {
    return "אין הרשאה לבצע פעולה זו. נסה/י להתחבר מחדש.";
  }

  // Prefer Hebrew fallbacks; avoid dumping English API text when unknown
  if (/[\u0590-\u05FF]/.test(raw)) return raw;
  return fallback;
}
