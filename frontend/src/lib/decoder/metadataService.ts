/**
 * Metadata Service - Fetches ERC-7730 metadata from KaiSign API
 * Server-safe implementation (no window.* dependencies)
 */

import type {
  ERC7730Metadata,
  TokenInfo,
  MetadataServiceConfig,
  CachedMetadata,
  CachedToken,
} from './types';
import { decodeAbiString } from './utils/formatters';

const DEFAULT_API_URL = 'https://kai-sign-production.up.railway.app/api/py';
const DEFAULT_CACHE_TTL = 60 * 1000; // 1 minute

/**
 * Metadata Service for fetching ERC-7730 metadata
 */
export class MetadataService {
  private apiBaseUrl: string;
  private cacheTTL: number;
  private metadataCache: Map<string, CachedMetadata>;
  private tokenCache: Map<string, CachedToken>;

  constructor(config: MetadataServiceConfig = {}) {
    this.apiBaseUrl = config.apiBaseUrl || DEFAULT_API_URL;
    this.cacheTTL = config.cacheTTL || DEFAULT_CACHE_TTL;
    this.metadataCache = new Map();
    this.tokenCache = new Map();
  }

  /**
   * Get contract metadata from KaiSign API
   * @param address - Contract address
   * @param chainId - Chain ID
   * @param selector - Optional function selector for proxy detection
   * @returns ERC-7730 metadata or null
   */
  async getContractMetadata(
    address: string,
    chainId: number,
    selector?: string
  ): Promise<ERC7730Metadata | null> {
    const normalizedAddress = address.toLowerCase();
    const normalizedChainId = this.normalizeChainId(chainId);
    const cacheKey = `${normalizedAddress}-${normalizedChainId}-${selector || ''}`;

    // Check cache first
    const cached = this.metadataCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }

