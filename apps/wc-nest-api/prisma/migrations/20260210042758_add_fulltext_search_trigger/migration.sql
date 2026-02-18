-- Add trigger function to auto-update search_vector from content field
-- This enables full-text search on messages using PostgreSQL's tsvector

-- Create the trigger function
CREATE OR REPLACE FUNCTION messages_search_vector_update() RETURNS trigger AS $$
BEGIN
  -- Update search_vector using English language configuration
  -- Combines content field for full-text search
  NEW.search_vector := to_tsvector('english', COALESCE(NEW.content, ''));
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update search_vector on INSERT or UPDATE
CREATE TRIGGER messages_search_vector_trigger
BEFORE INSERT OR UPDATE OF content ON messages
FOR EACH ROW EXECUTE FUNCTION messages_search_vector_update();

-- Update existing messages to populate search_vector
UPDATE messages SET search_vector = to_tsvector('english', COALESCE(content, ''));

