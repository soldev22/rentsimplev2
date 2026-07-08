# Backlog

Use this file to track deferred work and revisit items.

## Legend

- [ ] Todo
- [~] In progress
- [x] Done

## Prioritized Todo

- [ ] Guarantor legal copy pass with solicitor-approved language (England and Wales wording)
  - Owner: Product/Legal
  - Notes: Current legal text is stronger, but still not legal advice. Final text should be signed off.

- [ ] Add explicit defined terms section to guarantor declaration
  - Owner: Engineering
  - Notes: Define Landlord, Tenant, Guarantor, Tenancy, Guarantee and Indemnity.

- [ ] Add governing law and jurisdiction clause to guarantor declaration
  - Owner: Engineering
  - Notes: Default to England and Wales unless tenancy framework requires otherwise.

- [ ] Capture response evidence fields for court bundle
  - Owner: Engineering
  - Notes: Store response IP, user agent, request id, and server timestamp in audit metadata.

- [ ] Improve court-copy PDF formatting for multi-page output
  - Owner: Engineering
  - Notes: Add page headers/footers and signature/verification section.

- [ ] Add decline reason (optional) for guarantor responses
  - Owner: Engineering
  - Notes: Persist reason with request status when decision is declined.

- [ ] Add integration tests for guarantor consent endpoints
  - Owner: Engineering
  - Notes: Cover valid token, expired token, reused token, agree, decline, and court-copy routes.

## Parking Lot

- [ ] Add electronic signature provider integration for guarantor acceptance
- [ ] Add PDF/A export option for formal evidence retention

## Notes

- Keep backlog items small and actionable.
- Move completed items to [FEATURES.md](FEATURES.md) when shipped.
