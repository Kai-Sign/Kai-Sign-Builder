"use client";

import CardErc7730 from "./address-abi-form";
import Image from "next/image";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { useState } from "react";
import { Eye, Settings, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { ExtensionSafeButton } from "~/components/ExtensionSafeButton";

export default function Home() {
  const [isFormalMode, setIsFormalMode] = useState(true); // Formal as default
  const router = useRouter();

  return (
    <div className="relative">
      {/* Theme Toggle Button */}
      <div className="fixed top-4 left-4 z-50">
        <ExtensionSafeButton
          onClick={() => setIsFormalMode(!isFormalMode)}
          variant="outline"
          className="flex items-center gap-2"
        >
          {isFormalMode ? (
            <>
              <Sparkles className="h-4 w-4" />
              Fun Mode
            </>
          ) : (
            <>
              <Settings className="h-4 w-4" />
              Formal Mode
            </>
          )}
        </ExtensionSafeButton>
      </div>

      {/* Navigation Buttons (both modes) */}
      <div className="fixed top-4 right-4 z-50 flex gap-2">
        <ExtensionSafeButton
          variant="outline"
          onClick={() => router.push("/api-docs")}
          className="flex items-center gap-2"
        >
          <Settings className="h-4 w-4" />
          API Docs
        </ExtensionSafeButton>
        <ExtensionSafeButton
          variant="outline"
          onClick={() => router.push("/hardware-viewer")}
          className="flex items-center gap-2"
        >
          <Eye className="h-4 w-4" />
          Hardware Viewer
        </ExtensionSafeButton>
        <ExtensionSafeButton
          variant="outline"
          onClick={() => router.push("/kaisign-v1")}
          className="flex items-center gap-2"
        >
          <Settings className="h-4 w-4" />
          KaiSign V1 Manager
        </ExtensionSafeButton>
      </div>

      <div className="container relative m-auto flex min-h-screen items-center justify-center p-4 overflow-hidden">
        {/* Background - solid purple in formal mode, animated in fun mode */}
        {isFormalMode ? (
          <div className="fixed inset-0 z-0 bg-[#0d041b]" />
        ) : (
          <div className="fixed inset-0 z-0 bg-[#0d041b]" style={{
            backgroundImage: `
              linear-gradient(rgba(57, 27, 112, 0.7) 1px, transparent 1px),
              linear-gradient(90deg, rgba(57, 27, 112, 0.7) 1px, transparent 1px)
            `,
            backgroundSize: '30px 30px'
          }} />
        )}
        
        {/* Floating ETH Icons - Only in fun mode */}
        {!isFormalMode && (
          <>
            <Image 
              src="/assets/eth.svg" 
              alt="ETH Icon" 
              width={30} 
              height={30} 
              className="nft-icon animation-delay-1" 
              style={{ top: '10%', left: '5%' }}
            />
            <Image 
              src="/assets/eth.svg" 
              alt="ETH Icon" 
              width={24} 
              height={24} 
              className="nft-icon animation-delay-2" 
              style={{ top: '15%', left: '25%' }}
            />
            <Image 
              src="/assets/eth.svg" 
              alt="ETH Icon" 
              width={28} 
              height={28} 
              className="nft-icon animation-delay-3" 
              style={{ top: '7%', left: '45%' }}
            />
            <Image 
              src="/assets/eth.svg" 
              alt="ETH Icon" 
              width={20} 
              height={20} 
              className="nft-icon animation-delay-4" 
              style={{ top: '20%', left: '65%' }}
            />
            <Image 
              src="/assets/eth.svg" 
              alt="ETH Icon" 
              width={22} 
              height={22} 
              className="nft-icon animation-delay-5" 
              style={{ top: '5%', left: '85%' }}
            />
            <Image 
              src="/assets/eth.svg" 
              alt="ETH Icon" 
              width={26} 
              height={26} 
              className="nft-icon animation-delay-2" 
              style={{ top: '12%', left: '15%' }}
            />
            <Image 
              src="/assets/eth.svg" 
              alt="ETH Icon" 
              width={18} 
              height={18} 
              className="nft-icon animation-delay-3" 
              style={{ top: '18%', left: '55%' }}
            />
            <Image 
              src="/assets/eth.svg" 
              alt="ETH Icon" 
              width={32} 
              height={32} 
              className="nft-icon animation-delay-4" 
              style={{ top: '8%', left: '75%' }}
            />
          </>
        )}

        
        {/* Cat Rockets - Only in fun mode */}
        {!isFormalMode && (
          <div className="absolute bottom-[5%] left-0 w-full">
            <Image 
              src="/assets/catrocket.png" 
              alt="Cat Rocket" 
              width={80} 
              height={80} 
              className="rocket-ship animation-delay-1" 
            />
            <Image 
              src="/assets/catrocket.png" 
              alt="Cat Rocket" 
              width={70} 
              height={70} 
              className="rocket-ship animation-delay-6" 
            />
            <Image 
              src="/assets/catrocket.png" 
              alt="Cat Rocket" 
              width={60} 
              height={60} 
              className="rocket-ship animation-delay-4" 
            />
          </div>
        )}
        
        {/* NFT GIF - Only in fun mode */}
        {!isFormalMode && (
          <div className="absolute left-10 top-1/2 hidden -translate-y-1/2 transform lg:block">
            <div className="relative h-72 w-64 overflow-hidden rounded-lg border border-[#664bda]/30 float-animation glow-animation">
              <Image
                src="/assets/nft_gif.gif"
                alt="NFT Animation"
                width={256}
                height={288}
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0d041b] to-transparent opacity-30"></div>
            </div>
          </div>
        )}
        
        {/* To The Moon GIF - Only in fun mode */}
        {!isFormalMode && (
          <div className="absolute right-10 top-1/2 hidden -translate-y-1/2 transform lg:block">
            <div className="relative h-72 w-64 overflow-hidden rounded-lg border border-[#664bda]/30 float-animation-reverse glow-animation">
              <Image
                src="/assets/to_the_moon_gif.gif"
                alt="To The Moon Animation"
                width={256}
                height={288}
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0d041b] to-transparent opacity-30"></div>
              <div className="absolute bottom-2 left-0 right-0 text-center text-sm font-medium text-white text-glow">
                To The Moon
              </div>
            </div>
          </div>
        )}
        
        {/* Content */}
        <div className="relative z-10">
          <CardErc7730 />
        </div>
      </div>
    </div>
  );
}
