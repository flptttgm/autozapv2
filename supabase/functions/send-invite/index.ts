import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const APP_URL = "https://appiautozap.com";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string);

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

    const { email, role = 'member' } = await req.json();

    // Get user's workspace
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('workspace_id, full_name')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile?.workspace_id) {
      // Try alternative query with 'id' column
      const { data: profileAlt, error: profileAltError } = await supabase
        .from('profiles')
        .select('workspace_id, full_name')
        .eq('id', user.id)
        .single();

      if (profileAltError || !profileAlt?.workspace_id) {
        throw new Error(`Workspace not found. user_id query: ${profileError?.message || 'no error, workspace_id=' + profile?.workspace_id}. id query: ${profileAltError?.message || 'no error, workspace_id=' + profileAlt?.workspace_id}`);
      }
      // The 'id' column query worked, use that profile
      Object.assign(profile || {}, profileAlt);
    }

    // Check if user is admin/owner
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', profile.workspace_id)
      .eq('user_id', user.id)
      .single();

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      throw new Error('Insufficient permissions');
    }

    // Check member limit from subscription
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('members_limit')
      .eq('workspace_id', profile.workspace_id)
      .single();

    const membersLimit = subscription?.members_limit || 1;

    // Count current members
    const { count: membersCount } = await supabase
      .from('workspace_members')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', profile.workspace_id);

    // Count pending invites
    const { count: pendingInvites } = await supabase
      .from('invites')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', profile.workspace_id)
      .eq('status', 'pending');

    const totalMembers = (membersCount || 0) + (pendingInvites || 0);

    if (totalMembers >= membersLimit) {
      throw new Error(`Limite de ${membersLimit} membros atingido. Faça upgrade do seu plano para adicionar mais membros.`);
    }

    // Get workspace info
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('name')
      .eq('id', profile.workspace_id)
      .single();

    // Check if email is already a member
    const { data: existingUser } = await supabase.auth.admin.listUsers();
    const userWithEmail = existingUser?.users.find(u => u.email === email);

    if (userWithEmail) {
      const { data: existingMember } = await supabase
        .from('workspace_members')
        .select('id')
        .eq('workspace_id', profile.workspace_id)
        .eq('user_id', userWithEmail.id)
        .maybeSingle();

      if (existingMember) {
        throw new Error('User is already a member');
      }
    }

    // Create invite
    const { data: invite, error: inviteError } = await supabase
      .from('invites')
      .insert({
        workspace_id: profile.workspace_id,
        email,
        role,
        invited_by: user.id,
      })
      .select()
      .single();

    if (inviteError) {
      throw inviteError;
    }

    // Send email
    const inviteUrl = `${APP_URL}/accept-invite?token=${invite.token}`;

    await resend.emails.send({
      from: 'Autozap <noreply@appiautozap.com>',
      to: [email],
      subject: `Convite para ${workspace?.name || 'Equipe'}`,
      html: `
        <h1>Você foi convidado!</h1>
        <p><strong>${profile.full_name}</strong> convidou você para fazer parte da equipe <strong>${workspace?.name || 'WhatsApp AI'}</strong>.</p>
        <p>Como membro ${role === 'admin' ? 'administrador' : 'da equipe'}, você terá acesso a todas as conversas, leads e agendamentos do workspace.</p>
        <p><a href="${inviteUrl}" style="display: inline-block; padding: 12px 24px; background-color: #0066ff; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">Aceitar Convite</a></p>
        <p style="color: #666; font-size: 14px;">Este convite expira em 7 dias.</p>
        <p style="color: #666; font-size: 12px;">Se você não esperava este convite, pode ignorar este email.</p>
      `,
    });

    return new Response(JSON.stringify({ success: true, invite }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in send-invite:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
