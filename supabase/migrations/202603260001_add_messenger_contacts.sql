CREATE TABLE IF NOT EXISTS messenger_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meta_page_id TEXT NOT NULL,
    sender_psid TEXT NOT NULL,
    sender_name TEXT,
    sender_name_normalized TEXT,
    last_message_text TEXT,
    last_message_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (meta_page_id, sender_psid)
);

CREATE INDEX IF NOT EXISTS idx_messenger_contacts_page_name
    ON messenger_contacts (meta_page_id, sender_name_normalized);

CREATE TRIGGER update_messenger_contacts_updated_at
BEFORE UPDATE ON messenger_contacts
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();
