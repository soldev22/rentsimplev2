# Notifications

RentSimple can now attempt outbound tenant notifications when a staff user records a new outbound communication entry with channel `email` or `sms` and then saves the tenancy workflow.

For email routing, the platform now resolves ownership from the tenancy property's `ownerId`:

- If the landlord has a transactional email address configured, the tenant email uses the platform SMTP sender, routes replies to that landlord transactional address, and copies the landlord's registered onboarding email when it differs.
- If no landlord transactional address is configured, the tenant email uses the platform SMTP sender and routes replies to the landlord's registered onboarding email.
- If no landlord email can be resolved at all, the platform sender is used as a fallback.

Admins can now assign a landlord transactional email address from the user management screen. That address is the app transaction address for tenant correspondence, while the landlord's registered onboarding email remains the audit copy destination.

The exported tenancy TXT and PDF logs now include notification audit fields for each outbound communication entry, including sender address, reply-to address, copied parties, delivery status, and routing detail.

SMS remains direct to the tenant phone number; landlord visibility for SMS comes from the shared communication timeline in the platform.

## Supported outbound channels

- `email` via SMTP
- `sms` via Twilio

Other communication channels remain log-only and are still recorded in the conversation thread.

## Optional environment variables

### Email via SMTP

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

For shared hosting SMTP providers such as Hosting UK, the app now always sends with `SMTP_FROM` as the real SMTP `From` address and uses the landlord transactional or registered email in `Reply-To` instead of trying to spoof arbitrary `From` mailboxes.

### SMS via Twilio

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`

If the relevant provider settings are missing, the communication entry is still saved and the notification is marked as `skipped`.

## Testing

Run unit tests with:

```powershell
npm test
```

Current unit coverage focuses on:

- notification preparation rules for outbound email and SMS
- tenancy log text formatting
