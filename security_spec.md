# PickleConnect Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **PII & 2FA Isolation**: TOTP secrets, recovery codes, and notification preferences live strictly under `/users/{userId}/private/{docId}` and are readable/writable only by `request.auth.uid == userId`. Public `/athletes/{athleteId}` never stores emails, phones, or secrets.
2. **Ownership & Identity Integrity**: Every created document verifies `ownerUid` / `organizerUid` / `authorUid` / `senderUid` / `athleteUid` / `fromUid` strictly equals `request.auth.uid`, and rejects immutable field mutation on update.
3. **Terminal State Locking**: Once a `match` reaches `status == 'completed'`, non-admin users cannot alter scores or winner. Once a `registration` reaches `paymentStatus == 'verified'`, athletes cannot mutate payment status or amount.
4. **Strict Keys & Volumetric Bounds**: All writes validate `hasAll` + `hasOnly` (on create) and `affectedKeys().hasOnly(...)` (on update), enforce `.size()` on every string/array, and validate path IDs with `^[a-zA-Z0-9_\-]+$`.
5. **Temporal Integrity**: `createdAt` on create and `updatedAt` on update must equal `request.time`.
6. **Secure List Queries**: No blanket `allow list: if isSignedIn();` rules exist; private collections enforce `resource.data.<ownerField> == request.auth.uid` and public athletic directories enforce `resource.data.visibility == 'public'`.

## 2. The "Dirty Dozen" Adversarial Payloads (Must All Return PERMISSION_DENIED)
1. **PII / 2FA Theft**: User B reads `/users/userA/private/security` -> DENIED.
2. **Identity Spoofing on Create**: User B creates `/communityPosts/p1` with `authorUid: "userA"` -> DENIED.
3. **Shadow Field Injection**: User A creates `/athletes/userA` with extra field `isAdmin: true` -> DENIED.
4. **Immutable Field Tampering**: User A updates `/tournaments/t1` changing `organizerUid` or `createdAt` -> DENIED.
5. **Terminal Match Score Tampering**: Non-admin updates `/matches/m1` after `status == 'completed'` -> DENIED.
6. **Self-Verifying Payment Fraud**: Athlete sets `paymentStatus: 'verified'` on create or updates `paymentStatus` to `'verified'` without being organizer/admin -> DENIED.
7. **ID Poisoning**: Creating `/tournaments/../../../evil` or 200-char ID -> DENIED (`isValidId`).
8. **Denial of Wallet Payload**: Posting a 50KB `content` string into `/communityPosts` -> DENIED (`size() <= 1000`).
9. **Client Timestamp Forgery**: Creating a chat message with backdated `createdAt` != `request.time` -> DENIED.
10. **Cross-User Notification Scraping**: User B lists `/notifications` without matching `recipientUid == request.auth.uid` -> DENIED.
11. **Cross-User Cloud Backup Read**: User B lists or reads `/cloudBackups` owned by User A -> DENIED.
12. **Unverified Admin Email Spoofing**: Token with admin email but `email_verified: false` attempts privileged update -> DENIED.
