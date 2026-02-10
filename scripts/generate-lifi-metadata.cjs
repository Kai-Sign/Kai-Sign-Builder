const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// LiFi Diamond facets with their addresses and known function selectors
// Retrieved from on-chain facets() call
const FACET_SELECTORS = {
  "0xfdb9a62a5f4f98a0c4e4b864eb22a9eecb0bce5f": ["0xc18fa245", "0x54de26d9", "0xbd6d15ca", "0xfc1ebe3e", "0xe8bd0564", "0x26a93135", "0xad6607ff", "0xcda5f324", "0x1a0b79bf", "0x7cccba6d", "0x4bd751a8", "0x6c225efe", "0x3c580fed", "0x4b06e05f", "0x33619a2d", "0xc5e04e30", "0x1223354c", "0x76e04bbc", "0xc5ae0fe6", "0x04c5aa34", "0x161be542"],
  "0xb28dd740d27853a91639795223ab409088a73e23": ["0x1171c007", "0x00816c97", "0x6d028027", "0x90f3d77b", "0x94ddf663", "0x13f44d10", "0x9baf00f9", "0x56977cc0", "0xb06faf62", "0x51fed648"],
  "0x9fc3d15a029bfee6eb27e3d061210a465e231362": ["0x0680ded4", "0x082bc047", "0x03add8c3", "0x0b4cb5d8", "0x55c99cd8", "0x42afe79a", "0x8d03f456", "0xd40e64cc", "0xca360ae0"],
  "0x260fb3d593f6acb08e0aa380a123ce07d2bd4b7e": ["0xfc852c5a", "0xbe8a84ac", "0xaef365ad", "0xa2ed5607", "0xdee4be1b", "0xf6848697", "0x0193979f", "0x0078afb6"],
  "0x22b31a1a81d5e594315c866616db793e799556c5": ["0x536db266", "0xfbb2d381", "0xfcd8e49e", "0x9afc19c7", "0x44e2b18c", "0x2d2506a9", "0x124f1ead", "0xc3a6a96b"],
  "0x3de506059ae0b239e125e6b1365cfa92100540c0": ["0x54e97ec9", "0xcc41fe54", "0x808d859c", "0xdd081734", "0xd24c2325", "0xcd48728d", "0x1dc3017e", "0xdf834e15"],
  "0x8cd89ea14345f24d0299c2180aec97a417ca34e3": ["0x79b80512", "0x012f27e7", "0x1626cde1", "0xc93ff540", "0x7260352d", "0x36b92404", "0x72dd147e", "0xc5d60e97"],
  "0x7a5c119ec5ddbf9631cf40f6e5db28f31d4332a0": ["0x7f99d7af", "0x103c5200", "0xc318eeda", "0xee0aa320", "0x070e81f1", "0xd53482cf", "0xf58ae2ce"],
  "0x8c9dba771220ed09580b77f0765e7153fbde7790": ["0x5fd9ae2e", "0x2c57e884", "0x736eac0b", "0x4666fc80", "0x733214a3", "0xaf7060fd", "0xd5bcb610"],
  "0x108b0c3f20f266469fd2e98750926811ad632589": ["0x5df39dde", "0x9f5e58f5", "0xf2455b71", "0x4004633e", "0x2c7d2db0", "0x9eaeb24f"],
  "0x65d6b9a368be49bca4964b66e54f828cab64b8f9": ["0x46fd98e2", "0xfc5f1003", "0x606326ff", "0x194c869f", "0xb49d391d"],
  "0x26fc055eaf6a6df15502f2466990528ec55c857d": ["0xf21a2116", "0x981886a7", "0x81d82dd8", "0xae328590", "0x25d374e8"],
  "0xf5ba8db6fea7af820de35c8d0c294e17dbc1b9d2": ["0xcdffacc6", "0x52ef6b2c", "0xadfca15e", "0x7a0ed627", "0x01ffc9a7"],
  "0x6faa6906b9e4a59020e673910105567e809789e0": ["0x23452b9c", "0x7200b829", "0x8da5cb5b", "0xf2fde38b"],
  "0x6f2baa7cd5f156ca1b132f7ff11e0fa2ad775f61": ["0xf86368ae", "0x5ad317a4", "0x0340e905", "0x2fc487ae"],
  "0xad3f1634a917924cbb54a0f76e43ca035d2b6bcd": ["0xe796cd98", "0xf97136af", "0xa1f1ce43", "0x1794958f"],
  "0xb815b47ad429436892fc3c6ed1d401f515c7f763": ["0xbf69fa61", "0x89a30271", "0xe0a4201c", "0x4f3b0759"],
  "0xdc49bca8314e7cd7c90edb8652375a0b15efe611": ["0x82a3279b", "0x753cbab6", "0xe10c04c1"],
  "0xc4e5f14dfe359653d66ae49b1f12177e6f99102b": ["0xae0b91e5", "0x482c6a85", "0x0d19e519"],
  "0x88e0dd83e6da24bf317323e5ca06842406d57ed0": ["0xb94289bb", "0x092e8fa4", "0xa3443faa"],
  "0x54678c366682a29112609882dc58def6753bfc27": ["0xdecb09d7", "0xce8a97a5", "0x5bb5d448"],
  "0x29bedc1be2eecb654f7a9cd3f21b466c148186c2": ["0xce90a721", "0xb621b032", "0x30c48952"],
  "0x5ac2c4836c45faae84c7d73065796ac863ffb8c6": ["0x3961d1ed", "0xb3b63587", "0xa01fe784"],
  "0xfa93141130a11fdab7c6c800dfb93a5d19da6aa4": ["0x7766d1ed", "0x0ad553b3", "0xee3314a1"],
  "0xbf4ad13fa0e6e05916a78c201f147c5152dbe1c9": ["0x14d53077", "0xa6010a66", "0xfb214c2f"],
  "0xafe2648acc4a5720e0c3930df5bf247d446bffde": ["0x0ff754ea", "0x7e56b7b0", "0x9e75aa95"],
  "0x66fd4424bc4e24b6183e95dd74a3f3857725457f": ["0x1fe5bb31", "0x93057564", "0x5627b1f3"],
  "0xe46e9a5ae71f1fb3ac59d09469830d6ecc1d21f2": ["0x3f44d05f", "0x4213dfff", "0x22256e89"],
  "0xd69e5ea7458abff098e9240f81f733898535c7a0": ["0xbbbf77d5", "0x6f9206ba", "0x9c4b6dd9"],
  "0x77a13abb679a0dafb4435d1fa4ccc95d1ab51cfc": ["0x612ad9cb", "0xa4c3366e"],
  "0x03f58dc7e2195a0c6f501bc4819066fd9dfe307f": ["0x3f313808", "0xa8f66666"],
  "0x9a82bb477c30d92dab74875027e14d1de3510ef9": ["0xf66fe519", "0x7bf96e0a"],
  "0xac82fa2d953ee5c61d87686ade620b0728f484e6": ["0xc9851d0b", "0x3cc9517b"],
  "0x7570e6b01e43df1b0c67f99c4156285adc36c360": ["0x782621d8", "0x95726782"],
  "0x99fb0babba2c437153d25aff79dc80b905a27a5a": ["0xaf62c7d6", "0xb4f37581"],
  "0x69cb467efd8044ac9edb88f363309ab1cbfa0a15": ["0xa516f0f3", "0x5c2ed36a"],
  "0xef67be6d1a68ede5a21230629dfe896731adf947": ["0x28cc4316", "0x28832cbd"],
  "0x4640aaaab3e6f5bb9b4a16fb00ea0dbd6d98b397": ["0x6a51e9a9", "0x63267469"],
  "0x8bd90ea4ef3df26c385646f4f41e4c5e3c11bb2a": ["0xbab657d8", "0x8fab0663"],
  "0xcaefac1ea4dec8fd866cbc5b6dd3054f80d49b80": ["0x2541ec57", "0xad673d88"],
  "0x94ef6d1702ac7e30a5cef39dee26fab180c251fe": ["0x1458d7ad", "0xd9caed12"],
  "0x23fc1b73e66cd13e988170cb94e252cb7ff88185": ["0xb70fb9a5", "0x6e067161"],
  "0x989a7efabb9be76ac3424b940862d9cf55334873": ["0x64261d58", "0x21a3af52"],
  "0xa20d724c81ddde4a65f682a766881970245b31af": ["0x5f9af35d", "0x76ad76fe"],
  "0xa74c9c1b2194f27c372b0892839624852de21687": ["0x4630a0d8"],
  "0xf7993a8df974ad022647e63402d6315137c58abf": ["0x1f931c1c"]
};

