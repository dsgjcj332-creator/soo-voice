# Menu modifiers foundation

The modifier foundation introduces merchant-owned option groups for each menu item.

- A group can be required or optional and has explicit minimum/maximum selections.
- Options have canonical server-side price deltas; clients must submit option IDs, never trusted prices.
- Options are tenant-bound to their parent group. Row-level security prevents cross-merchant writes.
- Public guests can read only active groups/options. Merchants can manage groups only for menu items they own.

Migration: `sql/2026_12_05_menu_item_modifiers.sql`.

This is the data-model/security foundation only. Guest UI, cart-line identity, voice tool schemas, and server-side checkout pricing/selection validation are deliberately separate follow-up work; do not enable modifier selection in checkout until that validation layer is deployed.
