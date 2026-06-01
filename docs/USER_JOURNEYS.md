# RentSimple User Journeys

## Overview

This document captures the intended role-based journey for a user moving through the RentSimple platform.

The current core journey is:

1. A user registers.
2. The user is created in the system with the `unallocated` role.
3. The user is held on the waiting page until an administrator assigns a working role.
4. The user is first assigned the `applicant` role.
5. As an applicant, the user can browse available properties and apply for tenancy.
6. Once tenancy is approved or granted, the user is moved to the `tenant` role.
7. As a tenant, the user can manage maintenance-related activity for their property.

## Role Journey Map

### 1. Unallocated

This is the default role immediately after registration.

User experience:

- The user can sign up and create an account.
- The user is redirected to the waiting page.
- The user cannot access a working dashboard yet.

System intent:

- This is the holding state before an administrator decides the user's first active role.
- The waiting page should explain that the account is pending allocation.

Primary destination:

- `/waiting`

### 2. Applicant

This is the first active role after admin allocation for a prospective renter.

User experience:

- The user can access the applicant dashboard.
- The user can browse properties that are available to them.
- The user can apply for tenancy.

System intent:

- This role represents a user who is actively searching for a property and submitting tenancy applications.
- It is the pre-tenancy stage of the renter lifecycle.

Primary destination:

- `/dashboard/applicant`

Expected core capabilities:

- View properties
- Review property details
- Submit tenancy applications
- Track tenancy application status

### 3. Tenant

This is the role assigned after an applicant has been approved for tenancy or tenancy has been granted.

User experience:

- The user can access the tenant dashboard.
- The user is no longer treated as an applicant.
- The user can manage maintenance activity for the property they occupy.

System intent:

- This role represents an active occupant of a property.
- It is the post-approval stage of the renter lifecycle.

Primary destination:

- `/dashboard/tenants`

Expected core capabilities:

- View tenancy-related information
- Raise maintenance requests
- Track maintenance progress
- Review updates linked to the occupied property

## State Transitions

### Registration to Waiting

Trigger:

- A new user completes registration.

Result:

- The system creates the user with role `unallocated`.
- The user is redirected to the waiting page.

### Waiting to Applicant

Trigger:

- An administrator reviews the user and assigns the `applicant` role.

Result:

- The user can now access the applicant dashboard.
- The waiting state is removed because the user has been allocated a real role.

### Applicant to Tenant

Trigger:

- The applicant is approved for tenancy or tenancy is granted.

Result:

- The user's role changes from `applicant` to `tenant`.
- Future logins should route the user to the tenant dashboard.

## Admin Responsibility

The administrator controls the role transition points in this journey.

Admin actions required:

- Review newly registered users
- Assign `applicant` when the user is ready to start the tenancy application journey
- Promote `applicant` to `tenant` once tenancy is approved or granted

## Routing Summary

Current intended routing by stage:

- `unallocated` -> `/waiting`
- `applicant` -> `/dashboard/applicant`
- `tenant` -> `/dashboard/tenants`

## Notes

This document describes the intended product workflow, not just what is already fully implemented in the UI.

The most important lifecycle for renter users is:

- Register
- Wait for allocation
- Become applicant
- Apply for tenancy
- Become tenant
- Manage maintenance