// Common struct definitions used across LiFi facets
const COMMON_STRUCTS = {
  BridgeData: {
    type: "tuple",
    components: [
      { name: "transactionId", type: "bytes32" },
      { name: "bridge", type: "string" },
      { name: "integrator", type: "string" },
      { name: "referrer", type: "address" },
      { name: "sendingAssetId", type: "address" },
      { name: "receiver", type: "address" },
      { name: "minAmount", type: "uint256" },
      { name: "destinationChainId", type: "uint256" },
      { name: "hasSourceSwaps", type: "bool" },
      { name: "hasDestinationCall", type: "bool" }
    ]
  },
  SwapData: {
    type: "tuple",
    components: [
      { name: "callTo", type: "address" },
      { name: "approveTo", type: "address" },
      { name: "sendingAssetId", type: "address" },
      { name: "receivingAssetId", type: "address" },
      { name: "fromAmount", type: "uint256" },
      { name: "callData", type: "bytes" },
      { name: "requiresDeposit", type: "bool" }
    ]
  }
};

// Known function signatures mapped by selector (from LiFi contract types)
const KNOWN_FUNCTIONS = {
  // GenericSwapFacetV3 functions
  "0x54e97ec9": {
    name: "swapTokensSingleV3ERC20ToERC20",
    inputs: [
      { name: "_transactionId", type: "bytes32" },
      { name: "_integrator", type: "string" },
      { name: "_referrer", type: "string" },
      { name: "_receiver", type: "address" },
      { name: "_minAmountOut", type: "uint256" },
      { name: "_swapData", ...COMMON_STRUCTS.SwapData }
    ]
  },
  "0xcc41fe54": {
    name: "swapTokensSingleV3ERC20ToNative",
    inputs: [
      { name: "_transactionId", type: "bytes32" },
      { name: "_integrator", type: "string" },
      { name: "_referrer", type: "string" },
      { name: "_receiver", type: "address" },
      { name: "_minAmountOut", type: "uint256" },
      { name: "_swapData", ...COMMON_STRUCTS.SwapData }
    ]
  },
  "0x808d859c": {
    name: "swapTokensSingleV3NativeToERC20",
    inputs: [
      { name: "_transactionId", type: "bytes32" },
      { name: "_integrator", type: "string" },
      { name: "_referrer", type: "string" },
      { name: "_receiver", type: "address" },
      { name: "_minAmountOut", type: "uint256" },
      { name: "_swapData", ...COMMON_STRUCTS.SwapData }
    ]
  },
  "0xdd081734": {
    name: "swapTokensMultipleV3ERC20ToERC20",
    inputs: [
      { name: "_transactionId", type: "bytes32" },
      { name: "_integrator", type: "string" },
      { name: "_referrer", type: "string" },
      { name: "_receiver", type: "address" },
      { name: "_minAmountOut", type: "uint256" },
      { name: "_swapData", type: "tuple[]", components: COMMON_STRUCTS.SwapData.components }
    ]
  },
  "0xd24c2325": {
    name: "swapTokensMultipleV3ERC20ToNative",
    inputs: [
      { name: "_transactionId", type: "bytes32" },
      { name: "_integrator", type: "string" },
      { name: "_referrer", type: "string" },
      { name: "_receiver", type: "address" },
      { name: "_minAmountOut", type: "uint256" },
      { name: "_swapData", type: "tuple[]", components: COMMON_STRUCTS.SwapData.components }
    ]
  },
  "0xcd48728d": {
    name: "swapTokensMultipleV3NativeToERC20",
    inputs: [
      { name: "_transactionId", type: "bytes32" },
      { name: "_integrator", type: "string" },
      { name: "_referrer", type: "string" },
      { name: "_receiver", type: "address" },
      { name: "_minAmountOut", type: "uint256" },
      { name: "_swapData", type: "tuple[]", components: COMMON_STRUCTS.SwapData.components }
    ]
  },

  // StargateFacetV2 functions
  "0x7cccba6d": {
    name: "startBridgeTokensViaStargate",
    inputs: [
      { name: "_bridgeData", ...COMMON_STRUCTS.BridgeData },
      { name: "_stargateData", type: "tuple", components: [
        { name: "assetId", type: "uint16" },
        { name: "sendParams", type: "tuple", components: [
          { name: "dstEid", type: "uint32" },
          { name: "to", type: "bytes32" },
          { name: "amountLD", type: "uint256" },
          { name: "minAmountLD", type: "uint256" },
          { name: "extraOptions", type: "bytes" },
          { name: "composeMsg", type: "bytes" },
          { name: "oftCmd", type: "bytes" }
        ]},
        { name: "fee", type: "tuple", components: [
          { name: "nativeFee", type: "uint256" },
          { name: "lzTokenFee", type: "uint256" }
        ]},
        { name: "refundAddress", type: "address" }
      ]}
    ]
  },
  "0x4bd751a8": {
    name: "swapAndStartBridgeTokensViaStargate",
    inputs: [
      { name: "_bridgeData", ...COMMON_STRUCTS.BridgeData },
      { name: "_swapData", type: "tuple[]", components: COMMON_STRUCTS.SwapData.components },
      { name: "_stargateData", type: "tuple", components: [
        { name: "assetId", type: "uint16" },
        { name: "sendParams", type: "tuple", components: [
          { name: "dstEid", type: "uint32" },
          { name: "to", type: "bytes32" },
          { name: "amountLD", type: "uint256" },
          { name: "minAmountLD", type: "uint256" },
          { name: "extraOptions", type: "bytes" },
          { name: "composeMsg", type: "bytes" },
          { name: "oftCmd", type: "bytes" }
        ]},
        { name: "fee", type: "tuple", components: [
          { name: "nativeFee", type: "uint256" },
          { name: "lzTokenFee", type: "uint256" }
        ]},
        { name: "refundAddress", type: "address" }
      ]}
    ]
  },

  // AcrossFacetV3 functions
  "0xf66fe519": {
    name: "startBridgeTokensViaAcrossV3",
    inputs: [
      { name: "_bridgeData", ...COMMON_STRUCTS.BridgeData },
      { name: "_acrossData", type: "tuple", components: [
        { name: "receiverAddress", type: "address" },
        { name: "refundAddress", type: "address" },
        { name: "receivingAssetId", type: "address" },
        { name: "outputAmount", type: "uint256" },
        { name: "exclusiveRelayer", type: "address" },
        { name: "quoteTimestamp", type: "uint32" },
        { name: "fillDeadline", type: "uint32" },
        { name: "exclusivityDeadline", type: "uint32" },
        { name: "message", type: "bytes" }
      ]}
    ]
  },
  "0x7bf96e0a": {
    name: "swapAndStartBridgeTokensViaAcrossV3",
    inputs: [
      { name: "_bridgeData", ...COMMON_STRUCTS.BridgeData },
      { name: "_swapData", type: "tuple[]", components: COMMON_STRUCTS.SwapData.components },
      { name: "_acrossData", type: "tuple", components: [
        { name: "receiverAddress", type: "address" },
        { name: "refundAddress", type: "address" },
        { name: "receivingAssetId", type: "address" },
        { name: "outputAmount", type: "uint256" },
        { name: "exclusiveRelayer", type: "address" },
        { name: "quoteTimestamp", type: "uint32" },
        { name: "fillDeadline", type: "uint32" },
        { name: "exclusivityDeadline", type: "uint32" },
        { name: "message", type: "bytes" }
      ]}
    ]
  },

  // HopFacet functions
  "0x612ad9cb": {
    name: "startBridgeTokensViaHop",
    inputs: [
      { name: "_bridgeData", ...COMMON_STRUCTS.BridgeData },
      { name: "_hopData", type: "tuple", components: [
        { name: "bonderFee", type: "uint256" },
        { name: "amountOutMin", type: "uint256" },
        { name: "deadline", type: "uint256" },
        { name: "destinationAmountOutMin", type: "uint256" },
        { name: "destinationDeadline", type: "uint256" },
        { name: "hopBridge", type: "address" },
        { name: "relayer", type: "address" },
        { name: "relayerFee", type: "uint256" }
      ]}
    ]
  },
  "0xa4c3366e": {
    name: "swapAndStartBridgeTokensViaHop",
    inputs: [
      { name: "_bridgeData", ...COMMON_STRUCTS.BridgeData },
      { name: "_swapData", type: "tuple[]", components: COMMON_STRUCTS.SwapData.components },
      { name: "_hopData", type: "tuple", components: [
        { name: "bonderFee", type: "uint256" },
        { name: "amountOutMin", type: "uint256" },
        { name: "deadline", type: "uint256" },
        { name: "destinationAmountOutMin", type: "uint256" },
        { name: "destinationDeadline", type: "uint256" },
        { name: "hopBridge", type: "address" },
        { name: "relayer", type: "address" },
        { name: "relayerFee", type: "uint256" }
      ]}
    ]
  },

  // CBridgeFacet functions
  "0xc9851d0b": {
    name: "startBridgeTokensViaCBridge",
    inputs: [
      { name: "_bridgeData", ...COMMON_STRUCTS.BridgeData },
      { name: "_cBridgeData", type: "tuple", components: [
        { name: "maxSlippage", type: "uint32" },
        { name: "nonce", type: "uint64" }
      ]}
    ]
  },
  "0x3cc9517b": {
    name: "swapAndStartBridgeTokensViaCBridge",
    inputs: [
      { name: "_bridgeData", ...COMMON_STRUCTS.BridgeData },
      { name: "_swapData", type: "tuple[]", components: COMMON_STRUCTS.SwapData.components },
      { name: "_cBridgeData", type: "tuple", components: [
        { name: "maxSlippage", type: "uint32" },
        { name: "nonce", type: "uint64" }
      ]}
    ]
  },

  // SymbiosisFacet functions
  "0x3f313808": {
    name: "startBridgeTokensViaSymbiosis",
    inputs: [
      { name: "_bridgeData", ...COMMON_STRUCTS.BridgeData },
      { name: "_symbiosisData", type: "tuple", components: [
        { name: "firstSwapCalldata", type: "bytes" },
        { name: "secondSwapCalldata", type: "bytes" },
        { name: "intermediateToken", type: "address" },
        { name: "firstDexRouter", type: "address" },
        { name: "secondDexRouter", type: "address" },
        { name: "approvedTokens", type: "address[]" },
        { name: "callTo", type: "address" },
        { name: "callData", type: "bytes" }
      ]}
    ]
  },
  "0xa8f66666": {
    name: "swapAndStartBridgeTokensViaSymbiosis",
    inputs: [
      { name: "_bridgeData", ...COMMON_STRUCTS.BridgeData },
      { name: "_swapData", type: "tuple[]", components: COMMON_STRUCTS.SwapData.components },
      { name: "_symbiosisData", type: "tuple", components: [
        { name: "firstSwapCalldata", type: "bytes" },
        { name: "secondSwapCalldata", type: "bytes" },
        { name: "intermediateToken", type: "address" },
        { name: "firstDexRouter", type: "address" },
        { name: "secondDexRouter", type: "address" },
        { name: "approvedTokens", type: "address[]" },
        { name: "callTo", type: "address" },
        { name: "callData", type: "bytes" }
      ]}
    ]
  },

  // DeBridgeDlnFacet functions
  "0xae0b91e5": {
    name: "startBridgeTokensViaDeBridgeDln",
    inputs: [
      { name: "_bridgeData", ...COMMON_STRUCTS.BridgeData },
      { name: "_deBridgeData", type: "tuple", components: [
        { name: "receivingAssetId", type: "bytes" },
        { name: "receiver", type: "bytes" },
        { name: "minAmountOut", type: "uint256" }
      ]}
    ]
  },
  "0x482c6a85": {
    name: "swapAndStartBridgeTokensViaDeBridgeDln",
    inputs: [
      { name: "_bridgeData", ...COMMON_STRUCTS.BridgeData },
      { name: "_swapData", type: "tuple[]", components: COMMON_STRUCTS.SwapData.components },
      { name: "_deBridgeData", type: "tuple", components: [
        { name: "receivingAssetId", type: "bytes" },
        { name: "receiver", type: "bytes" },
        { name: "minAmountOut", type: "uint256" }
      ]}
    ]
  },

  // AllBridgeFacet functions
  "0x5df39dde": {
    name: "startBridgeTokensViaAllBridge",
    inputs: [
      { name: "_bridgeData", ...COMMON_STRUCTS.BridgeData },
      { name: "_allBridgeData", type: "tuple", components: [
        { name: "fees", type: "uint256" },
        { name: "recipient", type: "bytes32" },
        { name: "destinationChainId", type: "uint256" },
        { name: "receiveToken", type: "bytes32" },
        { name: "nonce", type: "uint256" },
        { name: "messenger", type: "uint8" },
        { name: "payFeeWithSendingAsset", type: "bool" }
      ]}
    ]
  },
  "0x9f5e58f5": {
    name: "swapAndStartBridgeTokensViaAllBridge",
    inputs: [
      { name: "_bridgeData", ...COMMON_STRUCTS.BridgeData },
      { name: "_swapData", type: "tuple[]", components: COMMON_STRUCTS.SwapData.components },
      { name: "_allBridgeData", type: "tuple", components: [
        { name: "fees", type: "uint256" },
        { name: "recipient", type: "bytes32" },
        { name: "destinationChainId", type: "uint256" },
        { name: "receiveToken", type: "bytes32" },
        { name: "nonce", type: "uint256" },
        { name: "messenger", type: "uint8" },
        { name: "payFeeWithSendingAsset", type: "bool" }
      ]}
    ]
  },

  // SquidFacet functions
  "0xb94289bb": {
    name: "startBridgeTokensViaSquid",
    inputs: [
      { name: "_bridgeData", ...COMMON_STRUCTS.BridgeData },
      { name: "_squidData", type: "tuple", components: [
        { name: "routeType", type: "uint8" },
        { name: "destinationChain", type: "string" },
        { name: "destinationAddress", type: "string" },
        { name: "bridgedTokenSymbol", type: "string" },
        { name: "depositAssetId", type: "address" },
        { name: "sourceCalls", type: "tuple[]", components: [
          { name: "callType", type: "uint8" },
          { name: "target", type: "address" },
          { name: "value", type: "uint256" },
          { name: "callData", type: "bytes" },
          { name: "payload", type: "bytes" }
        ]},
        { name: "destinationCalls", type: "bytes" },
        { name: "fee", type: "uint256" }
      ]}
    ]
  },
  "0x092e8fa4": {
    name: "swapAndStartBridgeTokensViaSquid",
    inputs: [
      { name: "_bridgeData", ...COMMON_STRUCTS.BridgeData },
      { name: "_swapData", type: "tuple[]", components: COMMON_STRUCTS.SwapData.components },
      { name: "_squidData", type: "tuple", components: [
        { name: "routeType", type: "uint8" },
        { name: "destinationChain", type: "string" },
        { name: "destinationAddress", type: "string" },
        { name: "bridgedTokenSymbol", type: "string" },
        { name: "depositAssetId", type: "address" },
        { name: "sourceCalls", type: "tuple[]", components: [
          { name: "callType", type: "uint8" },
          { name: "target", type: "address" },
          { name: "value", type: "uint256" },
          { name: "callData", type: "bytes" },
          { name: "payload", type: "bytes" }
        ]},
        { name: "destinationCalls", type: "bytes" },
        { name: "fee", type: "uint256" }
      ]}
    ]
  },

  // MayanFacet functions
  "0xdecb09d7": {
    name: "startBridgeTokensViaMayan",
    inputs: [
      { name: "_bridgeData", ...COMMON_STRUCTS.BridgeData },
      { name: "_mayanData", type: "tuple", components: [
        { name: "mayanProtocol", type: "address" },
        { name: "protocolData", type: "bytes" }
      ]}
    ]
  },
  "0xce8a97a5": {
    name: "swapAndStartBridgeTokensViaMayan",
    inputs: [
      { name: "_bridgeData", ...COMMON_STRUCTS.BridgeData },
      { name: "_swapData", type: "tuple[]", components: COMMON_STRUCTS.SwapData.components },
      { name: "_mayanData", type: "tuple", components: [
        { name: "mayanProtocol", type: "address" },
        { name: "protocolData", type: "bytes" }
      ]}
    ]
  },

  // WithdrawFacet
  "0xd9caed12": {
    name: "withdraw",
    inputs: [
      { name: "_assetAddress", type: "address" },
      { name: "_to", type: "address" },
      { name: "_amount", type: "uint256" }
    ]
  },

  // DiamondLoupeFacet
  "0xcdffacc6": {
    name: "facetAddress",
    inputs: [{ name: "_functionSelector", type: "bytes4" }]
  },
  "0x7a0ed627": {
    name: "facets",
    inputs: []
  },
  "0x52ef6b2c": {
    name: "facetAddresses",
    inputs: []
  },
  "0xadfca15e": {
    name: "facetFunctionSelectors",
    inputs: [{ name: "_facet", type: "address" }]
  },
  "0x01ffc9a7": {
    name: "supportsInterface",
    inputs: [{ name: "_interfaceId", type: "bytes4" }]
  },

  // OwnershipFacet
  "0x8da5cb5b": {
    name: "owner",
    inputs: []
  },
  "0xf2fde38b": {
    name: "transferOwnership",
    inputs: [{ name: "_newOwner", type: "address" }]
  },
  "0x23452b9c": {
    name: "cancelOwnershipTransfer",
    inputs: []
  },
  "0x7200b829": {
    name: "confirmOwnershipTransfer",
    inputs: []
  },

  // DiamondCutFacet
  "0x1f931c1c": {
    name: "diamondCut",
    inputs: [
      { name: "_diamondCut", type: "tuple[]", components: [
        { name: "facetAddress", type: "address" },
        { name: "action", type: "uint8" },
        { name: "functionSelectors", type: "bytes4[]" }
      ]},
      { name: "_init", type: "address" },
      { name: "_calldata", type: "bytes" }
    ]
  },

  // GasZipFacet functions
  "0xfc5f1003": {
    name: "startBridgeTokensViaGasZip",
    inputs: [
      { name: "_bridgeData", ...COMMON_STRUCTS.BridgeData },
      { name: "_gasZipData", type: "tuple", components: [
        { name: "gasZipChainId", type: "bytes32" },
        { name: "gasZipAmount", type: "uint256" }
      ]}
    ]
  },
  "0x606326ff": {
    name: "swapAndStartBridgeTokensViaGasZip",
    inputs: [
      { name: "_bridgeData", ...COMMON_STRUCTS.BridgeData },
      { name: "_swapData", type: "tuple[]", components: COMMON_STRUCTS.SwapData.components },
      { name: "_gasZipData", type: "tuple", components: [
        { name: "gasZipChainId", type: "bytes32" },
        { name: "gasZipAmount", type: "uint256" }
      ]}
    ]
  }
};

