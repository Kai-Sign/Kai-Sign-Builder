"use client";

import { Input } from "~/components/ui/input";
import { Card, CardContent } from "~/components/ui/card";
import { Label } from "~/components/ui/label";

import { useState, useEffect } from "react";
import { Textarea } from "~/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import SampleAddressAbiCard from "./sampleAddressAbiCard";
import { Button } from "~/components/ui/button";
import { FileJson, Loader2, Shield } from "lucide-react";
import Image from "next/image";
import { Switch } from "~/components/ui/switch";

import { ZodError } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useErc7730Store } from "~/store/erc7730Provider";
import useFunctionStore from "~/store/useOperationStore";
import generateFromERC7730 from "./generateFromERC7730";

// Sleep utility function for delay between retries
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Check if the API is ready
const checkApiHealth = async (): Promise<boolean> => {
  try {
    // First try the local API endpoint
    const localApiResponse = await fetch("/api/py", {
      method: "GET",
      headers: {
        "Cache-Control": "no-cache",
      },
      cache: "no-store",
    });

    if (localApiResponse.ok) {
      console.log("Local API is available");
      return true;
    }

    // If local API fails, try the direct Railway API
    console.log("Local API not available, trying Railway API directly");
    const railwayApiUrl = process.env.NEXT_PUBLIC_API_URL || "https://kai-sign-production.up.railway.app";
    const railwayResponse = await fetch(`${railwayApiUrl}/api/py`, {
      method: "GET",
      headers: {
        "Cache-Control": "no-cache",
      },
      cache: "no-store",
    });

    if (railwayResponse.ok) {
      console.log("Railway API is available");
      return true;
    }

    console.log("Both local and Railway APIs are unavailable");
    return false;
  } catch (error) {
    console.error("Error checking API health:", error);
    return false;
  }
};

