# Notifications

RentSimple can now attempt outbound tenant notifications when a staff user records a new outbound communication entry with channel `email` or `sms` and then saves the tenancy workflow.

For email routing, the platform now resolves ownership from the tenancy property's `ownerId`:

- If the landlord is managed by an agent, the tenant email is sent from the managing agent address and the landlord is copied.
- If no managing agent is assigned, the tenant email is sent from the landlord address.
- If no landlord or agent email can be resolved, the platform sender is used as a fallback.

Admins can now override the outbound email address for landlord and agent users from the user management screen. Agents can also explicitly toggle whether the landlord is copied on direct tenant emails.

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