// Build signature from inputs
function buildSignature(name, inputs) {
  const types = inputs.map(input => buildTypeString(input));
  return `${name}(${types.join(',')})`;
}

function buildTypeString(input) {
  if (input.type === 'tuple') {
    const components = input.components.map(c => buildTypeString(c));
    return `(${components.join(',')})`;
  } else if (input.type === 'tuple[]') {
    const components = input.components.map(c => buildTypeString(c));
    return `(${components.join(',')})[]`;
  }
  return input.type;
}

// Generate display fields for a function
function generateDisplayFields(inputs) {
  const fields = [];

  for (const input of inputs) {
    if (input.name === '_bridgeData') {
      // Add key BridgeData fields
      fields.push({
        path: `#.${input.name}.sendingAssetId`,
        label: "Token to Bridge",
        format: "addressName"
      });
      fields.push({
        path: `#.${input.name}.receiver`,
        label: "Receiver",
        format: "addressName"
      });
      fields.push({
        path: `#.${input.name}.minAmount`,
        label: "Minimum Amount",
        format: "tokenAmount",
        params: { tokenPath: `#.${input.name}.sendingAssetId` }
      });
      fields.push({
        path: `#.${input.name}.destinationChainId`,
        label: "Destination Chain",
        format: "raw"
      });
    } else if (input.name === '_swapData') {
      if (input.type === 'tuple[]') {
        fields.push({
          path: `#.${input.name}.[].sendingAssetId`,
          label: "Input Token",
          format: "addressName"
        });
        fields.push({
          path: `#.${input.name}.[].receivingAssetId`,
          label: "Output Token",
          format: "addressName"
        });
        fields.push({
          path: `#.${input.name}.[].fromAmount`,
          label: "Swap Amount",
          format: "tokenAmount",
          params: { tokenPath: `#.${input.name}.[].sendingAssetId` }
        });
      } else {
        fields.push({
          path: `#.${input.name}.sendingAssetId`,
          label: "Input Token",
          format: "addressName"
        });
        fields.push({
          path: `#.${input.name}.receivingAssetId`,
          label: "Output Token",
          format: "addressName"
        });
        fields.push({
          path: `#.${input.name}.fromAmount`,
          label: "Swap Amount",
          format: "tokenAmount",
          params: { tokenPath: `#.${input.name}.sendingAssetId` }
        });
      }
    } else if (input.name === '_receiver') {
      fields.push({
        path: `#.${input.name}`,
        label: "Receiver",
        format: "addressName"
      });
    } else if (input.name === '_minAmountOut') {
      fields.push({
        path: `#.${input.name}`,
        label: "Minimum Output",
        format: "raw"
      });
    }
  }

  return fields;
}

