/* =====================================================
   Supabase Client Configuration
   ===================================================== */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ SUPABASE_URL dan SUPABASE_SERVICE_KEY harus diisi di .env');
    process.exit(1);
}

// Use service_role key so we bypass RLS
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

module.exports = supabase;
