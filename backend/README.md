### Kai-Sign-Builder Backend

FastAPI backend that exposes secure signing via AWS KMS and an Ethereum raw-transaction relay. Private keys never leave KMS.

### Features
- AWS KMS secp256k1 signer: derive address and sign 32-byte digests
- Relay to broadcast raw signed transactions (incl. blob-carrying EIP-4844 txs)
- API key protection on sensitive endpoints

### Prerequisites
- Python 3.12
- AWS account with permissions to use KMS
- EIP-4844-capable RPC (e.g., Sepolia) for broadcasting transactions

### 1) Create a KMS key
- In AWS KMS, create a customer-managed asymmetric key:
  - Key type: Asymmetric
  - Key spec: ECC_SECG_P256K1
  - Key usage: Sign and verify
- Record the Key ID or full ARN.
- Ensure the backend's IAM principal has at least:
  - kms:GetPublicKey on the key
  - kms:Sign on the key (ideally with conditions limiting the algorithm)

Example minimal policy statement for the role/user running the backend:
```json
{
  "Effect": "Allow",
  "Action": ["kms:GetPublicKey", "kms:Sign"],
  "Resource": "arn:aws:kms:REGION:ACCOUNT_ID:key/KEY_ID"
}
```

### 2) Configure environment
Copy `.env.example` to `.env` at the repo root and fill in:
```
AWS_REGION=your-aws-region
AWS_KMS_KEY_ID=arn:aws:kms:REGION:ACCOUNT_ID:key/KEY_ID
BACKEND_API_KEY=your-strong-random-api-key

# EIP-4844-capable RPC (preferred)
SEPOLIA_RPC_URL=https://... 

# Optional alternatives
ALCHEMY_RPC_URL=https://...
ETHERSCAN_API_KEY=...
```

Notes:
- BACKEND_API_KEY protects the KMS and relay routes; send it via header `X-API-Key`.
- If both `SEPOLIA_RPC_URL` and `ALCHEMY_RPC_URL` are present, the relay uses `SEPOLIA_RPC_URL`.

### 3) Install and run
From the `backend/` directory:
```bash
pip install -r requirements.txt
python start.py
```

Server starts on `PORT` if set, otherwise `8000`. Open API docs at `/docs`.

### 4) Endpoints
All endpoints below require header: `X-API-Key: <BACKEND_API_KEY>`

- Get KMS-derived Ethereum address
```
GET /kms/address
```
Response:
```json
{ "address": "0xYourChecksumAddress" }
```

- Sign a 32-byte digest (0x + 64 hex)
```
POST /kms/signDigest
Content-Type: application/json
{
  "digest": "0x<64-hex>"
}
```
Response:
```json
{ "r": "0x...", "s": "0x...", "v": 27, "yParity": 0 }
```

- Broadcast raw signed transaction
```
POST /eth/sendRawTransaction
Content-Type: application/json
{
  "raw": "0x<signed-raw-tx>"
}
```
Response is the JSON-RPC result from the configured RPC.

### Security
- Private keys never leave KMS; only `Sign` operations are invoked with `MessageType=DIGEST`.
- Signatures are normalized to low-S to prevent malleability.
- Recovery id (`v`/`yParity`) is computed by recovering the public key and matching to the KMS key.
- All sensitive routes require `X-API-Key`; CORS is configured to allow this header.
- For production, also restrict network access (WAF/VPC), rotate API keys, and scope IAM policies narrowly to the specific KMS key.

### KZG notes (optional)
If you need KZG commitments for blob transactions, you can either:
- Run a small VM close to your RPC with a KZG library, or
- Use a serverless function that runs kzg-wasm if latency is acceptable.


