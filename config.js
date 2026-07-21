// Supabase Configuration
const SUPABASE_URL = 'https://avugppzsvfibjjshuqsy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2dWdwcHpzdmZpYmpqc2h1cXN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MDMzNDIsImV4cCI6MjA5NzM3OTM0Mn0.23371_SJWvtNB7rhnoTt_2_GJUdJCVAwWS3V8cpMAT0';

// Initialize the Supabase client
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
