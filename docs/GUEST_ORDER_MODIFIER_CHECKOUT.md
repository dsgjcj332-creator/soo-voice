# Guest checkout modifier contract

Checkout modifier format version 1 accepts each item line as:

```json
{
  "id": "menu-item-id",
  "quantity": 2,
  "modifiers": [
    {
      "groupId": "modifier-group-uuid",
      "optionIds": ["modifier-option-uuid"]
    }
  ]
}
```

The browser never submits authoritative option labels or prices. The checkout API validates UUIDs, duplicate groups/options, and request shape. The database then checks that each group is active and belongs to the ordered menu item and merchant, enforces required/minimum/maximum selection counts, verifies every option is active and belongs to its group, and reads each option's current price delta.

The database snapshots the selected option IDs, names, group names, price deltas, base item price, and final unit price into the order items JSON. The same snapshot is included in the durable `order.created` outbox payload for POS dispatch.

Different configurations of the same product are distinct cart/order lines. Repeating the exact same product + modifier configuration in a request is rejected. Idempotency hashes include canonicalized modifier IDs and order notes.

This PR is stacked on the structured modifier schema PR. Merge the schema foundation first, then this checkout validation layer. It does not yet add the guest selection UI or merchant editor.
