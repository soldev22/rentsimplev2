# RentSimple Feature List

## Core Platform

### Authentication & User Management

- ✅ User registration with email
- ✅ User login with email/password
- ✅ HTTP-only cookie session management
- ✅ Session validation across app
- ✅ User approval workflow (admin-gated)
- ✅ Role-based access control (Admin, Landlord, Tenant, Applicant, Agent, Builder)
- ✅ Password hashing and security
- ✅ Rate limiting on login attempts (IP + email based)
- ✅ Account lockout mechanism
- ✅ Email verification workflows
- ✅ Forgot password flow
- ✅ Admin ability to "act as" other users

### Dashboard & Navigation

- ✅ Role-based dashboard routing
- ✅ Shared dashboard layout/chrome
- ✅ Sidebar navigation
- ✅ User profile settings
- ✅ Audit trail viewing

### Mobile

- ✅ Responsive mobile design

---

## Landlord Features

### Property Management

- ✅ Create properties
- ✅ View property list
- ✅ View property details
- ✅ Edit property information
- ✅ Property status tracking
- ✅ Bulk property upload (CSV)
- ✅ Property images and gallery management
- ✅ Image moderation (AI-based content safety)
- ✅ Multiple images per property with sorting
- ✅ Property scope picker for multi-property landlords

### Case Management

- ✅ Create legal timeline cases (for damp, flood, complaints, etc.)
- ✅ Track case status with legal deadline timers
- ✅ Multi-stage case workflows with color-coded status (red/orange/green)
- ✅ Stage completion gating based on inspection reports
- ✅ Damp inspection reporting system
- ✅ Structured inspection form with UK Housing Act compliance
- ✅ Immutable inspection report storage
- ✅ Send inspection reports to tenants (email + dashboard)
- ✅ Tenant contact preference validation
- ✅ Case audit logging for tribunal evidence

### Tenant Management

- ✅ View tenant list
- ✅ Tenant communication/messaging thread
- ✅ Send messages to tenants
- ✅ View tenant profiles

### Maintenance

- ✅ View maintenance requests
- ✅ Create maintenance requests
- ✅ Assign maintenance to contractors
- ✅ Maintenance status tracking
- ✅ Maintenance communication with tenants

### Bookings

- ✅ View property bookings
- ✅ Create/manage bookings

---

## Tenant Features

### Tenancy Management

- ✅ View current tenancy details
- ✅ Access tenancy information
- ✅ Tenancy checklists and workflows
- ✅ Apply tenancy workflows (create/edit/submit)

### Maintenance Requests

- ✅ Raise maintenance requests
- ✅ Track maintenance request status
- ✅ Communicate with landlord about maintenance
- ✅ Maintenance request history
- ✅ Priority classification (low/medium/high)

### Notifications

- ✅ Tenant communication thread notifications
- ✅ Preferred contact method settings (email, phone, SMS, WhatsApp)
- ✅ Notification delivery via email
- ✅ Dashboard notification center

---

## Applicant Features

### Property Discovery

- ✅ Browse available properties
- ✅ View property details and photos
- ✅ View property quick-apply cards
- ✅ Search/filter properties (by amenities, price, location)

### Application Workflow

- ✅ Submit tenancy applications
- ✅ Application form with required fields
- ✅ Application status tracking
- ✅ View application history
- ✅ Application checklist completion

### Profile Management

- ✅ Complete applicant profile
- ✅ Preferred contact method settings
- ✅ Profile verification status

---

## Builder Features

### Property Builder

- ⏳ Property creation wizard
- ⏳ Template-based property setup
- ⏳ Draft property management

---

## Agent Features

### Agent Dashboard

- ⏳ Agent workspace
- ⏳ Case assignment
- ⏳ Performance metrics

---

## Admin Features

### User Management

- ✅ View all users
- ✅ Assign user roles
- ✅ Approve pending users
- ✅ User status overview
- ✅ Act as other users (impersonation)
- ✅ Reset user workspace

### System Administration

- ✅ Admin dashboard
- ✅ System-wide user management
- ✅ Workspace reset capability

---

## Audit & Compliance

### Audit Logging

- ✅ Immutable audit trail for all actions
- ✅ Entity-based audit events (property, case, application, etc.)
- ✅ Field-level change tracking
- ✅ Timestamp and performer tracking
- ✅ Metadata enrichment (case type, severity, urgency, etc.)
- ✅ Audit view in dashboard
- ✅ Export audit logs

### Data & Legal

- ✅ GDPR-compliant data handling
- ✅ Case completion evidence for tribunal
- ✅ Immutable inspection reports
- ✅ Legal timer enforcement for case stages

---

## API Features

### Data Access

- ✅ RESTful API endpoints
- ✅ Pagination support (offset and continuation token modes)
- ✅ Landlord-scoped queries
- ✅ Property ID-based partitioning
- ✅ Error handling with proper HTTP status codes
- ✅ Request validation

### Integration

- ✅ Email delivery (SMTP via Nodemailer)
- ✅ Image storage (Azure Blob Storage)
- ✅ Image moderation (Azure Content Safety)
- ✅ Database (Azure Cosmos DB)

---

## Technical Features

### Performance

- ✅ Server-side rendering with Next.js 16
- ✅ Turbopack compilation (~3-5s builds)
- ✅ Server components for data fetching
- ✅ Client components for interactivity
- ✅ Optimized routing (71+ routes)
- ✅ Memory cleanup (isMounted pattern)

### Development

- ✅ TypeScript strict mode
- ✅ ESLint configuration
- ✅ Vitest for testing
- ✅ Playwright for end-to-end testing
- ✅ Prettier formatting

### Security

- ✅ HTTP-only session cookies
- ✅ CSRF protection ready
- ✅ Rate limiting
- ✅ Password hashing (bcryptjs)
- ✅ Server-only marked functions
- ✅ Role-based access control enforcement

---

## Legend

- ✅ = Fully Implemented
- ⏳ = In Progress
- 📋 = Planned
- 🔧 = Technical Feature

---

## Recent Additions (Phase 4-5)

### Inspection & Reporting

- ✅ Damp inspection form with 9 fieldsets
- ✅ Severity/urgency classification
- ✅ Root cause diagnosis
- ✅ Remediation timeline tracking
- ✅ Immutable report viewer
- ✅ Send reports via email with HTML formatting
- ✅ Send reports via secure dashboard link
- ✅ Contact preference validation

### Workflow Improvements

- ✅ Two-step damp case completion (form → completion)
- ✅ Report prerequisite gating
- ✅ Visual stage status feedback (red/orange/green panels)
- ✅ Overdue stage highlighting
- ✅ Comprehensive audit logging for legal evidence

---

## Architecture

- **Frontend**: Next.js 16.2.6 with React 19.2.4
- **Database**: Azure Cosmos DB (partition key: /propertyId)
- **Auth**: Application-owned session management
- **Storage**: Azure Blob Storage for images
- **Email**: Nodemailer SMTP
- **Moderation**: Azure Content Safety API
- **Deployment**: Ready for Azure App Service/Container Apps
