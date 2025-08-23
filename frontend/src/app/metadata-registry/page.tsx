"use client";

import { useMemo, useState } from "react";
import { ethers } from "ethers";
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { useToast } from "~/hooks/use-toast";
import { postToBlob } from "~/lib/blobService";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { KaiSignModal } from "~/components/kaisign-metadata-ui";

export default function MetadataRegistryPage() {
  const { toast } = useToast();
  const [owner, setOwner] = useState("");
  const [legalName, setLegalName] = useState("");
  const [url, setUrl] = useState("");
  const [rawJson, setRawJson] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [ipfsHash, setIpfsHash] = useState<string>("");
  const [blobInfo, setBlobInfo] = useState<{ versionedHash: string; url: string; txHash: string } | null>(null);
  const [showViewer, setShowViewer] = useState(false);
  const [viewerAddress, setViewerAddress] = useState("");
  const [viewerChainId, setViewerChainId] = useState<number | undefined>(undefined);

  // Registry test controls
  const [registryAddress, setRegistryAddress] = useState<string>(
    (process.env.NEXT_PUBLIC_METADATA_REGISTRY_ADDRESS as string) || "0xE0BDb7d03D572707317d714d57609f35D1699208",
  );
  const [fnName, setFnName] = useState<string>("register");
  const [paramTypes, setParamTypes] = useState<string>("string,bytes");
  const [isSending, setIsSending] = useState<boolean>(false);
  const [noAttTxHash, setNoAttTxHash] = useState<string>("");
  const [withAttTxHash, setWithAttTxHash] = useState<string>("");
  const [regChainId, setRegChainId] = useState<number>(1);
  const [requireAtt, setRequireAtt] = useState<boolean>(true);
  const [extraHex, setExtraHex] = useState<string>("0x");
  const [signerOverride, setSignerOverride] = useState<string>("");
  const [valueEth, setValueEth] = useState<string>("0");
  const [gasLimit, setGasLimit] = useState<string>("300000");
  const [signMode, setSignMode] = useState<"rawCid" | "cidKeccak" | "chainCidPackedKeccak">("rawCid");

  const erc7730Json = useMemo(() => {
    if (rawJson.trim()) {
      return rawJson;
    }
    const data = {
      $schema: "https://schemas.ledger.com/erc7730/1.0.0",
      context: { contract: { address: "", chainId: viewerChainId || 1 } },
      metadata: {
        owner,
        info: { legalName, url },
      },
      display: { formats: {} },
    };
    return JSON.stringify(data, null, 2);
  }, [owner, legalName, url, rawJson, viewerChainId]);

  const handleUpload = async () => {
    setIsUploading(true);
    try {
      const blobRes = await postToBlob(erc7730Json);
      setIpfsHash(blobRes.blobVersionedHash);
      setBlobInfo({ versionedHash: blobRes.blobVersionedHash, url: blobRes.etherscanBlobUrl, txHash: blobRes.txHash });
      toast({ title: "Blob posted", description: blobRes.etherscanBlobUrl });
    } catch (e: any) {
      toast({ title: "Blob post failed", description: e.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const isValidTxHash = (h: string) => /^0x[a-fA-F0-9]{64}$/.test(h);
  const sepoliaTxUrl = (h: string) => `https://sepolia.etherscan.io/tx/${h}`;
  const sepoliaBlobUrl = (vh: string) => `https://sepolia.etherscan.io/blob/${vh}`;

  const buildFragment = () => `function ${fnName}(${paramTypes})`;

  const sendTx = async (attestationHex: string) => {
    if (!ipfsHash) {
      toast({ title: "Missing IPFS Hash", description: "Upload or paste a CID first.", variant: "destructive" });
      return "";
    }
    if (!registryAddress || !/^0x[a-fA-F0-9]{40}$/.test(registryAddress)) {
      toast({ title: "Invalid Registry Address", description: "Enter a valid 0x address.", variant: "destructive" });
      return "";
    }

    try {
      if (typeof window === "undefined" || !(window as any).ethereum) {
        toast({ title: "Wallet Required", description: "Please install/connect MetaMask.", variant: "destructive" });
        return "";
      }
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();

      const fragment = buildFragment();
      const iface = new ethers.Interface([fragment]);

      const types = paramTypes.split(",").map(t => t.trim().toLowerCase());

      let args: any[] = [];
      if (types.length === 2) {
        // (ipfs:string|bytes32, attestation:bytes)
        const firstType = types[0];
        const ipfsParam = firstType === "bytes32"
          ? ethers.keccak256(ethers.toUtf8Bytes(ipfsHash))
          : ipfsHash;
        args = [ipfsParam, attestationHex];
      } else if (
        types.length === 6 &&
        types[0] === "uint256" &&
        (types[1] === "bytes" || types[1] === "bytes32") &&
        types[2] === "bytes" &&
        types[3] === "bytes" &&
        types[4] === "bool" &&
        types[5] === "address"
      ) {
        const cidBytes = types[1] === "bytes32"
          ? ethers.keccak256(ethers.toUtf8Bytes(ipfsHash))
          : ethers.toUtf8Bytes(ipfsHash);
        const extra = extraHex && extraHex.startsWith("0x") ? extraHex : "0x"; // hex or empty
        const signerAddr = signerOverride && /^0x[a-fA-F0-9]{40}$/.test(signerOverride)
          ? signerOverride
          : await signer.getAddress();
        args = [regChainId, cidBytes, attestationHex, extra, requireAtt, signerAddr];
      } else {
        toast({ title: "Param Types Unsupported", description: `Provided types not handled: ${paramTypes}`, variant: "destructive" });
        return "";
      }

      const data = iface.encodeFunctionData(fnName, args);
      const value = valueEth && valueEth.trim() !== "" ? ethers.parseEther(valueEth) : 0n;
      const gas = gasLimit && gasLimit.trim() !== "" ? BigInt(gasLimit) : 300000n;
      const tx = await signer.sendTransaction({ to: registryAddress, data, value, gasLimit: gas });
      await tx.wait();
      return tx.hash;
    } catch (e: any) {
      // Still return tx hash if available on revert
      const txHash = e?.transaction?.hash || e?.receipt?.transactionHash || "";
      if (txHash) return txHash;
      throw e;
    }
  };

  const testWithoutAttestation = async () => {
    setIsSending(true);
    setNoAttTxHash("");
    try {
      const hash = await sendTx("0x");
      if (hash) {
        setNoAttTxHash(hash);
        toast({ title: "Submitted (expected revert)", description: hash });
      }
    } catch (e: any) {
      toast({ title: "Tx Error (expected)", description: e.message || String(e), variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  const testWithAttestation = async () => {
    setIsSending(true);
    setWithAttTxHash("");
    try {
      if (!(window as any).ethereum) {
        toast({ title: "Wallet Required", description: "Please install/connect MetaMask.", variant: "destructive" });
        return;
      }
      const accounts = await (window as any).ethereum.request({ method: "eth_requestAccounts" });
      const from = accounts?.[0];
      if (!from) throw new Error("No account");

      // Choose message per signMode
      let messageToSign = ipfsHash;
      if (signMode === "cidKeccak") {
        messageToSign = ethers.keccak256(ethers.toUtf8Bytes(ipfsHash));
      } else if (signMode === "chainCidPackedKeccak") {
        const packed = ethers.solidityPacked(["uint256","string"], [regChainId, ipfsHash]);
        messageToSign = ethers.keccak256(packed);
      }

      const signature: string = await (window as any).ethereum.request({
        method: "personal_sign",
        params: [messageToSign, from],
      });

      const hash = await sendTx(signature);
      if (hash) {
        setWithAttTxHash(hash);
        toast({ title: "Submitted (expected pass)", description: hash });
      }
    } catch (e: any) {
      toast({ title: "Tx Error", description: e.message || String(e), variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Metadata Registry</h1>
      <Tabs defaultValue="form" className="w-full">
        <TabsList className="bg-gray-900">
          <TabsTrigger value="form">Form</TabsTrigger>
          <TabsTrigger value="json">JSON</TabsTrigger>
          <TabsTrigger value="viewer">Viewer</TabsTrigger>
        </TabsList>

        <TabsContent value="form" className="mt-4">
          <Card className="p-6 space-y-4">
            <div>
              <Label>Owner</Label>
              <Input value={owner} onChange={(e) => setOwner(e.target.value)} />
            </div>
            <div>
              <Label>Legal Name</Label>
              <Input value={legalName} onChange={(e) => setLegalName(e.target.value)} />
            </div>
            <div>
              <Label>URL</Label>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} />
            </div>
            <div className="flex gap-2 items-center flex-wrap">
              <Button onClick={handleUpload} disabled={isUploading}>
                {isUploading ? "Posting..." : "Post Blob"}
              </Button>
              {blobInfo && (
                <a
                  className="underline text-blue-400"
                  href={blobInfo.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  View Blob Receipt
                </a>
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="json" className="mt-4">
          <Card className="p-6 space-y-4">
            <Label>ERC7730 JSON</Label>
            <Textarea rows={16} value={erc7730Json} onChange={(e) => setRawJson(e.target.value)} />
            <div>
              <Button onClick={handleUpload} disabled={isUploading}>
                {isUploading ? "Posting..." : "Post Blob"}
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="viewer" className="mt-4">
          <Card className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Contract Address</Label>
                <Input value={viewerAddress} onChange={(e) => setViewerAddress(e.target.value)} placeholder="0x..." />
              </div>
              <div>
                <Label>Chain ID</Label>
                <Input
                  value={viewerChainId ?? ""}
                  onChange={(e) => setViewerChainId(Number(e.target.value) || undefined)}
                  placeholder="1"
                />
              </div>
              <div className="flex items-end">
                <Button onClick={() => setShowViewer(true)} disabled={!viewerAddress || !viewerChainId}>
                  Open Viewer
                </Button>
              </div>
            </div>

            <KaiSignModal
              isOpen={showViewer}
              onClose={() => setShowViewer(false)}
              contractAddress={viewerAddress}
              chainId={viewerChainId || 1}
            />
          </Card>
        </TabsContent>

        {/* Registry Test */}
        <TabsContent value="form" className="mt-4">
          <Card className="p-6 space-y-4">
            <h2 className="text-lg font-semibold">Test Metadata Registry (On-chain)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Registry Address (Sepolia)</Label>
                <Input value={registryAddress} onChange={(e) => setRegistryAddress(e.target.value)} placeholder="0x..." />
              </div>
              <div>
                <Label>Function Name</Label>
                <Input value={fnName} onChange={(e) => setFnName(e.target.value)} placeholder="register" />
              </div>
              <div>
                <Label>Param Types</Label>
                <Input value={paramTypes} onChange={(e) => setParamTypes(e.target.value)} placeholder="string,bytes or bytes32,bytes" />
              </div>
              <div>
                <Label>Current IPFS Hash</Label>
                <Input value={ipfsHash} onChange={(e) => setIpfsHash(e.target.value)} placeholder="Qm... or baf..." />
              </div>
              {/* Extra controls for 6-arg signature */}
              <div>
                <Label>Registry Chain ID (uint256)</Label>
                <Input value={regChainId} onChange={(e) => setRegChainId(Number(e.target.value) || 0)} placeholder="1" />
              </div>
              <div>
                <Label>Require Attestation (bool)</Label>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={requireAtt} onChange={(e) => setRequireAtt(e.target.checked)} />
                  <span className="text-sm text-gray-300">true/false</span>
                </div>
              </div>
              <div>
                <Label>Extra Bytes (bytes, hex)</Label>
                <Input value={extraHex} onChange={(e) => setExtraHex(e.target.value)} placeholder="0x" />
              </div>
              <div>
                <Label>Signer Address (optional)</Label>
                <Input value={signerOverride} onChange={(e) => setSignerOverride(e.target.value)} placeholder="0x... (defaults to connected wallet)" />
              </div>
              <div>
                <Label>ETH Value (optional)</Label>
                <Input value={valueEth} onChange={(e) => setValueEth(e.target.value)} placeholder="0" />
              </div>
              <div>
                <Label>Gas Limit (manual)</Label>
                <Input value={gasLimit} onChange={(e) => setGasLimit(e.target.value)} placeholder="300000" />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={testWithoutAttestation} disabled={isSending || !ipfsHash} variant="destructive">
                Send without attestation (expect revert)
              </Button>
              <Button onClick={testWithAttestation} disabled={isSending || !ipfsHash}>
                Send with attestation (expect pass)
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label>Signature message</Label>
                <select
                  className="w-full p-2 bg-gray-900 border border-gray-700 rounded text-white"
                  value={signMode}
                  onChange={(e) => setSignMode(e.target.value as any)}
                >
                  <option value="rawCid">raw CID (personal_sign)</option>
                  <option value="cidKeccak">keccak256(CID)</option>
                  <option value="chainCidPackedKeccak">keccak256(packed(chainId,CID))</option>
                </select>
              </div>
            </div>
            {(noAttTxHash || withAttTxHash) && (
              <div className="space-y-2 text-sm">
                {noAttTxHash && (
                  <div>
                    <span className="text-gray-300">No-attestation TX:</span>{" "}
                    <code className="bg-gray-800 px-1 rounded">{noAttTxHash}</code>{" "}
                    {isValidTxHash(noAttTxHash) && (
                      <a className="text-blue-400 underline ml-2" href={sepoliaTxUrl(noAttTxHash)} target="_blank" rel="noreferrer">
                        View on Etherscan
                      </a>
                    )}
                  </div>
                )}
                {withAttTxHash && (
                  <div>
                    <span className="text-gray-300">With-attestation TX:</span>{" "}
                    <code className="bg-gray-800 px-1 rounded">{withAttTxHash}</code>{" "}
                    {isValidTxHash(withAttTxHash) && (
                      <a className="text-blue-400 underline ml-2" href={sepoliaTxUrl(withAttTxHash)} target="_blank" rel="noreferrer">
                        View on Etherscan
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}


