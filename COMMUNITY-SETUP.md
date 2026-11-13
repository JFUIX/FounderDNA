# FounderDNA community

Hosted on GitHub Pages at https://jfuix.github.io/FounderDNA/ with Supabase project `hpvenojmbxsjwqeletbd`.

## Deployed features

- Public milestone feed, server-side full-text search, category filters, 30 posts per page.
- Business profiles with a public founder name, description, optional HTTPS website, and all-posts view.
- Email magic-link sign-in. Auth URL settings must allow `https://jfuix.github.io/FounderDNA/community.html`.
- Owner-only milestone edits and deletion. Post deletion cascades to replies and notifications.
- Public replies, newest first, with 50-reply pagination and owner-only deletion.
- Milestone permalinks and copy-link controls.
- Milestone and reply drafts in local browser storage, expiring after 7 days when accessed. Milestone drafts clear after publishing, explicit clearing, or signing out. No automatic draft publication.
- Private in-app notifications for replies to owned posts or conversations a user participated in. Refreshed every minute while the site is visible, or manually in the reply inbox. The inbox shows the most recent 50 notifications. No email notification delivery.
- Private content reports and account-specific hidden-member preferences. Hiding affects the member's content in your view; it does not revoke their access to public pages. Notifications are not generated between hidden members.
- Homepage displays the latest three real milestones. The private brief tool only creates a preview and a text download; it never sends a support request.
- About/contact and privacy/community-rule pages. Contact currently links to GitHub issues, which are public.

## Database setup and access

The base SQL in `supabase/community.sql` and the upgrade SQL in `supabase/community-upgrade.sql` have already been applied to the project. Do not rerun them on an initialized database. For a new project, apply base then upgrade. The database migration history retains both applied changes.

Public browser settings live in `community-config.js`. Only a Supabase publishable key belongs here. Never put a service-role key, secret API key, or management token in browser code.

Every application table has row-level security. Post/profile edits use both `USING` and `WITH CHECK` ownership policies plus column-scoped grants. Reports, blocks and notifications are private to their owners. Only the private reply trigger creates notifications for other users. It checks the authenticated actor, uses an empty search path, and cannot be invoked directly by public API roles.

The feed search uses an indexed, generated English `tsvector`. Search applies across the database before pagination. Post and reply creation have hourly rate limits; reports are also rate-limited. These are basic early-access controls, not a full anti-abuse system.

## Moderation and support

The project owner reviews `community_reports` in the Supabase dashboard Table Editor. Inspect the referenced post or reply and remove content that violates the community rules. Reports are not automatically emailed to administrators, and no guaranteed response time is advertised. Removing reported content also removes its associated reports via the foreign key.

For an account deletion request, use the Supabase Auth dashboard to remove the account once the owner's identity and request have been verified. Associated application content cascades on account deletion. Revoke sessions as appropriate; existing access tokens may remain valid until expiry. Do not post private account details in GitHub issues.

Replace the `.support-link` route in `about.html` with a public support email when the owner supplies one. The rest of the site links to About & contact rather than duplicating an address.

## Authentication

Keep email confirmation enabled. Supabase's built-in email sender has testing restrictions and rate limits. Configure an SMTP provider in Supabase before inviting a broader public audience if it is not already configured. The public integration cannot inspect or change SMTP/redirect settings through the available project tools. Do not place SMTP secrets in this repository.

## Verification

The frontend interaction checks cover draft restoration through sign-in and reload, expiry, post creation/editing, replies, profile editing, search beyond the first page, ownership controls, reports, hidden members, permalinks, safe text rendering, and error recovery. Homepage checks cover the private brief preview/download and public milestone rendering.

Live database tests use a rolled-back transaction with two simulated authenticated roles. They verify public reads, owner edits, generated full-text search, protected profiles, private reports/blocks/notifications, notification creation, mark-read, and hidden-member notification suppression. Temporary test users/content are not retained. Public REST queries verify the actual feed, reply-count relation, full-text search, and profile endpoints. Email delivery and redirects require a real inbox; the owner previously confirmed email sign-in worked.
