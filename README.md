# OneSupport License Server

Run with Node.js 18+:

```bash
ADMIN_TOKEN="replace-with-a-long-secret" node server.js
```

Admin API requires header `X-Admin-Token`.

Create a license:
`POST /admin/create` body `{ "licenseKey":"OS-XXXX", "expiresAt":"2026-10-02T23:59:59Z" }`

Disable: `POST /admin/status` body `{ "licenseKey":"OS-XXXX", "status":"disabled" }`

Extend: `POST /admin/extend` body `{ "licenseKey":"OS-XXXX", "expiresAt":"..." }`

For production, deploy behind HTTPS and protect the admin API. Never put ADMIN_TOKEN in the extension.
