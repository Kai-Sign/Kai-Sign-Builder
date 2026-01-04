# API Metadata Files

This folder contains ERC-7730 format metadata files for submission to the KaiSign API.

## Structure

```
api-metadata/
├── dex/
│   ├── paraswap-augustus-v6.json    # ParaSwap DEX aggregator
│   ├── 0x-exchange-proxy.json       # 0x Protocol exchange
│   └── cow-protocol-settlement.json # CoW Protocol batch settlement
└── README.md
```

## Contracts Covered

| Protocol | Address | Functions |
|----------|---------|-----------|
| ParaSwap Augustus V6 | `0x6A000F20005980200259B80c5102003040001068` | simpleSwap, multiSwap, megaSwap |
| 0x Exchange Proxy | `0xDef1C0ded9bec7F1a1670819833240f027b25EfF` | transformERC20, fillRfqOrder, fillLimitOrder |
| CoW Protocol Settlement | `0x9008D19f58AAbD9eD0D60971565AA8510560ab41` | settle, setPreSignature, invalidateOrder |

## Submission

To submit these metadata files to the KaiSign API:

```bash
# Submit all files in the folder
curl -X POST https://kai-sign-production.up.railway.app/api/metadata/batch \
  -H "Content-Type: application/json" \
  -d @api-metadata/dex/*.json
```

Or submit individually via the KaiSign Builder UI.

## Format

Each file follows the ERC-7730 standard with:
- `context.contract`: Contract address, chainId, name, and ABI with selectors
- `display.formats`: Human-readable intent and field labels for each function
