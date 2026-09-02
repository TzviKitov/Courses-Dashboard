/**
 * Synthetic seed — never use real youth PII.
 * Run against a STAGING project only.
 *
 *   npx tsx scripts/seed-synthetic.ts
 */
console.log(`
Synthetic seed (manual):
1. Use a separate Supabase project (staging).
2. Create instructor via dashboard invite.
3. Insert fake adult-looking rows, e.g.:

  insert into registrations (landing_id, full_name, phone, email, birth_year, marketing_opt_in)
  values ('YOUR_LANDING_ID', 'משתתף בדיקה', '+972501111111', 'seed@example.com', 2000, false);

Do NOT copy production data. Do NOT use real names/phones of minors.
`);
