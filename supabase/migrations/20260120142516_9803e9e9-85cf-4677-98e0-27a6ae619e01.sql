-- Update existing agents with default trigger keywords based on agent_type
-- This ensures routing works for agents that were created before this feature

UPDATE custom_templates
SET trigger_keywords = CASE agent_type
  WHEN 'sales' THEN '["preço", "valor", "comprar", "promoção", "desconto", "quanto custa", "orçamento", "pagar", "parcela"]'::jsonb
  WHEN 'support' THEN '["ajuda", "problema", "não entendi", "dúvida", "como faço", "não funciona", "explicar", "orientação"]'::jsonb
  WHEN 'scheduling' THEN '["agendar", "marcar", "horário", "consulta", "visita", "reunião", "disponibilidade", "remarcar", "cancelar"]'::jsonb
  WHEN 'financial' THEN '["boleto", "fatura", "pagamento", "2a via", "cobrança", "parcela", "vencimento", "pix", "nota fiscal"]'::jsonb
  WHEN 'technical' THEN '["erro", "bug", "travou", "não abre", "configurar", "instalar", "atualizar", "técnico", "sistema"]'::jsonb
  ELSE trigger_keywords
END,
trigger_intents = CASE agent_type
  WHEN 'sales' THEN '["interesse em compra", "pedido de orçamento", "dúvida sobre produto", "negociação"]'::jsonb
  WHEN 'support' THEN '["pedido de ajuda", "reclamação", "dúvida operacional", "confusão"]'::jsonb
  WHEN 'scheduling' THEN '["desejo de agendar", "verificar disponibilidade", "remarcar", "cancelar agendamento"]'::jsonb
  WHEN 'financial' THEN '["dúvida financeira", "problema com pagamento", "renegociação", "segunda via"]'::jsonb
  WHEN 'technical' THEN '["problema técnico", "dúvida de uso", "configuração", "instalação"]'::jsonb
  ELSE trigger_intents
END
WHERE (trigger_keywords IS NULL OR trigger_keywords = '[]'::jsonb)
  AND agent_type IS NOT NULL
  AND agent_type != 'general';