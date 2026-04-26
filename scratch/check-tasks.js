
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    const value = valueParts.join('=');
    if (key && value) env[key.trim()] = value.trim();
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function checkRecentTasks() {
    console.log('Checking recent tasks...');
    const { data, error } = await supabase.from('tasks').select('id, created_at').order('created_at', { ascending: false }).limit(5);
    
    if (error) {
        console.error('Error:', error.message);
    } else {
        console.log('Recent Tasks:', data);
    }
}

checkRecentTasks();
