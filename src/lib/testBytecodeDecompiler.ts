import { analyzeBytecode, decompileBytecode } from './bytecodeDecompiler';
import { analyzeWithERC7730 } from './erc7730Matcher';

async function testSepoliaTransactions() {
  console.log('Testing Bytecode Decompiler with Sepolia Transactions\n');
  
  // Test cases from the user's provided URLs
  const testCases = [
    {
      name: 'BatchExecutor - Multiple ERC20 transfers',
      chainId: 11155111,
      contractAddress: '0x5dd9fdf2310b5dac8dced8a100fb4952546ae7bd',
      bytecode: '0x34fcd5be00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000001200000000000000000000000005dd9fdf2310b5dac8dced8a100fb4952546ae7bd000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000044a9059cbb000000000000000000000000bb6e6d6dabd150c4a000d1fd8a7de46a750477f40000000000000000000000000000000000000000000000000de0b6b3a7640000000000000000000000000000000000000000000000000000000000000000000000000000000000005dd9fdf2310b5dac8dced8a100fb4952546ae7bd000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000044a9059cbb000000000000000000000000bb6e6d6dabd150c4a000d1fd8a7de46a750477f40000000000000000000000000000000000000000000000001bc16d674ec8000000000000000000000000000000000000000000000000000000000000',
      txHash: '0x7c756c8c549e5ba4710ba81844ac6cef27326623424b470897dc8d08bfc43113'
    },
    {
      name: 'DeleGator - Execute with mode',
      chainId: 11155111,
      contractAddress: '0x5315eb7f03465aa2aef2fe052b8eed2cab0741a0',
      bytecode: '0x1cff79cd0000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000001200000000000000000000000005315eb7f03465aa2aef2fe052b8eed2cab0741a0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000044a9059cbb000000000000000000000000bb6e6d6dabd150c4a000d1fd8a7de46a750477f40000000000000000000000000000000000000000000000000de0b6b3a7640000000000000000000000000000000000000000000000000000000000000000000000000000000000005315eb7f03465aa2aef2fe052b8eed2cab0741a0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000044a9059cbb000000000000000000000000bb6e6d6dabd150c4a000d1fd8a7de46a750477f40000000000000000000000000000000000000000000000001bc16d674ec8000000000000000000000000000000000000000000000000000000000000',
      txHash: '0x2eca4eb7ae55dcc419c0e21ac34a3e57731b2bb5825bef9048afb1e55d0dccd0'
    },
    {
      name: 'Simple Transfer',
      chainId: 11155111,
      contractAddress: '0x779877A7B0D9E8603169DdbD7836e478b4624789', // LINK token on Sepolia
      bytecode: '0xa9059cbb000000000000000000000000bb6e6d6dabd150c4a000d1fd8a7de46a750477f40000000000000000000000000000000000000000000000000de0b6b3a7640000',
      txHash: '0x8c99c823afaf80b6889a9a7d5eb9337bd60e88bd62f9dcce4491043d5576edbf'
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n=== Testing: ${testCase.name} ===`);
    console.log(`Transaction: ${testCase.txHash}`);
    console.log(`Contract: ${testCase.contractAddress}`);
    console.log(`Chain: ${testCase.chainId === 11155111 ? 'Sepolia' : 'Unknown'}`);
    
    try {
      // Test bytecode decompilation
      const decompiled = await decompileBytecode(
        testCase.bytecode,
        testCase.contractAddress as `0x${string}`,
        testCase.chainId
      );
      
      console.log('\nDecompiled:');
      console.log(`- Function: ${decompiled.functionName || decompiled.signature || 'Unknown'}`);
      console.log(`- Selector: 0x${decompiled.selector}`);
      
      if (decompiled.error) {
        console.log(`- Error: ${decompiled.error}`);
      } else if (decompiled.decodedParams) {
        console.log('- Parameters:');
        decompiled.decodedParams.forEach((param, index) => {
          const input = decompiled.inputs?.[index];
          if (input) {
            console.log(`  ${input.name} (${input.type}): ${JSON.stringify(param)}`);
          }
        });
        
        // Check for nested operations (batch transactions)
        if ((decompiled as any).nestedOperations) {
          console.log('\n- Nested Operations:');
          (decompiled as any).nestedOperations.forEach((op: any, index: number) => {
            console.log(`  Operation ${index + 1}: ${op.functionName || op.signature || 'Unknown'}`);
          });
        }
      }
      
      // Test ERC-7730 matching
      const erc7730Analysis = await analyzeWithERC7730(
        testCase.bytecode,
        testCase.contractAddress as `0x${string}`,
        testCase.chainId,
        decompiled
      );
      
      if (erc7730Analysis.metadata) {
        console.log('\nERC-7730 Metadata found!');
        console.log(`- Contract: ${erc7730Analysis.metadata.context?.name}`);
      }
      
      if (erc7730Analysis.matched.intent) {
        console.log(`\nMatched Intent: "${erc7730Analysis.matched.intent}"`);
      }
      
      if (erc7730Analysis.hardwareDisplay.length > 0) {
        console.log('\nHardware Wallet Display:');
        erc7730Analysis.hardwareDisplay.forEach((screen) => {
          console.log(`- ${screen}`);
        });
      }
      
    } catch (error) {
      console.error('Test failed:', error);
    }
  }
}

// Run the tests
if (require.main === module) {
  testSepoliaTransactions().catch(console.error);
}

export { testSepoliaTransactions };