// Generate intent description
function generateIntent(funcName) {
  if (funcName.includes('swap') && funcName.includes('Bridge')) {
    const protocol = extractProtocol(funcName);
    return `Swap tokens and bridge via ${protocol}`;
  } else if (funcName.includes('Bridge') || funcName.includes('bridge')) {
    const protocol = extractProtocol(funcName);
    return `Bridge tokens via ${protocol}`;
  } else if (funcName.includes('swap') || funcName.includes('Swap')) {
    return `Swap tokens`;
  } else if (funcName.includes('withdraw')) {
    return `Withdraw tokens`;
  }
  return `Execute ${funcName}`;
}

function extractProtocol(funcName) {
  const protocols = ['Stargate', 'Across', 'Hop', 'CBridge', 'Symbiosis', 'DeBridge', 'AllBridge', 'Squid', 'Mayan', 'ThorSwap', 'Relay', 'Chainflip', 'Glacis', 'Garden', 'GasZip'];
  for (const protocol of protocols) {
    if (funcName.includes(protocol)) return protocol;
  }
  return 'LiFi';
}

// Main chain deployments for LiFi Diamond facets
const CHAIN_DEPLOYMENTS = [
  { chainId: 1, name: "mainnet" },
  { chainId: 137, name: "polygon" },
  { chainId: 42161, name: "arbitrum" },
  { chainId: 10, name: "optimism" },
  { chainId: 8453, name: "base" },
  { chainId: 56, name: "bsc" },
  { chainId: 43114, name: "avalanche" },
  { chainId: 250, name: "fantom" },
  { chainId: 100, name: "gnosis" },
  { chainId: 324, name: "zksync" },
  { chainId: 59144, name: "linea" },
  { chainId: 534352, name: "scroll" },
  { chainId: 81457, name: "blast" },
  { chainId: 34443, name: "mode" }
];

