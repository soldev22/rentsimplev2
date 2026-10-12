# RentSimple v2

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
yarn dev
pnpm dev
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

Set `NEXT_PUBLIC_BASE_URL` to the public HTTPS address of the deployed application so links in email notifications point to the live site rather than `localhost`.

Example:

```text
NEXT_PUBLIC_BASE_URL=https://your-public-domain.example
```

## Backlog

Use [BACKLOG.md](BACKLOG.md) to track deferred work, legal/compliance follow-ups, and items to revisit.

## Public information pages

Public visitors can open About us (`/about`), Services (`/services`), Meet the team (`/team`), FAQs (`/faqs`) and Contact (`/contact`) from both the header and footer. Shared navigation, phone details and the trading address are maintained in `lib/public-config.ts`: The Crown Hub, Main Street, Thornton, KY1 4AF. The Contact page links to Google Maps without embedding a third-party map and asks visitors to arrange a time before visiting.

The team page currently introduces the team's approach and links to contact; add only verified names, roles, biographies and approved photos when available. These pages do not invent opening hours, fees, accreditations or staff profiles. Meeting buttons reuse the existing request panel; requesting a meeting is not a confirmed booking.

## Public registration types

Public signup offers Applicant, Landlord, Agent, Tenant and Builder, derived from `UserRole` through the shared registration-role labels. Global admin, User and the internal unallocated role are not selectable. Both the registration API and user creation validate the selection. All new accounts still require email verification; Applicants become approved after verification, while other roles await approval. Older callers that omit `requestedRole` retain the existing unallocated workflow.

### Internal User role

`user` is an internal platform role displayed as **User**, distinct from `admin` (**Global admin**). An Applicant registers normally and verifies their email; a Global admin can then assign User and approve access in `/dashboard/users`. Promotion requires a verified email. Approved Users land on `/dashboard/platform` and have platform-wide visibility and management of properties, applications, accounts, maintenance, cases, meeting requests, diary and audit history.

Only Global admins may assign account roles or approval, change login email through account management, require terms re-agreement, impersonate another account or reset workspace data. Users may edit other account details, assignments and notification settings. Users cannot delete or erase accounts, applications, properties, images, compliance certificates, verification/deposit documents, maintenance photos, cases, messages or invites. Document replacement, image rejection, invite decline and replacement lists that remove included items, contacts, reference requests, communications or document references are also denied server-side. Workflow activation that would promote an Applicant to Tenant must be performed by an existing authorized role, not a User; existing Landlord/Agent behavior is unchanged.

Authorization uses shared platform-management, account-role-management and deletion capabilities in `lib/auth.ts`, with resource-scope checks retained for other roles. The UI hides or disables restricted actions; server handlers and management services enforce them independently. Users cannot be created by public registration, bootstrap an administrator, or elevate through workflow role assignment.

Landlord signup stores `requestedRole: "landlord"` while the actual role remains `unallocated`, initially pending verification and then pending approval. Only explicit Global admin role assignment and approval grant Landlord access. The waiting page displays Landlord application wording and the shared contact phone. Pending Landlord applications are prioritised across Users pane pages and labelled "Landlord application".

The Landlord sales page reuses the meeting panel and adds phone/account actions at the top and bottom. Contact details are shared in `lib/public-config.ts`. Set `NEXT_PUBLIC_LANDLORD_VIDEO_URL` to an HTTPS embed URL to show the lazy responsive onboarding video; without a URL, no video slot is rendered.

On first email verification, a Landlord application's verification and notification-attempt marker are saved together using Cosmos ETag concurrency control before approved Global admin email/SMS alerts run. Repeated or concurrent verification cannot trigger duplicate alerts or downgrade an already verified account. Delivery failures are logged and do not undo verification; alerts are attempted once per account, not automatically retried.

## Landlord meeting requests

The public header and the home page hero/bottom CTA open a native modal slide-over without navigation. [/meet](app/(public)/meet/page.tsx) renders the same form for sharing. The form links to the draft [/privacy](app/(public)/privacy/page.tsx) notice; confirm the legal controller, lawful basis and retention policy before launch.

`POST /api/meeting-requests` validates the shared schema, rejects a populated `website` honeypot, and uses the existing Cosmos-backed registration rate limiter with a separate `meeting_request` action (5 attempts per IP per hour; 3 valid submissions per email per hour). Identifiers are hashed using the existing registration hash helper. Property count must be a positive safe integer; select 1-3 distinct days from Monday to Saturday. Notes are limited to 2000 characters.

Requests are stored in `meeting-requests`, partitioned by `/id`. Override the container name with `COSMOSDB_MEETING_REQUESTS_CONTAINER`. Existing Cosmos connection/identity configuration is reused. The confirmation email and approved Global admin email/SMS alerts use the existing Postmark/Twilio helpers and configuration. Each Global admin needs an email and mobile number; missing configuration/failed delivery is logged and never removes a saved request. Set `NEXT_PUBLIC_BASE_URL` so admin SMS/email links resolve to the live dashboard.