    try {
      // Fetch from KaiSign API
      const apiUrl = `${this.apiBaseUrl}/contract/${normalizedAddress}?chain_id=${normalizedChainId}`;
      const response = await fetch(apiUrl);

      if (!response.ok) {
        console.warn(`[MetadataService] API returned ${response.status} for ${normalizedAddress}`);
        return null;
      }

      const data = await response.json();

      if (!data.success || !data.metadata) {
        console.warn(`[MetadataService] No metadata in response for ${normalizedAddress}`);
        return null;
      }

      const metadata = data.metadata as ERC7730Metadata;

      // Cache result
      this.metadataCache.set(cacheKey, {
        data: metadata,
        timestamp: Date.now(),
      });

      return metadata;
    } catch (error) {
      console.error('[MetadataService] Failed to fetch metadata:', error);
      return null;
    }
  }

  /**
   * Get token metadata (symbol, decimals, name)
   * Falls back to on-chain queries if API doesn't provide
   * @param address - Token address
   * @param chainId - Chain ID
   * @returns Token info
   */
  async getTokenMetadata(address: string, chainId: number = 1): Promise<TokenInfo> {
    const normalizedAddress = address.toLowerCase();
    const cacheKey = `token-${normalizedAddress}-${chainId}`;

    // Check cache
    const cached = this.tokenCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }

    // Handle native ETH addresses
    if (
      normalizedAddress === '0x0000000000000000000000000000000000000000' ||
      normalizedAddress === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
    ) {
      const ethInfo: TokenInfo = {
        symbol: 'ETH',
        decimals: 18,
        name: 'Ether',
        address: normalizedAddress,
      };
      this.tokenCache.set(cacheKey, { data: ethInfo, timestamp: Date.now() });
      return ethInfo;
    }

    let symbol = '';
    let decimals = 18;
    let name = 'Unknown Token';

    // Try to get from contract metadata
    try {
      const metadata = await this.getContractMetadata(normalizedAddress, chainId);
      if (metadata) {
        symbol = metadata.metadata?.symbol || metadata.context?.contract?.symbol || '';
        decimals = metadata.metadata?.decimals || metadata.context?.contract?.decimals || 0;
        name = metadata.metadata?.name || metadata.context?.contract?.name || 'Unknown Token';
      }
    } catch (error) {
      console.warn('[MetadataService] Token metadata not found:', normalizedAddress);
    }

    // If decimals not found, try on-chain call via our API
    if (!decimals) {
      try {
        const tokenInfo = await this.fetchTokenInfoOnChain(normalizedAddress, chainId);
        decimals = tokenInfo.decimals || 18;
        symbol = symbol || tokenInfo.symbol || '';
        name = name !== 'Unknown Token' ? name : tokenInfo.name || 'Unknown Token';
      } catch (error) {
        console.warn('[MetadataService] On-chain token lookup failed:', error);
        decimals = 18;
      }
    }

    const tokenInfo: TokenInfo = {
      symbol: symbol || `${normalizedAddress.slice(0, 6)}...${normalizedAddress.slice(-4)}`,
      decimals: decimals || 18,
      name,
      address: normalizedAddress,
    };

    // Cache result
    this.tokenCache.set(cacheKey, {
      data: tokenInfo,
      timestamp: Date.now(),
    });

    return tokenInfo;
  }

  /**
   * Fetch token info from on-chain via RPC
   * This requires a provider - in browser context, uses existing API
   */
  private async fetchTokenInfoOnChain(address: string, chainId: number): Promise<Partial<TokenInfo>> {
    // Try to fetch via our backend API which can make RPC calls
    try {
      const response = await fetch(`${this.apiBaseUrl}/token/${address}?chain_id=${chainId}`);
      if (response.ok) {
        const data = await response.json();
        return {
          symbol: data.symbol,
          decimals: data.decimals,
          name: data.name,
        };
      }
    } catch {
      // Fall through to default
    }

    return { decimals: 18 };
  }

  /**
   * Normalize chain ID to number
   */
  private normalizeChainId(chainId: number | string): number {
    if (typeof chainId === 'string') {
      if (chainId.startsWith('0x')) {
        return parseInt(chainId, 16);
      }
      return parseInt(chainId, 10);
    }
    return chainId;
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.metadataCache.clear();
    this.tokenCache.clear();
  }

  /**
   * Add metadata to cache (for testing purposes)
   * @param address - Contract address
   * @param metadata - ERC-7730 metadata
   * @param chainId - Chain ID (default: 1)
   */
  addMetadata(address: string, metadata: ERC7730Metadata, chainId: number = 1): void {
    const normalizedAddress = address.toLowerCase();
    const normalizedChainId = this.normalizeChainId(chainId);

    // Cache with empty selector for general lookup
    const cacheKey = `${normalizedAddress}-${normalizedChainId}-`;
    this.metadataCache.set(cacheKey, {
      data: metadata,
      timestamp: Date.now(),
    });

    // Also cache with specific selectors from the ABI if available
    if (metadata.context?.contract?.abi) {
      for (const item of metadata.context.contract.abi) {
        if (item.selector) {
          const selectorCacheKey = `${normalizedAddress}-${normalizedChainId}-${item.selector.toLowerCase()}`;
          this.metadataCache.set(selectorCacheKey, {
            data: metadata,
            timestamp: Date.now(),
          });
        }
      }
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { metadataSize: number; tokenSize: number; ttl: number } {
    return {
      metadataSize: this.metadataCache.size,
      tokenSize: this.tokenCache.size,
      ttl: this.cacheTTL,
    };
  }
}

// Default instance
let defaultService: MetadataService | null = null;

/**
 * Get or create the default metadata service instance
 */
export function getMetadataService(config?: MetadataServiceConfig): MetadataService {
  if (!defaultService || config) {
    defaultService = new MetadataService(config);
  }
  return defaultService;
}

/**
 * Resolve a JSONPath reference to actual value from decoded params
 * Supports ERC-7730 style paths: $.fieldName, $.nested.field, $.array[0]
 * @param path - JSONPath like "$.to" or "$.message.recipient"
 * @param params - Decoded parameters object
 * @returns Resolved value or the original path if not found
 */
export function resolveJsonPath(path: string, params: Record<string, unknown>): unknown {
  if (!path || typeof path !== 'string') return path;

  // Must start with "$." to be a JSONPath reference
  if (!path.startsWith('$.')) return path;

  // Remove "$." prefix
  const pathParts = path.slice(2).split('.');
  let current: unknown = params;

  for (const part of pathParts) {
    if (current === null || current === undefined) return null;

    // Handle array indices like "items[0]" or "tokens[1]"
    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      const [, fieldName, indexStr] = arrayMatch;
      const index = parseInt(indexStr, 10);
      current = (current as Record<string, unknown>)[fieldName];
      if (Array.isArray(current) && index < current.length) {
        current = current[index];
      } else {
        return null;
      }
    } else {
      current = (current as Record<string, unknown>)[part];
    }
  }

  // Handle BigNumber-like objects
  if (current && typeof current === 'object' && '_isBigNumber' in (current as Record<string, unknown>)) {
    return (current as { toString: () => string }).toString();
  }

  return current;
}

/**
 * Resolve a field path to its value in decoded params
 * Supports ERC-7730 syntax: #._swapData.[0].fromAmount
 * @param pathStr - Path string
 * @param params - Decoded parameters
 * @returns Resolved value or undefined
 */
export function resolveFieldPath(pathStr: string, params: Record<string, unknown>): unknown {
  // Remove #. or @. prefix
  let currentPath = pathStr;
  if (currentPath.startsWith('#.') || currentPath.startsWith('@.')) {
    currentPath = currentPath.substring(2);
  }

  const parts = currentPath.split('.').filter((p) => p);
  let value: unknown = params;

  for (const part of parts) {
    if (value === undefined || value === null) return undefined;

    // Handle array index: _swapData[0] or [0]
    const arrayMatch = part.match(/^(.+?)?\[(\d+)\]$/);
    if (arrayMatch) {
      const fieldName = arrayMatch[1];
      const index = parseInt(arrayMatch[2]);

      if (fieldName) {
        value = (value as Record<string, unknown>)[fieldName];
        if (value === undefined || value === null) return undefined;
      }

      if (Array.isArray(value)) {
        value = value[index];
      } else {
        return undefined;
      }
    } else {
      value = (value as Record<string, unknown>)[part];
    }
  }

  return value;
}
