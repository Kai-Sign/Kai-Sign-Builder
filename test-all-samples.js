// Test all sample transactions
async function testAllSamples() {
  const samples = [
    {
      name: 'Sepolia TX 1 - BatchExecutor',
      url: 'https://sepolia.etherscan.io/tx/0x7c756c8c549e5ba4710ba81844ac6cef27326623424b470897dc8d08bfc43113',
      contractAddress: '0x5dd9fdf2310b5dac8dced8a100fb4952546ae7bd',
      bytecode: '0x34fcd5be00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000001200000000000000000000000005dd9fdf2310b5dac8dced8a100fb4952546ae7bd000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000044a9059cbb000000000000000000000000bb6e6d6dabd150c4a000d1fd8a7de46a750477f40000000000000000000000000000000000000000000000000de0b6b3a7640000000000000000000000000000000000000000000000000000000000000000000000000000000000005dd9fdf2310b5dac8dced8a100fb4952546ae7bd000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000044a9059cbb000000000000000000000000bb6e6d6dabd150c4a000d1fd8a7de46a750477f40000000000000000000000000000000000000000000000001bc16d674ec8000000000000000000000000000000000000000000000000000000000000'
    },
    {
      name: 'Sepolia TX 2 - DeleGator',
      url: 'https://sepolia.etherscan.io/tx/0x2eca4eb7ae55dcc419c0e21ac34a3e57731b2bb5825bef9048afb1e55d0dccd0',
      contractAddress: '0x5315eb7f03465aa2aef2fe052b8eed2cab0741a0',
      bytecode: '0x1cff79cd0000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000001200000000000000000000000005315eb7f03465aa2aef2fe052b8eed2cab0741a0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000044a9059cbb000000000000000000000000bb6e6d6dabd150c4a000d1fd8a7de46a750477f40000000000000000000000000000000000000000000000000de0b6b3a7640000000000000000000000000000000000000000000000000000000000000000000000000000000000005315eb7f03465aa2aef2fe052b8eed2cab0741a0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000044a9059cbb000000000000000000000000bb6e6d6dabd150c4a000d1fd8a7de46a750477f40000000000000000000000000000000000000000000000001bc16d674ec8000000000000000000000000000000000000000000000000000000000000'
    },
    {
      name: 'Sepolia TX 3 - Simple Transfer',
      url: 'https://sepolia.etherscan.io/tx/0x8c99c823afaf80b6889a9a7d5eb9337bd60e88bd62f9dcce4491043d5576edbf',
      contractAddress: '0x779877A7B0D9E8603169DdbD7836e478b4624789',
      bytecode: '0xa9059cbb000000000000000000000000bb6e6d6dabd150c4a000d1fd8a7de46a750477f40000000000000000000000000000000000000000000000000de0b6b3a7640000'
    }
  ];

  console.log('Testing all sample transactions...\n');

  for (const sample of samples) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Testing: ${sample.name}`);
    console.log(`URL: ${sample.url}`);
    console.log(`Contract: ${sample.contractAddress}`);
    console.log(`${'='.repeat(80)}`);

    try {
      const response = await fetch('http://localhost:3000/api/decompile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bytecode: sample.bytecode,
          contractAddress: sample.contractAddress,
          chainId: 11155111 // Sepolia
        }),
      });

      const result = await response.json();

      if (result.success) {
        console.log('✅ SUCCESS - Bytecode decoded successfully!');
        console.log('\nFunction:', result.analysis.decompiled.functionName || result.analysis.decompiled.signature);
        console.log('Selector:', `0x${result.analysis.decompiled.selector}`);
        
        // Show parameters
        if (result.analysis.decompiled.inputs && result.analysis.decompiled.decodedParams) {
          console.log('\nParameters:');
          result.analysis.decompiled.inputs.forEach((input, i) => {
            const value = result.analysis.decompiled.decodedParams[i];
            console.log(`  ${input.name} (${input.type}): ${JSON.stringify(value)}`);
          });
        }

        // Show nested operations for batch transactions
        if (result.analysis.decompiled.nestedOperations) {
          console.log('\nNested Operations:');
          result.analysis.decompiled.nestedOperations.forEach((op, index) => {
            console.log(`  ${index + 1}. ${op.functionName || op.signature}`);
            if (op.decodedParams && op.inputs) {
              op.inputs.forEach((input, i) => {
                console.log(`     - ${input.name}: ${op.decodedParams[i]}`);
              });
            }
          });
        }

        // Check ERC-7730 matching
        if (result.erc7730.metadata) {
          console.log('\n📋 ERC-7730 Metadata Found!');
          console.log('Contract:', result.erc7730.metadata.context?.name);
        } else {
          console.log('\n⚠️  No ERC-7730 metadata found for this contract');
        }

      } else {
        console.log('❌ FAILED - Error decoding bytecode');
        console.log('Error:', result.error);
        if (result.details) {
          console.log('Details:', result.details);
        }
      }
    } catch (error) {
      console.log('❌ FAILED - Request error');
      console.log('Error:', error.message);
    }
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log('All tests completed!');
  console.log(`${'='.repeat(80)}`);
}

// Run tests
testAllSamples().catch(console.error);