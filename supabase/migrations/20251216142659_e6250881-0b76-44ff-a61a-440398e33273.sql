-- Aumentar o limite do campo phone para suportar formatos maiores do WhatsApp (chatLid)
ALTER TABLE leads ALTER COLUMN phone TYPE varchar(100);