
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Manually parse .env.local
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

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkConnection() {
    console.log('Connecting to Supabase:', supabaseUrl);
    try {
        const { count, error } = await supabase.from('products').select('*', { count: 'exact', head: true });
        
        if (error) {
            console.error('Database Connection Error:', error.message);
        } else {
            console.log('Connection Successful!');
            console.log('Total Products in Database:', count);
        }
    } catch (e) {
        console.error('Unexpected error:', e.message);
    }
}

checkConnection();
