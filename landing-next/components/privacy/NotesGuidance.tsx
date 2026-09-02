export function NotesGuidance({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2 ${className}`}>
      תארו התנהגות בקורס בלבד (למשל: נמנע מהשתתפות, נראה מצוברח אחרי השיעור).
      אין לתעד אבחנות, תרופות, שמות מטפלים או פרטי משפחה.
    </p>
  );
}
