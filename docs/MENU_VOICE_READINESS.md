# Menu and Voice Workflow Readiness

## Included changes

- Bulk menu import now writes the validated batch to the same persistence source used by normal menu creation: local demo storage for local demo users, or Supabase for authenticated users.
- Bulk import no longer reports success after writing only to browser storage when the account is connected to Supabase.
- Menu deletion is tenant-scoped by both item ID and owner ID, and the UI only removes the item after the database confirms the delete.
- Menu deletion no longer falls back to a local test buffer or reports success when the remote delete fails.
- AI-only sample seeding is performed as one checked batch insert for Supabase accounts; a failed insert is surfaced rather than silently creating a browser-only copy.
- Voice selection is persisted to merchant_settings before the UI confirms that the voice was published. Database failures are shown to the user.

## Still required

- Verify the menu import, edit, delete, category, and QR guest-view flows in a real staging Supabase project.
- Confirm merchant_settings and menu_items RLS policies with two separate merchant accounts.
- Confirm the configured Gemini server key and voice preview API on the deployed environment.
- Review CSV/JSON imports using the restaurant's actual export format before importing a full production catalog.
