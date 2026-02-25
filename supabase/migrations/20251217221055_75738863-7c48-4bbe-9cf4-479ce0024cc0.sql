-- Políticas RLS para Platform Admins verem todos os dados

-- whatsapp_instances
CREATE POLICY "Platform admins can view all whatsapp_instances"
ON public.whatsapp_instances FOR SELECT
USING (is_platform_admin(auth.uid()));

-- messages  
CREATE POLICY "Platform admins can view all messages"
ON public.messages FOR SELECT
USING (is_platform_admin(auth.uid()));

-- subscriptions
CREATE POLICY "Platform admins can view all subscriptions"
ON public.subscriptions FOR SELECT
USING (is_platform_admin(auth.uid()));

-- leads
CREATE POLICY "Platform admins can view all leads"
ON public.leads FOR SELECT
USING (is_platform_admin(auth.uid()));

-- profiles
CREATE POLICY "Platform admins can view all profiles"
ON public.profiles FOR SELECT
USING (is_platform_admin(auth.uid()));

-- workspaces
CREATE POLICY "Platform admins can view all workspaces"
ON public.workspaces FOR SELECT
USING (is_platform_admin(auth.uid()));

-- workspace_members
CREATE POLICY "Platform admins can view all workspace_members"
ON public.workspace_members FOR SELECT
USING (is_platform_admin(auth.uid()));

-- appointments
CREATE POLICY "Platform admins can view all appointments"
ON public.appointments FOR SELECT
USING (is_platform_admin(auth.uid()));

-- audit_logs
CREATE POLICY "Platform admins can view all audit_logs"
ON public.audit_logs FOR SELECT
USING (is_platform_admin(auth.uid()));

-- payments_history
CREATE POLICY "Platform admins can view all payments"
ON public.payments_history FOR SELECT
USING (is_platform_admin(auth.uid()));

-- chat_memory
CREATE POLICY "Platform admins can view all chat_memory"
ON public.chat_memory FOR SELECT
USING (is_platform_admin(auth.uid()));

-- knowledge_base
CREATE POLICY "Platform admins can view all knowledge_base"
ON public.knowledge_base FOR SELECT
USING (is_platform_admin(auth.uid()));

-- calendar_integrations
CREATE POLICY "Platform admins can view all calendar_integrations"
ON public.calendar_integrations FOR SELECT
USING (is_platform_admin(auth.uid()));

-- system_config
CREATE POLICY "Platform admins can view all system_config"
ON public.system_config FOR SELECT
USING (is_platform_admin(auth.uid()));

-- invites
CREATE POLICY "Platform admins can view all invites"
ON public.invites FOR SELECT
USING (is_platform_admin(auth.uid()));

-- asaas_customers
CREATE POLICY "Platform admins can view all asaas_customers"
ON public.asaas_customers FOR SELECT
USING (is_platform_admin(auth.uid()));