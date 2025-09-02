# Frontend

Marker and documentation to indicate the Next.js app lives at the repository root under `src/`.

Run the app:

```
npm run dev
```

Environment variables (create `.env.local` at repo root):

```
PINATA_JWT=REDACTED
NEXT_PUBLIC_CHAIN_ID=11155111
NEXT_PUBLIC_KAISIGN_CONTRACT_ADDRESS=
```

Notes:
- Do NOT commit real secrets. Use a local `.env.local`.
- IPFS uploads call server route `POST /api/ipfs/upload` which uses `PINATA_JWT` on the server.

