import { type paths } from "~/generate/api-types";

type GenerateBody =
  paths["/api/py/generateERC7730"]["post"]["requestBody"]["content"]["application/json"];
export type GenerateResponse =
  paths["/api/py/generateERC7730"]["post"]["responses"]["200"]["content"]["application/json"];

export default async function generateERC7730({
  input,
  inputType,
}: {
  inputType: "address" | "abi";
  input: string;
}): Promise<GenerateResponse | null> {
  const body: GenerateBody = {
    address: inputType === "address" ? input : undefined,
    abi: inputType === "abi" ? input : undefined,
  };

  try {
    console.log("Making API call to /api/py/generateERC7730");
    const response = await fetch("/api/py/generateERC7730", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    console.log(`API response status: ${response.status}`);

    if (!response.ok) {
      try {
        const errorData = await response.json();
        console.error("API Error Details:", errorData);
        throw new Error(`API Error: ${errorData.message || JSON.stringify(errorData)}`);
      } catch (jsonError) {
        // If we can't parse the error as JSON, use the status text
        console.error("Error parsing API error response:", jsonError);
        throw new Error(`API Error: ${response.statusText} (${response.status})`);
      }
    }

    try {
      const data = await response.json();
      console.log("API response parsed successfully");
      return data as GenerateResponse;
    } catch (parseError) {
      console.error("Error parsing API response:", parseError);
      throw new Error("Failed to parse API response");
    }
  } catch (error) {
    console.error("Error in generateERC7730:", error);
    throw error;
  }
}
