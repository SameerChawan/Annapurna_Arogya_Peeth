const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('WARNING: SUPABASE_URL or SUPABASE_KEY not set. Supabase features will not work.');
}

const supabase = createClient(supabaseUrl || '', supabaseKey || '');

module.exports = supabase;
