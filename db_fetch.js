import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();
// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function getTables() {
    const { data, error } = await supabase.rpc('get_table_names');

    if (error) {
        console.error('Error fetching tables:', error);
        return;
    }

    console.log('Tables:', data);
}

getTables();
