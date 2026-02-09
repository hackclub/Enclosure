# Enclosure

 
## Importing shop items from Rails

You can import shop items from a Rails JSON endpoint using the script `scripts/import_shop_items_from_rails.mjs`.

Example:

```bash
SOURCE_URL="https://rails.example.com/api/shop_items" \
SOURCE_TOKEN="railsBearerTokenIfNeeded" \
BACKEND_URL="http://localhost:4000" \
BACKEND_TOKEN="<admin-identity-token>" \
node scripts/import_shop_items_from_rails.mjs
```

The script maps common fields (`title`, `description`, `image_url`, `url`) to this app's `shop_items` schema and POSTs each item to `/api/shop-items`.

