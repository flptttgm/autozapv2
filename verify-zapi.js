
const SUPABASE_URL = "https://hmoekghvlyfyfjobyufq.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhtb2VrZ2h2bHlmeWZqb2J5dWZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxNzIyMzYsImV4cCI6MjA3OTc0ODIzNn0.zS6icMiulXADsCK7miNQZjv-HbHYA4OpCrZp4WMN6ws";
const WORKSPACE_ID = "b98b97a6-6d55-44ab-8967-51a9978bf2ba";

async function createInstance() {
    console.log('Testing instance creation...');
    try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/zapi-partners?action=create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': ANON_KEY,
            },
            body: JSON.stringify({ workspace_id: WORKSPACE_ID })
        });

        console.log('Status:', response.status);
        const text = await response.text();
        console.log('Body:', text);

    } catch (error) {
        console.error('Error:', error);
    }
}

createInstance();
