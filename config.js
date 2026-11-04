/* Site config. Fill SUPABASE_URL / SUPABASE_ANON_KEY for the NEW Powerwave Supabase project before going live.
   The anon key is a public client key (safe in the browser); NEVER put the service_role key here.
   LOCAL_DEV=true lets the app read ./data/site_data.json with no login - only for local testing on the box. */
window.PW_CONFIG = {
  SUPABASE_URL: 'https://lpftmsvpmqnuoubqubkg.supabase.co',          // e.g. https://<project-ref>.supabase.co
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwZnRtc3ZwbXFudW91YnF1YmtnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM4MjYwMDYsImV4cCI6MjEwOTQwMjAwNn0.a7Cu10Vbtr5qeYM3DDWw8DOL2b6ies_TOsr3nz8Nphg',     // anon public key
  LOCAL_DEV: false           // set false for any hosted build
};
