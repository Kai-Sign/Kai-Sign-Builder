"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { SignMessage } from "../../components/SignMessage";
import { VerifySignature } from "../../components/VerifySignature";

export default function DigitalSignaturesPage() {
  return (
    <div className="container mx-auto py-10 px-4">
      <div className="space-y-4 max-w-4xl mx-auto">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Ethereum Digital Signatures</h1>
          <p className="text-lg text-muted-foreground">
            Sign messages with your Ethereum wallet or verify signatures from others
          </p>
        </div>
        
        <Tabs defaultValue="sign" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="sign">Sign Message</TabsTrigger>
            <TabsTrigger value="verify">Verify Signature</TabsTrigger>
          </TabsList>
          <TabsContent value="sign" className="mt-6">
            <SignMessage />
            
            <div className="mt-8 space-y-4 text-sm">
              <h3 className="font-semibold text-base">What are Ethereum signatures?</h3>
              <p>
                Ethereum signatures allow you to prove ownership of an Ethereum address without revealing your private key.
                When you sign a message, you create a cryptographic proof that you control the address.
              </p>
              <p>
                Use cases include:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Authentication to websites and dApps</li>
                <li>Verifying identity across platforms</li>
                <li>Creating off-chain approvals</li>
                <li>Message authentication</li>
              </ul>
            </div>
          </TabsContent>
          <TabsContent value="verify" className="mt-6">
            <VerifySignature />
            
            <div className="mt-8 space-y-4 text-sm">
              <h3 className="font-semibold text-base">How to verify a signature</h3>
              <p>
                To verify a signature, you need three pieces of information:
              </p>
              <ol className="list-decimal pl-6 space-y-1">
                <li>The exact message that was signed</li>
                <li>The signature</li>
                <li>Optionally, the expected signer address</li>
              </ol>
              <p>
                The verification process mathematically recovers the Ethereum address that produced the signature.
                If you provide an expected address, it will also check if the recovered address matches.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
} 