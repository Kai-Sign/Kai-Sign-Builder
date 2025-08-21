import { useState, ChangeEvent } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { useSignature } from "../hooks/useSignature";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import { SignatureService } from "../lib/signatureService";
import { Separator } from "../components/ui/separator";

/**
 * Component for verifying Ethereum signatures
 */
export function VerifySignature() {
  const [message, setMessage] = useState("");
  const [signature, setSignature] = useState("");
  const [expectedAddress, setExpectedAddress] = useState("");
  const [copySuccess, setCopySuccess] = useState("");
  
  const { verifyMessageSignature, verificationState } = useSignature();

  const handleVerify = () => {
    if (!message.trim() || !signature.trim()) return;
    
    try {
      // Only pass expected address if it's not empty
      const addressToCheck = expectedAddress.trim() ? expectedAddress : undefined;
      verifyMessageSignature(message, signature, addressToCheck);
    } catch (error) {
      console.error("Error verifying signature:", error);
      // Error is handled in the hook
    }
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopySuccess(`${type} copied to clipboard!`);
    setTimeout(() => setCopySuccess(""), 3000);
  };

  // Use our custom address validation function
  const isValidAddress = !expectedAddress || SignatureService.isValidAddress(expectedAddress);
  
  // Ensure these values are boolean for the disabled attribute
  const isInputEmpty = !message.trim() || !signature.trim();
  const isVerifying = !!verificationState.isLoading;
  const hasInvalidAddress = !!expectedAddress && !isValidAddress;

  return (
    <Card className="w-full max-w-3xl shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl">Verify a Signature</CardTitle>
        <CardDescription>
          Verify a message signature to confirm it was signed by a specific Ethereum address
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="message" className="text-sm font-medium">
            Message
          </label>
          <Textarea
            id="message"
            placeholder="Enter the original signed message..."
            value={message}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setMessage(e.target.value)}
            rows={4}
            className="resize-none"
          />
        </div>
        
        <div className="space-y-2">
          <label htmlFor="signature" className="text-sm font-medium">
            Signature
          </label>
          <Textarea
            id="signature"
            placeholder="Enter the signature to verify..."
            value={signature}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setSignature(e.target.value)}
            rows={4}
            className="resize-none font-mono text-xs"
          />
        </div>
        
        <div className="space-y-2">
          <label htmlFor="expectedAddress" className="text-sm font-medium">
            Expected Address (Optional)
          </label>
          <Input
            id="expectedAddress"
            placeholder="0x..."
            value={expectedAddress}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setExpectedAddress(e.target.value)}
            className="font-mono"
          />
          {expectedAddress && !isValidAddress && (
            <p className="text-xs text-red-500 mt-1">
              Invalid Ethereum address format
            </p>
          )}
        </div>

        {verificationState.error && (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              {verificationState.error.message}
            </AlertDescription>
          </Alert>
        )}

        {verificationState.recoveredAddress && (
          <>
            <Separator className="my-4" />
            
            <div className="rounded-lg border p-4 space-y-4">
              <div className="flex items-center space-x-2">
                <div className={`h-3 w-3 rounded-full ${verificationState.isValid ? 'bg-green-500' : 'bg-red-500'}`} />
                <h3 className="text-lg font-medium">
                  {verificationState.isValid 
                    ? 'Signature is valid!' 
                    : 'Signature verification failed!'}
                </h3>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Signer Address</label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(verificationState.recoveredAddress, "Address")}
                    className="h-8 px-2"
                  >
                    Copy
                  </Button>
                </div>
                <Input
                  readOnly
                  value={verificationState.recoveredAddress}
                  className="font-mono text-sm"
                />
              </div>
              
              {expectedAddress && (
                <div className="space-y-1">
                  <p className="text-sm">
                    <strong>Expected Address:</strong> {expectedAddress}
                  </p>
                  <p className="text-sm">
                    <strong>Matches:</strong>{" "}
                    {verificationState.isValid ? (
                      <span className="text-green-600">Yes</span>
                    ) : (
                      <span className="text-red-600">No</span>
                    )}
                  </p>
                </div>
              )}
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
          onClick={handleVerify} 
          disabled={isInputEmpty || isVerifying || hasInvalidAddress}
          className="w-full"
        >
          {verificationState.isLoading ? "Verifying..." : "Verify Signature"}
        </Button>
      </CardFooter>
    </Card>
  );
} 