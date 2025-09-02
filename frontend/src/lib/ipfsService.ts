// Deprecated: IPFS upload service has been replaced by blob posting.
export async function uploadToIPFS(_file: File | string | object): Promise<string> {
  throw new Error('IPFS upload is disabled. Use blob posting instead.');
}