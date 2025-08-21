"use client";

import { useMemo, useState } from "react";
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { useToast } from "~/hooks/use-toast";
import { uploadToIPFS } from "~/lib/ipfsService";
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
  const [showViewer, setShowViewer] = useState(false);
  const [viewerAddress, setViewerAddress] = useState("");
  const [viewerChainId, setViewerChainId] = useState<number | undefined>(undefined);

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
      const cid = await uploadToIPFS(erc7730Json);
      setIpfsHash(cid);
      toast({ title: "Uploaded to IPFS", description: cid });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
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
            <div className="flex gap-2">
              <Button onClick={handleUpload} disabled={isUploading}>
                {isUploading ? "Uploading..." : "Upload to IPFS"}
              </Button>
              {ipfsHash && (
                <a
                  className="underline text-blue-400"
                  href={`https://gateway.ipfs.io/ipfs/${ipfsHash}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View on IPFS
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
                {isUploading ? "Uploading..." : "Upload to IPFS"}
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
      </Tabs>
    </div>
  );
}


