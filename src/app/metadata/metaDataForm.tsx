"use client";

import { useRouter } from "next/navigation";
import { useContext, useEffect, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import Devices from "./devices";
import { Erc7730StoreContext, useErc7730Store } from "~/store/erc7730Provider";
import { Card } from "~/components/ui/card";
import { Loader2 } from "lucide-react";

const metaDataSchema = z.object({
  owner: z.string().min(1, {
    message: "Contract owner name is required.",
  }),
  url: z.string().min(1, {
    message: "URL is required.",
  }),
  legalName: z.string().min(1, {
    message: "Legal name is required.",
  }),
});

type MetadataFormType = z.infer<typeof metaDataSchema>;

const MetadataForm = () => {
  const router = useRouter();
  const hasHydrated = useContext(Erc7730StoreContext)?.persist?.hasHydrated();
  const [isLoading, setIsLoading] = useState(true);
  const [loadingAttempts, setLoadingAttempts] = useState(0);
  const redirectAttempted = useRef(false);

  const { getMetadata, setMetadata, getContractAddress } = useErc7730Store(
    (s) => s,
  );
  const metadata = getMetadata();
  const address = getContractAddress();

  const form = useForm<MetadataFormType>({
    resolver: zodResolver(metaDataSchema),
    values: {
      owner: metadata?.owner ?? "",
      url: metadata?.info?.url ?? "",
      legalName: metadata?.info?.legalName ?? "",
    },
  });

  // Only update metadata when values actually change
  const formValues = form.watch();
  useEffect(() => {
    // Wait for hydration
    if (hasHydrated === false) return;
    
    // Only update if values are different from current metadata
    if (
      formValues.owner !== metadata?.owner ||
      formValues.url !== metadata?.info?.url ||
      formValues.legalName !== metadata?.info?.legalName
    ) {
      setMetadata({
        owner: formValues.owner,
        info: {
          legalName: formValues.legalName ?? "",
          url: formValues.url ?? "",
        },
      });
    }
  }, [formValues, hasHydrated, metadata, setMetadata]);

  useEffect(() => {
    let redirectTimer: NodeJS.Timeout;
    
    // Check if we're on Vercel - if so, be more lenient with empty metadata
    const isVercel = typeof window !== 'undefined' && window.location.hostname.includes('vercel.app');
    
    if (hasHydrated) {
      if (metadata === null && !redirectAttempted.current && !isVercel) {
        // Redirect to home if no metadata even after hydration (but not on Vercel)
        redirectAttempted.current = true;
        redirectTimer = setTimeout(() => {
          router.push("/");
        }, 500);
      } else {
        // We have metadata or we're on Vercel, so we can stop loading
        setIsLoading(false);
        
        // If we're on Vercel and have no metadata, create empty placeholder metadata
        if (isVercel && metadata === null) {
          setMetadata({
            owner: "",
            info: {
              legalName: "",
              url: "",
            },
          });
        }
      }
    } else {
      // If not hydrated yet, we set a timer that checks periodically
      const checkInterval = setInterval(() => {
        setLoadingAttempts(prev => {
          // After several attempts (5 seconds), assume it's loaded enough to check
          if (prev >= 10) {
            clearInterval(checkInterval);
            
            // Final check if metadata exists
            if (getMetadata() === null && !redirectAttempted.current && !isVercel) {
              redirectAttempted.current = true;
              redirectTimer = setTimeout(() => {
                router.push("/");
              }, 500);
            } else {
              setIsLoading(false);
              
              // If we're on Vercel and have no metadata, create empty placeholder metadata
              if (isVercel && getMetadata() === null) {
                setMetadata({
                  owner: "",
                  info: {
                    legalName: "",
                    url: "",
                  },
                });
              }
            }
          }
          return prev + 1;
        });
      }, 500);
      
      return () => {
        clearInterval(checkInterval);
        if (redirectTimer) clearTimeout(redirectTimer);
      };
    }

    return () => {
      if (redirectTimer) clearTimeout(redirectTimer);
    };
  }, [metadata, router, hasHydrated, getMetadata, setMetadata]);

  const onSubmit = (data: MetadataFormType) => {
    setMetadata({
      owner: data.owner,
      info: {
        legalName: data.legalName,
        url: data.url,
      },
    });
    router.push("/operations");
  };

  if (isLoading) {
    return (
      <div className="flex h-[60vh] w-full flex-col items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-purple-500" />
        <p className="mt-4 text-lg">Initializing metadata...</p>
        <p className="mt-2 text-sm text-gray-500">
          Please wait while we connect to the API
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-20 flex w-full items-center justify-between">
        <h1 className="text-2xl font-bold">Metadata</h1>
      </div>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="grid grid-cols-2 gap-10"
        >
          <div>
            <Card className="mb-40 flex h-fit flex-col gap-6 p-6">
              <FormField
                control={form.control}
                name="owner"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contract owner name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="legalName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Legal Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <div>
                      <FormLabel>URL</FormLabel>
                      <FormDescription>
                        Where to find information on the entity the user
                        interacts with.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>

                    <FormMessage />
                  </FormItem>
                )}
              />
            </Card>
            <div className="flex w-full items-center justify-end">
              <Button onClick={form.handleSubmit(onSubmit)}>Continue</Button>
            </div>
          </div>
          {metadata && (
            <div className="hidden flex-row justify-between lg:flex">
              <Devices metadata={metadata} address={address} />
            </div>
          )}
        </form>
      </Form>
    </>
  );
};

export default MetadataForm;
