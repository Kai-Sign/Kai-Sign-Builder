// Main library exports
export { KaiSignGraphClient, createKaiSignClient } from './lib/graphClient';
export type { ContractMetadata, FunctionMetadata, SpecHistory } from './lib/graphClient';

// Hooks
export { useKaiSign, useTransactionPreview } from './hooks/useKaiSign';
export type { UseKaiSignOptions, UseKaiSignReturn } from './hooks/useKaiSign';

// Components
export { ContractSelector } from './components/ContractSelector';
export { TransactionPreview } from './components/TransactionPreview';

// Re-export for convenience
export default KaiSignGraphClient;
