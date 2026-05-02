# Security Specification - AutoHub (Mechora)

## Data Invariants
1. Users can only edit their own profile.
2. Only mechanics can toggle their own availability.
3. Car owners can create bookings; mechanics can update the status of bookings assigned to them.
4. SOS alerts are public for reading by authenticated mechanics, but only the creator can resolve/cancel them.
5. `role` fields are immutable after initial registration.

## The Dirty Dozen Payloads (Rejection Targets)
1. **Identity Spoofing**: Attempting to create a `user` document with a different `userId` than `request.auth.uid`.
2. **Role Escalation**: Attempting to update `role` from `owner` to `admin` in `users/{userId}`.
3. **Shadow Update**: Adding `isAdmin: true` to a user profile update.
4. **Unauthorized Read**: An unauthenticated user attempting to list `bookings`.
5. **Orphaned Booking**: Creating a booking with a non-existent `ownerId`.
6. **False Status Update**: An owner attempting to mark their own booking as `completed` (only mechanics can do this).
7. **Mechanic Impersonation**: An owner attempting to update `mechanics/{id}` availability.
8. **PII Leakage**: Authenticated user trying to read another user's private phone number without a related booking.
9. **Malicious ID**: Attempting to create a booking with a 2MB string as document ID.
10. **State Skipping**: Updating a booking status from `pending` straight to `completed` without an intermediary `accepted` state (if enforced).
11. **Time Hijacking**: Submitting a `createdAt` timestamp from 2020.
12. **Blind Querying**: Attempting to `list` all users without a `where` clause filter.

## Test Runner (Draft)
A suite of tests will be implemented to ensure `PERMISSION_DENIED` for the above scenarios.
