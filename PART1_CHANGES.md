# QR-ATT - Part I (Individual Final Project): What was added

## 0. SETUP (do this first)
1. Supabase Dashboard -> **SQL Editor** -> paste all of `supabase/part1_migration.sql` -> **Run**
   (safe to run many times; it upgrades your existing tables).
2. Register an account in the app, then make it the first **admin** (SQL Editor):
   ```sql
   update public.profiles set role = 'admin' where email = 'your-admin@email.com';
   ```
3. Restart Expo: `npx expo start -c`, then log out and log in again.

## 1. Requirement checklist
| Requirement | Where |
|---|---|
| 3 roles: Student / Teacher / Administrator | `profiles.role`, role-aware tabs in `app/(tabs)/_layout.tsx` |
| Login, Register, Logout, Session, Password protection | `lib/auth.ts`, `app/login.tsx`, `app/register.tsx`, `app/(tabs)/profile.tsx` |
| Student: profile, available events, scan, history | `profile.tsx`, `events.tsx`, `scan.tsx`, `history.tsx` |
| Teacher: create / manage events, QR, monitor attendance, summaries | `events.tsx`, `app/event/form.tsx`, `app/event/[id].tsx`, `history.tsx` |
| Admin: manage users / events, all attendance, correct records, reports | `app/(tabs)/admin.tsx` (Overview, Users, Attendance, Logs) |
| Event fields: name, date, time, venue, description, status | `events` table + `app/event/form.tsx` |
| Create / Edit / View / Close event | `lib/events.ts` (+ reopen, admin delete) |
| Prevent duplicate / closed event / invalid QR / unauthorized | `lib/attendance.ts` `registerAttendance` **and** RLS policy |
| Attendance record: student, event, date, time, status | `attendance` table (`status` column added) |
| DB: Users, Profiles, Events, Attendance (+relations) | see section 3 |
| Security + RLS | see section 4 |
| UI feedback: loading, success, error, empty, invalid QR, duplicate, unauthorized, closed | `components/StateView.tsx`, `scan.tsx` result card |

## 2. Event -> Handler -> Action -> Result (for your defense)
| # | Event | Handler | Action | Result |
|---|---|---|---|---|
| 1 | User presses **Sign In** | `handleLogin` (login.tsx) | validate input -> `signIn()` -> load profile | Home screen for the user's role, or error message |
| 2 | QR scanner **detects a QR** | `handleBarcodeScanned` (scan.tsx) | lock scanner -> `registerAttendance()` | Success / error card |
| 3 | **Invalid QR** detected | `parseQRPayload` / event lookup | reject before any insert | "Invalid QR code" / "does not match any event" |
| 4 | **Duplicate** attendance | Postgres unique `(student_id,event_id)` -> code `23505` | caught in `registerAttendance` | "You already recorded attendance" |
| 5 | **Event created** (Save pressed) | `handleSave` (event/form.tsx) | `validateEventForm` -> `createEvent` -> audit log | New event + QR page |
| 6 | **Event status changes** (Close/Reopen) | `toggleStatus` (event/[id].tsx) | `setEventStatus` | Badge updates; scans are refused for closed events |
| 7 | Admin **corrects attendance** | `changeStatus` / `correct` | `updateAttendanceStatus` + audit log | Record updated, list refreshed |
| 8 | **Data refreshed** (screen focus / pull-down) | `useFocusEffect` + `RefreshControl` | re-query Supabase | Latest data shown |
| 9 | User presses **Logout** | `handleSignOut` (profile.tsx) | `signOut()` clears global store | Redirect to Login |
| 10 | **Auth state changes** | pub/sub in `lib/auth.ts` (`notify`) | every `useAuth()` re-renders | Tabs hide/show per role; no user -> `<Redirect href="/login">` |

## 3. Database (Postgres on Supabase)
- `auth.users` (Supabase Auth, passwords are hashed - never stored by the app)
- `profiles` (1:1 with auth.users): full_name, role (`student|teacher|admin`), id_number, department, is_active
- `events`: event_code (unique, printed in QR), title, description, venue, start_time, end_time, **status** (`open|closed`), created_by -> auth.users
- `attendance`: student_id -> auth.users, event_id -> events, scanned_at, **status** (`present|late|absent|excused`), `UNIQUE(student_id, event_id)`
- `audit_logs`: actor_id, action, target_type, target_id, details (admin "system records")

Relationships: profiles 1-1 users; events N-1 creator; attendance N-1 student and N-1 event.

## 4. Security
- **Authentication**: Supabase Auth (email + password, min 8 chars with letter+number).
- **Authorization (RBAC)**: role stored in `profiles`; `get_my_role()` / `is_admin()` used inside RLS.
- **No role escalation**: DB trigger `protect_profile_privileges` blocks non-admins from changing role / is_active. Sign-up can only choose student or teacher.
- **RLS highlights**: only teacher/admin can INSERT events; only the owner (or admin) can UPDATE; only admin can DELETE.
  Students can INSERT attendance only for themselves, only while the event is `open` and inside its time window (**checked by the database**, not just the app).
- **QR cannot be forged to create events** - the QR only carries the event code; the app always re-reads the event from the DB.
- **Input validation**: `lib/validation.ts` (email, password, names, event form, code format, time order).
- **Secrets**: `.env` is git-ignored; `.env.example` now has placeholders only. No service-role key in the app.
- **Deactivated users** cannot log in and lose all role permissions.

## 5. Known limitations (be ready to explain)
- Session is not restored after a full app restart (documented in your Phase 2 notes) - user logs in again.
- Teacher self-selects the role at registration (needed for demo). In production an admin would approve teachers.
- Part II features (late detection, rotating QR, offline mode, analytics, notifications) are intentionally NOT included.

## 6. Quick test script
1. Register teacher + student + (promote) admin.  2. Teacher: New Event -> QR shows.
3. Student: Events tab shows it -> Scan tab -> success.  4. Scan again -> duplicate message.
5. Teacher: Close Event -> student scan -> "closed" message.  6. Teacher sees attendee + counts.
7. Admin: Users tab (change role / deactivate), Attendance tab (correct / delete), Logs tab.
8. Student opens Admin/Manage routes -> hidden / "Administrators only".
