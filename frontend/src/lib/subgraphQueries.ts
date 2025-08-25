// Subgraph queries for KaiSign V1
const SUBGRAPH_URL = process.env.NEXT_PUBLIC_KAISIGN_GRAPH_URL || "https://api.studio.thegraph.com/query/117022/kaisign-subgraph/version/latest";

export interface SubgraphSpec {
  id: string;
  user: string;
  ipfs: string;
  targetContract: string;
  chainID: string;
  blockTimestamp: string;
  status: string;
  questionId?: string;
  proposedTimestamp?: string;
  isFinalized?: boolean;
  isAccepted?: boolean;
  eventTimestamp?: string;
  incentiveId?: string;
}

export interface SubgraphIncentive {
  id: string;
  incentiveId: string;
  creator: string;
  targetContract: string;
  chainId: string;
  amount: string;
  deadline: string;
  description: string;
  blockTimestamp: string;
  transactionHash: string;
}

export interface SubgraphContract {
  id: string;
  address: string;
  chainID: string;
  name: string;
  version: string;
  description?: string;
  hasApprovedMetadata: boolean;
  latestApprovedSpecID: string;
  latestSpecTimestamp: string;
  functionCount: number;
  createdAt: string;
  updatedAt: string;
}

export class SubgraphClient {
  private url: string;

  constructor(url?: string) {
    this.url = url || SUBGRAPH_URL;
  }

