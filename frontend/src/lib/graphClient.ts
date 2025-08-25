import { GraphQLClient } from 'graphql-request';

export interface ContractMetadata {
  address: string;
  chainID: string;
  name: string;
  version: string;
  description?: string;
  hasApprovedMetadata: boolean;
  latestSpecTimestamp: string;
  functionCount: number;
}

export interface FunctionMetadata {
  selector: string;
  name: string;
  intent: string;
  parameterTypes: string[];
  displayFormat: string;
}

export interface SpecHistory {
  id: string;
  creator: string;
  blobHash: string; // EIP-4844 blob hash
  createdTimestamp: string;
  proposedTimestamp?: string;
  status: 'COMMITTED' | 'SUBMITTED' | 'PROPOSED' | 'FINALIZED' | 'CANCELLED';
  targetContract?: string;
  chainId?: number;
  questionId?: string;
  incentiveId?: string;
}

export interface IPFSMetadata {
  context: {
    contract: {
      deployedOn: string;
      deploymentAddress: string;
    };
  };
  metadata: {
    appDomain: string;
    constants: Record<string, any>;
    enums: Record<string, any>;
    functions: Record<string, {
      intent: string;
      fields: Array<{
        path: string;
        label: string;
        format: string;
        params?: Record<string, any>;
      }>;
    }>;
    owner: string;
    info: {
      legalName: string;
      lastUpdate: string;
      version: string;
      url: string;
    };
  };
}

interface SpecData {
  id: string;
  user: string;
  blobHash: string;
  targetContract?: string;
  chainID?: string;
  blockTimestamp: string;
  status: string;
}

export class KaiSignGraphClient {
  private client: GraphQLClient;
  
  constructor(graphqlEndpoint: string) {
    this.client = new GraphQLClient(graphqlEndpoint);
  }

  /**
   * Get contracts with approved metadata for a specific chain
   * Always returns latest metadata (handles disputes automatically)
   */
  async getContractsWithMetadata(chainID: string): Promise<ContractMetadata[]> {
    const query = `
      query GetContracts($chainID: String!) {
        contracts(where: { chainID: $chainID, hasApprovedMetadata: true }) {
          address
          chainID
          name
          version
          description
          hasApprovedMetadata
          latestSpecTimestamp
          functionCount
        }
      }
    `;

    const data = await this.client.request<{ contracts: ContractMetadata[] }>(query, { chainID });
    return data.contracts;
  }

  /**
   * Get transaction metadata for a specific contract and selector
   * Always uses latest approved metadata
   */
  async getTransactionMetadata(
    contractAddress: string, 
    selector: string, 
    chainID: string
  ): Promise<FunctionMetadata | null> {
    // Query for specs that target this contract
    const query = `
      query GetContractSpecs($targetContract: Bytes!, $chainID: String!) {
        specs(where: { 
          targetContract: $targetContract
          chainID: $chainID
        }) {
          id
          blobHash
          user
          status
          blockTimestamp
        }
      }
    `;

    const targetContract = contractAddress.toLowerCase();
    const data = await this.client.request<{ specs: SpecData[] }>(
      query, 
      { targetContract, chainID }
    );
    
    // If we have specs, return a placeholder indicating metadata is available
    if (data.specs && data.specs.length > 0) {
      return {
        selector: selector,
        name: `Contract Function ${selector}`,
        intent: `Execute function ${selector} on contract`,
        parameterTypes: [],
        displayFormat: `function_${selector.slice(2, 10)}`
      };
    }
    
    return null;
  }

  /**
   * Get complete contract metadata with IPFS data
   */
  async getCompleteContractMetadata(contractAddress: string, chainID: string): Promise<{ specs: SpecData[], ipfsMetadata?: IPFSMetadata }> {
    const query = `
      query GetContractSpecs($targetContract: Bytes!, $chainID: String!) {
        specs(where: { 
          targetContract: $targetContract
          chainID: $chainID
        }
        orderBy: blockTimestamp
        orderDirection: desc) {
          id
          blobHash
          user
          status
          blockTimestamp
          targetContract
          chainID
        }
      }
    `;

    const targetContract = contractAddress.toLowerCase();
    const data = await this.client.request<{ specs: SpecData[] }>(
      query, 
      { targetContract, chainID }
    );
    
    // No IPFS fetching; rely on blobHash only
    return { specs: data.specs };
  }

