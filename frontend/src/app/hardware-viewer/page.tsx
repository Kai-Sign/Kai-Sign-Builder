import { HydrateClient } from "~/trpc/server";
import HardwareViewer from "./hardwareViewer";

export default async function HardwareViewerPage() {
  return (
    <HydrateClient>
      <div className="container mx-auto flex max-w-4xl flex-col justify-center p-4">
        <div className="flex flex-col gap-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold">Hardware UI Viewer</h1>
            <p className="text-gray-600 mt-2">
              Paste your ERC7730 metadata JSON to see how it would look on a hardware wallet
            </p>
          </div>
          <HardwareViewer />
        </div>
      </div>
    </HydrateClient>
  );
} 