// Generate metadata for a single facet
function generateFacetMetadata(facetAddress, selectors) {
  const abi = [];
  const formats = {};

  for (const selector of selectors) {
    const funcDef = KNOWN_FUNCTIONS[selector];
    if (!funcDef) continue;

    const signature = buildSignature(funcDef.name, funcDef.inputs);

    // Add to ABI
    abi.push({
      type: "function",
      name: funcDef.name,
      inputs: funcDef.inputs,
      outputs: [],
      stateMutability: "payable",
      selector: selector
    });

    // Generate display format
    const fields = generateDisplayFields(funcDef.inputs);
    if (fields.length > 0) {
      formats[signature] = {
        intent: generateIntent(funcDef.name),
        fields: fields
      };
    }
  }

  if (abi.length === 0) {
    return null;
  }

  // Build deployments object
  const deployments = {};
  for (const chain of CHAIN_DEPLOYMENTS) {
    deployments[chain.name] = {
      address: facetAddress,
      chainId: chain.chainId
    };
  }

  return {
    "$schema": "https://erc7730.org/schema/v1",
    context: {
      contract: {
        abi: abi,
        deployments: deployments
      }
    },
    metadata: {
      owner: "LI.FI",
      info: {
        url: "https://li.fi",
        legalName: "LI.FI",
        lastUpdate: new Date().toISOString().split('T')[0]
      },
      token: {
        standard: "none"
      }
    },
    display: {
      formats: formats
    }
  };
}

