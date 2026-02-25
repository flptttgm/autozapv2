
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://hmoekghvlyfyfjobyufq.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhtb2VrZ2h2bHlmeWZqb2J5dWZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxNzIyMzYsImV4cCI6MjA3OTc0ODIzNn0.zS6icMiulXADsCK7miNQZjv-HbHYA4OpCrZp4WMN6ws";
const WORKSPACE_ID = "b98b97a6-6d55-44ab-8967-51a9978bf2ba";

const supabase = createClient(SUPABASE_URL, ANON_KEY);

async function testQuery() {
    console.log('Testing Supabase query...');
    try {
        const { data, error } = await supabase
            .from('whatsapp_instances')
            .select('id, instance_id, instance_token, workspace_id, status, phone, connected_at, created_at, subscribed, ai_mode')
            .eq('workspace_id', WORKSPACE_ID)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Supabase Error:', JSON.stringify(error, null, 2));
        } else {
            console.log('Data retrieved:', JSON.stringify(data, null, 2));
        }
    } catch (err) {
        console.error('Exception:', err);
    }
}

testQuery();
