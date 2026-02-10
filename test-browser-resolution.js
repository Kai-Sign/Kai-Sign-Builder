#!/usr/bin/env node

// Test browser path resolution logic with exact same data as CLI

const transactionData = {
  "txHash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  "methodCall": {
    "name": "takeBid",
    "params": [
      {
        "name": "inputs",
        "type": "tuple",
        "components": [
          {
            "name": "orders",
            "type": "tuple",
            "components": [
              {
                "name": "orders",
                "type": "tuple[]",
                "value": [
                  {
                    "trader": "0x742d35Cc6634C0532925a3b8D591D3d5F88cE442",
                    "collection": "0xbAbaFdd8045740449a42B788a26E9b3A32F88aC1",
                    "listingsRoot": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
                    "numberOfListings": "1",
                    "expirationTime": "1700000000",
                    "assetType": "0",
                    "makerFee": {
                      "recipient": "0x0000a26b00c1F0DF003000390027140000fAa719",
                      "rate": "250"
                    },
                    "salt": "123456789"
                  },
                  {
                    "trader": "0x8888888888888888888888888888888888888888",
                    "collection": "0x9999999999999999999999999999999999999999",
                    "listingsRoot": "0x2345678901bcdef02345678901bcdef02345678901bcdef02345678901bcdef0",
                    "numberOfListings": "1",
                    "expirationTime": "1700000000",
                    "assetType": "0",
                    "makerFee": {
                      "recipient": "0x0000a26b00c1F0DF003000390027140000fAa719",
                      "rate": "250"
                    },
                    "salt": "987654321"
                  }
                ]
              }
            ]
          },
          {
            "name": "exchanges",
            "type": "tuple",
            "components": [
              {
                "name": "exchanges",
                "type": "tuple[]",
                "value": [
                  {
                    "index": "0",
                    "proof": ["0x1111111111111111111111111111111111111111111111111111111111111111"],
                    "listing": {
                      "index": "0",
                      "tokenId": "1234",
                      "amount": "1",
                      "price": "1000000000000000000"
                    },
                    "taker": {
                      "tokenId": "1234",
                      "amount": "1"
                    }
                  },
                  {
                    "index": "1",
                    "proof": ["0x2222222222222222222222222222222222222222222222222222222222222222"],
                    "listing": {
                      "index": "1",
                      "tokenId": "5678",
                      "amount": "1",
                      "price": "2000000000000000000"
                    },
                    "taker": {
                      "tokenId": "5678",
                      "amount": "1"
                    }
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
};

// Browser path resolution logic (copied from hardwareViewer.tsx)
function getFieldValueFromTransaction(path, format, field) {
  console.log(`Browser: Getting field value for path: ${path}, format: ${format}`);
  
  const contextData = transactionData;
  
  if (!contextData) {
    return `Mock ${format} value`;
  }

  try {
    let cleanPath = path;
    let isDirectParam = false;
    
    if (path.startsWith('#.')) {
      cleanPath = path.substring(2);
      isDirectParam = true;
    }
    
    const pathParts = cleanPath.split('.');
    let value = contextData;
    
    if (contextData.methodCall && contextData.methodCall.params) {
      if (isDirectParam) {
        let current = contextData.methodCall.params.find(p => p.name === pathParts[0]);
        console.log(`Browser: Found initial param '${pathParts[0]}':`, current);
        
        for (let i = 1; i < pathParts.length && current; i++) {
          const part = pathParts[i];
          console.log(`Browser: Processing path part '${part}'`);
          
          // Numeric index - find in components array or value array
          if (/^\d+$/.test(part)) {
            const idx = parseInt(part);
            // Try value array first (for tuple[] types)
            if (current.value && Array.isArray(current.value) && idx < current.value.length) {
              current = { value: current.value[idx] };
              console.log(`Browser: Found value at array index ${idx}:`, current);
            }
            // Fall back to components array
            else if (current.components && current.components[idx]) {
              current = current.components[idx];
              console.log(`Browser: Found component at index ${idx}:`, current);
            } else {
              console.log(`Browser: No component or value at index ${idx}`);
              current = null;
            }
          }
          // Property name - find in components by name or value object by property
          else {
            if (current.components) {
              const found = current.components.find(c => c.name === part);
              if (found) {
                current = found;
                console.log(`Browser: Found component by name '${part}':`, current);
              } else {
                console.log(`Browser: Component '${part}' not found`);
                current = null;
              }
            }
            // Try to access property in value object
            else if (current.value && typeof current.value === 'object' && current.value[part] !== undefined) {
              current = { value: current.value[part] };
              console.log(`Browser: Found property '${part}' in value:`, current);
            }
            // If no components but we have a value and this is the last part, we're done
            else if (i === pathParts.length - 1 && current.name === part && current.value !== undefined) {
              console.log(`Browser: Found final field '${part}' with value:`, current.value);
              break;
            } else {
              console.log(`Browser: No match for '${part}'`);
              current = null;
            }
          }
        }
        
        value = current?.value;
        console.log(`Browser: Final resolved value:`, value);
      }
    }

    if (value !== undefined) {
      return value.toString();
    }
  } catch (error) {
    console.error('Browser: Error processing path:', path, error);
  }

  console.log(`Browser: Returning mock value for path '${path}'`);
  return `Mock ${format} value`;
}

// Test the same paths that the CLI tests
const testPaths = [
  '#.inputs.orders.orders.0.trader',
  '#.inputs.orders.orders.0.collection', 
  '#.inputs.exchanges.exchanges.0.listing.tokenId',
  '#.inputs.exchanges.exchanges.0.listing.price',
  '#.inputs.orders.orders.1.trader',
  '#.inputs.orders.orders.1.collection',
  '#.inputs.exchanges.exchanges.1.listing.tokenId',
  '#.inputs.exchanges.exchanges.1.listing.price'
];

console.log('🧪 Testing Browser Path Resolution Logic');
console.log('==========================================');

testPaths.forEach((path, index) => {
  console.log(`\n--- Test ${index + 1}: ${path} ---`);
  const result = getFieldValueFromTransaction(path, 'test', null);
  console.log(`Result: ${result}`);
  console.log(`Status: ${result.startsWith('Mock') ? '❌ FAIL' : '✅ PASS'}`);
});