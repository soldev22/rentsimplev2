# RentSimple Project Context

## Project Goal

Build a scalable property management platform (RentSimple) for future SaaS/product use.

## Architecture Principles

- Modular structure (dashboard → modules)
- Clean separation of concerns (pages / components / logic)
- Reusable components
- Simple, scalable design (avoid overengineering)

## Folder Structure

/app
  /dashboard
    /properties
      page.tsx        (list)
      /[id]/page.tsx  (detail)
      /new/page.tsx   (create)
    /tenants
    /maintenance
    /documents

/components
/lib
/styles

## Current Progress

- Dashboard ✅
- Properties module (list page) ✅
- Next: Property detail page + create form

## Rules

- Do NOT move project into OneDrive
- Use GitHub for sync
- Keep logic simple first, scale later
