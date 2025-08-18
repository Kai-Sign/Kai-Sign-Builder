# Subgraph Deployment Instructions

## Current Status
- ✅ Schema updated with new events
- ✅ Event handlers implemented
- ✅ ABI updated with new contract
- ✅ Configuration updated to new contract address: `0xA2119F82f3F595DB34fa059785BeA2f4F78D418B`
- ✅ Code generation completed successfully
- ✅ Build completed successfully

## Deployment Steps

### 1. Authenticate with The Graph Studio
You need to authenticate with your Graph Studio deploy key:

```bash
cd graph/kaisign
graph auth --studio <YOUR_DEPLOY_KEY>
```

Note: The subgraph slug is `kai-sign`

### 2. Deploy the Updated Subgraph
```bash
npm run deploy
```

When prompted for a version label, use something like `v0.0.8` (incrementing from the current v0.0.7).

### 3. Monitor Deployment
After deployment:
- Check The Graph Studio dashboard for deployment status
- Monitor indexing progress
- Verify events are being indexed from the new contract address

### 4. Update Environment Variables
Once deployed successfully, update the subgraph URL in `.env.local`:
```
NEXT_PUBLIC_KAISIGN_GRAPH_URL=https://api.studio.thegraph.com/query/117022/kai-sign/v0.0.8
KAISIGN_GRAPH_ENDPOINT=https://api.studio.thegraph.com/query/117022/kai-sign/v0.0.8
```

## Verification Steps

### Test the New Subgraph
```bash
# Test basic connectivity
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"query":"{ _meta { block { number } } }"}' \
  https://api.studio.thegraph.com/query/117022/kai-sign/v0.0.8

# Test new event entities
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"query":"{ logCommitSpecs(first: 5) { id committer targetContract chainId } }"}' \
  https://api.studio.thegraph.com/query/117022/kai-sign/v0.0.8
```

## Expected Results
- Subgraph should start indexing from block 8840000 on Sepolia
- New event types should be available for querying
- Old events (LogAssertSpecInvalid, LogAssertSpecValid) will no longer be indexed
- Updated LogCreateSpec events should have the new field structure

## Troubleshooting
If deployment fails:
1. Check authentication: `graph auth --studio <key>`
2. Verify build: `npm run build`
3. Check logs in The Graph Studio dashboard
4. Ensure contract address is correct in subgraph.yaml