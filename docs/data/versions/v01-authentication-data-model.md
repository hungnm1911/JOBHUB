
# V1 — Authentication Data Model

## 1. Purpose

This document defines the canonical persistence model required to support:

`docs/product/versions/v01-account-authentication.md`

It describes the data required by V1 without defining HTTP endpoints,
controllers, services, routes, or application workflow implementation.

The V1 persistence model consists of three collections:

- `users`
- `auth_sessions`
- `auth_tokens`

Relations:

```text
User
├── 1 — N AuthSession
└── 1 — N AuthToken
````

---

# 2. User

## Responsibility

`User` stores the platform account identity, credentials, platform role,
account status, email-verification state, and minimal account-level personal information.

It does not replace Candidate Profile, CV, Company, or later recruitment-domain data.

## Fields

| Field                | Required | Purpose                                                  |
| -------------------- | -------- | -------------------------------------------------------- |
| `fullName`           | Yes      | Name used to identify and display the user               |
| `avatarUrl`          | No       | Account avatar                                           |
| `dateOfBirth`        | No       | Date of birth                                            |
| `phoneNumber`        | No       | Personal phone number                                    |
| `email`              | Yes      | Unique login identifier                                  |
| `passwordHash`       | Yes      | Hashed account password                                  |
| `role`               | Yes      | Platform account role                                    |
| `status`             | Yes      | Account access status                                    |
| `emailVerifiedAt`    | No       | Time at which the email was verified                     |
| `mustChangePassword` | Yes      | Whether a later workflow requires forced password change |
| `createdAt`          | Yes      | Creation timestamp                                       |
| `updatedAt`          | Yes      | Last update timestamp                                    |

---

## 2.1. User role

Canonical values:

```text
CANDIDATE
COMPANY_MANAGER
PLATFORM_ADMIN
```

The role represents the platform account type.

The role is not selected by Candidate during Candidate registration.

---

## 2.2. User status

Canonical values:

```text
ACTIVE
LOCKED
TERMINATED
```

### ACTIVE

The account is not locked or terminated.

### LOCKED

The account is currently denied access.

### TERMINATED

Platform access for the account has been terminated.

Account status does not represent email verification.

---

## 2.3. Email verification state

Email verification is represented independently from account status.

```text
emailVerifiedAt = null
→ email is not verified

emailVerifiedAt = timestamp
→ email is verified
```

Therefore an account may be:

```text
emailVerifiedAt != null
status = LOCKED
```

without contradiction.

No separate `PENDING_EMAIL_VERIFICATION` account status is required in V1.

---

## 2.4. Login identity

`email` is the unique login identifier.

`phoneNumber` is not a login identifier and is not required to be unique in V1.

---

## 2.5. Password storage

The persisted password value is:

```text
passwordHash
```

The plaintext password must not be persisted.

The exact hashing implementation belongs to application implementation/configuration,
not to this data contract.

---

## 2.6. mustChangePassword

The field exists in the account data model for compatibility with later account flows.

For V1 Candidate self-registration:

```text
mustChangePassword = false
```

V1 defines no forced-password-change business workflow.

---

## 2.7. Explicitly excluded User data

The V1 User model does not own:

* address;
* gender;
* skills;
* experience;
* Candidate Profile;
* CV identifiers;
* Company ownership.

Those concepts belong to later product versions.

---

# 3. AuthSession

## Responsibility

`AuthSession` represents one login session belonging to one User.

A User may have multiple concurrent AuthSession records.

Each successful login creates a separate session.

---

## Fields

| Field              | Required | Purpose                                         |
| ------------------ | -------- | ----------------------------------------------- |
| `userId`           | Yes      | User owning the session                         |
| `refreshTokenHash` | Yes      | Stored hash representing the refresh credential |
| `expiresAt`        | Yes      | Session expiration time                         |
| `createdAt`        | Yes      | Session creation time                           |

---

## 3.1. Relationship

```text
User 1 ---- N AuthSession
```

Every AuthSession belongs to exactly one User.

---

## 3.2. Session expiration

Each session has an expiration time:

```text
expiresAt
```

An expired session must no longer be usable.

Expired AuthSession records may be automatically removed by the persistence layer.

---

## 3.3. Session revocation representation

V1 does not persist:

```text
revokedAt
revokeReason
session revocation history
```

Revoking a session is represented by removing the AuthSession record.

Therefore:

```text
AuthSession exists
→ session may still be valid subject to other checks

AuthSession does not exist
→ session is not valid
```

---

## 3.4. Current-session revocation

Logout revokes only the current session.

Conceptually:

```text
delete AuthSession
where:
  session belongs to current User
  AND
  session is the current session
