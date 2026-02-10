
  How Calldata Is Truly Processed

  1. Raw Calldata Structure

  0xa9059cbb000000000000000000000000742d35cc6634c0532925a3b8d591d3d5f88ce44200000000000000000
  0000000000000000000000000000000000000003b9aca00

  Breakdown:
  - First 4 bytes: 0xa9059cbb = Function selector (keccak256 of "transfer(address,uint256)")
  - Remaining bytes: ABI-encoded parameters

  2. EVM Processing Flow

  Step 1: Function Selector Extraction
  // EVM extracts first 4 bytes
  bytes4 selector = bytes4(msg.data[:4]); // 0xa9059cbb

  Step 2: Function Dispatch
  // Contract's dispatcher (compiler-generated)
  if (selector == 0xa9059cbb) {
      transfer(address(params[0]), uint256(params[1]));
  } else if (selector == 0x23b872dd) {
      transferFrom(address(params[0]), address(params[1]), uint256(params[2]));
  }

  Step 3: Parameter Decoding
  // ABI decoding happens automatically
  // msg.data[4:] gets decoded into typed parameters

  3. Real-World Calldata Examples

  Simple Transfer:
  Function: transfer(address,uint256)
  Calldata: 0xa9059cbb000...742d35cc...000...3b9aca00
  Result: ONE function execution

  Nested/Batch Calls:
  Function: multicall(bytes[])
  Calldata: 0xac9650d8000...
    └─ Contains: [
         0xa9059cbb000...  // transfer() call 1
         0xa9059cbb000...  // transfer() call 2
       ]
  Result: ONE multicall containing MULTIPLE nested executions

  4. The Key Insight: One Calldata = One Top-Level Function

  At the EVM level:
  - One transaction = One calldata = One function call
  - The receiving contract's dispatcher routes to exactly one function
  - Any "nesting" happens inside that function's execution

  Examples:

  Safe's execTransaction:
  Calldata → execTransaction(target, value, data, ...)
           └─ data contains: 0xa9059cbb... (nested transfer)
  EVM sees: ONE execTransaction call
  Safe contract internally: Decodes data and makes nested call

  Batch Operations:
  Calldata → executeBatch(calls[])
           └─ calls contains: [{target, data: 0xa9059cbb...}, {target, data: 0xa9059cbb...}]
  EVM sees: ONE executeBatch callContract internally: Loops through calls array

  5. Why This Matters For Transaction Analysis

  The Problem With Double Detection:
  Transaction Calldata: execTransaction(...)
  ├─ Level 0: execTransaction (what EVM actually executes)
  └─ Level 1: transfer (what gets executed internally)

  In reality:
  - Only execTransaction runs at EVM level
  - transfer is internal contract logic
  - Both are important for user understanding, but they're different abstraction levels

  6. Standards Like ERC-7730's Approach

  ERC-7730 tries to solve this by:
  - Top-level display: Show the actual function called (execTransaction)
  - Nested display: Show what it does internally (transfer USDC)
  - User intent: Focus on the meaningful action (token transfer)

  7. The Real Transaction Flow

  User Intent: "Transfer 100 USDC"
      ↓
  Wallet Creates: execTransaction(USDC_CONTRACT, 0, transfer_calldata, ...)
      ↓
  EVM Executes: Safe.execTransaction()
      ↓
  Safe Contract: Makes internal call with transfer_calldata
      ↓
  USDC Contract: Executes transfer(recipient, 100)
      ↓
  Result: USDC moved

  8. Why Your Project Has Duplication

  The issue: Your project is detecting both:
  1. The EVM-level call (execTransaction) - what actually runs
  2. The logical intent (transfer) - what the user cares about

  In reality: Only execTransaction runs at the EVM level, but both are valid for different
  purposes:
  - Technical accuracy: Show execTransaction
  - User understanding: Show transfer
  - Complete picture: Show both with proper hierarchy

  The duplication happens because you're mixing these two valid but different abstraction 
  levels in the same operation list.

  This is why blockchain explorers like Etherscan show both the "Method" (execTransaction)
  and the "Decoded Input" with internal calls - they're different layers of the same
  transaction.
