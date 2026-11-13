# Connect the FounderDNA community

The community page is at `community.html`. It is a clearly labeled local preview until configured. Preview posts and replies are stored only in the visitor's browser, are never uploaded, and are not automatically migrated to the public feed.

## Activate with Supabase's free plan

1. Create a project at https://supabase.com/dashboard. A free project is sufficient to start; check the current free-plan quotas and email delivery limits in the dashboard.
2. Open **SQL Editor**, paste `supabase/community.sql`, and run it once. This creates public-read tables with authenticated, owner-only writes and deletes, server timestamps, and submission rate limits. It does not expose the auth users table or email addresses.
3. Under **Authentication → URL Configuration**, set the Site URL to `https://jfuix.github.io/FounderDNA/` and add `https://jfuix.github.io/FounderDNA/community.html` as an allowed redirect URL. Use your actual domain instead if you have one. Keep email confirmation enabled and enable the Email provider.
4. In **Project Settings → API** (or the project's Connect dialog), copy the project URL and the **publishable** key into `community-config.js`. A legacy `anon` key also works. These are browser-public settings; never use a `service_role` or secret key. Commit this file to the repository.
5. Wait for GitHub Pages to deploy. Open Community, sign in through the email link, and publish a milestone. Open a second browser to confirm the post is public. Sign in as another user and reply. Verify the second user cannot delete the first user's post, while each user can delete their own content.

Built-in Supabase email delivery is limited and intended for testing. Before a broader launch, configure SMTP in Supabase for reliable sign-in delivery and review the project's current auth limits. No paid plan is necessary to test the page.

## Behavior

- Anyone can read the feed and replies. Confirmed sign-in is required to post or reply.
- Names and business names are self-described, not verified identities. Email is never included in public content.
- Posts support six milestone types and up to 2,000 characters; replies allow up to 1,000 characters.
- The feed loads 30 posts at a time. Search and category filters apply to loaded posts; use Load more to include older posts. Refresh retrieves new posts and replies reload when their conversation is opened.
- Owners can delete their own posts and replies. Deleting a post also deletes its replies.
- Public posts can be moderated by the project owner in the Supabase Table Editor. There is no in-app admin dashboard or private messaging in this version.
- HTML in posts is rendered as text. The database checks ownership and field sizes independently of the browser.

## Validation before launch

Test sign-in and link redirects, public reads from a second session, post and reply creation, ownership restrictions with two accounts, and error recovery. The frontend preview can be tested without Supabase. The authenticated public flow requires the configured project and has not been verified against a live database by this change.
