/**
 * Token Registry
 *
 * Provides token metadata (symbol, decimals) for common ERC-20 tokens
 * Used to format amounts as "1,000 USDC" instead of raw "1000000"
 *
 * ~170 tokens across Ethereum Mainnet, Gnosis, Arbitrum, Base, Optimism, Polygon
 * Source: Etherscan top 200 by market cap (verified 2026-03-22)
 * All decimals individually verified via Etherscan contract pages
 */

// All addresses lowercase for matching
export const KNOWN_TOKENS = {

  // ── Ethereum Mainnet — Stablecoins ──────────────────────────────────
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': { symbol: 'USDC', decimals: 6, name: 'USD Coin' },
  '0xdac17f958d2ee523a2206206994597c13d831ec7': { symbol: 'USDT', decimals: 6, name: 'Tether USD' },
  '0x6b175474e89094c44da98b954eedeac495271d0f': { symbol: 'DAI', decimals: 18, name: 'Dai Stablecoin' },
  '0x4fabb145d64652a948d72533023f6e7a623c7c53': { symbol: 'BUSD', decimals: 18, name: 'Binance USD' },
  '0x853d955acef822db058eb8505911ed77f175b99e': { symbol: 'FRAX', decimals: 18, name: 'Frax' },
  '0x0000000000085d4780b73119b644ae5ecd22b376': { symbol: 'TUSD', decimals: 18, name: 'TrueUSD' },
  '0x5f98805a4e8be255a32880fdec7f6728c6568ba0': { symbol: 'LUSD', decimals: 18, name: 'Liquity USD' },
  '0xdc035d45d973e3ec169d2276ddab16f1e407384f': { symbol: 'USDS', decimals: 18, name: 'USDS' },
  '0x4c9edd5852cd905f086c759e8383e09bff1e68b3': { symbol: 'USDe', decimals: 18, name: 'Ethena USDe' },
  '0x9d39a5de30e57443bff2a8307a4256c8797a3497': { symbol: 'sUSDe', decimals: 18, name: 'Staked USDe' },
  '0x6c3ea9036406852006290770bedfcaba0e23a0e8': { symbol: 'PYUSD', decimals: 6, name: 'PayPal USD' },
  '0x40d16fc0246ad3160ccc09b8d0d3a2cd28ae6c2f': { symbol: 'GHO', decimals: 18, name: 'GHO' },
  '0xf939e0a03fb07f59a73934160d4ccf6cfe4a7b50': { symbol: 'crvUSD', decimals: 18, name: 'Curve USD' },
  '0x57ab1ec28d129707052df4df418d58a2d46d5f51': { symbol: 'sUSD', decimals: 18, name: 'Synthetix USD' },
  '0x1abaea1f7c830bd89acc67ec4af516284b1bc33c': { symbol: 'EURC', decimals: 6, name: 'Euro Coin' },
  '0x45804880de22913dafe09f4980848ece6ecbaf78': { symbol: 'PAXG', decimals: 18, name: 'Paxos Gold' },
  '0x8292bb45bf1ee4d140127049757c2e0ff06317ed': { symbol: 'RLUSD', decimals: 18, name: 'Ripple USD' },
  '0x4f8e5de400de08b164e7421b3ee387f461becd1a': { symbol: 'USDD', decimals: 18, name: 'USDD' },
  '0x73a15fed60bf67631dc6cd7bc5b6e8da8190acf5': { symbol: 'USD0', decimals: 18, name: 'Usual USD' },
  '0x96f6ef951840721adbf46ac996b59e0235cb985c': { symbol: 'USDY', decimals: 18, name: 'Ondo US Dollar Yield' },
  '0xc5f0f7b66764f6ec8c8dff7ba683102295e16409': { symbol: 'FDUSD', decimals: 18, name: 'First Digital USD' },
  '0xdb25f211ab05b1c97d595516f45794528a807ad8': { symbol: 'EURS', decimals: 2, name: 'STASIS Euro' },
  '0x68749665ff8d2d112fa859aa293f07a622782f38': { symbol: 'XAUt', decimals: 6, name: 'Tether Gold' },

  // ── Ethereum Mainnet — ETH Derivatives ──────────────────────────────
  '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': { symbol: 'WETH', decimals: 18, name: 'Wrapped Ether' },
  '0xae7ab96520de3a18e5e111b5eaab095312d7fe84': { symbol: 'stETH', decimals: 18, name: 'Lido Staked ETH' },
  '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0': { symbol: 'wstETH', decimals: 18, name: 'Wrapped stETH' },
  '0xbe9895146f7af43049ca1c1ae358b0541ea49704': { symbol: 'cbETH', decimals: 18, name: 'Coinbase Wrapped Staked ETH' },
  '0xae78736cd615f374d3085123a210448e74fc6393': { symbol: 'rETH', decimals: 18, name: 'Rocket Pool ETH' },
  '0xcd5fe23c85820f7b72d0926fc9b05b43e359b7ee': { symbol: 'weETH', decimals: 18, name: 'Wrapped eETH' },
  '0xbf5495efe5db9ce00f80364c8b423567e58d2110': { symbol: 'ezETH', decimals: 18, name: 'Renzo Restaked ETH' },
  '0xa1290d69c65a6fe4df752f95823fae25cb99e5a7': { symbol: 'rsETH', decimals: 18, name: 'KelpDAO Restaked ETH' },
  '0xf951e335afb289fa71f488748039e0aff3dd12ea': { symbol: 'swETH', decimals: 18, name: 'Swell ETH' },
  '0xd5f7838f5c461feff7fe49ea5ebaf7728bb0adfa': { symbol: 'mETH', decimals: 18, name: 'Mantle Staked ETH' },
  '0xa35b1b31ce002fbf2058d742f44a6ae6501e7d07': { symbol: 'ETHx', decimals: 18, name: 'Stader ETHx' },
  '0xf1c9acdc66974dfb6decb12aa385b9cd01190e38': { symbol: 'osETH', decimals: 18, name: 'StakeWise osETH' },
  '0x35fa164735182de50811e8e2e824cfb9b6118ac2': { symbol: 'eETH', decimals: 18, name: 'ether.fi ETH' },
  '0xe95a203b1a91a908f9b9ce46459d101078c2ca59': { symbol: 'ankrETH', decimals: 18, name: 'Ankr Staked ETH' },
  '0xa2e3356610840701bdf5611a53974510ae27e2e1': { symbol: 'wBETH', decimals: 18, name: 'Wrapped Binance Beacon ETH' },
  '0x4d5f47fa6a74757f35c14fd3a6ef8e3c9bc514e8': { symbol: 'aEthWETH', decimals: 18, name: 'Aave Ethereum WETH' },
  '0xac3e018457b222d93114458476f3e3416abbe38f': { symbol: 'sfrxETH', decimals: 18, name: 'Staked Frax ETH' },

  // ── Ethereum Mainnet — BTC Derivatives ──────────────────────────────
  '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': { symbol: 'WBTC', decimals: 8, name: 'Wrapped BTC' },
  '0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf': { symbol: 'cbBTC', decimals: 8, name: 'Coinbase Wrapped BTC' },
  '0x18084fba666a33d37592fa2633fd49a74dd93a88': { symbol: 'tBTC', decimals: 18, name: 'tBTC v2' },
  '0x66eff5221ca926636224650fd3b9c497ff828f7d': { symbol: 'multiBTC', decimals: 8, name: 'MultiBTC' },
  '0x8236a87084f8b84306f72007f36f2618a5634494': { symbol: 'LBTC', decimals: 18, name: 'Lombard BTC' },

  // ── Ethereum Mainnet — DeFi Governance/Protocol ─────────────────────
  '0x514910771af9ca656af840dff83e8264ecf986ca': { symbol: 'LINK', decimals: 18, name: 'Chainlink' },
  '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984': { symbol: 'UNI', decimals: 18, name: 'Uniswap' },
  '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9': { symbol: 'AAVE', decimals: 18, name: 'Aave' },
  '0xc00e94cb662c3520282e6f5717214004a7f26888': { symbol: 'COMP', decimals: 18, name: 'Compound' },
  '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2': { symbol: 'MKR', decimals: 18, name: 'Maker' },
  '0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f': { symbol: 'SNX', decimals: 18, name: 'Synthetix' },
  '0xd533a949740bb3306d119cc777fa900ba034cd52': { symbol: 'CRV', decimals: 18, name: 'Curve DAO' },
  '0x5a98fcbea516cf06857215779fd812ca3bef1b32': { symbol: 'LDO', decimals: 18, name: 'Lido DAO' },
  '0xba100000625a3754423978a60c9317c58a424e3d': { symbol: 'BAL', decimals: 18, name: 'Balancer' },
  '0x6b3595068778dd592e39a122f4f5a5cf09c90fe2': { symbol: 'SUSHI', decimals: 18, name: 'SushiSwap' },
  '0x111111111117dc0aa78b770fa6a738034120c302': { symbol: '1INCH', decimals: 18, name: '1inch' },
  '0xc18360217d8f7ab5e7c516566761ea12ce7f9d72': { symbol: 'ENS', decimals: 18, name: 'Ethereum Name Service' },
  '0x92d6c1e31e14520e676a687f0a93788b716bff5d': { symbol: 'DYDX', decimals: 18, name: 'dYdX' },
  '0xd33526068d116ce69f19a9ee46f0bd304f21a51f': { symbol: 'RPL', decimals: 18, name: 'Rocket Pool' },
  '0x4e3fbd56cd56c3e72c1403e103b45db9da5b9d2b': { symbol: 'CVX', decimals: 18, name: 'Convex Finance' },
  '0x3432b6a60d23ca0dfca7761b7ab56b8edbc4eb5c': { symbol: 'FXS', decimals: 18, name: 'Frax Share' },
  '0xc0c293ce456ff0ed870add98a0828dd7d39e5736': { symbol: 'AURA', decimals: 18, name: 'Aura Finance' },
  '0x808507121b80c02388fad14726482e061b8da827': { symbol: 'PENDLE', decimals: 18, name: 'Pendle' },
  '0x6810e776880c02933d47db1b9fc05908e5386b96': { symbol: 'GNO', decimals: 18, name: 'Gnosis' },
  '0x56072c95faa701256059aa122697b133aded9279': { symbol: 'SKY', decimals: 18, name: 'Sky' },
  '0x58d97b57bb95320f9a05dc918aef65434969c2b2': { symbol: 'MORPHO', decimals: 18, name: 'Morpho' },
  '0x57e114b691db790c35207b2e685d4a43181e6061': { symbol: 'ENA', decimals: 18, name: 'Ethena' },
  '0xfaba6f8e4a5e8ab82f62fe7c39859fa577269be3': { symbol: 'ONDO', decimals: 18, name: 'Ondo Finance' },
  '0xec53bf9167f50cdeb3ca405942f5bef520184144': { symbol: 'EIGEN', decimals: 18, name: 'EigenLayer' },
  '0xfe0c30065b384f05761f15d0cc899d4f9f9cc0eb': { symbol: 'ETHFI', decimals: 18, name: 'ether.fi' },
  '0x6985884c4392d348587b19cb9eaaf157f13271cd': { symbol: 'ZRO', decimals: 18, name: 'LayerZero' },
  '0xdef1ca1fb7fbcdc777520aa7f396b4e015f497ab': { symbol: 'COW', decimals: 18, name: 'CoW Protocol' },
  '0xde4ee8057785a7e8e800db58f9784845a5c2cbd6': { symbol: 'DEXE', decimals: 18, name: 'DeXe Protocol' },
  '0x66a5cfb2e9c529f14fe6364ad1075df3a649c0a5': { symbol: 'ZK', decimals: 18, name: 'ZKsync' },
  '0x64aa3364f17a4d01c6f1751fd97c2bd3d7e7f1d5': { symbol: 'OHM', decimals: 18, name: 'Olympus' },

  // ── Ethereum Mainnet — Major Tokens by Market Cap ───────────────────
  '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce': { symbol: 'SHIB', decimals: 18, name: 'Shiba Inu' },
  '0x6982508145454ce325ddbe47a25d4ec3d2311933': { symbol: 'PEPE', decimals: 18, name: 'Pepe' },
  '0x163f8c2467924be0ae7b5347228cabf260318753': { symbol: 'WLD', decimals: 18, name: 'Worldcoin' },
  '0xaea46a60368a7bd060eec7df8cba43b7ef41ad85': { symbol: 'FET', decimals: 18, name: 'Fetch.ai' },
  '0x6de037ef9ad2725eb40118bb1702ebb27e4aeb24': { symbol: 'RNDR', decimals: 18, name: 'Render' },
  '0xf57e7e7c23978c3caec3c3548e3d615c346e79ff': { symbol: 'IMX', decimals: 18, name: 'Immutable' },
  '0x0f5d2fb29fb7d3cfee444a200298f468908cc942': { symbol: 'MANA', decimals: 18, name: 'Decentraland' },
  '0x3845badade8e6ddf26091cdd1260cff30996f5d9': { symbol: 'SAND', decimals: 18, name: 'The Sandbox' },
  '0x4d224452801aced8b2f0aebe155379bb5d594381': { symbol: 'APE', decimals: 18, name: 'ApeCoin' },
  '0x5283d291dbcf85356a21ba2e38f76917eac29f21': { symbol: 'BLUR', decimals: 18, name: 'Blur' },
  '0xc944e90c64b2c07662a292be6244bdf05cda44a7': { symbol: 'GRT', decimals: 18, name: 'The Graph' },
  '0xbbbbca6a901c926f240b89eacb641d8aec7aeafd': { symbol: 'LRC', decimals: 18, name: 'Loopring' },
  '0x1f573d6fb3f13d689ff844b4ce37794d79a7ff1c': { symbol: 'BNT', decimals: 18, name: 'Bancor' },
  '0xe41d2489571d322189246dafa5ebde1f4699f498': { symbol: 'ZRX', decimals: 18, name: '0x Protocol' },
  '0x0d8775f648430679a709e98d2b0cb6250d2887ef': { symbol: 'BAT', decimals: 18, name: 'Basic Attention Token' },
  '0x4a220e6096b25eadb88358cb44068a3248254675': { symbol: 'QNT', decimals: 18, name: 'Quant' },
  '0x2af5d2ad76741191d15dfe7bf6ac92d4bd912ca3': { symbol: 'LEO', decimals: 18, name: 'UNUS SED LEO' },
  '0x75231f58b43240c9718dd58b4967c5114342a86c': { symbol: 'OKB', decimals: 18, name: 'OKB' },
  '0xb8c77482e45f1f44de1745f52c74426c631bdd52': { symbol: 'BNB', decimals: 18, name: 'BNB' },
  '0xa0b73e1ff0b80914ab6fe0444e65848c4c34450b': { symbol: 'CRO', decimals: 8, name: 'Cronos' },
  '0x3c3a81e81dc49a522a592e7622a7e711c06bf354': { symbol: 'MNT', decimals: 18, name: 'Mantle' },
  '0x455e53cbb86018ac2b8092fdcd39d8444affc3f6': { symbol: 'POL', decimals: 18, name: 'Polygon' },
  '0xb62132e35a6c13ee1ee0f84dc5d40bad8d815206': { symbol: 'NEXO', decimals: 18, name: 'Nexo' },
  '0xcf0c122c6b73ff809c693db761e7de57b2f1eb50': { symbol: 'FLOKI', decimals: 9, name: 'Floki' },
  '0xf34960d9d60be18cc1d5afc1a6f012a723a28811': { symbol: 'KCS', decimals: 18, name: 'KuCoin Token' },
  '0x418708dd507a2f0cac24d31c60b350315f4c8009': { symbol: 'WTRUMP', decimals: 18, name: 'Wrapped Official Trump' },
  '0x44ff8620b8ca30902395a7bd3f2407e1a091bf73': { symbol: 'VIRTUAL', decimals: 18, name: 'Virtual Protocol' },
  '0xe0f63a424a4439cbe457d80e4f4b51ad25b2c56c': { symbol: 'SPX', decimals: 8, name: 'SPX6900' },
  '0x7dd9c5cba05e151c895fde1cf355c9a1d5da6429': { symbol: 'GLM', decimals: 18, name: 'Golem' },
  '0x58b6a8a3302369daec383334672404ee733ab239': { symbol: 'LPT', decimals: 18, name: 'Livepeer' },
  '0xaa7a9ca87d3694b5755f213b5d04094b8d0f0a6f': { symbol: 'TRAC', decimals: 18, name: 'OriginTrail' },
  '0xff20817765cb7f73d4bde2e66e067e58d11095c2': { symbol: 'AMP', decimals: 18, name: 'Amp' },
  '0x7ddc52c4de30e94be3a6a0a2b259b2850f421989': { symbol: 'GMT', decimals: 18, name: 'GoMining' },
  '0xc96de26018a54d51c097160568752c4e3bd6c364': { symbol: 'FBTC', decimals: 18, name: 'Fire BTC' },

  // ── Ethereum Mainnet — Wrapped L1 / Cross-chain Tokens ──────────────
  '0x582d872a1b094fc48f5de31d3b73f2d9be47def1': { symbol: 'TONCOIN', decimals: 9, name: 'Wrapped TON Coin' },
  '0x85f17cf997934a597031b2e18a9ab6ebd4b9f6a4': { symbol: 'NEAR', decimals: 24, name: 'NEAR Protocol' },
  '0xd1d82d3ab815e0b47e38ec2d666c5b8aa05ae501': { symbol: 'SOL', decimals: 9, name: 'Wrapped SOL' },
  '0xbe90556468e5ee2a15da99a5c0e045ed0b142143': { symbol: 'jitoSOL', decimals: 9, name: 'Jito Staked SOL' },
  '0x50327c6c5a14dcade707abad2e27eb517df87ab5': { symbol: 'TRX', decimals: 6, name: 'TRON' },
  '0x6e1a19f235be7ed8e3369ef73b196c07257494de': { symbol: 'WFIL', decimals: 18, name: 'Wrapped Filecoin' },
  '0xd850942ef8811f2a866692a623011bde52a462c1': { symbol: 'VEN', decimals: 18, name: 'VeChain' },
  '0x4e15361fd6b4bb609fa63c81a2be19d873717870': { symbol: 'FTM', decimals: 18, name: 'Fantom' },
  '0x3883f5e181fccaf8410fa61e12b59bad963fb645': { symbol: 'THETA', decimals: 18, name: 'Theta Network' },
  '0xca14007eff0db1f8135f4c25b34de49ab0d42766': { symbol: 'STRK', decimals: 18, name: 'Starknet' },
  '0xe28b3b32b6c345a34ff64674606124dd5aceca30': { symbol: 'INJ', decimals: 18, name: 'Injective' },
  '0xbdf43ecadc5cef51b7d1772f722e40596bc1788b': { symbol: 'SEI', decimals: 18, name: 'Sei' },

  // ── Ethereum Mainnet — Exchange/Platform Tokens ─────────────────────
  '0x54d2252757e1672eead234d27b1270728ff90581': { symbol: 'BGB', decimals: 18, name: 'Bitget Token' },
  '0xe66747a101bff2dba3697199dcce5b743b454759': { symbol: 'GT', decimals: 18, name: 'GateToken' },
  '0x61ec85ab89377db65762e234c946b5c25a56e99e': { symbol: 'HTX', decimals: 18, name: 'HTX Token' },
  '0xda5e1988097297dcdc1f90d4dfe7909e847cbef6': { symbol: 'WLFI', decimals: 18, name: 'World Liberty Financial' },
  '0x4a64515e5e1d1073e83f30cb97bed20400b66e10': { symbol: 'WZEC', decimals: 18, name: 'Wrapped Zcash' },

  // ── Ethereum Mainnet — Gaming / Metaverse / NFT ─────────────────────
  '0xd1d2eb1b1e90b638588728b4130137d262c87cae': { symbol: 'GALA', decimals: 8, name: 'Gala Games' },
  '0xbb0e17ef65f82ab018d8edd776e8dd940327b28b': { symbol: 'AXS', decimals: 18, name: 'Axie Infinity Shard' },
  '0x7420b4b9a0110cdc71fb720908340c03f9bc03ec': { symbol: 'JASMY', decimals: 18, name: 'JasmyCoin' },
  '0x3506424f91fd33084466f402d5d97f05f8e3b4af': { symbol: 'CHZ', decimals: 18, name: 'Chiliz' },
  '0x198d14f2ad9ce69e76ea330b374de4957c3f850a': { symbol: 'NFT', decimals: 6, name: 'APENFT' },
  '0xc669928185dbce49d2230cc9b0979be6dc797957': { symbol: 'BTT', decimals: 18, name: 'BitTorrent' },
  '0x152649ea73beab28c5b49b26eb48f7ead6d4c898': { symbol: 'Cake', decimals: 18, name: 'PancakeSwap' },

  // ── Ethereum Mainnet — Meme / High Market Cap ───────────────────────
  '0x4aef9bd3fbb09d8f374436d9ec25711a1be9bacb': { symbol: 'BONK', decimals: 5, name: 'Bonk' },
  '0xcf7e6742266ad5a76ee042e26d3f766c34195e5f': { symbol: 'WIF', decimals: 6, name: 'dogwifhat' },

  // ── Ethereum Mainnet — Institutional / RWA ──────────────────────────
  '0x7712c34205737192402172409a8f7ccef8aa2aec': { symbol: 'BUIDL', decimals: 6, name: 'BlackRock USD Fund' },

  // ── Ethereum Mainnet — DeFi Receipt/Yield/Savings Tokens ────────────
  '0x4da27a545c0c5b758a6ba100e3a049001de870f5': { symbol: 'stkAAVE', decimals: 18, name: 'Staked Aave' },
  '0x9fb7b4477576fe5b32be4c1843afb1e55f251b33': { symbol: 'fUSDC', decimals: 6, name: 'Fluid USDC' },
  '0x028171bca77440897b824ca71d1c56cac55b68a3': { symbol: 'aDAI', decimals: 18, name: 'Aave DAI' },
  '0xbcca60bb61934080951369a648fb03df4f96263c': { symbol: 'aUSDC', decimals: 6, name: 'Aave USDC' },
  '0x5d3a536e4d6dbd6114cc1ead35777bab948e3643': { symbol: 'cDAI', decimals: 8, name: 'Compound DAI' },
  '0x39aa39c021dfbae8fac545936693ac917d5e7563': { symbol: 'cUSDC', decimals: 8, name: 'Compound USDC' },
  '0xa3931d71877c0e7a3148cb7eb4463524fec27fbd': { symbol: 'sUSDS', decimals: 18, name: 'Savings USDS' },
  '0x83f20f44975d03b1b09e64809b757c47f942beea': { symbol: 'sDAI', decimals: 18, name: 'Savings DAI' },

  // ── Ethereum Mainnet — Special Addresses ────────────────────────────
  '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee': { symbol: 'ETH', decimals: 18, name: 'Ether' },

  // ── Ethereum Mainnet — Additional from Etherscan Top 200 ────────────
  '0xb50721bcf8d664c30412cfbc6cf7a15145234ad1': { symbol: 'ARB', decimals: 18, name: 'Arbitrum (Mainnet)' },

  // ── Gnosis Chain ────────────────────────────────────────────────────
  '0xe91d153e0b41518a2ce8dd3d7944fa863463a97d': { symbol: 'wxDAI', decimals: 18, name: 'Wrapped xDAI' },
  '0xddafbb505ad214d7b80b1f830fccb89b60fb7a83': { symbol: 'USDC', decimals: 6, name: 'USD Coin (Gnosis)' },
  '0x9c58bacc331c9aa871afd802db6379a98e80cedb': { symbol: 'GNO', decimals: 18, name: 'Gnosis (Gnosis Chain)' },

  // ── Arbitrum ────────────────────────────────────────────────────────
  '0xaf88d065e77c8cc2239327c5edb3a432268e5831': { symbol: 'USDC', decimals: 6, name: 'USD Coin (Arbitrum)' },
  '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8': { symbol: 'USDC.e', decimals: 6, name: 'Bridged USDC (Arbitrum)' },
  '0x82af49447d8a07e3bd95bd0d56f35241523fbab1': { symbol: 'WETH', decimals: 18, name: 'Wrapped Ether (Arbitrum)' },
  '0x912ce59144191c1204e64559fe8253a0e49e6548': { symbol: 'ARB', decimals: 18, name: 'Arbitrum' },
  '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9': { symbol: 'USDT', decimals: 6, name: 'Tether USD (Arbitrum)' },

  // ── Base ────────────────────────────────────────────────────────────
  '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': { symbol: 'USDC', decimals: 6, name: 'USD Coin (Base)' },
  '0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca': { symbol: 'USDbC', decimals: 6, name: 'Bridged USDC (Base)' },
  '0x4200000000000000000000000000000000000006': { symbol: 'WETH', decimals: 18, name: 'Wrapped Ether (L2)' },
  '0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22': { symbol: 'cbETH', decimals: 18, name: 'Coinbase Wrapped Staked ETH (Base)' },
  '0x940181a94a35a4569e4529a3cdfb74e38fd98631': { symbol: 'AERO', decimals: 18, name: 'Aerodrome' },
  '0x50c5725949a6f0c72e6c4a641f24049a917db0cb': { symbol: 'DAI', decimals: 18, name: 'Dai Stablecoin (Base)' },

  // ── Optimism ────────────────────────────────────────────────────────
  '0x4200000000000000000000000000000000000042': { symbol: 'OP', decimals: 18, name: 'Optimism' },
  '0x0b2c639c533813f4aa9d7837caf62653d097ff85': { symbol: 'USDC', decimals: 6, name: 'USD Coin (Optimism)' },
  '0x7f5c764cbc14f9669b88837ca1490cca17c31607': { symbol: 'USDC.e', decimals: 6, name: 'Bridged USDC (Optimism)' },
  '0x94b008aa00579c1307b0ef2c499ad98a8ce58e58': { symbol: 'USDT', decimals: 6, name: 'Tether USD (Optimism)' },

  // ── Polygon ─────────────────────────────────────────────────────────
  '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359': { symbol: 'USDC', decimals: 6, name: 'USD Coin (Polygon)' },
  '0x2791bca1f2de4661ed88a30c99a7a9449aa84174': { symbol: 'USDC.e', decimals: 6, name: 'Bridged USDC (Polygon)' },
  '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270': { symbol: 'WMATIC', decimals: 18, name: 'Wrapped MATIC' },
  '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619': { symbol: 'WETH', decimals: 18, name: 'Wrapped Ether (Polygon)' },
  '0xc2132d05d31c914a87c6611c10748aeb04b58e8f': { symbol: 'USDT', decimals: 6, name: 'Tether USD (Polygon)' }
};

