import { HydrateClient } from "~/trpc/server";
import { Button } from "~/components/ui/button";
import Link from "next/link";
import FileUploader from "./fileUploader";

export default function ReviewResultsPage() {
  return (
    <HydrateClient>
      <div className="container mx-auto max-w-4xl p-6 text-white">
        <h1 className="mb-8 text-4xl font-bold">ERC7730 JSON Review</h1>
        
        <FileUploader />
        
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
          <h2 className="mb-4 text-2xl font-medium">Reality.eth Review</h2>
          <p className="mb-4 text-gray-300">
            Reality.eth's optimistic oracle reviews metadata CIDs on Ethereum by treating each CID as a "question." 
            Anyone can stake ETH to assert that the spec is correct. If no one challenges that assertion within the 
            designated window, the metadata is marked as reviewed. <br />
            <br />
            Once reviewed, this metadata serves as a trusted 
            reference in the Kleros Community Curation Registry for exact submission, but it does not itself complete 
            the on-chain registration. Final submission to the registry still requires the usual Kleros curation process.
          </p>
          
          <div className="mt-6">
            <h3 className="mb-3 text-lg font-medium text-purple-200">Key Requirements:</h3>
            <ul className="list-inside list-disc space-y-2 text-gray-300">
              <li>Minimum bond requirement varies based on question complexity</li>
              <li>Timeout period for challenges (typically 24-48 hours)</li>
              <li>Gas costs for question creation and answer submission</li>
              <li>Potential arbitration fees if disputes arise</li>
              <li>Bond doubling mechanism for subsequent answers</li>
            </ul>
          </div>

          <div className="mt-6 p-4 bg-purple-900 rounded-lg">
            <p className="text-sm text-purple-200">
              <strong>Note:</strong> The review process involves smart contract interactions with associated 
              gas costs and potential bond requirements. Review the Reality.eth contract documentation for current 
              fee structures and timeout parameters.
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