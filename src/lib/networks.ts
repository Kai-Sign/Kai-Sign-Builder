import { 
  mainnet, 
  sepolia, 
  polygon, 
  polygonMumbai, 
  optimism, 
  optimismSepolia, 
  arbitrum, 
  arbitrumSepolia, 
  base, 
  baseSepolia,
  bsc,
  avalanche,
  fantom,
  gnosis,
  celo,
  aurora,
  moonbeam,
  cronos,
  evmos,
  kava,
  mantle,
  scroll,
  scrollSepolia,
  linea,
  lineaTestnet,
  zkSync,
  zkSyncSepoliaTestnet,
  blast,
  blastSepolia
} from 'viem/chains';
import type { Chain } from 'viem';

export interface NetworkConfig {
  id: number;
  name: string;
  shortName: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: {
    default: {
      http: readonly string[];
    };
  };
  blockExplorers: {
    default: {
      name: string;
      url: string;
    };
  };
  testnet?: boolean;
}

// Popular networks configuration
export const SUPPORTED_NETWORKS: NetworkConfig[] = [
  // Ethereum
  {
    id: mainnet.id,
    name: mainnet.name,
    shortName: 'eth',
    nativeCurrency: mainnet.nativeCurrency,
    rpcUrls: mainnet.rpcUrls,
    blockExplorers: mainnet.blockExplorers,
  },
  {
    id: sepolia.id,
    name: sepolia.name,
    shortName: 'sep',
    nativeCurrency: sepolia.nativeCurrency,
    rpcUrls: sepolia.rpcUrls,
    blockExplorers: sepolia.blockExplorers,
    testnet: true,
  },
  
  // Polygon
  {
    id: polygon.id,
    name: polygon.name,
    shortName: 'matic',
    nativeCurrency: polygon.nativeCurrency,
    rpcUrls: polygon.rpcUrls,
    blockExplorers: polygon.blockExplorers,
  },
  {
    id: polygonMumbai.id,
    name: polygonMumbai.name,
    shortName: 'maticmum',
    nativeCurrency: polygonMumbai.nativeCurrency,
    rpcUrls: polygonMumbai.rpcUrls,
    blockExplorers: polygonMumbai.blockExplorers,
    testnet: true,
  },
  
  // Optimism
  {
    id: optimism.id,
    name: optimism.name,
    shortName: 'oeth',
    nativeCurrency: optimism.nativeCurrency,
    rpcUrls: optimism.rpcUrls,
    blockExplorers: optimism.blockExplorers,
  },
  {
    id: optimismSepolia.id,
    name: optimismSepolia.name,
    shortName: 'opsep',
    nativeCurrency: optimismSepolia.nativeCurrency,
    rpcUrls: optimismSepolia.rpcUrls,
    blockExplorers: optimismSepolia.blockExplorers,
    testnet: true,
  },
  
  // Arbitrum
  {
    id: arbitrum.id,
    name: arbitrum.name,
    shortName: 'arb1',
    nativeCurrency: arbitrum.nativeCurrency,
    rpcUrls: arbitrum.rpcUrls,
    blockExplorers: arbitrum.blockExplorers,
  },
  {
    id: arbitrumSepolia.id,
    name: arbitrumSepolia.name,
    shortName: 'arbsep',
    nativeCurrency: arbitrumSepolia.nativeCurrency,
    rpcUrls: arbitrumSepolia.rpcUrls,
    blockExplorers: arbitrumSepolia.blockExplorers,
    testnet: true,
  },
  
  // Base
  {
    id: base.id,
    name: base.name,
    shortName: 'base',
    nativeCurrency: base.nativeCurrency,
    rpcUrls: base.rpcUrls,
    blockExplorers: base.blockExplorers,
  },
  {
    id: baseSepolia.id,
    name: baseSepolia.name,
    shortName: 'basesep',
    nativeCurrency: baseSepolia.nativeCurrency,
    rpcUrls: baseSepolia.rpcUrls,
    blockExplorers: baseSepolia.blockExplorers,
    testnet: true,
  },
  
  // BSC
  {
    id: bsc.id,
    name: bsc.name,
    shortName: 'bnb',
    nativeCurrency: bsc.nativeCurrency,
    rpcUrls: bsc.rpcUrls,
    blockExplorers: bsc.blockExplorers,
  },
  
  // Avalanche
  {
    id: avalanche.id,
    name: avalanche.name,
    shortName: 'avax',
    nativeCurrency: avalanche.nativeCurrency,
    rpcUrls: avalanche.rpcUrls,
    blockExplorers: avalanche.blockExplorers,
  },
  
  // Fantom
  {
    id: fantom.id,
    name: fantom.name,
    shortName: 'ftm',
    nativeCurrency: fantom.nativeCurrency,
    rpcUrls: fantom.rpcUrls,
    blockExplorers: fantom.blockExplorers,
  },
  
  // Gnosis
  {
    id: gnosis.id,
    name: gnosis.name,
    shortName: 'gno',
    nativeCurrency: gnosis.nativeCurrency,
    rpcUrls: gnosis.rpcUrls,
    blockExplorers: gnosis.blockExplorers,
  },
  
  // Celo
  {
    id: celo.id,
    name: celo.name,
    shortName: 'celo',
    nativeCurrency: celo.nativeCurrency,
    rpcUrls: celo.rpcUrls,
    blockExplorers: celo.blockExplorers,
  },
  
  // Aurora
  {
    id: aurora.id,
    name: aurora.name,
    shortName: 'aurora',
    nativeCurrency: aurora.nativeCurrency,
    rpcUrls: aurora.rpcUrls,
    blockExplorers: aurora.blockExplorers,
  },
  
  // Moonbeam
  {
    id: moonbeam.id,
    name: moonbeam.name,
    shortName: 'mbeam',
    nativeCurrency: moonbeam.nativeCurrency,
    rpcUrls: moonbeam.rpcUrls,
    blockExplorers: moonbeam.blockExplorers,
  },
  
  // Cronos
  {
    id: cronos.id,
    name: cronos.name,
    shortName: 'cro',
    nativeCurrency: cronos.nativeCurrency,
    rpcUrls: cronos.rpcUrls,
    blockExplorers: cronos.blockExplorers,
  },
  
  // Evmos
  {
    id: evmos.id,
    name: evmos.name,
    shortName: 'evmos',
    nativeCurrency: evmos.nativeCurrency,
    rpcUrls: evmos.rpcUrls,
    blockExplorers: evmos.blockExplorers,
  },
  
  // Kava
  {
    id: kava.id,
    name: kava.name,
    shortName: 'kava',
    nativeCurrency: kava.nativeCurrency,
    rpcUrls: kava.rpcUrls,
    blockExplorers: kava.blockExplorers,
  },
  
  // Mantle
  {
    id: mantle.id,
    name: mantle.name,
    shortName: 'mantle',
    nativeCurrency: mantle.nativeCurrency,
    rpcUrls: mantle.rpcUrls,
    blockExplorers: mantle.blockExplorers,
  },
  
  // Scroll
  {
    id: scroll.id,
    name: scroll.name,
    shortName: 'scr',
    nativeCurrency: scroll.nativeCurrency,
    rpcUrls: scroll.rpcUrls,
    blockExplorers: scroll.blockExplorers,
  },
  {
    id: scrollSepolia.id,
    name: scrollSepolia.name,
    shortName: 'scrsep',
    nativeCurrency: scrollSepolia.nativeCurrency,
    rpcUrls: scrollSepolia.rpcUrls,
    blockExplorers: scrollSepolia.blockExplorers,
    testnet: true,
  },
  
  // Linea
  {
    id: linea.id,
    name: linea.name,
    shortName: 'linea',
    nativeCurrency: linea.nativeCurrency,
    rpcUrls: linea.rpcUrls,
    blockExplorers: linea.blockExplorers,
  },
  {
    id: lineaTestnet.id,
    name: lineaTestnet.name,
    shortName: 'lineatest',
    nativeCurrency: lineaTestnet.nativeCurrency,
    rpcUrls: lineaTestnet.rpcUrls,
    blockExplorers: lineaTestnet.blockExplorers,
    testnet: true,
  },
  
  // zkSync
  {
    id: zkSync.id,
    name: zkSync.name,
    shortName: 'zksync',
    nativeCurrency: zkSync.nativeCurrency,
    rpcUrls: zkSync.rpcUrls,
    blockExplorers: zkSync.blockExplorers,
  },
  {
    id: zkSyncSepoliaTestnet.id,
    name: zkSyncSepoliaTestnet.name,
    shortName: 'zksyncsep',
    nativeCurrency: zkSyncSepoliaTestnet.nativeCurrency,
    rpcUrls: zkSyncSepoliaTestnet.rpcUrls,
    blockExplorers: zkSyncSepoliaTestnet.blockExplorers,
    testnet: true,
  },
  
  // Blast
  {
    id: blast.id,
    name: blast.name,
    shortName: 'blast',
    nativeCurrency: blast.nativeCurrency,
    rpcUrls: blast.rpcUrls,
    blockExplorers: blast.blockExplorers,
  },
  {
    id: blastSepolia.id,
    name: blastSepolia.name,
    shortName: 'blastsep',
    nativeCurrency: blastSepolia.nativeCurrency,
    rpcUrls: blastSepolia.rpcUrls,
    blockExplorers: blastSepolia.blockExplorers,
    testnet: true,
  },
];

// Helper functions
export const getNetworkById = (chainId: number): NetworkConfig | undefined => {
  return SUPPORTED_NETWORKS.find(network => network.id === chainId);
};

export const getMainnetNetworks = (): NetworkConfig[] => {
  return SUPPORTED_NETWORKS.filter(network => !network.testnet);
};

export const getTestnetNetworks = (): NetworkConfig[] => {
  return SUPPORTED_NETWORKS.filter(network => network.testnet);
};

export const getNetworkName = (chainId: number): string => {
  const network = getNetworkById(chainId);
  return network ? network.name : `Unknown Network (${chainId})`;
};

export const getNetworkShortName = (chainId: number): string => {
  const network = getNetworkById(chainId);
  return network ? network.shortName : `unknown-${chainId}`;
};

// Default network (Ethereum Mainnet)
export const DEFAULT_NETWORK = SUPPORTED_NETWORKS[0]!; 