/**
 * Get token info by address
 * @param {string} address - Token contract address
 * @returns {Object|null} - Token info {symbol, decimals, name} or null if unknown
 */
export function getTokenInfo(address) {
  if (!address) return null;
  return KNOWN_TOKENS[address.toLowerCase()] || null;
}

/**
 * Get token symbol by address
 * @param {string} address - Token contract address
 * @returns {string} - Token symbol or shortened address
 */
export function getTokenSymbol(address) {
  const token = getTokenInfo(address);
  if (token) return token.symbol;
  // Return shortened address if unknown
  return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Unknown';
}

/**
 * Get token decimals by address
 * @param {string} address - Token contract address
 * @returns {number} - Token decimals (defaults to 18 if unknown)
 */
export function getTokenDecimals(address) {
  const token = getTokenInfo(address);
  return token ? token.decimals : 18;
}

/**
 * Format token amount with symbol
 * @param {string|bigint} rawAmount - Raw token amount
 * @param {string} tokenAddress - Token contract address
 * @returns {string} - Formatted amount like "1,000.50 USDC"
 */
export function formatTokenAmount(rawAmount, tokenAddress) {
  const token = getTokenInfo(tokenAddress);
  const decimals = token ? token.decimals : 18;
  const symbol = token ? token.symbol : '';

  try {
    const amount = BigInt(rawAmount);
    const divisor = BigInt(10) ** BigInt(decimals);
    const integerPart = amount / divisor;
    const fractionalPart = amount % divisor;

    // Format integer part with commas
    const intStr = integerPart.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    // Format fractional part (trim trailing zeros, keep at least 2)
    let fracStr = fractionalPart.toString().padStart(decimals, '0');
    fracStr = fracStr.replace(/0+$/, '') || '0';
    if (fracStr.length < 2 && fracStr !== '0') fracStr = fracStr.padEnd(2, '0');

    const formatted = fracStr === '0' ? intStr : `${intStr}.${fracStr}`;
    return symbol ? `${formatted} ${symbol}` : formatted;
  } catch (e) {
    return rawAmount.toString();
  }
}

export default {
  KNOWN_TOKENS,
  getTokenInfo,
  getTokenSymbol,
  getTokenDecimals,
  formatTokenAmount
};
