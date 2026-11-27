# Firestore Security Specification (`security_spec.md`)

## 1. Data Invariants & Master Source of Truth

- **Master Source of Truth**: `/users/{userId}` (document ID strictly equals `request.auth.uid`, with `request.auth.token.email_verified == true`).
- **Master Gate**: Every subcollection document under `/users/{userId}/workspaces/{workspaceId}`, `/users/{userId}/cases/{caseId}`, `/users/{userId}/journalRows/{rowId}`, `/users/{userId}/reviewRows/{reviewId}`, `/users/{userId}/records/{recordId}`, and `/users/{userId}/generatedDocs/{docId}` requires:
  1. Authenticated & verified user (`request.auth != null && request.auth.token.email_verified == true`).
  2. Path UID ownership (`request.auth.uid == userId`) AND payload ownership (`incoming().ownerId == request.auth.uid`).
  3. Parent `/users/{userId}` document exists (`exists(...) || existsAfter(...)`).
- **PII Isolation**: Raw email, phone numbers, and street addresses for the authenticated account are read from Firebase Auth in memory and are NOT persisted into Firestore documents.
- **Temporal Integrity**: `createdAt == request.time` and `updatedAt == request.time` on creation; `createdAt == existing().createdAt` and `updatedAt == request.time` on update.
- **Terminal State Locking**: In `reviewRows`, once `status == 'GENERATED'` and `generatedDocId != ''`, updates are restricted to updating `generatedPdfReady` (unless explicitly reverting/updating through allowed workflow fields without mutating immutable identity keys). Wait: let's lock `generatedDocId` once `status == 'GENERATED' && existing().generatedDocId != ''` so generated document references cannot be hijacked!

## 2. The "Dirty Dozen" Adversarial Payloads (Must All Return PERMISSION_DENIED)

1. **Unauthenticated Write**: `setDoc(doc(db, 'users/uid1/cases/c1'), { ... })` with `auth == null` -> `PERMISSION_DENIED`.
2. **Unverified Email Spoof**: Signed in with `email_verified: false` writing to `/users/uid1/workspaces/default` -> `PERMISSION_DENIED`.
3. **Cross-Tenant Read/List**: `uid2` attempting `getDoc` or `getDocs` on `/users/uid1/cases` -> `PERMISSION_DENIED`.
4. **Cross-Tenant OwnerId Spoofing**: `uid2` creating `/users/uid2/cases/c1` with `ownerId: 'uid1'` -> `PERMISSION_DENIED`.
5. **Shadow / Ghost Field Injection**: `uid1` creating `/users/uid1/cases/c1` with valid fields plus `"isAdmin": true` -> `PERMISSION_DENIED` (`keys().hasOnly(...)` blocks extra keys).
6. **Shadow Field Update**: `uid1` updating `/users/uid1/cases/c1` with `{ notes: 'ok', ghostField: 'hack' }` -> `PERMISSION_DENIED` (`affectedKeys().hasOnly(...)` blocks extra keys).
7. **Resource / ID Poisoning**: `uid1` creating `/users/uid1/journalRows/${'a'.repeat(200)}` or non-alphanumeric ID `../bad` -> `PERMISSION_DENIED` (`isValidId()` rejects >128 chars or invalid regex).
8. **Oversized String / Denial-of-Wallet Payload**: `uid1` writing `title: 'x'.repeat(2000)` on `JournalCheckRecord` (`maxLength: 500`) -> `PERMISSION_DENIED`.
9. **Type Confusion / Value Poisoning**: `uid1` updating `ReviewQueueRecord` `generatedPdfReady` to `"yes"` (string instead of boolean) or `decision` to `"CUSTOM"` -> `PERMISSION_DENIED`.
10. **Client-Forged Timestamp**: `uid1` creating `/users/uid1/records/r1` with `createdAt: new Date('2020-01-01')` instead of `serverTimestamp()` -> `PERMISSION_DENIED` (`createdAt == request.time`).
11. **Immortal Field Mutation**: `uid1` updating `/users/uid1/cases/c1` trying to mutate `ownerId` or `createdAt` or `caseId` -> `PERMISSION_DENIED`.
12. **Generated Doc Reference Hijack (Terminal Lock)**: `uid1` updating a `ReviewQueueRecord` whose `existing().status == 'GENERATED'` and `existing().generatedDocId != ''` to swap `generatedDocId` to another doc -> `PERMISSION_DENIED`.