Postmark must approve the sender account before it can send to external recipient domains. A pending account can reject confirmation emails with HTTP 422 / Postmark error 412 even when its token and sender are configured. Resolve this in Postmark; do not bypass it by changing the requester address. Safe provider/status/error-code metadata is included in server logs.

Approved Global admins and Users manage requests at [/dashboard/meeting-requests](app/dashboard/meeting-requests/page.tsx), with 50 requests per page, internal notes and optimistic concurrency checks. Each status change stores an audit entry atomically in the request and mirrors it to the existing platform audit log. If the mirror fails, the dashboard reports a warning and the request's own status history remains intact. Notes/status history are internal and are not returned by the public submission endpoint.

The Global admin platform overview includes a **Meeting requests** panel with total requests, current status counts and a **Manage meeting requests** link. Counts refresh when the dashboard loads; only status fields are queried, not contact details or email content. The panel and management screen are restricted to approved Global admins.

Each meeting request has its own expandable panel. Approved Global admins can permanently delete a request after confirming; deletion includes its internal notes and embedded status history. Version checks prevent deleting a request changed since the page loaded. Deletion does not send a cancellation notification to the prospect.

### Shared Global admin diary

Approved Global admins can open `/dashboard/diary` for day, Monday-to-Sunday week and month views, date navigation and links back to individual meeting requests (including requests outside the first list page). Set a meeting date, start time and end time before confirming; location/video link is optional. Input and display use `Europe/London`, stored as UTC instants with the time zone. Invalid dates, end-before-start and ambiguous/nonexistent UK clock-change times are rejected; choose a different time around those clock changes. Appointments currently start and finish on the same UK date, from 2000 through 2099.

The diary is a date-bounded projection of the existing meeting records, not a second collection: saving confirmation and appointment details is one ETag-protected write. Rescheduling changes the same diary entry; cancelled/new requests are excluded, completed meetings remain visible as history, and deletion removes the entry with the request. Appointment and status changes are audited. Previously confirmed requests without a schedule remain stored and are flagged in the diary for manual scheduling. Email conversations/internal notes are not included in diary query results.

This first version does not send automatic invitations, sync Outlook, block overlapping appointments, assign staff, create standalone appointments or support recurring events. Confirming a meeting only adds it to the RentSimple diary. Select **Use meeting details** in the panel's email composer to prepare a friendly, editable message with the currently selected date, UK start/end times, meeting type and optional location/video link. Review the wording and select **Send email** to send it through the existing tracked Postmark conversation. Internal notes are never included. Preparing or sending an email does not save the appointment; use **Save changes** to persist it and update the diary. Replacing a non-empty draft requires confirmation, and an unresolved send attempt cannot be replaced.

If meeting save/delete/email actions report that the meeting API is unavailable, restart the local development server (or deploy a fresh build), then refresh the panel. Newly added routes may not be registered in an already-running development server. Expired sessions require signing in again. Unexpected responses are reported explicitly, and unconfirmed writes should be checked by refreshing before retrying.

### Two-way meeting email

Incoming prospect emails use yellow panels with the prospect's name; outgoing RentSimple emails use blue panels with the sending actor. Sender labels distinguish direction without relying on colour alone.

Each meeting panel includes an email conversation and composer for approved Global admins. Messages are sent to the prospect's stored email address, never a caller-supplied recipient. Incoming messages are accepted only when the sender matches the prospect and the opaque per-meeting reply token matches. Email does not automatically change the meeting status or confirm a booking. Use **Refresh replies** to load new messages.

Configure these server-only environment variables locally and in the live deployment:

- `POSTMARK_MEETING_INBOUND_ADDRESS`: the inbound address from the Postmark inbound stream settings, in the form `yourhash@inbound.postmarkapp.com`.
- `POSTMARK_INBOUND_WEBHOOK_SECRET`: a unique random secret of at least 32 characters, different from the Postmark server token. Do not commit it.
- Existing `POSTMARK_SERVER_TOKEN`, `POSTMARK_FROM` and optional `POSTMARK_MESSAGE_STREAM` remain the outbound sender configuration.

In **Postmark → Server → Inbound message stream → Settings**, set the inbound webhook to `https://postmark:<URL-encoded-webhook-secret>@www.rentsimple.co.uk/api/webhooks/postmark/inbound`. Set the same secret in the deployed application before enabling the webhook. Use HTTPS. Postmark does not sign inbound webhooks; this endpoint requires constant-time-checked HTTP Basic authentication. Apply Postmark IP allowlisting at the hosting/network layer where supported. Do not paste the authenticated URL into public logs or source control. Postmark cannot call localhost directly; test the deployed HTTPS endpoint, or use an explicitly approved development tunnel.

Reply-To uses plus addressing with a random 96-bit token (not the meeting ID), keeping the mailbox local part below the email length limit. Existing requests get a reply token when the first dashboard email is sent. Once configured, new request acknowledgement emails use the same thread and reply address. Emails sent before threading was enabled are not imported; if threading configuration is absent, the existing acknowledgement email path still runs without reply capture and the dashboard composer explains the missing configuration.

