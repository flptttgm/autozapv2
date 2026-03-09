import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_MESSAGE_LENGTH = 1000;
const TYPING_DELAY_MS = 1500;

function normalizeMimeType(input: unknown, fallback: string): string {
  if (typeof input !== 'string') return fallback;
  const trimmed = input.trim();
  if (!trimmed) return fallback;
  return trimmed.split(';')[0] || fallback;
}

function stripBase64DataUrlPrefix(input: string): string {
  return input.replace(/^data:[^;]+;base64,/, '').replace(/\s+/g, '').trim();
}

function guessFileExtensionFromMime(mimeType: string): string {
  const base = normalizeMimeType(mimeType, 'application/octet-stream');
  if (base === 'audio/wav') return 'wav';
  if (base === 'audio/ogg') return 'ogg';
  if (base === 'audio/webm') return 'webm';
  if (base === 'audio/mpeg' || base === 'audio/mp3') return 'mp3';
  if (base === 'image/jpeg') return 'jpg';
  if (base === 'image/png') return 'png';
  if (base === 'image/webp') return 'webp';
  if (base === 'image/gif') return 'gif';
  if (base === 'application/pdf') return 'pdf';
  if (base === 'application/msword') return 'doc';
  if (base === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
  if (base === 'application/vnd.ms-excel') return 'xls';
  if (base === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') return 'xlsx';
  if (base === 'application/vnd.ms-powerpoint') return 'ppt';
  if (base === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') return 'pptx';
  if (base === 'text/plain') return 'txt';
  if (base === 'text/csv') return 'csv';
  if (base === 'application/zip' || base === 'application/x-zip-compressed') return 'zip';
  if (base === 'application/x-rar-compressed') return 'rar';
  return 'bin';
}

function base64ToUint8Array(base64: string): Uint8Array {
  const clean = stripBase64DataUrlPrefix(base64);
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const {
      chat_id: providedChatId,
      message,
      lead_id: providedLeadId,
      user_id,
      user_name,
      instance_id: providedInstanceId,
      audio_base64,
      audio_duration,
      audio_mime_type,
      image_base64,
      image_mime_type,
      image_caption,
      document_base64,
      document_mime_type,
      document_file_name,
      document_extension,
      document_caption,
      quoted_message_id
    } = await req.json();

    const normalizedAudioBase64 = typeof audio_base64 === 'string'
      ? stripBase64DataUrlPrefix(audio_base64)
      : null;

    const normalizedImageBase64 = typeof image_base64 === 'string'
      ? stripBase64DataUrlPrefix(image_base64)
      : null;

    const normalizedDocumentBase64 = typeof document_base64 === 'string'
      ? stripBase64DataUrlPrefix(document_base64)
      : null;

    const isAudioMessage = !!normalizedAudioBase64;
    const isImageMessage = !!normalizedImageBase64;
    const isDocumentMessage = !!normalizedDocumentBase64;

    if (!providedChatId || (!message && !normalizedAudioBase64 && !normalizedImageBase64 && !normalizedDocumentBase64)) {
      throw new Error('chat_id and (message, audio_base64, image_base64, or document_base64) are required');
    }

    let chat_id = providedChatId;

    console.log('Manual message send request:', {
      chat_id: providedChatId,
      providedLeadId,
      message_length: message?.length || 0,
      providedInstanceId,
      hasLeadId: !!providedLeadId,
      isAudio: isAudioMessage,
      isImage: isImageMessage,
      isDocument: isDocumentMessage,
      audioDuration: audio_duration,
      imageMimeType: image_mime_type,
      captionLength: image_caption?.length || 0
    });

    let lead_id = providedLeadId;
    let workspace_id: string | null = null;
    let destinationPhone: string | null = null;

    if (lead_id) {
      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .select('phone, workspace_id')
        .eq('id', lead_id)
        .single();

      if (leadError || !lead?.phone) {
        console.error('Lead lookup failed:', { lead_id, error: leadError?.message });
        lead_id = null;
      } else {
        workspace_id = lead.workspace_id;
        destinationPhone = lead.phone;
      }
    }

    if (!lead_id || !workspace_id || !destinationPhone) {
      console.log('No lead found, attempting to find/create from chat history...');

      const { data: existingMessages, error: msgError } = await supabase
        .from('messages')
        .select('metadata, workspace_id')
        .eq('chat_id', chat_id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (msgError) {
        console.error('Error fetching messages:', { chat_id, error: msgError.message });
        throw new Error('Erro ao buscar histórico do chat');
      }

      if (!existingMessages || existingMessages.length === 0) {
        throw new Error('Nenhuma mensagem encontrada para este chat');
      }

      const messageWithWorkspace = existingMessages.find(m => m.workspace_id);
      const messageWithPhone = existingMessages.find(m => m.metadata?.phone);

      workspace_id = messageWithWorkspace?.workspace_id || null;
      const phoneFromMetadata = messageWithPhone?.metadata?.phone;
      const senderName = messageWithPhone?.metadata?.senderName || messageWithPhone?.metadata?.pushName || 'Contato via WhatsApp';

      console.log('Extracted from messages:', { workspace_id, phoneFromMetadata, senderName });

      if (!workspace_id) {
        throw new Error('Não foi possível determinar o workspace deste chat');
      }

      if (!phoneFromMetadata) {
        // For groups without phone, try to get group ID from zapi_payload
        const messageWithGroupPhone = existingMessages.find(m => m.metadata?.zapi_payload?.phone);
        const groupPhone = messageWithGroupPhone?.metadata?.zapi_payload?.phone;

        if (groupPhone) {
          console.log('[manual-inbox] Group detected, using group phone:', groupPhone);
          destinationPhone = groupPhone;
          // For groups, skip lead creation - just use a null lead_id
          lead_id = null;
        } else {
          throw new Error('Não foi possível determinar o telefone do destinatário');
        }
      }

      // Check if this is a group chat
      const isGroupChat = existingMessages.some(m =>
        m.metadata?.zapi_payload?.isGroup === true ||
        m.metadata?.isGroup === true
      ) || chat_id.includes('-group') || chat_id.includes('g.us');

      if (!isGroupChat && phoneFromMetadata) {
        // Only do lead lookup/creation for non-group chats
        const { data: existingLead } = await supabase
          .from('leads')
          .select('id, phone')
          .eq('workspace_id', workspace_id)
          .eq('phone', phoneFromMetadata)
          .maybeSingle();

        if (existingLead) {
          console.log('Found existing lead:', existingLead.id);
          lead_id = existingLead.id;
          destinationPhone = existingLead.phone;
        } else {
          console.log('Creating new lead for phone:', phoneFromMetadata);
          const { data: newLead, error: createError } = await supabase
            .from('leads')
            .insert({
              phone: phoneFromMetadata,
              name: senderName,
              workspace_id: workspace_id,
              status: 'new',
              metadata: {
                source: 'manual_inbox',
                originalChatId: chat_id
              }
            })
            .select('id, phone')
            .single();

          if (createError) {
            console.error('Error creating lead:', createError);
            throw new Error('Erro ao criar lead automaticamente');
          }

          console.log('Created new lead:', newLead.id);
          lead_id = newLead.id;
          destinationPhone = newLead.phone;

          const { error: updateError } = await supabase
            .from('messages')
            .update({ lead_id: newLead.id })
            .eq('chat_id', chat_id)
            .eq('workspace_id', workspace_id)
            .is('lead_id', null);

          if (updateError) {
            console.error('Error updating messages with new lead_id:', updateError);
          } else {
            console.log('Updated old messages with new lead_id');
          }
        }
      } else if (isGroupChat && !destinationPhone) {
        // For groups, try extracting group phone from zapi_payload
        const messageWithGroupPhone = existingMessages.find(m => m.metadata?.zapi_payload?.phone);
        destinationPhone = messageWithGroupPhone?.metadata?.zapi_payload?.phone || null;
      }
    }

    if (!workspace_id || !destinationPhone) {
      throw new Error('Não foi possível determinar o destinatário da mensagem');
    }

    const { data: existingLeadMessage } = await supabase
      .from('messages')
      .select('chat_id')
      .eq('lead_id', lead_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingLeadMessage?.chat_id && existingLeadMessage.chat_id !== providedChatId) {
      console.log(`[manual-inbox] Using existing chat_id: ${existingLeadMessage.chat_id} instead of ${providedChatId}`);
      chat_id = existingLeadMessage.chat_id;
    }

    let chatInstanceId = providedInstanceId || null;

    if (!chatInstanceId) {
      const { data: existingMessages } = await supabase
        .from('messages')
        .select('metadata')
        .eq('chat_id', chat_id)
        .eq('direction', 'inbound')
        .not('metadata->instanceId', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1);

      chatInstanceId = existingMessages?.[0]?.metadata?.instanceId || null;
    }

    console.log('Using instanceId:', chatInstanceId);

    let instance;

    if (chatInstanceId) {
      const { data: specificInstance, error: specificError } = await supabase
        .from('whatsapp_instances')
        .select('instance_id, instance_token, status')
        .eq('workspace_id', workspace_id)
        .eq('instance_id', chatInstanceId)
        .maybeSingle();

      if (specificError) {
        console.error('Error fetching specific WhatsApp instance:', specificError);
      }

      instance = specificInstance;

      if (instance && instance.status !== 'connected') {
        throw new Error('A instância do WhatsApp usada nesta conversa está desconectada. Reconecte na página Conexões.');
      }
    }

    if (!instance) {
      const { data: fallbackInstance, error: fallbackError } = await supabase
        .from('whatsapp_instances')
        .select('instance_id, instance_token, status')
        .eq('workspace_id', workspace_id)
        .eq('status', 'connected')
        .order('connected_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fallbackError) {
        console.error('Error fetching fallback WhatsApp instance:', fallbackError);
        throw new Error('Erro ao buscar instância do WhatsApp');
      }

      instance = fallbackInstance;
    }

    if (!instance?.instance_id || !instance?.instance_token) {
      throw new Error('WhatsApp desconectado. Verifique sua instância na página Conexões.');
    }

    const zapiInstanceId = instance.instance_id;
    const zapiInstanceToken = instance.instance_token;

    const zapiUserToken = Deno.env.get('ZAPI_USER_TOKEN');
    if (!zapiUserToken) {
      throw new Error('Z-API credentials not configured');
    }

    console.log('Sending message to:', chat_id, 'using instance:', zapiInstanceId, 'lead_id:', lead_id, 'isAudio:', isAudioMessage);

    let zapiMessageId: string | null = null;

    if (isAudioMessage) {
      const mimeType = normalizeMimeType(audio_mime_type, 'audio/webm');
      const ext = guessFileExtensionFromMime(mimeType);
      const objectPath = `outbound/${workspace_id}/${lead_id}/${crypto.randomUUID()}.${ext}`;

      const audioBytes = base64ToUint8Array(normalizedAudioBase64);

      console.log('[manual-inbox] Uploading audio to storage', {
        mimeType_received: audio_mime_type,
        mimeType_used: mimeType,
        bytes_len: audioBytes.byteLength,
        duration: audio_duration || 0,
        objectPath,
        chat_id,
        lead_id,
        workspace_id,
      });

      const audioArrayBuffer = audioBytes.buffer.slice(
        audioBytes.byteOffset,
        audioBytes.byteOffset + audioBytes.byteLength
      ) as ArrayBuffer;
      const uploadBlob = new Blob([audioArrayBuffer], { type: mimeType });
      const { error: uploadError } = await supabase.storage
        .from('whatsapp-audio')
        .upload(objectPath, uploadBlob, {
          contentType: mimeType,
          upsert: false,
        });

      if (uploadError) {
        console.error('[manual-inbox] Storage upload error', {
          message: uploadError.message,
          objectPath,
        });
        throw new Error('Erro ao preparar upload do áudio');
      }

      const { data: signedData, error: signedError } = await supabase.storage
        .from('whatsapp-audio')
        .createSignedUrl(objectPath, 60 * 30);

      if (signedError || !signedData?.signedUrl) {
        console.error('[manual-inbox] Signed URL error', {
          message: signedError?.message,
          objectPath,
        });
        throw new Error('Erro ao gerar link do áudio');
      }

      const audioUrl = signedData.signedUrl;

      console.log('[manual-inbox] Sending audio payload', {
        mimeType_received: audio_mime_type,
        mimeType_used: mimeType,
        base64_len: normalizedAudioBase64?.length || 0,
        bytes_len: audioBytes.byteLength,
        duration: audio_duration || 0,
        chat_id,
        lead_id,
        storagePath: objectPath,
        audioUrl_prefix: audioUrl.slice(0, 64),
      });

      const zapiUrl = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiInstanceToken}/send-audio`;

      const zapiResponse = await fetch(zapiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': zapiUserToken,
        },
        body: JSON.stringify({
          phone: destinationPhone,
          audio: audioUrl,
          waveform: true,
          delayTyping: 1
        }),
      });

      try {
        const zapiResult = await zapiResponse.clone().json();
        zapiMessageId = zapiResult.messageId || zapiResult.zapiMessageId || zapiResult.id || null;
        console.log('[manual-inbox] Z-API audio response messageId:', zapiMessageId);
      } catch (e) {
        console.log('[manual-inbox] Could not parse Z-API response for messageId');
      }

      if (!zapiResponse.ok) {
        const errorText = await zapiResponse.text();
        console.error('[manual-inbox] Z-API audio error', {
          status: zapiResponse.status,
          body: errorText,
          mimeType_used: mimeType,
          base64_len: normalizedAudioBase64?.length || 0,
        });
        if (errorText.includes('disconnected') || errorText.includes('Enqueue message is disabled')) {
          throw new Error('WhatsApp desconectado. Por favor, reconecte sua instância na página Conexões.');
        }
        throw new Error(`Erro ao enviar áudio: ${zapiResponse.status}`);
      }

      const { error: insertError } = await supabase
        .from('messages')
        .insert({
          chat_id,
          lead_id,
          content: '🎤 Áudio',
          direction: 'outbound_manual',
          message_type: 'audio',
          is_read: true,
          workspace_id: workspace_id,
          zapi_message_id: zapiMessageId,
          delivery_status: zapiMessageId ? 'sent' : 'pending',
          metadata: {
            sentBy: 'user',
            userId: user_id || null,
            userName: user_name || 'Usuário',
            instanceId: zapiInstanceId,
            duration: audio_duration || 0,
            audioBase64Sent: false,
            audioUrlSent: true,
            audioMimeType: mimeType,
            audioBytes: audioBytes.byteLength,
            audioStoragePath: objectPath,
            mediaUrl: audioUrl,
          }
        });

      if (insertError) {
        console.error('Error saving audio message:', insertError);
        throw insertError;
      }

      console.log('Audio message sent successfully');

    } else if (isImageMessage) {
      const mimeType = normalizeMimeType(image_mime_type, 'image/jpeg');
      const ext = guessFileExtensionFromMime(mimeType);
      const objectPath = `outbound/${workspace_id}/${lead_id}/${crypto.randomUUID()}.${ext}`;

      const imageBytes = base64ToUint8Array(normalizedImageBase64);

      console.log('[manual-inbox] Uploading image to storage', {
        mimeType_received: image_mime_type,
        mimeType_used: mimeType,
        bytes_len: imageBytes.byteLength,
        objectPath,
        chat_id,
        lead_id,
        workspace_id,
        hasCaption: !!image_caption,
      });

      const imageArrayBuffer = imageBytes.buffer.slice(
        imageBytes.byteOffset,
        imageBytes.byteOffset + imageBytes.byteLength
      ) as ArrayBuffer;
      const uploadBlob = new Blob([imageArrayBuffer], { type: mimeType });
      const { error: uploadError } = await supabase.storage
        .from('whatsapp-images')
        .upload(objectPath, uploadBlob, {
          contentType: mimeType,
          upsert: false,
        });

      if (uploadError) {
        console.error('[manual-inbox] Storage upload error for image', {
          message: uploadError.message,
          objectPath,
        });
        throw new Error('Erro ao preparar upload da imagem');
      }

      const { data: signedData, error: signedError } = await supabase.storage
        .from('whatsapp-images')
        .createSignedUrl(objectPath, 60 * 30);

      if (signedError || !signedData?.signedUrl) {
        console.error('[manual-inbox] Signed URL error for image', {
          message: signedError?.message,
          objectPath,
        });
        throw new Error('Erro ao gerar link da imagem');
      }

      const imageUrl = signedData.signedUrl;

      console.log('[manual-inbox] Sending image payload', {
        mimeType_used: mimeType,
        bytes_len: imageBytes.byteLength,
        chat_id,
        lead_id,
        storagePath: objectPath,
        imageUrl_prefix: imageUrl.slice(0, 64),
        caption: image_caption?.slice(0, 50) || '',
      });

      const zapiUrl = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiInstanceToken}/send-image`;

      const zapiPayload: Record<string, unknown> = {
        phone: destinationPhone,
        image: imageUrl,
        delayTyping: 1
      };

      if (image_caption && image_caption.trim()) {
        zapiPayload.caption = image_caption.trim();
      }

      const zapiResponse = await fetch(zapiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': zapiUserToken,
        },
        body: JSON.stringify(zapiPayload),
      });

      let zapiImageMessageId: string | null = null;
      try {
        const zapiResult = await zapiResponse.clone().json();
        zapiImageMessageId = zapiResult.messageId || zapiResult.zapiMessageId || zapiResult.id || null;
        console.log('[manual-inbox] Z-API image response messageId:', zapiImageMessageId);
      } catch (e) {
        console.log('[manual-inbox] Could not parse Z-API response for image messageId');
      }

      if (!zapiResponse.ok) {
        const errorText = await zapiResponse.text();
        console.error('[manual-inbox] Z-API image error', {
          status: zapiResponse.status,
          body: errorText,
          mimeType_used: mimeType,
        });
        if (errorText.includes('disconnected') || errorText.includes('Enqueue message is disabled')) {
          throw new Error('WhatsApp desconectado. Por favor, reconecte sua instância na página Conexões.');
        }
        throw new Error(`Erro ao enviar imagem: ${zapiResponse.status}`);
      }

      const messageContent = image_caption?.trim() || '📷 Imagem';

      const { error: insertError } = await supabase
        .from('messages')
        .insert({
          chat_id,
          lead_id,
          content: messageContent,
          direction: 'outbound_manual',
          message_type: 'image',
          is_read: true,
          workspace_id: workspace_id,
          zapi_message_id: zapiImageMessageId,
          delivery_status: zapiImageMessageId ? 'sent' : 'pending',
          metadata: {
            sentBy: 'user',
            userId: user_id || null,
            userName: user_name || 'Usuário',
            instanceId: zapiInstanceId,
            imageMimeType: mimeType,
            imageBytes: imageBytes.byteLength,
            imageStoragePath: objectPath,
            caption: image_caption?.trim() || null,
            mediaUrl: imageUrl,
          }
        });

      if (insertError) {
        console.error('Error saving image message:', insertError);
        throw insertError;
      }

      console.log('Image message sent successfully');

    } else if (isDocumentMessage) {
      const mimeType = normalizeMimeType(document_mime_type, 'application/octet-stream');
      const ext = document_extension || guessFileExtensionFromMime(mimeType);
      const objectPath = `outbound/${workspace_id}/${lead_id}/${crypto.randomUUID()}.${ext}`;

      const documentBytes = base64ToUint8Array(normalizedDocumentBase64);
      const fileName = document_file_name || `documento.${ext}`;

      console.log('[manual-inbox] Uploading document to storage', {
        mimeType_received: document_mime_type,
        mimeType_used: mimeType,
        bytes_len: documentBytes.byteLength,
        objectPath,
        fileName,
        chat_id,
        lead_id,
        workspace_id,
        hasCaption: !!document_caption,
      });

      const documentArrayBuffer = documentBytes.buffer.slice(
        documentBytes.byteOffset,
        documentBytes.byteOffset + documentBytes.byteLength
      ) as ArrayBuffer;
      const uploadBlob = new Blob([documentArrayBuffer], { type: mimeType });
      const { error: uploadError } = await supabase.storage
        .from('whatsapp-documents')
        .upload(objectPath, uploadBlob, {
          contentType: mimeType,
          upsert: false,
        });

      if (uploadError) {
        console.error('[manual-inbox] Storage upload error for document', {
          message: uploadError.message,
          objectPath,
        });
        throw new Error('Erro ao preparar upload do documento');
      }

      const { data: signedData, error: signedError } = await supabase.storage
        .from('whatsapp-documents')
        .createSignedUrl(objectPath, 60 * 30);

      if (signedError || !signedData?.signedUrl) {
        console.error('[manual-inbox] Signed URL error for document', {
          message: signedError?.message,
          objectPath,
        });
        throw new Error('Erro ao gerar link do documento');
      }

      const documentUrl = signedData.signedUrl;

      console.log('[manual-inbox] Sending document payload', {
        mimeType_used: mimeType,
        bytes_len: documentBytes.byteLength,
        chat_id,
        lead_id,
        storagePath: objectPath,
        documentUrl_prefix: documentUrl.slice(0, 64),
        fileName,
        caption: document_caption?.slice(0, 50) || '',
      });

      const zapiUrl = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiInstanceToken}/send-document/${ext}`;

      const zapiPayload: Record<string, unknown> = {
        phone: destinationPhone,
        document: documentUrl,
        fileName: fileName,
        delayTyping: 1
      };

      if (document_caption && document_caption.trim()) {
        zapiPayload.caption = document_caption.trim();
      }

      const zapiResponse = await fetch(zapiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': zapiUserToken,
        },
        body: JSON.stringify(zapiPayload),
      });

      let zapiDocumentMessageId: string | null = null;
      try {
        const zapiResult = await zapiResponse.clone().json();
        zapiDocumentMessageId = zapiResult.messageId || zapiResult.zapiMessageId || zapiResult.id || null;
        console.log('[manual-inbox] Z-API document response messageId:', zapiDocumentMessageId);
      } catch (e) {
        console.log('[manual-inbox] Could not parse Z-API response for document messageId');
      }

      if (!zapiResponse.ok) {
        const errorText = await zapiResponse.text();
        console.error('[manual-inbox] Z-API document error', {
          status: zapiResponse.status,
          body: errorText,
          mimeType_used: mimeType,
        });
        if (errorText.includes('disconnected') || errorText.includes('Enqueue message is disabled')) {
          throw new Error('WhatsApp desconectado. Por favor, reconecte sua instância na página Conexões.');
        }
        throw new Error(`Erro ao enviar documento: ${zapiResponse.status}`);
      }

      const messageContent = fileName;

      const { error: insertError } = await supabase
        .from('messages')
        .insert({
          chat_id,
          lead_id,
          content: messageContent,
          direction: 'outbound_manual',
          message_type: 'document',
          is_read: true,
          workspace_id: workspace_id,
          zapi_message_id: zapiDocumentMessageId,
          delivery_status: zapiDocumentMessageId ? 'sent' : 'pending',
          metadata: {
            sentBy: 'user',
            userId: user_id || null,
            userName: user_name || 'Usuário',
            instanceId: zapiInstanceId,
            documentMimeType: mimeType,
            documentBytes: documentBytes.byteLength,
            documentStoragePath: objectPath,
            fileName: fileName,
            caption: document_caption?.trim() || null,
            mediaUrl: documentUrl,
          }
        });

      if (insertError) {
        console.error('Error saving document message:', insertError);
        throw insertError;
      }

      console.log('Document message sent successfully');

    } else {
      const messageParts = [];
      if (message.length <= MAX_MESSAGE_LENGTH) {
        messageParts.push(message);
      } else {
        for (let i = 0; i < message.length; i += MAX_MESSAGE_LENGTH) {
          messageParts.push(message.substring(i, i + MAX_MESSAGE_LENGTH));
        }
      }

      for (let i = 0; i < messageParts.length; i++) {
        const part = messageParts[i];

        const zapiUrl = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiInstanceToken}/send-text`;

        const zapiResponse = await fetch(zapiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'client-token': zapiUserToken,
          },
          body: JSON.stringify({
            phone: destinationPhone,
            message: part,
            delayTyping: 1,
            ...(quoted_message_id && i === 0 ? { messageId: quoted_message_id } : {})
          }),
        });

        try {
          const zapiResult = await zapiResponse.clone().json();
          zapiMessageId = zapiResult.messageId || zapiResult.zapiMessageId || zapiResult.id || null;
          console.log('[manual-inbox] Z-API response messageId:', zapiMessageId);
        } catch (e) {
          console.log('[manual-inbox] Could not parse Z-API response for messageId');
        }

        if (!zapiResponse.ok) {
          const errorText = await zapiResponse.text();
          if (errorText.includes('disconnected') || errorText.includes('Enqueue message is disabled')) {
            throw new Error('WhatsApp desconectado. Por favor, reconecte sua instância na página Conexões.');
          }
          throw new Error(`Erro ao enviar mensagem: ${zapiResponse.status}`);
        }

        const direction = 'outbound_manual';
        console.log('Saving message with direction:', direction);

        const { error: insertError } = await supabase
          .from('messages')
          .insert({
            chat_id,
            lead_id,
            content: part,
            direction: direction,
            message_type: 'text',
            is_read: true,
            workspace_id: workspace_id,
            zapi_message_id: zapiMessageId,
            delivery_status: zapiMessageId ? 'sent' : 'pending',
            metadata: {
              sentBy: 'user',
              userId: user_id || null,
              userName: user_name || 'Usuário',
              instanceId: zapiInstanceId,
              ...(quoted_message_id && i === 0 ? { quotedMessageId: quoted_message_id } : {})
            }
          });

        if (insertError) {
          console.error('Error saving message:', insertError);
          throw insertError;
        }

        console.log(`Sent message part ${i + 1}/${messageParts.length}`);

        if (i < messageParts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, TYPING_DELAY_MS));
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      is_audio: isAudioMessage,
      is_image: isImageMessage,
      is_document: isDocumentMessage,
      lead_id: lead_id,
      lead_created: !providedLeadId && lead_id ? true : false
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in manual-inbox:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
