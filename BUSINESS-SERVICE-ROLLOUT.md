# FounderDNA business-progress redesign — prepared for activation

This branch restores the service around Find Direction, Find People, and Gather Support. Community milestones are secondary. It does not fabricate experts, users, investments, or successful connections.

## Production approval required

The proposed database migration was rejected by automatic approval review because it changes production access rules and queues existing milestones for moderation. The migration has not been applied. The existing website and production tables remain unchanged.

Review `supabase/business-service.sql` before approving. Read-only production inspection found **zero milestones and zero replies** when this change was prepared. Recheck immediately before activation. No accounts or existing content are deleted by this migration; any existing milestone would become pending review rather than public.

## Concrete changes requiring approval

- Create private business requests, evolving FounderDNA context, request conversations, and introduction decisions.
- Create a private PDF storage bucket with a 2 MB limit per file and owner/reviewer access rules.
- Create a private reviewer email allowlist. Only a verified account whose email is in that table can review requests. No reviewer email is included in this public repository.
- Require explicit publication consent and human approval for milestones. Own pending items remain visible to their owners and reviewers; only approved milestones are public. Editing approved content returns it to review.
- Add an idempotent request-submission function and a reviewer-only function that copies only consented public milestone fields from a private request.

No payment processing, paid project creation, external email sending, or automatic external introductions are included.

## Activation order after approval

1. Recheck production counts and existing schema. Apply `supabase/business-service.sql` using the migration tool.
2. Privately insert the owner's supplied reviewer email into `service_private.reviewer_emails` through the database tool. Do not put it into a tracked file or public page. Membership is checked against the actual confirmed email in `auth.users`, not editable user metadata.
3. Run the database security/performance advisors and live access checks. Fix any findings related to these changes.
4. Merge/deploy this branch to GitHub Pages only after the backend is ready.
5. Verify all pages/assets return the deployed source. Sign in with the verified reviewer account at `review.html` and submit a real test request from another account to check the complete live flow. Delete only the test fixtures afterward.

## Pages and behavior

- `index.html`: the three pillars, five goals, how review works, living FounderDNA explanation, funding paths, real availability distinctions, and FAQ.
- `brief.html`: four-step questionnaire, preview/download, private review permission, optional expert PDFs, separate milestone publication choice, confirmed reference, and safe retry token.
- `requests.html`: own requests only, latest private DNA context, updates, weekly check-ins, and specific introduction approvals/declines.
- `review.html`: verified authorized reviewer queue, status updates, private document links, team responses/next actions/relevant opportunities, named introduction proposals, and milestone moderation.
- `community.html`: secondary reviewed milestone space. Public business profiles remain separate from private FounderDNA records.
- `about.html` and `privacy.html`: accurate service limits, consent, retention, private documents, and contact routes.

## Manual operating process

Check the review desk regularly; no staff email alerts or response-time guarantee is installed. Read only the context needed. Ask for details in the request conversation, save useful next actions, and keep opportunities factual. Any proposed paid service needs separate agreed terms.

Before sharing a brief externally, propose the named person/organisation, purpose, and exact information in the introduction panel. Wait for the owner to approve. A decision does not send any message automatically. Withdrawal stops future sharing but cannot recall already shared information.

Publish only the consented public milestone fields. Do not copy private contact details, private business context, or documents into public content. Expert applications stay private and are not automatically public directory listings.

## Authentication and documents

The existing email callback remains `community.html`; that page safely returns signed-in users to the allowed originating service page. Never include credentials or session tokens in a return URL. Brief drafts omit permission checkboxes and files, so those decisions are reviewed again after sign-in.

The private PDF bucket permits uploads only under the signed-in owner's folder. Reviewers can read a document only when it is referenced by a submitted request. Unused uploads are not available to reviewers. Signed download links are short-lived. A failed client upload/submission attempts to remove unused documents; the owner should occasionally remove orphan uploads. Submitted document removal and account deletion are handled manually by the project owner.

## Verification completed without production mutation

Local Postgres (PGlite) tests apply the full base, community upgrade, and proposed service schema. They verify submission/receipt, required private-review consent, private DNA updates, cross-account isolation, confirmed-email reviewer access, protected team responses, specific introduction decisions, explicit milestone opt-in, moderation and re-review, idempotent public publication, private document access, and safe request retries.

DOM interaction tests verify questionnaire validation, draft recovery through sign-in, receipt/error states, no automatic public publication, account-bound private drafts, and no upload without document permission. Source checks cover JavaScript syntax, links/assets/anchors, unique IDs, encoding, and selectors.

Visual browser testing is unavailable in this session because the managed browser tool is absent. Live service verification is pending production approval and activation.
