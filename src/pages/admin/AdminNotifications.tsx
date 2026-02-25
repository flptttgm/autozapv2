import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, Send, Users, CheckCircle, XCircle, Clock, Loader2, Search, Filter, Megaphone, Smartphone, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type TargetMode = 'all' | 'filtered' | 'selected';
type Channel = 'in_app' | 'push' | 'email';

interface UserData {
  user_id: string;
  full_name: string | null;
  email: string;
  plan_type: string | null;
  whatsapp_status: string | null;
  onboarding_completed: boolean | null;
  has_push: boolean;
}

export default function AdminNotifications() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("/");
  
  // Channels
  const [selectedChannels, setSelectedChannels] = useState<Channel[]>(['in_app', 'push']);
  
  // Target mode and filters
  const [targetMode, setTargetMode] = useState<TargetMode>('all');
  const [filterPlanType, setFilterPlanType] = useState<string>('all');
  const [filterWhatsApp, setFilterWhatsApp] = useState<string>('all');
  const [filterOnboarding, setFilterOnboarding] = useState<string>('all');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Preview tab
  const [previewTab, setPreviewTab] = useState<string>('push');

  // Fetch broadcast history
  const { data: broadcasts, isLoading: loadingBroadcasts } = useQuery({
    queryKey: ['admin-broadcasts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('broadcast_notifications')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  // Fetch total push subscriptions count
  const { data: subscriptionsCount } = useQuery({
    queryKey: ['admin-push-subscriptions-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('push_subscriptions')
        .select('*', { count: 'exact', head: true });
      
      if (error) throw error;
      return count || 0;
    }
  });

  // Fetch ALL users with their data
  const { data: allUsers, isLoading: loadingUsers } = useQuery({
    queryKey: ['admin-all-users-notifications'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_admin_users_with_email');
      if (error) throw error;
      
      const { data: pushSubs, error: pushError } = await supabase
        .from('push_subscriptions')
        .select('user_id');
      
      if (pushError) throw pushError;
      
      const pushUserIds = new Set(pushSubs?.map(s => s.user_id) || []);
      
      const usersData: UserData[] = (data || []).map((user: any) => ({
        user_id: user.id,
        full_name: user.full_name,
        email: user.email,
        plan_type: user.plan_type,
        whatsapp_status: user.whatsapp_connected ? 'connected' : 'disconnected',
        onboarding_completed: user.onboarding_completed,
        has_push: pushUserIds.has(user.id),
      }));
      
      return usersData;
    }
  });

  const totalUsersCount = allUsers?.length || 0;

  // Filter users based on criteria
  const filteredUsers = useMemo(() => {
    if (!allUsers) return [];
    
    return allUsers.filter(user => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          user.full_name?.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }
      
      if (filterPlanType !== 'all' && user.plan_type !== filterPlanType) {
        return false;
      }
      
      if (filterWhatsApp !== 'all' && user.whatsapp_status !== filterWhatsApp) {
        return false;
      }
      
      if (filterOnboarding !== 'all') {
        const completed = filterOnboarding === 'completed';
        if (user.onboarding_completed !== completed) return false;
      }
      
      return true;
    });
  }, [allUsers, searchQuery, filterPlanType, filterWhatsApp, filterOnboarding]);

  // Calculate recipient count based on mode
  const recipientCount = useMemo(() => {
    switch (targetMode) {
      case 'all':
        return totalUsersCount;
      case 'filtered':
        return filteredUsers.length;
      case 'selected':
        return selectedUserIds.length;
      default:
        return 0;
    }
  }, [targetMode, totalUsersCount, filteredUsers, selectedUserIds]);

  // Calculate how many have push in current selection
  const pushRecipientCount = useMemo(() => {
    switch (targetMode) {
      case 'all':
        return subscriptionsCount || 0;
      case 'filtered':
        return filteredUsers.filter(u => u.has_push).length;
      case 'selected':
        return allUsers?.filter(u => selectedUserIds.includes(u.user_id) && u.has_push).length || 0;
      default:
        return 0;
    }
  }, [targetMode, subscriptionsCount, filteredUsers, selectedUserIds, allUsers]);

  const toggleChannel = (channel: Channel) => {
    setSelectedChannels(prev => 
      prev.includes(channel)
        ? prev.filter(c => c !== channel)
        : [...prev, channel]
    );
  };

  // Send broadcast mutation
  const sendBroadcastMutation = useMutation({
    mutationFn: async () => {
      const payload: any = { 
        title, 
        body, 
        url, 
        target_mode: targetMode,
        channels: selectedChannels
      };
      
      if (targetMode === 'filtered') {
        payload.filters = {};
        if (filterPlanType !== 'all') payload.filters.plan_type = filterPlanType;
        if (filterWhatsApp !== 'all') payload.filters.whatsapp_status = filterWhatsApp;
        if (filterOnboarding !== 'all') payload.filters.onboarding_completed = filterOnboarding === 'completed';
      } else if (targetMode === 'selected') {
        payload.selected_user_ids = selectedUserIds;
      }

      const { data, error } = await supabase.functions.invoke('send-broadcast-notification', {
        body: payload
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      const parts = [];
      if (data.in_app_created > 0) parts.push(`${data.in_app_created} in-app`);
      if (data.push_sent > 0) parts.push(`${data.push_sent} push`);
      if (data.email_sent > 0) parts.push(`${data.email_sent} email`);
      
      toast.success(`Notificação enviada! (${parts.join(', ')})`);
      setTitle("");
      setBody("");
      setUrl("/");
      setSelectedUserIds([]);
      queryClient.invalidateQueries({ queryKey: ['admin-broadcasts'] });
    },
    onError: (error: any) => {
      toast.error(`Erro ao enviar: ${error.message}`);
    }
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />Enviado</Badge>;
      case 'sending':
        return <Badge variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Enviando</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Falhou</Badge>;
      default:
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
    }
  };

  const getChannelBadges = (channels: string[] | null) => {
    const channelList = channels || ['in_app', 'push'];
    return (
      <div className="flex gap-1 flex-wrap">
        {channelList.includes('in_app') && <Badge variant="outline" className="text-xs"><Bell className="h-3 w-3 mr-1" />In-App</Badge>}
        {channelList.includes('push') && <Badge variant="outline" className="text-xs"><Smartphone className="h-3 w-3 mr-1" />Push</Badge>}
        {channelList.includes('email') && <Badge variant="outline" className="text-xs"><Mail className="h-3 w-3 mr-1" />Email</Badge>}
      </div>
    );
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const selectAllFiltered = () => {
    setSelectedUserIds(filteredUsers.map(u => u.user_id));
  };

  const deselectAll = () => {
    setSelectedUserIds([]);
  };

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Notificações em Massa</h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Envie notificações in-app, push e email para usuários da plataforma
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalUsersCount}</div>
              <p className="text-xs text-muted-foreground">receberão notificação</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Push Ativo</CardTitle>
              <Smartphone className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{subscriptionsCount || 0}</div>
              <p className="text-xs text-muted-foreground">dispositivos registrados</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Broadcasts</CardTitle>
              <Bell className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{broadcasts?.length || 0}</div>
              <p className="text-xs text-muted-foreground">notificações enviadas</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Última Notificação</CardTitle>
              <Send className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {broadcasts?.[0] 
                  ? format(new Date(broadcasts[0].created_at), 'dd/MM', { locale: ptBR })
                  : '-'
                }
              </div>
              <p className="text-xs text-muted-foreground">
                {broadcasts?.[0]?.title?.slice(0, 30) || 'Nenhuma ainda'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Send Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Nova Notificação
            </CardTitle>
            <CardDescription>
              Preencha os campos abaixo para enviar uma notificação
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Channel Selection */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Megaphone className="h-4 w-4" />
                Canais de Envio
              </Label>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={selectedChannels.includes('in_app')}
                    onCheckedChange={() => toggleChannel('in_app')}
                  />
                  <Bell className="h-4 w-4 text-blue-500" />
                  <span>In-App ({recipientCount})</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={selectedChannels.includes('push')}
                    onCheckedChange={() => toggleChannel('push')}
                  />
                  <Smartphone className="h-4 w-4 text-green-500" />
                  <span>Push ({pushRecipientCount})</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={selectedChannels.includes('email')}
                    onCheckedChange={() => toggleChannel('email')}
                  />
                  <Mail className="h-4 w-4 text-purple-500" />
                  <span>Email ({recipientCount})</span>
                </label>
              </div>
              {selectedChannels.length === 0 && (
                <p className="text-sm text-destructive">Selecione pelo menos um canal</p>
              )}
            </div>

            {/* Target Mode Selection */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Modo de Envio
              </Label>
              <RadioGroup 
                value={targetMode} 
                onValueChange={(v) => setTargetMode(v as TargetMode)}
                className="flex flex-wrap gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="all" />
                  <Label htmlFor="all" className="cursor-pointer">
                    Todos os usuários ({totalUsersCount})
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="filtered" id="filtered" />
                  <Label htmlFor="filtered" className="cursor-pointer">
                    Por filtros
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="selected" id="selected" />
                  <Label htmlFor="selected" className="cursor-pointer">
                    Selecionar usuários
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Filters Section */}
            {targetMode === 'filtered' && (
              <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                <Label className="text-sm font-medium">Filtros</Label>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="plan-filter" className="text-xs">Tipo de Plano</Label>
                    <Select value={filterPlanType} onValueChange={setFilterPlanType}>
                      <SelectTrigger id="plan-filter">
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="trial">Trial</SelectItem>
                        <SelectItem value="starter">Starter</SelectItem>
                        <SelectItem value="professional">Professional</SelectItem>
                        <SelectItem value="enterprise">Enterprise</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="whatsapp-filter" className="text-xs">Status WhatsApp</Label>
                    <Select value={filterWhatsApp} onValueChange={setFilterWhatsApp}>
                      <SelectTrigger id="whatsapp-filter">
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="connected">Conectado</SelectItem>
                        <SelectItem value="disconnected">Desconectado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="onboarding-filter" className="text-xs">Onboarding</Label>
                    <Select value={filterOnboarding} onValueChange={setFilterOnboarding}>
                      <SelectTrigger id="onboarding-filter">
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="completed">Completo</SelectItem>
                        <SelectItem value="pending">Pendente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-muted-foreground">
                    <strong>{filteredUsers.length}</strong> usuários
                  </span>
                  <span className="text-muted-foreground">
                    <strong>{filteredUsers.filter(u => u.has_push).length}</strong> com push ativo
                  </span>
                </div>
              </div>
            )}

            {/* User Selection Section */}
            {targetMode === 'selected' && (
              <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Selecionar Usuários</Label>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={selectAllFiltered}>
                      Selecionar todos
                    </Button>
                    <Button variant="outline" size="sm" onClick={deselectAll}>
                      Limpar seleção
                    </Button>
                  </div>
                </div>
                
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome ou email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {loadingUsers ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <ScrollArea className="h-[300px] border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12"></TableHead>
                          <TableHead>Nome</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Plano</TableHead>
                          <TableHead>Push</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUsers.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                              Nenhum usuário encontrado
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredUsers.map((user) => (
                            <TableRow key={user.user_id} className="cursor-pointer" onClick={() => toggleUserSelection(user.user_id)}>
                              <TableCell>
                                <Checkbox
                                  checked={selectedUserIds.includes(user.user_id)}
                                  onCheckedChange={() => toggleUserSelection(user.user_id)}
                                />
                              </TableCell>
                              <TableCell className="font-medium">
                                {user.full_name || 'Sem nome'}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {user.email}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="capitalize">
                                  {user.plan_type || 'trial'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {user.has_push ? (
                                  <Badge variant="default" className="bg-green-600">Ativo</Badge>
                                ) : (
                                  <Badge variant="secondary">Inativo</Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
                
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-muted-foreground">
                    <strong>{selectedUserIds.length}</strong> selecionados
                  </span>
                  <span className="text-muted-foreground">
                    <strong>{pushRecipientCount}</strong> com push ativo
                  </span>
                </div>
              </div>
            )}

            {/* Form Fields */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Título (máx. 50 caracteres)</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value.slice(0, 50))}
                    placeholder="Nova funcionalidade disponível! 🎉"
                  />
                  <p className="text-xs text-muted-foreground">{title.length}/50</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="body">Mensagem (máx. 200 caracteres)</Label>
                  <Textarea
                    id="body"
                    value={body}
                    onChange={(e) => setBody(e.target.value.slice(0, 200))}
                    placeholder="Confira as novas automações de IA que preparamos para você..."
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">{body.length}/200</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="url">URL de Destino</Label>
                  <Input
                    id="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="/dashboard"
                  />
                  <p className="text-xs text-muted-foreground">Página que abrirá ao clicar na notificação</p>
                </div>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      className="w-full" 
                      disabled={!title || !body || sendBroadcastMutation.isPending || recipientCount === 0 || selectedChannels.length === 0}
                    >
                      {sendBroadcastMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Enviar para {recipientCount} usuário{recipientCount !== 1 ? 's' : ''}
                        </>
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirmar envio</AlertDialogTitle>
                      <AlertDialogDescription asChild>
                        <div className="space-y-2">
                          <p>Você está prestes a enviar uma notificação para <strong>{recipientCount}</strong> usuário{recipientCount !== 1 ? 's' : ''}.</p>
                          <div className="text-xs space-y-1">
                            {selectedChannels.includes('in_app') && <p>• {recipientCount} receberão in-app</p>}
                            {selectedChannels.includes('push') && <p>• {pushRecipientCount} receberão push</p>}
                            {selectedChannels.includes('email') && <p>• {recipientCount} receberão email</p>}
                          </div>
                        </div>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="my-4 p-4 bg-muted rounded-lg">
                      <p className="font-semibold">{title}</p>
                      <p className="text-sm text-muted-foreground">{body}</p>
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => sendBroadcastMutation.mutate()}>
                        Confirmar Envio
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              {/* Preview */}
              <div className="space-y-2">
                <Label>Pré-visualização</Label>
                <Tabs value={previewTab} onValueChange={setPreviewTab}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="push">Push/In-App</TabsTrigger>
                    <TabsTrigger value="email">Email</TabsTrigger>
                  </TabsList>
                  <TabsContent value="push">
                    <div className="bg-background border rounded-lg p-4 shadow-lg max-w-sm">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
                          <Bell className="h-5 w-5 text-primary-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">
                            {title || 'Título da notificação'}
                          </p>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {body || 'Corpo da mensagem aparecerá aqui...'}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">agora</p>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                  <TabsContent value="email">
                    <div className="bg-muted/50 border rounded-lg overflow-hidden max-w-sm">
                      {/* Email preview header */}
                      <div className="bg-gradient-to-r from-primary to-primary/80 p-4 text-center">
                        <h3 className="text-primary-foreground font-bold text-lg">Appi AutoZap</h3>
                      </div>
                      {/* Email preview content */}
                      <div className="p-4 bg-background">
                        <h4 className="font-semibold text-base mb-2">
                          {title || 'Título da notificação'}
                        </h4>
                        <p className="text-sm text-muted-foreground mb-4">
                          {body || 'Corpo da mensagem aparecerá aqui...'}
                        </p>
                        <div className="bg-primary text-primary-foreground text-center py-2 px-4 rounded-md text-sm font-medium">
                          Acessar Plataforma →
                        </div>
                      </div>
                      {/* Email preview footer */}
                      <div className="bg-muted/80 p-3 text-center">
                        <p className="text-xs text-muted-foreground">
                          © {new Date().getFullYear()} Appi AutoZap
                        </p>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
                <p className="text-xs text-muted-foreground">
                  Assim será exibida a notificação
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* History */}
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Notificações</CardTitle>
            <CardDescription>
              Todas as notificações em massa enviadas pela plataforma
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingBroadcasts ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : broadcasts?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma notificação enviada ainda
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Título</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Canais</TableHead>
                      <TableHead>Destinatários</TableHead>
                      <TableHead>In-App</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {broadcasts?.map((broadcast: any) => (
                      <TableRow key={broadcast.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{broadcast.title}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-xs">
                              {broadcast.body}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {format(new Date(broadcast.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          {getChannelBadges(broadcast.channels)}
                        </TableCell>
                        <TableCell>{broadcast.total_recipients}</TableCell>
                        <TableCell className="text-green-600">{broadcast.successful_sends}</TableCell>
                        <TableCell>
                          {broadcast.email_sent !== null ? (
                            <span className={broadcast.email_sent > 0 ? "text-green-600" : "text-muted-foreground"}>
                              {broadcast.email_sent || 0}
                              {broadcast.email_failed > 0 && (
                                <span className="text-red-600 ml-1">({broadcast.email_failed} falhas)</span>
                              )}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(broadcast.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
