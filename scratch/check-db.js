
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

let envContent = '';
try {
    envContent = fs.readFileSync('.env.local', 'utf8');
} catch (e) {
    console.error('Failed to read .env.local:', e.message);
    process.exit(1);
}

const env = {};
envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    const value = valueParts.join('=');
    if (key && value) env[key.trim()] = value.trim();
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
    try {
        const { data, error } = await supabase.from('products').select('*').limit(1).single();
        if (error) {
            console.error('Error:', error.message);
        } else {
            console.log('Columns in products table:', Object.keys(data));
        }
    } catch (e) {
        console.error('Unexpected error:', e.message);
    }
}

checkColumns();