  private async query(query: string): Promise<any> {
    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query })
      });

      const data = await response.json();
      
      if (data.errors) {
        console.error('Subgraph query error:', data.errors);
        throw new Error(data.errors[0]?.message || 'Subgraph query failed');
      }

      return data.data;
    } catch (error) {
      console.error('Failed to query subgraph:', error);
      throw error;
    }
  }

  // Get all specs for a user
  async getUserSpecs(userAddress: string): Promise<SubgraphSpec[]> {
    const query = `{
      specs(where: {user: "${userAddress.toLowerCase()}"}, orderBy: blockTimestamp, orderDirection: desc) {
        id
        user
        ipfs
        targetContract
        chainID
        blockTimestamp
        status
        questionId
        proposedTimestamp
        isFinalized
        isAccepted
        eventTimestamp
        incentiveId
      }
    }`;

    const result = await this.query(query);
    return result.specs || [];
  }

  // Get specs by status
  async getSpecsByStatus(status: string): Promise<SubgraphSpec[]> {
    const query = `{
      specs(where: {status: "${status}"}, orderBy: blockTimestamp, orderDirection: desc, first: 100) {
        id
        user
        ipfs
        targetContract
        chainID
        blockTimestamp
        status
        questionId
        proposedTimestamp
        isFinalized
        isAccepted
        eventTimestamp
        incentiveId
      }
    }`;

    const result = await this.query(query);
    return result.specs || [];
  }

  // Get specs for a specific contract
  async getContractSpecs(contractAddress: string): Promise<SubgraphSpec[]> {
    const query = `{
      specs(where: {targetContract: "${contractAddress.toLowerCase()}"}, orderBy: blockTimestamp, orderDirection: desc) {
        id
        user
        ipfs
        targetContract
        chainID
        blockTimestamp
        status
        questionId
        proposedTimestamp
        isFinalized
        isAccepted
        eventTimestamp
        incentiveId
      }
    }`;

    const result = await this.query(query);
    return result.specs || [];
  }

  // Get specs with incentives
  async getSpecsWithIncentives(): Promise<SubgraphSpec[]> {
    const query = `{
      specs(where: {incentiveId_not: null}, orderBy: blockTimestamp, orderDirection: desc, first: 100) {
        id
        user
        ipfs
        targetContract
        chainID
        blockTimestamp
        status
        questionId
        proposedTimestamp
        isFinalized
        isAccepted
        eventTimestamp
        incentiveId
      }
    }`;

    const result = await this.query(query);
    return result.specs || [];
  }

  // Get user's incentives (Note: These entities might not be deployed yet)
  async getUserIncentives(userAddress: string): Promise<SubgraphIncentive[]> {
    // First check if the entity exists
    const testQuery = `{
      __schema {
        types {
          name
        }
      }
    }`;

    try {
      // Try to query incentives if the entity exists
      const query = `{
        logIncentiveCreateds(where: {creator: "${userAddress.toLowerCase()}"}, orderBy: blockTimestamp, orderDirection: desc) {
          id
          incentiveId
          creator
          targetContract
          chainId
          amount
          deadline
          description
          blockTimestamp
          transactionHash
        }
      }`;

      const result = await this.query(query);
      return result.logIncentiveCreateds || [];
    } catch (error) {
      console.log('Incentive entities not yet deployed, returning empty array');
      return [];
    }
  }

  // Get proposed specs
  async getProposedSpecs(): Promise<SubgraphSpec[]> {
    const query = `{
      specs(where: {status: "PROPOSED"}, orderBy: proposedTimestamp, orderDirection: desc) {
        id
        user
        ipfs
        targetContract
        chainID
        blockTimestamp
        status
        questionId
        proposedTimestamp
        isFinalized
        isAccepted
        eventTimestamp
        incentiveId
      }
    }`;

    const result = await this.query(query);
    return result.specs || [];
  }

  // Get finalized specs
  async getFinalizedSpecs(): Promise<SubgraphSpec[]> {
    const query = `{
      specs(where: {status: "FINALIZED"}, orderBy: blockTimestamp, orderDirection: desc) {
        id
        user
        ipfs
        targetContract
        chainID
        blockTimestamp
        status
        questionId
        proposedTimestamp
        isFinalized
        isAccepted
        eventTimestamp
        incentiveId
      }
    }`;

    const result = await this.query(query);
    return result.specs || [];
  }

  // Get contracts with metadata
  async getContracts(): Promise<SubgraphContract[]> {
    const query = `{
      contracts(first: 100, orderBy: updatedAt, orderDirection: desc) {
        id
        address
        chainID
        name
        version
        description
        hasApprovedMetadata
        latestApprovedSpecID
        latestSpecTimestamp
        functionCount
        createdAt
        updatedAt
      }
    }`;

    const result = await this.query(query);
    return result.contracts || [];
  }

  // Get handle results for specs
  async getHandleResults(specIds?: string[]): Promise<any[]> {
    let whereClause = "";
    if (specIds && specIds.length > 0) {
      const formattedIds = specIds.map(id => `"${id}"`).join(", ");
      whereClause = `where: {specID_in: [${formattedIds}]}`;
    }

    const query = `{
      logHandleResults(${whereClause}, orderBy: blockTimestamp, orderDirection: desc) {
        id
        specID
        isAccepted
        blockTimestamp
        transactionHash
      }
    }`;

    const result = await this.query(query);
    return result.logHandleResults || [];
  }

  // Get proposals for specs
  async getProposals(userAddress?: string): Promise<any[]> {
    let whereClause = "";
    if (userAddress) {
      whereClause = `where: {user: "${userAddress.toLowerCase()}"}`;
    }

    const query = `{
      logProposeSpecs(${whereClause}, orderBy: blockTimestamp, orderDirection: desc) {
        id
        user
        specID
        questionId
        bond
        blockTimestamp
        transactionHash
      }
    }`;

    const result = await this.query(query);
    return result.logProposeSpecs || [];
  }

  // Combined query for dashboard
  async getDashboardData(userAddress: string) {
    const query = `{
      userSpecs: specs(where: {user: "${userAddress.toLowerCase()}"}, orderBy: blockTimestamp, orderDirection: desc) {
        id
        user
        ipfs
        targetContract
        chainID
        blockTimestamp
        status
        questionId
        proposedTimestamp
        isFinalized
        isAccepted
        eventTimestamp
        incentiveId
      }
      proposedSpecs: specs(where: {status: "PROPOSED"}, first: 10, orderBy: proposedTimestamp, orderDirection: desc) {
        id
        user
        ipfs
        targetContract
        chainID
        blockTimestamp
        status
        questionId
        proposedTimestamp
      }
      finalizedSpecs: specs(where: {status: "FINALIZED"}, first: 10, orderBy: blockTimestamp, orderDirection: desc) {
        id
        user
        ipfs
        targetContract
        chainID
        blockTimestamp
        status
        isAccepted
      }
      contracts(first: 10, orderBy: updatedAt, orderDirection: desc) {
        id
        address
        chainID
        name
        version
        hasApprovedMetadata
        functionCount
      }
    }`;

    const result = await this.query(query);
    return {
      userSpecs: result.userSpecs || [],
      proposedSpecs: result.proposedSpecs || [],
      finalizedSpecs: result.finalizedSpecs || [],
      contracts: result.contracts || []
    };
  }
}

// Export a default instance
export const subgraphClient = new SubgraphClient();