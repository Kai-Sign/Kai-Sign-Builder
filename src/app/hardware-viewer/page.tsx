"use client";

import { useState } from "react";
import DeviceSimulator from "~/components/advanced/DeviceSimulator";

export default function HardwareViewerPage() {
  const [erc7730Data, setErc7730Data] = useState<any>(null);
  const [jsonError, setJsonError] = useState<string>("");
  
  // Sample transaction for testing
  const sampleTransaction = {
    to: "0x1234567890123456789012345678901234567890",
    value: "1000000000000000000", // 1 ETH
    data: "0x",
    gasLimit: "21000",
    gasPrice: "20000000000",
    nonce: 0,
    chainId: 1
  };

  const handleComplete = (approved: boolean) => {
    console.log('Transaction', approved ? 'approved' : 'rejected');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto max-w-7xl px-4 py-8">
        {/* Header Section */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-3">
            Hardware Wallet UI Viewer
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Preview how your ERC7730 metadata will appear on different hardware wallets
          </p>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Section */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
              ERC7730 Metadata Input
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Paste your JSON here:
                </label>
                <textarea
                  className={`w-full h-64 p-4 border-2 rounded-lg font-mono text-sm bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 
                    focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors
                    ${jsonError ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`}
                  placeholder='{"version": "1.0", "display": {...}}'
                  onChange={(e) => {
                    try {
                      if (e.target.value.trim()) {
                        const parsed = JSON.parse(e.target.value);
                        setErc7730Data(parsed);
                        setJsonError("");
                      } else {
                        setErc7730Data(null);
                        setJsonError("");
                      }
                    } catch (err) {
                      setJsonError("Invalid JSON format");
                    }
                  }}
                />
                {jsonError && (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400">{jsonError}</p>
                )}
              </div>

              {/* Quick Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const sampleERC7730 = {
                      version: "1.0",
                      display: {
                        formats: {
                          fields: [
                            {
                              path: "to",
                              label: "Recipient",
                              format: "address"
                            },
                            {
                              path: "value",
                              label: "Amount",
                              format: "amount",
                              params: { token: "ETH" }
                            }
                          ]
                        }
                      }
                    };
                    setErc7730Data(sampleERC7730);
                    setJsonError("");
                  }}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
                >
                  Load Sample
                </button>
                <button
                  onClick={() => {
                    setErc7730Data(null);
                    setJsonError("");
                  }}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
                >
                  Clear
                </button>
              </div>

              {/* Transaction Details */}
              <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Sample Transaction Details:
                </h3>
                <div className="space-y-1 text-xs font-mono text-gray-600 dark:text-gray-400">
                  <p>To: {sampleTransaction.to}</p>
                  <p>Value: 1 ETH</p>
                  <p>Chain ID: {sampleTransaction.chainId}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Simulator Section */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
              Device Preview
            </h2>
            
            <div className="flex items-center justify-center min-h-[400px]">
              {erc7730Data ? (
                <DeviceSimulator 
                  transaction={sampleTransaction}
                  erc7730Spec={erc7730Data}
                  onComplete={handleComplete}
                />
              ) : (
                <div className="text-center text-gray-500 dark:text-gray-400">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm">Enter ERC7730 metadata to preview</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 