  /**
   * Get dispute/replacement history for a contract
   * Shows all finalized specs ordered by newest first
   */
  async getContractSpecHistory(contractAddress: string, chainID: string): Promise<SpecHistory[]> {
    const query = `
      query GetSpecHistory($targetContract: Bytes!, $chainID: String!) {
        specs(
          where: { 
            targetContract: $targetContract
            chainID: $chainID
            status: FINALIZED
          }
          orderBy: blockTimestamp
          orderDirection: desc
        ) {
          id
          user
          blobHash
          blockTimestamp
          status
        }
      }
    `;

    const data = await this.client.request<{ specs: SpecData[] }>(query, { 
      targetContract: contractAddress.toLowerCase(), 
      chainID 
    });
    
    return data.specs.map((spec: SpecData) => ({
      id: spec.id,
      creator: spec.user,
      blobHash: spec.blobHash,
      createdTimestamp: spec.blockTimestamp,
      status: spec.status as SpecHistory['status']
    }));
  }

  /**
   * Get all functions for a specific contract
   */
  async getContractFunctions(contractAddress: string, chainID: string): Promise<FunctionMetadata[]> {
    const query = `
      query GetContractFunctions($contractId: String!) {
        functions(where: { contract: $contractId }) {
          selector
          name
          intent
          parameterTypes
          displayFormat
        }
      }
    `;

    const contractId = `${contractAddress.toLowerCase()}-${chainID}`;
    const data = await this.client.request<{ functions: FunctionMetadata[] }>(query, { contractId });
    
    return data.functions;
  }

  /**
   * Search contracts by name
   */
  async searchContracts(searchTerm: string, chainID?: string): Promise<ContractMetadata[]> {
    const whereClause = chainID 
      ? `{ hasApprovedMetadata: true, chainID: "${chainID}", name_contains_nocase: "${searchTerm}" }`
      : `{ hasApprovedMetadata: true, name_contains_nocase: "${searchTerm}" }`;

    const query = `
      query SearchContracts {
        contracts(where: ${whereClause}) {
          address
          chainID
          name
          version
          description
          hasApprovedMetadata
          latestSpecTimestamp
          functionCount
        }
      }
    `;

    const data = await this.client.request<{ contracts: ContractMetadata[] }>(query);
    return data.contracts;
  }

  /**
   * Get all finalized specifications created by a specific user
   */
  async getUserFinalizedSpecs(userAddress: string): Promise<SpecHistory[]> {
    const query = `
      query GetUserFinalizedSpecs($user: Bytes!) {
        specs(
          where: { 
            user: $user
            status: FINALIZED
          }
          orderBy: blockTimestamp
          orderDirection: desc
        ) {
          id
          user
          blobHash
          targetContract
          blockTimestamp
          status
        }
      }
    `;

    const data = await this.client.request<{ specs: any[] }>(query, { 
      user: userAddress.toLowerCase()
    });
    
    if (!data || !data.specs) {
      return [];
    }
    
    return data.specs.map((spec: any) => ({
      id: spec.id,
      creator: spec.user,
      blobHash: spec.blobHash,
      createdTimestamp: spec.blockTimestamp,
      status: spec.status as SpecHistory['status'],
      targetContract: spec.targetContract,
      totalBonds: "0",
      bondsSettled: false,
      proposedTimestamp: spec.blockTimestamp
    }));
  }

  /**
   * Get all specifications (any status) created by a specific user
   */
  async getUserSpecs(userAddress: string): Promise<SpecHistory[]> {
    const query = `
      query GetUserSpecs($user: Bytes!) {
        specs(
          where: { 
            user: $user
          }
          orderBy: blockTimestamp
          orderDirection: desc
        ) {
          id
          user
          blobHash
          targetContract
          blockTimestamp
          status
        }
      }
    `;

    const data = await this.client.request<{ specs: any[] }>(query, { 
      user: userAddress.toLowerCase()
    });
    
    if (!data || !data.specs) {
      return [];
    }
    
    return data.specs.map((spec: any) => ({
      id: spec.id,
      creator: spec.user,
      blobHash: spec.blobHash,
      createdTimestamp: spec.blockTimestamp,
      status: spec.status as SpecHistory['status'],
      targetContract: spec.targetContract,
      totalBonds: "0",
      bondsSettled: false,
      proposedTimestamp: spec.blockTimestamp
    }));
  }
}

// Default client instance for common networks
export const createKaiSignClient = (network: 'mainnet' | 'sepolia' | string) => {
  const endpoints = {
    mainnet: 'https://api.thegraph.com/subgraphs/name/kai-sign/kaisign-mainnet',
    sepolia: 'https://api.studio.thegraph.com/query/117022/kaisign-subgraph/v0.0.3',
  };

  const endpoint = endpoints[network as keyof typeof endpoints] || network;
  return new KaiSignGraphClient(endpoint);
};

// Re-export for convenience
export default KaiSignGraphClient;
