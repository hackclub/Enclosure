-- List all triggers on the orders table
SELECT tgname, tgtype, tgrelid::regclass, tgenabled
FROM pg_trigger
WHERE tgrelid = 'orders'::regclass;

-- Drop all triggers on orders table (repeat for each trigger found)
DROP TRIGGER IF EXISTS orders_airtable_notify ON orders;
-- Add more DROP TRIGGER lines if you find other triggers

-- Recreate a single correct trigger for AFTER INSERT only
CREATE OR REPLACE FUNCTION notify_airtable_sync()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify(
    'airtable_sync',
    json_build_object('table', TG_TABLE_NAME, 'id', NEW.id)::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_airtable_notify
AFTER INSERT ON orders
FOR EACH ROW EXECUTE FUNCTION notify_airtable_sync();

-- Now test by inserting a new order:
-- INSERT INTO orders (user_id, shop_item_id, amount, status, slack_id, created_at) VALUES ('test-user', 'test-item', 10, 'pending', 'test-slack', NOW());

-- You should see only one NOTIFY and one sync per order.
