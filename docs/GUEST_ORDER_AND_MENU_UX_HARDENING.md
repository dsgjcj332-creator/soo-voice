# Guest ordering, kitchen completion and menu UX hardening

This change prioritizes the guest ordering journey and the merchant-facing menu experience.

## Guest checkout
The guest browser sends only catalog item IDs and quantities to `POST /api/store/orders`.
The trusted server validates the request, enforces rate limits, and calls
`create_guest_order` so catalog prices are reloaded from the database and the
order plus `order.created` outbox event are committed together.

Required server environment:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ORDER_TOKEN_SECRET` (at least 32 characters)

The Vercel handlers use ESM-safe `node:crypto` imports for token derivation and
tracking-token verification.

## Voice order lifecycle
- `add_to_cart` only adds the catalog item to the active cart.
- The assistant asks whether the guest wants anything else.
- `place_order` is exposed only on the store page and only submits after an
  explicit guest confirmation.
- The assistant reports success only after the secure checkout endpoint returns
  a created order. A failure is returned to the model and shown in the cart.

The outbox row is an internal durable kitchen event. It is not proof that an
external POS accepted an order; an active provider adapter and delivery worker
are still required for that.

## Kitchen completion tile
The third overview tile counts orders completed during the current local day.
Kitchen status transitions set `orders.completedAt` in epoch milliseconds.
The dashboard queues realtime events while the first SELECT is in flight, so a
slow initial load cannot overwrite a kitchen status update.

If the timestamp migration has not been applied yet, the kitchen still updates
the status using a compatibility fallback and shows a warning. The overview
temporarily falls back to the order creation timestamp until the migration is
applied.

## Menu appearance and currency
The designer saves optional `customAccentColor`, `customCardColor` and
`customButtonColor` values in `menu_customizer`. Empty values preserve the
selected theme preset. Currency is intentionally not stored in the designer:
merchant Settings is the single source of truth for the public menu, voice
assistant and invoice.

The restaurant logo URL in Store Settings takes precedence over the emoji
fallback in the guest menu and invoice.

## Database migration order
Apply the following additions after the existing store settings and billing
migrations:

1. `sql/2026_11_30_menu_customizer_palette.sql`
2. `sql/2026_12_01_order_completion_timestamp.sql`

The palette migration safely no-ops when the optional `menu_customizer` table
is absent from an isolated test database. Production merchants should have the
table because the existing designer already reads and writes it.

## Mobile UX
Product rows render as touch-friendly cards on narrow screens. Category
management stacks fields vertically, keeps reorder controls tappable, and
reassigns products before a category can be deleted.
