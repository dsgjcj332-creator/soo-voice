# Shared Daily Checklist Readiness

The Dashboard daily execution checklist is now designed to persist per merchant
and local calendar day in `merchant_daily_tasks`.

- Authenticated merchant users can read and update only their own task rows.
- The fixed task keys are kitchen, conversations, menu, voice and connections.
- The browser keeps a local cache for fast loading and offline fallback.
- Successful cloud writes update all five task states atomically through one
  Supabase upsert request.
- Supabase Realtime updates other open devices; a 15-second polling fallback
  covers projects where the table is not in the Realtime publication.
- A cloud error is shown explicitly and the local copy is retained with a retry action.
- Demo users remain local-only and are not represented as cloud-synced.

Apply `sql/2026_11_27_merchant_daily_tasks.sql` in Staging before deploying
the updated dashboard. The current owner identity is the authenticated merchant
user ID; multi-user staff membership and role-based task attribution are a
separate follow-up once merchant team membership is implemented.