Messages and reply tokens are embedded in the existing request record with ETag-conditional writes. Inbound Postmark `MessageID` deduplication and append happen atomically; transient persistence failures return 503 for Postmark retry, and invalid credentials/unknown recipients/unmatched senders return 403. Deleting a meeting removes its conversation; later replies are rejected. Text and HTML-only replies are shown as escaped plain text, never executable HTML. Postmark attachments are not stored or exposed by the app; the thread shows an attachment-count notice. Webhook bodies are capped at 10 MiB; reply text at 50000 characters; threads at 100 messages and 1 MB per request. Larger payloads/full threads require manual handling in Postmark; they are not acknowledged as saved.

Outbound drafts are saved as `sending` before contacting Postmark, then updated to `sent`, `failed` or `skipped`. The attempt ID is idempotent: repeating a request checks that attempt without sending another copy. A crashed or ambiguous send can remain `sending`; check Postmark before sending a new attempt. `sent` means accepted by the provider, not confirmed inbox delivery; delivery/bounce webhooks are not part of this feature. Failed attempts remain visible and can be followed by a new manually initiated message. Outbound admin attempts are limited to 20 per hour per Global admin via the existing rate limiter. Conversation records include actor and time; internal notes are never sent.

Postmark setup references: [Inbound parsing and plus addressing](https://postmarkapp.com/developer/user-guide/inbound/parse-an-email), [Inbound webhook settings and payload](https://postmarkapp.com/developer/webhooks/inbound-webhook), [Webhook authentication](https://postmarkapp.com/developer/webhooks/webhooks-overview).

### CRM contacts and stages

Approved Global admins and Users open [/dashboard/crm](app/dashboard/crm/page.tsx) from the dashboard navigation or the **CRM** card on the platform overview. It is a basic stage/contact view, not campaigns, tasks or accounting. Access uses the existing `canManagePlatform` capability plus approved status; signed-out visitors go to `/login` and other roles to `/dashboard`. The APIs are `GET`/`POST /api/admin/crm/contacts` and `PATCH /api/admin/crm/contacts/[id]`; there is no delete.

Stages are derived from stored facts and cannot be set directly (requests containing `stage`, `status`, `role` or `approval_status` are rejected). Each contact shows the reasons for its stage:

- **Suspect**: a manually added contact, or meeting requests that are only new, confirmed or cancelled.
- **Prospect**: at least one linked meeting is or was marked done (status `done` or a done entry in its status history). Booking or rescheduling a later meeting does not remove this.
- **Allocated**: an account exists with the same normalized email, regardless of email verification, approval or role. This takes priority over Prospect.

Contacts, meeting requests and accounts are matched only by normalized (trimmed, lower-case) email, never by name. Existing meeting enquiries appear automatically and are merged with a manual contact for the same email, so no duplicate contact is shown; linked meeting request IDs (with links to the meeting panel) and account IDs are listed. Accounts without a contact or meeting are not listed. Account matching assumes stored account emails are already normalized, as registration does.

Manual contacts store first/last name (80), email (254), company (120), town (80) and an internal note (2000). The ID is derived from the normalized email, so adding the same email twice returns a 409 duplicate. Email cannot be changed after creation. Updates require the `updatedAt` version loaded with the page and use ETag checks; a stale edit returns 409. Changes are mirrored to the platform audit log; if the mirror fails the save still succeeds and a warning is shown. The CRM reads accounts through a projection (ID, email, role, approval status, created date) and never reads or changes passwords, registration, verification, approval or roles. Being in any CRM stage never grants access.

Manual contacts are stored in `crm-contacts`, partitioned by `/id`. Override the container name with `COSMOSDB_CRM_CONTACTS_CONTAINER`. The list is merged in memory without pagination.

## API Pagination

The main list APIs now support two pagination modes.

Offset mode:

```text
GET /api/properties?page=1&pageSize=25
GET /api/applications?page=2&pageSize=50
GET /api/maintenance?page=3&pageSize=25
```

Continuation mode:

```text
GET /api/properties?continuationToken=<token>&maxItemCount=50
GET /api/applications?continuationToken=<token>&maxItemCount=50
GET /api/maintenance?continuationToken=<token>&maxItemCount=50
```

Properties and applications also accept landlord scoping when relevant:

```text
GET /api/properties?landlordId=<landlordId>&page=1&pageSize=25
GET /api/applications?landlordId=<landlordId>&page=1&pageSize=25
```

Response shape:

```json
{
  "properties": [],
  "pagination": {
    "mode": "offset",
    "page": 1,
    "pageSize": 25,
    "totalCount": 250,
    "totalPages": 10,
    "hasPreviousPage": false,
    "hasNextPage": true
  }
}
```

Continuation responses return the next token instead of offset metadata:

```json
{
  "applications": [],
  "pagination": {
    "mode": "continuation",
    "continuationToken": "<next-token>",
    "maxItemCount": 50
  }
}
```

Use offset pagination for user-facing page navigation. Use continuation pagination for deep traversal or background sync jobs against large Cosmos containers.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
