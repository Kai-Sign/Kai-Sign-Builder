"use client";

import { useEffect, useState } from "react";
import { RadioGroup, RadioGroupItem } from "@radix-ui/react-radio-group";
import { Label } from "@radix-ui/react-label";
import { Loader2 } from "lucide-react";
import { cn } from "~/lib/utils";
import { useErc7730Store } from "~/store/erc7730Provider";
import useOperationStore from "~/store/useOperationStore";

const SelectOperation = () => {
  const operation = useErc7730Store((s) => s.getOperations)();
  const [isLoading, setIsLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const {
    selectedOperation,
    setSelectedOperation,
    validateOperation,
    updatedOperation,
  } = useOperationStore();

  useEffect(() => {
    void useOperationStore.persist.rehydrate();
    void useOperationStore.persist.rehydrate();
  }, []);

  // Handle loading state and retry logic for slow server startup
  useEffect(() => {
    if (!useOperationStore?.persist?.hasHydrated()) return;
    
    if (!operation?.formats && retryCount < 5) {
      // Retry loading operation data every 2 seconds for up to 10 seconds
      const timer = setTimeout(() => {
        setRetryCount(prev => prev + 1);
      }, 2000);
      
      return () => clearTimeout(timer);
    } else if (operation?.formats) {
      setIsLoading(false);
    } else if (retryCount >= 5) {
      // Stop loading after max retries
      setIsLoading(false);
    }
  }, [operation?.formats, retryCount]);

  if (!useOperationStore?.persist?.hasHydrated()) return null;
  
  // Show loading state while waiting for operation data
  if (isLoading && !operation?.formats) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2 text-sm text-gray-500">Loading operations...</span>
      </div>
    );
  }
  
  if (!operation?.formats) return null;

  return (
    <RadioGroup
      value={selectedOperation ?? ""}
      onValueChange={setSelectedOperation}
      className="flex flex-col gap-2"
    >
      {operation.formats &&
        Object.entries(operation.formats).map(([operationName]) => (
          <RadioGroupItem
            key={operationName}
            value={operationName}
            className={cn(
              "overflow-hidden rounded-lg p-3 focus:outline-none",
              selectedOperation === operationName &&
                "bg-black/5 ring-black/10 dark:bg-white/5",
              updatedOperation.includes(operationName) &&
                "bg-orange-300/10 text-orange-500/90",
              validateOperation.includes(operationName) &&
                "bg-green-100/90 text-[#6EB260]/90 dark:bg-green-100/10",
            )}
          >
            <div className="flex w-full items-center justify-between">
              <div className="text-sm/6">
                <Label
                  htmlFor={operationName}
                  className={cn("cursor-pointer font-semibold")}
                >
                  {operationName}
                </Label>
              </div>
            </div>
          </RadioGroupItem>
        ))}
    </RadioGroup>
  );
};

export default SelectOperation;
