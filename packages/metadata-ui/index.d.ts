export interface KaiSignContractMetadata {
  success: boolean;
  contractAddress: string;
  chainId: number;
  metadata: {
    address: string;
    chainId: number;
    functions?: any;
    recognized?: boolean;
    ipfs?: any;
    erc7730?: {
      owner?: string;
      info?: {
        legalName?: string;
        url?: string;
      };
    };
  };
  sources: {
    graph: boolean;
    ipfs: boolean;
  };
  timestamp: string;
}

export interface KaiSignModalProps {
  isOpen: boolean;
  onClose: () => void;
  contractAddress: string;
  chainId: number;
  apiEndpoint?: string;
  className?: string;
  theme?: 'light' | 'dark';
}

export declare function KaiSignModal(props: KaiSignModalProps): JSX.Element | null;

export declare function useContractMetadata(options: {
  contractAddress: string;
  chainId: number;
  apiEndpoint?: string;
}): {
  data: KaiSignContractMetadata | null;
  loading: boolean;
  error: string | null;
};
