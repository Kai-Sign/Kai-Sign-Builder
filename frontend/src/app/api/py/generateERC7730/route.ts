import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    { status: "ok", message: "generateERC7730 API is running" },
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Accept, Cache-Control",
      },
    }
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address, abi, chain_id } = body;

    // Validate inputs
    if (!address && !abi) {
      return NextResponse.json(
        { 
          error: 'Either address or abi is required',
          details: 'Provide either a contract address or ABI for ERC-7730 generation'
        },
        { status: 400 }
      );
    }

    if (address && !address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return NextResponse.json(
        { 
          error: 'Invalid address format',
          details: 'Address must be a valid Ethereum address (42 characters, starting with 0x)'
        },
        { status: 400 }
      );
    }

    if (abi) {
      try {
        const parsed = JSON.parse(abi);
        if (!Array.isArray(parsed)) {
          throw new Error('ABI must be an array');
        }
      } catch (e) {
        return NextResponse.json(
          { 
            error: 'Invalid ABI format',
            details: 'ABI must be a valid JSON array'
          },
          { status: 400 }
        );
      }
    }

    // Try to proxy to Railway API first
    const railwayApiUrl = process.env.NEXT_PUBLIC_API_URL || "https://kai-sign-production.up.railway.app";
    
    try {
      const railwayResponse = await fetch(`${railwayApiUrl}/api/py/generateERC7730`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Cache-Control": "no-cache",
        },
        body: JSON.stringify(body),
      });

      if (railwayResponse.ok) {
        const data = await railwayResponse.json();
        return NextResponse.json(data, {
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Accept, Cache-Control",
          },
        });
      }

      // If Railway API fails, log the error and fall through to fallback
      console.log(`Railway API failed with status: ${railwayResponse.status}`);
    } catch (railwayError) {
      console.log('Railway API not available:', railwayError);
    }

    // Fallback: Use our contract-metadata API and transform the response
    if (address && chain_id) {
      try {
        const metadataResponse = await fetch(`${request.nextUrl.origin}/api/contract-metadata?address=${address}&chainId=${chain_id}`, {
          method: 'GET',
        });

        if (metadataResponse.ok) {
          const metadataData = await metadataResponse.json();
          
          // Transform contract-metadata response to match ERC-7730 format
          const erc7730Response = {
            functions: metadataData.metadata?.functions || [],
            events: [], // Events not available in contract-metadata API
            context: {
              contract: {
                deployments: [{
                  chainId: chain_id,
                  address: address
                }],
                abi: abi || "[]"
              }
            },
            metadata: {
              title: "Contract Metadata",
              description: `ERC-7730 metadata for contract ${address}`,
              ...metadataData.metadata?.info,
              owner: metadataData.metadata?.owner,
              constants: metadataData.metadata?.constants || {},
              enums: metadataData.metadata?.enums || {},
              functions: metadataData.metadata?.erc7730?.metadata?.functions || {}
            },
            display: metadataData.metadata?.erc7730?.display || {},
            severity: 0
          };

          return NextResponse.json(erc7730Response, {
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
              "Access-Control-Allow-Headers": "Content-Type, Accept, Cache-Control",
            },
          });
        }
      } catch (fallbackError) {
        console.log('Fallback API also failed:', fallbackError);
      }
    }

    // Final fallback: Generate ERC-7730 metadata from ABI
    let functions: any[] = [];
    let events: any[] = [];
    let displayFormats: any = {};
    let metadataFunctions: any = {};

    if (abi) {
      try {
        const parsedABI = JSON.parse(abi);
        if (Array.isArray(parsedABI)) {
          // Extract functions from ABI
          const abiFunctions = parsedABI.filter((item: any) => item.type === 'function');
          const abiEvents = parsedABI.filter((item: any) => item.type === 'event');

          // Generate function metadata
          abiFunctions.forEach((func: any) => {
            const selector = `${func.name}(${func.inputs?.map((input: any) => input.type).join(',') || ''})`;
            
            const functionData = {
              selector,
              name: func.name,
              intent: `Execute ${func.name} function`,
              fields: func.inputs?.map((input: any, index: number) => ({
                label: input.name || `param${index}`,
                path: `${func.name}.${input.name || `param${index}`}`,
                intent: `${input.name || `Parameter ${index}`} of type ${input.type}`,
                params: {
                  type: input.type
                }
              })) || []
            };

            functions.push(functionData);

            // Add to metadata functions
            metadataFunctions[selector] = {
              intent: functionData.intent,
              fields: functionData.fields
            };

            // Generate display format
            if (func.inputs && func.inputs.length > 0) {
              displayFormats[selector] = {
                intent: functionData.intent,
                fields: func.inputs.map((input: any, index: number) => ({
                  label: input.name || `Parameter ${index}`,
                  path: `${func.name}.${input.name || `param${index}`}`,
                  params: {
                    type: input.type
                  }
                }))
              };
            }
          });

          // Generate event metadata
          abiEvents.forEach((event: any) => {
            const eventData = {
              name: event.name,
              inputs: event.inputs || [],
              intent: `${event.name} event emitted`
            };
            events.push(eventData);
          });
        }
      } catch (parseError) {
        console.error('Error parsing ABI for fallback:', parseError);
      }
    }

    const fallbackResponse = {
      functions,
      events,
      context: {
        contract: {
          deployments: chain_id && address ? [{
            chainId: chain_id,
            address: address
          }] : [],
          abi: abi || "[]"
        }
      },
      metadata: {
        title: address ? `Contract ${address}` : "Contract Metadata",
        description: address ? `ERC-7730 metadata for contract ${address}` : "Generated from ABI",
        owner: "",
        info: {
          legalName: "",
          url: "",
          version: "1.0.0",
          lastUpdate: new Date().toISOString()
        },
        functions: metadataFunctions
      },
      display: {
        formats: displayFormats
      },
      severity: 0
    };

    return NextResponse.json(fallbackResponse, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS", 
        "Access-Control-Allow-Headers": "Content-Type, Accept, Cache-Control",
      },
    });

  } catch (error) {
    console.error('Error in generateERC7730:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { 
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Accept, Cache-Control",
        },
      }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Accept, Cache-Control",
    },
  });
}