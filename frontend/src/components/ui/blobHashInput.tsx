"use client";

import { useState, useEffect } from "react";
import { Input } from "./input";
import { Button } from "./button";
import { Label } from "./label";
import { CheckCircle, XCircle, Loader2, ExternalLink } from "lucide-react";
import { validateBlobHash } from "~/lib/blobService";
import { BlobValidationResult } from "~/lib/blobValidationService";
import { useToast } from "~/hooks/use-toast";

interface BlobHashInputProps {
  value: string;
  onChange: (value: string) => void;
  onValidationChange?: (isValid: boolean, validation: BlobValidationResult | null) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  className?: string;
  showValidationStatus?: boolean;
}

export function BlobHashInput({
  value,
  onChange,
  onValidationChange,
  placeholder = "0x01...",
  label = "Blob Versioned Hash",
  disabled = false,
  className = "",
  showValidationStatus = true
}: BlobHashInputProps) {
  const [validation, setValidation] = useState<BlobValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [lastValidatedValue, setLastValidatedValue] = useState<string>("");
  const { toast } = useToast();

  // Debounced validation
  useEffect(() => {
    if (!value || value === lastValidatedValue) return;

    const timeoutId = setTimeout(async () => {
      // Only validate if it looks like a complete blob hash
      if (value.length === 66 && value.startsWith('0x01')) {
        setIsValidating(true);
        try {
          const result = await validateBlobHash(value);
          setValidation(result);
          setLastValidatedValue(value);
          onValidationChange?.(result.isValid && result.exists, result);
        } catch (error) {
          console.error('Validation error:', error);
          setValidation({
            isValid: false,
            exists: false,
            error: error instanceof Error ? error.message : 'Validation failed'
          });
          onValidationChange?.(false, null);
        } finally {
          setIsValidating(false);
        }
      } else if (value.length > 0) {
        // For incomplete inputs, do basic format validation only
        const basicValidation = validateBasicFormat(value);
        setValidation(basicValidation);
        onValidationChange?.(false, basicValidation);
      } else {
        setValidation(null);
        onValidationChange?.(false, null);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [value, lastValidatedValue, onValidationChange]);

  // Basic format validation for incomplete inputs
  const validateBasicFormat = (input: string): BlobValidationResult => {
    if (!input.startsWith('0x01')) {
      return {
        isValid: false,
        exists: false,
        error: 'Blob hash must start with 0x01'
      };
    }
    
    if (input.length < 66) {
      return {
        isValid: false,
        exists: false,
        error: `Incomplete blob hash (${input.length}/66 characters)`
      };
    }
    
    if (input.length > 66) {
      return {
        isValid: false,
        exists: false,
        error: 'Blob hash is too long'
      };
    }
    
    // If we get here, it's exactly 66 characters and starts with 0x01
    // Let the full validation handle the rest
    return {
      isValid: false,
      exists: false,
      error: 'Validating...'
    };
  };

  const handleManualValidation = async () => {
    if (!value) {
      toast({
        title: "No blob hash entered",
        description: "Please enter a blob hash to validate",
        variant: "destructive"
      });
      return;
    }

    setIsValidating(true);
    try {
      const result = await validateBlobHash(value);
      setValidation(result);
      setLastValidatedValue(value);
      onValidationChange?.(result.isValid && result.exists, result);

      if (result.isValid && result.exists) {
        toast({
          title: "Blob Hash Valid",
          description: `Blob exists on-chain. Block: ${result.blobData?.blockNumber || 'Unknown'}`,
          variant: "default"
        });
      } else {
        toast({
          title: "Blob Hash Invalid",
          description: result.error || "Invalid blob hash",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Manual validation error:', error);
      toast({
        title: "Validation Error",
        description: error instanceof Error ? error.message : "Failed to validate blob hash",
        variant: "destructive"
      });
    } finally {
      setIsValidating(false);
    }
  };

  const getValidationIcon = () => {
    if (isValidating) {
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    }
    
    if (!validation) return null;
    
    if (validation.isValid && validation.exists) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    
    return <XCircle className="h-4 w-4 text-red-500" />;
  };

  const getValidationMessage = () => {
    if (isValidating) return "Validating...";
    if (!validation) return "";
    
    if (validation.isValid && validation.exists) {
      return `Valid blob hash (Block ${validation.blobData?.blockNumber || 'Unknown'})`;
    }
    
    return validation.error || "Invalid blob hash";
  };

  const getValidationColor = () => {
    if (isValidating) return "text-blue-500";
    if (!validation) return "";
    
    if (validation.isValid && validation.exists) {
      return "text-green-500";
    }
    
    return "text-red-500";
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <Label htmlFor="blobHash" className="text-white mb-2 block">
        {label}
      </Label>
      
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            id="blobHash"
            type="text"
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={`bg-gray-900 border-gray-600 text-white pr-10 ${
              validation?.isValid && validation?.exists ? 'border-green-500' : 
              validation?.isValid === false ? 'border-red-500' : ''
            }`}
            disabled={disabled}
          />
          {showValidationStatus && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              {getValidationIcon()}
            </div>
          )}
        </div>
        
        <Button
          onClick={handleManualValidation}
          variant="outline"
          className="text-white border-gray-600 hover:bg-gray-800"
          disabled={disabled || !value || isValidating}
        >
          {isValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Validate"}
        </Button>
      </div>

      {showValidationStatus && validation && (
        <div className={`text-sm ${getValidationColor()}`}>
          {getValidationMessage()}
        </div>
      )}

      {validation?.blobData?.etherscanUrl && (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.open(validation.blobData!.etherscanUrl, '_blank')}
            className="text-blue-400 hover:text-blue-300 p-0 h-auto"
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            View on Etherscan
          </Button>
        </div>
      )}
    </div>
  );
}
