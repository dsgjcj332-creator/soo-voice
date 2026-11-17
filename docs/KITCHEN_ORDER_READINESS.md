# Kitchen Order Reliability

## Included

- Kitchen Realtime channels are scoped to the signed-in merchant and handle INSERT, UPDATE, and DELETE events.
- Realtime events received before the initial order snapshot completes are replayed after the snapshot to reduce lost updates.
- Initial loading and silent polling are tenant-filtered and bounded to the most recent 200 orders.
- Polling skips hidden tabs and reports refresh failures instead of silently presenting stale data as current.
- Status changes are tenant-scoped, optimistic only while the request is pending, and rolled back if Supabase does not confirm the update.
- Order deletion is tenant-scoped and only removes the ticket from the screen after the database confirms deletion.
- Load and action errors are visible in the kitchen interface.

## Required staging verification

- Create a guest order through the public store flow and confirm it appears in the correct merchant kitchen.
- Confirm status changes propagate to a second open kitchen screen.
- Confirm a delete from one screen disappears from the other screen.
- Confirm merchant A cannot update or delete merchant B's order.
- Confirm behavior when Realtime disconnects and the polling fallback resumes.
- Confirm the database RLS policies still enforce tenant isolation independently of client filters.
