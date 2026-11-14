# FounderDNA

FounderDNA is a founder self-assessment and practical business-support platform. The assessment is the primary entry point; existing guided briefs, human review, collaboration requests, private progress tracking, and moderated milestones remain available.

**Live site:** https://jfuix.github.io/FounderDNA/  
**Assessment:** https://jfuix.github.io/FounderDNA/assessment.html

## Assessment
- 12 self-reflection questions covering direction, customer validation, execution, and adaptability
- Five answer choices per question, scored from 0 to 4
- Category scores and an overall percentage with actionable recommendations
- Valid zero-valued responses are handled correctly (unanswered is represented by `null`)
- No account required; responses are held in page memory, not submitted to a server
- Premium results dashboard with category meters, strengths and growth priorities, and a seven-day action plan
- Download a plain-text results report, or print/save a PDF through the browser
- Keyboard-accessible question controls and progress indicators

Scores are self-reported reflections, **not** validated psychometrics or predictions of business success.

## Existing support features
- Guided business briefs with browser-local draft saving
- Supabase email-link authentication and private request submissions
- My Progress request tracking, reviewer desk, and consent-based introductions
- Community milestones with moderation

Backend behavior and access policies must be tested in a configured environment before making guarantees about production privacy or reliability. Never commit a Supabase secret/service-role key to frontend code.

## Technology
Static HTML, CSS and JavaScript on GitHub Pages; Supabase client for existing optional support features.

## Design
Permanent dark theme: `#050505`, `#C70102`, `#C80000`, and `#FFFFFF`.

## Development and QA
1. Test assessment keyboard navigation, zero-valued answers, previous/next, completion, retake, and print.
2. Test widths 320, 390, 768, and 1440 px, plus reduced-motion settings.
3. Verify Supabase RLS, reviewer authorization, private storage and signed links with separate test accounts.
4. Verify form submission, consent, error handling, navigation, SEO and metadata.
5. Confirm GitHub Pages has published the latest `main` commit.

## Scope
The original historical question bank and scoring formula were not recoverable from the available brief. The assessment currently uses a newly authored, transparent 12-question self-reflection rubric. Replace only after confirming an approved original instrument.

## Maintainer
[JFUIX](https://github.com/JFUIX)

## QA automation

The `.github/workflows/assessment-qa.yml` workflow runs Playwright Chromium tests on relevant commits to `main`. Review the Actions run status and logs before treating the browser QA as passed. End-to-end authenticated flows require dedicated test identities and are not covered by the public assessment test suite.

## Phase 4: private assessment history

The optional **Save to my account** action uses Supabase email-link authentication and inserts into `public.assessment_results`. The table has RLS ownership checks for reading, inserting, and deleting results. Anonymous visitors can take the assessment without signing in. Results are not uploaded unless the visitor explicitly selects Save to my account. Signed-in visitors can view and delete their most recent 10 saved assessments. Saved entries include answer values, dimension percentages, and the overall reflection percentage. The My Progress page links to the assessment history.

**QA note:** After the initial browser-test failure notification, the suite was changed to serve the website via localhost instead of `file://` and to upload failure diagnostics. This is a corrective attempt, not evidence that the previous failure's cause has been confirmed or that a subsequent run has passed. Review GitHub Actions for the new result. Account sign-in, redirect and RLS isolation require live test accounts before production sign-off.
