import { useState } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import { useSignature } from "../hooks/useSignature";
import { Separator } from "../components/ui/separator";
import { ethers } from "ethers";
import { ChangeEvent } from "react";

/**
 * Component for signing messages with an Ethereum wallet
 */
export function SignMessage() {
  const [message, setMessage] = useState("");
  const [copySuccess, setCopySuccess] = useState("");
  const { signMessage, signatureState } = useSignature();

  const handleSignMessage = async () => {
    if (!message.trim()) return;
    
    try {
      await signMessage(message);
    } catch (error) {
      console.error("Error signing message:", error);
      // Error is already handled in the hook
    }
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopySuccess(`${type} copied to clipboard!`);
    setTimeout(() => setCopySuccess(""), 3000);
  };

  return (
    <Card className="w-full max-w-3xl shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl">Sign a Message</CardTitle>
        <CardDescription>
          Sign a message with your Ethereum wallet to prove your identity
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="message" className="text-sm font-medium">
            Message to Sign
          </label>
          <Textarea
            id="message"
            placeholder="Enter a message to sign..."
            value={message}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setMessage(e.target.value)}
            rows={4}
            className="resize-none"
          />
        </div>

        {signatureState.error && (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              {signatureState.error.message}
            </AlertDescription>
          </Alert>
        )}

        {signatureState.signature && (
          <>
            <Separator className="my-4" />
            
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Signer Address</label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(signatureState.address, "Address")}
                    className="h-8 px-2"
                  >
                    Copy
                  </Button>
                </div>
                <Input
                  readOnly
                  value={signatureState.address}
                  className="font-mono text-sm"
                />
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Signed Message</label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(signatureState.message, "Message")}
                    className="h-8 px-2"
                  >
                    Copy
                  </Button>
                </div>
                <Textarea
                  readOnly
                  value={signatureState.message}
                  className="font-mono text-sm resize-none"
                  rows={3}
                />
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Signature</label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(signatureState.signature, "Signature")}
                    className="h-8 px-2"
                  >
                    Copy
                  </Button>
                </div>
                <Textarea
                  readOnly
                  value={signatureState.signature}
                  className="font-mono text-xs resize-none"
                  rows={4}
                />
              </div>

              <div className="text-sm">
                <strong>Timestamp:</strong>{" "}
                {new Date(signatureState.timestamp).toLocaleString()}
              </div>
            </div>
          </>
        )}

        {copySuccess && (
          <Alert className="bg-green-50 text-green-800 border-green-200">
            <AlertDescription>{copySuccess}</AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter>
        <Button 
          onClick={handleSignMessage} 
          disabled={!message.trim() || signatureState.isLoading} 
          className="w-full"
        >
          {signatureState.isLoading ? "Waiting for Wallet..." : "Sign Message"}
        </Button>
      </CardFooter>
    </Card>
  );
} 