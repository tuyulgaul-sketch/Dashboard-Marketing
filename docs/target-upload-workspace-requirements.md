# Upload Target dan Realisasi – Workspace Continuity

User request, 8 September 2026: switching to another browser tab or window and returning must not reset Arianie's Upload Target dan Realisasi workspace to its initial tab. Preserve the selected main tab, year, filters, scroll position, and safe in-progress form state. Do not silently publish or delete data.

## Source findings
- TargetRealizationUploadPage.tsx initializes its main tab with useState('setup') and does not persist the selection.
- useTargetRealizationPublisher.ts clears the permission state and starts a fresh RPC check when its dependencies change. AuthContext.tsx reloads profile and central runtimes on auth state changes. ReleaseSyncBridge.tsx and the global-reset sync can also cause intentional full page reloads.
- Investigate and reproduce the actual focus/auth lifecycle before changing it. Do not disable legitimate session expiration, identity changes, authorization checks, directory security refresh, or required global resets just to suppress a reload.

## Acceptance criteria
1. Returning to the same browser window after switching tabs/windows preserves the current section, year, filters, scroll position and in-progress noncommitted edits. No automatic jump to the initial upload tab.
2. Main tab selection is restorable after an ordinary page reload; URL state or user-scoped session storage may be used. Do not store authentication tokens, uploaded file bytes, or sensitive customer/financial payloads in browser storage.
3. Keep already visited tab forms mounted when switching between the five workspace sections, without triggering duplicate loads or repeated publishing. Account for both the current on-screen Target Setup and the pending single Bulk Pipeline form in issue #41.
4. Distinguish a normal focus/token refresh from an actual identity change, sign-out, access revocation, or required global reset. Preserve navigation state only within the same authorized session. Real authorization loss must still block access and clear user-scoped transient state.
5. Unsaved draft state must never be mistaken for official saved data. File inputs may require re-selection after a genuine reload; show an explicit message rather than pretending the browser preserved file contents. Preserve existing server-side validation and publish confirmation.
6. Add regression tests for switching windows, switching internal tabs, reloading, back/forward navigation, same-account token refresh, account changes, permission denial, and deliberate global resets. Run relevant existing tests and a production build.
7. No database reset, no business-data mutation, no RBAC widening, and no unrelated workflow changes. Deliver together with PR #40 and issue #41 in the next permitted production release, and verify the deployed commit and production alias before declaring completion.
