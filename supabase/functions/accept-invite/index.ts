import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Get user from token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { invite_token } = await req.json();

    // Get invite
    const { data: invite, error: inviteError } = await supabase
      .from('invites')
      .select('*')
      .eq('token', invite_token)
      .eq('status', 'pending')
      .single();

    if (inviteError || !invite) {
      throw new Error('Invalid or expired invite');
    }

    // Check if invite is expired
    if (new Date(invite.expires_at) < new Date()) {
      await supabase
        .from('invites')
        .update({ status: 'expired' })
        .eq('id', invite.id);
      
      throw new Error('Invite has expired');
    }

    // Check if email matches (user must be logged in with the invited email)
    if (user.email !== invite.email) {
      throw new Error('You must be logged in with the invited email to accept this invite');
    }

    // Check if user is already a member
    const { data: existingMember } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', invite.workspace_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingMember) {
      throw new Error('Already a member of this workspace');
    }

    // Add user to workspace
    const { error: memberError } = await supabase
      .from('workspace_members')
      .insert({
        workspace_id: invite.workspace_id,
        user_id: user.id,
        role: invite.role,
      });

    if (memberError) {
      throw memberError;
    }

    // Update user's profile workspace_id
    await supabase
      .from('profiles')
      .update({ workspace_id: invite.workspace_id })
      .eq('id', user.id);

    // Mark invite as accepted
    await supabase
      .from('invites')
      .update({ status: 'accepted' })
      .eq('id', invite.id);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in accept-invite:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