```

Other sessions belonging to the same User remain unaffected.

---

## 3.5. All-session revocation

The following V1 events revoke every session belonging to the User:

* successful Password Reset;
* account becomes `LOCKED`;
* account becomes `TERMINATED`.

Conceptually:

```text
remove all AuthSession records belonging to User
```

---

## 3.6. Access dependency

Access authorization is associated with a specific AuthSession.

If that AuthSession no longer exists or is no longer valid:

* access associated with that session must not continue to be accepted;
* refresh must not produce new access.

The exact JWT payload and verification implementation are outside this data contract.

---

# 4. AuthToken

## Responsibility

`AuthToken` represents a temporary, expiring, one-time authentication request.

V1 uses AuthToken for:

```text
EMAIL_VERIFICATION
PASSWORD_RESET
```

---

## Fields

| Field       | Required | Purpose                                    |
| ----------- | -------- | ------------------------------------------ |
| `userId`    | Yes      | User owning the request                    |
| `type`      | Yes      | Authentication request type                |
| `tokenHash` | Yes      | Persisted hash of the authentication token |
| `expiresAt` | Yes      | Expiration time                            |
| `createdAt` | Yes      | Creation time                              |

---

## 4.1. Authentication token types

Canonical V1 values:

```text
EMAIL_VERIFICATION
PASSWORD_RESET
```

No additional AuthToken type belongs to V1 unless the canonical V1 business specification is changed.

---

## 4.2. Relationship

```text
User 1 ---- N AuthToken
```

Every AuthToken belongs to exactly one User.

---

## 4.3. Token persistence

The persisted value is:

```text
tokenHash
```

The raw authentication token must not be persisted as the canonical stored value.

The hashing algorithm belongs to implementation/configuration rather than this data contract.

---

## 4.4. Expiration

Every AuthToken has:

```text
expiresAt
```

An expired AuthToken must not be usable.

Expired records may be automatically removed by the persistence layer.

---

## 4.5. One-time use

Email Verification and Password Reset requests are one-time-use.

After successful use, the corresponding AuthToken no longer remains usable.

V1 persistence represents successful consumption by removing the corresponding AuthToken.

---

# 5. Email Verification persistence lifecycle

Conceptual data lifecycle:

```text
Candidate account created
        ↓
User.emailVerifiedAt = null
        ↓
Create EMAIL_VERIFICATION AuthToken
        ↓
User performs verification
        ↓
Validate token and expiration
        ↓
Consume AuthToken
        ↓
Set User.emailVerifiedAt
```

Successful email verification does not change:

```text
User.status
```

A User that is already `LOCKED` or `TERMINATED` remains in that account state.

---

# 6. Password Reset persistence lifecycle

When Forgot Password creates a new usable reset request:

```text
User
 ↓
invalidate/remove previous PASSWORD_RESET AuthToken(s)
 ↓
create new PASSWORD_RESET AuthToken
```

This preserves the V1 rule that a newly created reset request replaces the previous usable reset request.

Successful password reset conceptually performs:

```text
Validate and consume PASSWORD_RESET AuthToken
        ↓
Update User.passwordHash
        ↓
ensure mustChangePassword = false
        ↓
Remove all AuthSession records belonging to User
```

The User must authenticate again using the new password.

---

# 7. Collection summary

```text
users
├── fullName
├── avatarUrl
├── dateOfBirth
├── phoneNumber
├── email
├── passwordHash
├── role
├── status
├── emailVerifiedAt
├── mustChangePassword
├── createdAt
└── updatedAt

auth_sessions
├── userId
├── refreshTokenHash
├── expiresAt
└── createdAt

auth_tokens
├── userId
├── type
├── tokenHash
├── expiresAt
└── createdAt
```

---

# 8. Persistence invariants

The following invariants are canonical for V1:

1. `email` uniquely identifies a User for login.
2. Email verification state is independent from account status.
3. A User may own multiple concurrent AuthSession records.
4. Every AuthSession belongs to one User.
5. Revoking a session is represented by removing its AuthSession record.
6. Logout removes only the current AuthSession.
7. Password Reset removes all AuthSession records for the User.
8. `LOCKED` removes all AuthSession records for the User.
9. `TERMINATED` removes all AuthSession records for the User.
10. Email Verification and Password Reset use AuthToken records.
11. AuthToken records expire.
12. AuthToken records are one-time-use.
13. A new Password Reset request invalidates the previous usable Password Reset request.
14. Raw passwords, refresh credentials, and temporary authentication tokens are not the canonical persisted values; their hashes are stored instead.

---

# 9. Implementation boundary

This document defines persistence requirements and data ownership for V1.

It does not define:

* REST endpoints;
* HTTP status codes;
* controllers;
* routes;
* service interfaces;
* middleware composition;
* JWT payload shape;
* JWT signing or verification algorithms;
* hashing algorithms;
* exact MongoDB queries;
* transaction strategy;
* API response schemas.

Those decisions belong to the implementation and engineering layers.

Implementation must satisfy this data contract without changing the business behavior defined in:

`docs/product/versions/v01-account-authentication.md`
