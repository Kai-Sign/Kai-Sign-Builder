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
  ipfsCID: string;
  createdTimestamp: string;
  status: 'COMMITTED' | 'SUBMITTED' | 'PROPOSED' | 'FINALIZED' | 'CANCELLED';
}

interface SpecData {
  id: string;
  user: string;
  ipfs: string;
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
    const query = `
      query GetTransactionMetadata($contractId: String!, $selector: String!) {
        functions(where: { 
          contract: $contractId
          selector: $selector
        }) {
          selector
          name
          intent
          parameterTypes
          displayFormat
        }
      }
    `;

    const contractId = `${contractAddress.toLowerCase()}-${chainID}`;
    const data = await this.client.request<{ functions: FunctionMetadata[] }>(
      query, 
      { contractId, selector }
    );
    
    return data.functions[0] || null;
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
          ipfs
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
      ipfsCID: spec.ipfs,
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
}

// Default client instance for common networks
export const createKaiSignClient = (network: 'mainnet' | 'sepolia' | string) => {
  const endpoints = {
    mainnet: 'https://api.thegraph.com/subgraphs/name/kai-sign/kaisign-mainnet',
    sepolia: 'https://api.studio.thegraph.com/query/117022/kaisign-subgraph/v0.0.1',
  };

  const endpoint = endpoints[network as keyof typeof endpoints] || network;
  return new KaiSignGraphClient(endpoint);
};

// Re-export for convenience
export default KaiSignGraphClient;
