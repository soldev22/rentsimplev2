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
