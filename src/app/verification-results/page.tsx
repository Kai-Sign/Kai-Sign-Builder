import { HydrateClient } from "~/trpc/server";
import { Button } from "~/components/ui/button";
import Link from "next/link";
import FileUploader from "./fileUploader";

export default function VerificationResultsPage() {
  return (
    <HydrateClient>
      <div className="container mx-auto max-w-4xl p-6 text-white">
        <h1 className="mb-8 text-4xl font-bold">ERC7730 JSON Verification</h1>
        
        <FileUploader />
        
        {/* KaiSign V1 Management Link */}
        <div className="mb-8 rounded-lg bg-green-950 p-6 border border-green-800">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-green-100 mb-2">KaiSign V1 Management</h3>
              <p className="text-green-200 text-sm">
                Manage incentives, browse specifications, and interact with advanced KaiSign V1 features.
              </p>
            </div>
            <Link href="/kaisign-v1">
              <Button className="bg-green-600 hover:bg-green-700 text-white">
                Open V1 Manager
              </Button>
            </Link>
          </div>
        </div>
        
        <div className="mb-12 rounded-lg bg-blue-950 p-8 text-white">
          <h2 className="mb-4 text-2xl font-medium">What is ERC7730?</h2>
          <p className="text-gray-300">
            Learn more about the ERC7730 standard for smart contract clear signing at{" "}
            <a 
              href="https://developers.ledger.com/docs/clear-signing/references/erc7730-standard" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 underline"
            >
              Ledger's official documentation
            </a>.
          </p>
        </div>

        <div className="mb-12 rounded-lg bg-purple-950 p-8 text-white">
          <h2 className="mb-4 text-2xl font-medium">KaiSign V1 Verification System</h2>
          <p className="mb-4 text-gray-300">
            KaiSign V1 uses Reality.eth's optimistic oracle with enhanced features including commit-reveal submission, 
            contract-specific specifications, and an incentive system. The system treats each ERC7730 specification 
            as a "question" that can be verified through community consensus. <br />
            <br />
            The V1 contract introduces security improvements with commit-reveal patterns to prevent front-running,
            contract address linking for targeted specifications, and incentive mechanisms to encourage quality submissions.
          </p>
          
          <div className="mt-6">
            <h3 className="mb-3 text-lg font-medium text-purple-200">V1 Features:</h3>
            <ul className="list-inside list-disc space-y-2 text-gray-300">
              <li><strong>Commit-Reveal Pattern:</strong> Prevents front-running with two-step submission process</li>
              <li><strong>Cross-Chain Contract Targeting:</strong> Link specifications to contracts on any blockchain with chain ID support</li>
              <li><strong>Incentive System:</strong> Create rewards for quality ERC7730 specifications</li>
              <li><strong>Enhanced Security:</strong> ReentrancyGuard, AccessControl, and Pausable functionality</li>
              <li><strong>Bond Settlement:</strong> Automated distribution of bonds to winning parties</li>
              <li><strong>Platform Fees:</strong> 5% platform fee on bonds and incentives</li>
            </ul>
          </div>

          <div className="mt-6">
            <h3 className="mb-3 text-lg font-medium text-purple-200">Process Overview:</h3>
            <ol className="list-inside list-decimal space-y-2 text-gray-300">
              <li>Upload your ERC7730 JSON specification</li>
              <li>Specify target contract address and chain ID</li>
              <li>Submit with minimum bond (commit-reveal handled automatically)</li>
              <li>Community can challenge within 48-hour window</li>
              <li>Finalize result and claim rewards if accepted</li>
            </ol>
          </div>

          <div className="mt-6 p-4 bg-purple-900 rounded-lg">
            <p className="text-sm text-purple-200">
              <strong>V1 Contract:</strong> 0xB55D4406916e20dF5B965E15dd3ff85fa8B11dCf on Sepolia Testnet
              <br />
              <strong>Note:</strong> The V1 system includes enhanced security features and gas optimizations. 
              All interactions are logged and can be tracked through the contract events.
            </p>
          </div>
        </div>
        
        <div className="flex justify-between">
          <Button 
            variant="outline" 
            asChild
            className="px-8 py-6 text-base border border-gray-700 hover:bg-gray-800 hover:border-gray-600"
          >
            <Link href="/">Back to Home</Link>
          </Button>
          
          <Button 
            variant="outline" 
            asChild
            className="px-8 py-6 text-base border border-gray-700 hover:bg-gray-800 hover:border-gray-600"
          >
            <Link href="/contract-events">Past Results</Link>
          </Button>
        </div>
      </div>
    </HydrateClient>
  );
} 