const CardErc7730 = () => {
  const [input, setInput] = useState("");
  const [inputType, setInputType] = useState<"address" | "abi" | "proxy">("address");
  const [implementationAddress, setImplementationAddress] = useState("");
  const [isProxyContract, setIsProxyContract] = useState(false);
  const { setErc7730 } = useErc7730Store((state) => state);
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [apiReady, setApiReady] = useState<boolean | null>(null);
  const [checkingApi, setCheckingApi] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);

    // Check API health on mount
    const checkApi = async () => {
      setCheckingApi(true);
      // Force API ready to true for production
      // This is a workaround for Vercel deployments
      const isProduction = window.location.hostname.includes('vercel.app');
      
      if (isProduction) {
        console.log("Production environment detected, assuming API is ready");
        setApiReady(true);
        setCheckingApi(false);
        return;
      }

      let isReady = await checkApiHealth();
      
      // If not ready, retry a few times with increasing delay
      if (!isReady) {
        let retryDelay = 1000;
        for (let i = 0; i < 3; i++) {
          await sleep(retryDelay);
          isReady = await checkApiHealth();
          if (isReady) break;
          retryDelay *= 2;
        }
      }
      
      // For deployments, assume API is ready even if check fails
      if (!isReady && (process.env.NODE_ENV === "production" || isProduction)) {
        console.log("Production environment, forcing API ready");
        isReady = true;
      }
      
      setApiReady(isReady);
      setCheckingApi(false);
    };
    
    checkApi();
  }, []);

  const {
    mutateAsync: fetchERC7730Metadata,
    isPending: loading,
    error,
  } = useMutation({
    mutationFn: (input: string | { proxyAddress: string; implementationAddress: string }) =>
      generateFromERC7730({
        input,
        inputType: typeof input === 'string' 
          ? (inputType === 'proxy' ? 'address' : inputType) 
          : 'proxy',
      }),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Skip API health check on production
    if (apiReady === false && !window.location.hostname.includes('vercel.app')) {
      // Re-check API health
      setCheckingApi(true);
      const isReady = await checkApiHealth();
      setApiReady(isReady);
      setCheckingApi(false);
      
      if (!isReady) {
        // Show error message
        return;
      }
    }
    
    try {
      let erc7730;
      
      if (isProxyContract && implementationAddress) {
        // Pass both proxy and implementation addresses
        erc7730 = await fetchERC7730Metadata({
          proxyAddress: input,
          implementationAddress: implementationAddress
        });
      } else {
        // Original behavior
        erc7730 = await fetchERC7730Metadata(input);
      }

      if (erc7730) {
        console.log(erc7730);
        useFunctionStore.persist.clearStorage();

        setErc7730(erc7730);
        router.push("/metadata");
      }
    } catch (error) {
      console.error("Error fetching metadata:", error);
      // Continue anyway on production
      if (window.location.hostname.includes('vercel.app')) {
        router.push("/metadata");
      }
    }
  };

  const onTabChange = (value: string) => {
    setInputType(value as "address" | "abi" | "proxy");
    setInput("");
    if (value !== "proxy") {
      setIsProxyContract(false);
      setImplementationAddress("");
    } else {
      setIsProxyContract(true);
    }
  };
  
  const handleSkipToVerification = () => {
    router.push("/verification-results");
  };

  if (!mounted) return null;

  return (
    <div className="w-full max-w-[580px]">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-4xl font-bold text-white">
          ERC7730 Json Builder
        </h1>
        <div className="h-16 w-16">
          <Image 
            src="/assets/unicorn.png" 
            alt="Pixel Unicorn" 
            width={64} 
            height={64}
          />
        </div>
      </div>

      <div className="rounded-xl border border-[#664bda]/50 bg-[#140a33]/50 p-6 backdrop-blur-sm">
        <form onSubmit={handleSubmit} className="flex w-full flex-col gap-6">
          <Tabs defaultValue="address" onValueChange={onTabChange}>
            <div className="relative overflow-hidden rounded-lg border border-[#1f0f4c] bg-[#0f051d]">
              <TabsList className="flex w-full">
                <TabsTrigger 
                  value="address" 
                  className="flex-1 rounded-none py-4 text-center data-[state=active]:bg-[#5379FF] data-[state=active]:text-white data-[state=inactive]:bg-transparent"
                >
                  Contract Address
                </TabsTrigger>
                <TabsTrigger 
                  value="proxy" 
                  className="flex-1 rounded-none py-4 text-center data-[state=active]:bg-[#F9CB28] data-[state=active]:text-white data-[state=inactive]:bg-transparent"
                >
                  Proxy Contract
                </TabsTrigger>
                <TabsTrigger 
                  value="abi" 
                  className="flex-1 rounded-none py-4 text-center data-[state=active]:bg-[#5379FF] data-[state=active]:text-white data-[state=inactive]:bg-transparent"
                >
                  ABI
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="address" className="mt-6">
              <div>
                <Label className="mb-2 block font-normal text-white">Contract Address</Label>
                <Input
                  id="contract-address"
                  placeholder="0x..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  className="h-12 rounded-lg border-[#1f0f4c] bg-[#0f051d] text-white placeholder:text-gray-500"
                />
              </div>
            </TabsContent>
            
            <TabsContent value="proxy" className="mt-6">
              <div className="space-y-4">
                <div>
                  <Label className="mb-2 block font-normal text-white">Proxy Contract Address</Label>
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-amber-400" />
                    <Input
                      id="proxy-address"
                      placeholder="0x... (the address users interact with)"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      className="h-12 rounded-lg border-amber-500/30 bg-[#0f051d] text-white placeholder:text-gray-500"
                    />
                  </div>
                </div>
                
                <div>
                  <Label className="mb-2 block font-normal text-white">Implementation Contract Address</Label>
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-blue-400" />
                    <Input
                      id="implementation-address"
                      placeholder="0x... (the address with logic implementation)"
                      value={implementationAddress}
                      onChange={(e) => setImplementationAddress(e.target.value)}
                      className="h-12 rounded-lg border-blue-500/30 bg-[#0f051d] text-white placeholder:text-gray-500"
                    />
                  </div>
                </div>
                
                <div className="rounded-md border border-amber-500/30 bg-amber-900/10 p-3 text-sm">
                  <p className="text-amber-300">How Proxy Contracts Work:</p>
                  <p className="mt-1 text-gray-400">
                    • <span className="text-amber-400">Proxy Address</span>: The contract users interact with<br />
                    • <span className="text-blue-400">Implementation Address</span>: Contains the actual logic & ABI
                  </p>
                  <p className="mt-2 text-white">Both addresses are needed for correct ERC7730 registration.</p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="abi" className="mt-6">
              <div>
                <Label className="mb-2 block font-normal text-white">ABI</Label>
                <Textarea
                  id="abi"
                  placeholder="Paste your ABI here..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  className="min-h-[120px] rounded-lg border-[#1f0f4c] bg-[#0f051d] text-white placeholder:text-gray-500"
                />
              </div>
            </TabsContent>

            <div className="mt-6 flex items-center justify-between gap-4">
              <button
                type="submit"
                disabled={loading || (checkingApi && !window.location.hostname.includes('vercel.app'))}
                className="rounded-full bg-gradient-to-r from-[#FF4D4D] to-[#F9CB28] px-8 py-3 font-medium text-white transition-transform hover:-translate-y-1 hover:shadow-lg disabled:opacity-70 flex items-center gap-2"
              >
                {(loading || checkingApi) && <Loader2 className="h-4 w-4 animate-spin" />}
                {checkingApi ? "Checking API..." : "Submit"}
              </button>
              
              <button
                type="button"
                onClick={handleSkipToVerification}
                className="flex items-center gap-2 rounded-lg border border-[#41b1e1]/50 bg-transparent px-4 py-3 text-[#41b1e1] transition-all hover:bg-[#41b1e1]/10"
              >
                <FileJson className="h-5 w-5" />
                <span>I already have a JSON file</span>
              </button>
            </div>
          </Tabs>
        </form>
      </div>

      {apiReady === false && !window.location.hostname.includes('vercel.app') && (
        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-900/20 p-4 text-amber-400">
          The API server is currently starting up. Please wait a moment before submitting.
        </div>
      )}

      {error && !window.location.hostname.includes('vercel.app') && (
        <div className="mt-4 rounded-lg border border-red-500/30 bg-red-900/20 p-4 text-red-400">
          {error instanceof ZodError
            ? JSON.parse(error.message)[0].message
            : error.message}
        </div>
      )}

      <div className="mt-6">
        <div className="rounded-xl border border-[#664bda]/50 bg-[#140a33]/50 p-6 backdrop-blur-sm">
          <h3 className="mb-3 text-xl font-medium text-white">
            Sample {inputType === "address" ? "Address" : "ABI"}
          </h3>
          <p className="mb-4 text-sm text-gray-400">
            Click to copy a sample {inputType === "address" ? "address" : "ABI"} for testing
          </p>
          
          <div className="flex flex-wrap gap-2">
            {inputType === "address" ? (
              <>
                <button
                  onClick={() => {
                    const value = "0x0bb4D3e88243F4A057Db77341e6916B0e449b158";
                    void navigator.clipboard.writeText(value);
                    setInput(value);
                  }}
                  className="rounded-lg border border-[#41b1e1]/30 bg-[#0f051d] px-4 py-2 text-[#41b1e1] transition-all hover:-translate-y-1 hover:border-[#41b1e1]/70"
                >
                  Poap
                </button>
                <button
                  onClick={() => {
                    const value = "0x5954ab967bc958940b7eb73ee84797dc8a2afbb9";
                    void navigator.clipboard.writeText(value);
                    setInput(value);
                  }}
                  className="rounded-lg border border-[#41b1e1]/30 bg-[#0f051d] px-4 py-2 text-[#41b1e1] transition-all hover:-translate-y-1 hover:border-[#41b1e1]/70"
                >
                  ApeCoin: Staking
                </button>
                <button
                  onClick={() => {
                    const value = "0x43506849D7C04F9138D1A2050bbF3A0c054402dd";
                    void navigator.clipboard.writeText(value);
                    setInput(value);
                  }}
                  className="rounded-lg border border-[#41b1e1]/30 bg-[#0f051d] px-4 py-2 text-[#41b1e1] transition-all hover:-translate-y-1 hover:border-[#41b1e1]/70"
                >
                  USDC
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  // Fetch a sample ABI instead of using hardcoded values
                  fetch("https://api.etherscan.io/api?module=contract&action=getabi&address=0x0bb4D3e88243F4A057Db77341e6916B0e449b158")
                    .then(response => response.json())
                    .then(data => {
                      if (data.status === "1" && data.result) {
                        void navigator.clipboard.writeText(data.result);
                        setInput(data.result);
                      }
                    })
                    .catch(err => {
                      console.error("Error fetching ABI:", err);
                    });
                }}
                className="rounded-lg border border-[#41b1e1]/30 bg-[#0f051d] px-4 py-2 text-[#41b1e1] transition-all hover:-translate-y-1 hover:border-[#41b1e1]/70"
              >
                Poap
              </button>
            )}
          </div>
          
          {/* Proxy Contract Section */}
          <div className="mt-6 border-t border-[#664bda]/30 pt-4">
            <h4 className="mb-2 text-lg font-medium text-white">Upgradeable/Proxy Contracts</h4>
            <p className="mb-3 text-sm text-gray-400">
              For upgradeable contracts, you must register the <span className="text-amber-400">proxy contract address</span>, but our system will 
              automatically fetch the <span className="text-blue-400">implementation contract's logic</span> for accurate function descriptions.
            </p>
            
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  const value = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
                  void navigator.clipboard.writeText(value);
                  setInput(value);
                }}
                className="rounded-lg border border-amber-500/50 bg-[#0f051d] px-4 py-2 text-amber-400 transition-all hover:-translate-y-1 hover:border-amber-500"
              >
                USDC Proxy
              </button>
            </div>
            
            <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-900/10 p-3 text-sm">
              <p className="text-amber-300">How It Works:</p>
              <p className="mt-1 text-gray-400">
                1. <span className="text-amber-400">Enter the proxy address</span> (e.g., <span className="font-mono text-xs">0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48</span> for USDC)<br />
                2. Our backend automatically fetches the <span className="text-blue-400">implementation logic</span> (e.g., <span className="font-mono text-xs">0x43506849D7C04F9138D1A2050bbF3A0c054402dd</span>)<br />
                3. The generated ERC7730 file contains the proxy address while using the implementation's ABI
              </p>
              <p className="mt-2 text-yellow-300 font-medium">This ensures you get the correct function signatures while properly directing transactions to the proxy contract.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CardErc7730;
