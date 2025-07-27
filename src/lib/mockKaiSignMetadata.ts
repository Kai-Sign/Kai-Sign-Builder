// Your actual KaiSign metadata from IPFS QmQeU4y197HgXt54UNWE61xfSodW8XUTpYn33DNdZprNJD
// This is a local fallback when IPFS gateways are slow/unavailable

export const kaisignMetadata = {
  "context": {
    "contract": {
      "deployedOn": "11155111",
      "deploymentAddress": "0xB55D4406916e20dF5B965E15dd3ff85fa8B11dCf"
    }
  },
  "metadata": {
    "appDomain": "kaisign.cipherlogic.xyz",
    "constants": {
      "Proposal": {
        "type": "enum",
        "values": [
          "Submitted",
          "Finalized",
          "Cancelled"
        ]
      }
    },
    "enums": {
      "ProposalStatus": {
        "type": "enum",
        "values": [
          "Submitted",
          "Finalized", 
          "Cancelled"
        ]
      }
    },
    "functions": {
      "0x1f7b6d32": {
        "intent": "Get the details of a specific spec proposal",
        "fields": [
          {
            "path": "specId",
            "label": "Specification ID",
            "format": "bytes32"
          }
        ]
      },
      "0x2986c0e5": {
        "intent": "Finalize a proposed specification and make it active",
        "fields": [
          {
            "path": "specId", 
            "label": "Specification ID",
            "format": "bytes32"
          }
        ]
      },
      "0x32e7c5bf": {
        "intent": "Cancel a previously submitted specification proposal",
        "fields": [
          {
            "path": "specId",
            "label": "Specification ID", 
            "format": "bytes32"
          }
        ]
      },
      "0x38a699a4": {
        "intent": "Get the total number of finalized specifications",
        "fields": []
      },
      "0x39e503ab": {
        "intent": "Get the current active specification for a target contract",
        "fields": [
          {
            "path": "targetContract",
            "label": "Target Contract Address",
            "format": "address"
          }
        ]
      },
      "0x3ccfd60b": {
        "intent": "Cancel ownership transfer to reject pending ownership",
        "fields": []
      },
      "0x61bc221a": {
        "intent": "Propose a new specification for display metadata",
        "fields": [
          {
            "path": "ipfs",
            "label": "IPFS Hash",
            "format": "string"
          },
          {
            "path": "targetContract", 
            "label": "Target Contract Address",
            "format": "address"
          },
          {
            "path": "chainId",
            "label": "Chain ID",
            "format": "uint256"
          }
        ]
      },
      "0x715018a6": {
        "intent": "Transfer ownership of the contract to a new address",
        "fields": [
          {
            "path": "newOwner",
            "label": "New Owner Address", 
            "format": "address"
          }
        ]
      },
      "0x79ba5097": {
        "intent": "Accept ownership transfer to become the new owner",
        "fields": []
      },
      "0x8ab1d681": {
        "intent": "Get the current owner of the contract",
        "fields": []
      },
      "0x8da5cb5b": {
        "intent": "Get the current owner of the contract",
        "fields": []
      },
      "0x9623609d": {
        "intent": "Get the current pending owner awaiting ownership transfer",
        "fields": []
      },
      "0xb60d4288": {
        "intent": "Get details of a finalized specification by index",
        "fields": [
          {
            "path": "index",
            "label": "Specification Index",
            "format": "uint256"
          }
        ]
      },
      "0xc884ef83": {
        "intent": "Get detailed information about a specification",
        "fields": [
          {
            "path": "specId",
            "label": "Specification ID",
            "format": "bytes32"
          }
        ]
      },
      "0xe30c3978": {
        "intent": "Get the pending owner awaiting ownership transfer",
        "fields": []
      }
    },
    "owner": "KaiSign",
    "info": {
      "legalName": "KaiSign V1 Platform",
      "lastUpdate": "2025-01-26",
      "version": "1.0.0",
      "url": "https://kaisign.cipherlogic.xyz"
    }
  }
};
