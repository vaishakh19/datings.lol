## Summary

<!-- One sentence on what the PR changes and why. -->

## Hard-rule checklist

- [ ] No changes weaken Dodo TEST MODE enforcement (no live path, no `DODO_PAYMENTS_BASE_URL`, no key-prefix looseness, no webhook-signature/idempotency/ordering/quarantine weakening).
- [ ] No secrets logged or committed; `.env` untouched; `.env.example` updated if variables were added.
- [ ] All entitlement/quota decisions remain server-side; client `isPro` / localStorage treated as UI hint only.
- [ ] No edits to existing Supabase migrations; new schema change is in a new timestamped additive migration (if applicable).
- [ ] `npm run verify` passes locally: lint, tests, build.

## Tests

- [ ] Added/updated tests for the change (or justified why not).
- [ ] `npm test` passes.

## Manual verification

<!-- Include the exact commands or reproduction steps. -->

## Risk / rollback notes

<!-- Anything risky, feature-flagged, or requiring special env config? -->