async function main() {
  console.log('Generating LiFi Diamond COMBINED metadata file...\n');

  const outputDir = 'scripts/lifi-facet-metadata';
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // COMBINED metadata for Diamond address (what users actually call)
  const LIFI_DIAMOND_ADDRESS = '0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE';
  const combinedAbi = [];
  const combinedFormats = {};
  let totalFunctions = 0;

  // Collect ALL functions from ALL facets into ONE metadata file
  for (const [facetAddress, selectors] of Object.entries(FACET_SELECTORS)) {
    for (const selector of selectors) {
      const funcDef = KNOWN_FUNCTIONS[selector];
      if (!funcDef) continue;

      const signature = buildSignature(funcDef.name, funcDef.inputs);

      // Add to combined ABI
      combinedAbi.push({
        type: "function",
        name: funcDef.name,
        inputs: funcDef.inputs,
        outputs: [],
        stateMutability: "payable",
        selector: selector
      });

      // Generate display format
      const fields = generateDisplayFields(funcDef.inputs);
      if (fields.length > 0) {
        combinedFormats[signature] = {
          intent: generateIntent(funcDef.name),
          fields: fields
        };
        totalFunctions++;
        console.log(`  Added: ${funcDef.name} (${selector}) from ${facetAddress}`);
      }
    }
  }

  // Build deployments for Diamond address (not facet addresses!)
  const deployments = {};
  for (const chain of CHAIN_DEPLOYMENTS) {
    deployments[chain.name] = {
      address: LIFI_DIAMOND_ADDRESS,
      chainId: chain.chainId
    };
  }

  const combinedMetadata = {
    "$schema": "https://erc7730.org/schema/v1",
    context: {
      contract: {
        abi: combinedAbi,
        deployments: deployments
      }
    },
    metadata: {
      owner: "LI.FI",
      info: {
        url: "https://li.fi",
        legalName: "LI.FI",
        lastUpdate: new Date().toISOString().split('T')[0]
      },
      token: {
        standard: "none"
      }
    },
    display: {
      formats: combinedFormats
    }
  };

  // Save combined metadata
  const combinedFilename = 'lifi-diamond-combined.json';
  const combinedFilepath = path.join(outputDir, combinedFilename);
  fs.writeFileSync(combinedFilepath, JSON.stringify(combinedMetadata, null, 2));

  console.log(`\n=== Summary ===`);
  console.log(`Generated COMBINED metadata file: ${combinedFilename}`);
  console.log(`Diamond address: ${LIFI_DIAMOND_ADDRESS}`);
  console.log(`Total functions covered: ${totalFunctions}`);
  console.log(`Chains: ${CHAIN_DEPLOYMENTS.map(c => c.name).join(', ')}`);

  // Also generate per-facet files for reference
  console.log('\nAlso generating per-facet reference files...');
  const generatedFiles = [];

  for (const [facetAddress, selectors] of Object.entries(FACET_SELECTORS)) {
    const metadata = generateFacetMetadata(facetAddress, selectors);

    if (metadata && Object.keys(metadata.display.formats).length > 0) {
      const filename = `${facetAddress}.json`;
      const filepath = path.join(outputDir, filename);

      fs.writeFileSync(filepath, JSON.stringify(metadata, null, 2));

      const funcCount = Object.keys(metadata.display.formats).length;
      generatedFiles.push({
        address: facetAddress,
        file: filepath,
        functions: funcCount
      });
    }
  }

  // Save manifest
  const manifest = {
    generated: new Date().toISOString(),
    diamondAddress: LIFI_DIAMOND_ADDRESS,
    combinedFile: combinedFilepath,
    totalFunctions: totalFunctions,
    facetFiles: generatedFiles
  };
  fs.writeFileSync(path.join(outputDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`\nManifest saved to ${outputDir}/manifest.json`);
}

main().catch(console.error);
