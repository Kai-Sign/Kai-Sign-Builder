import { ethers } from 'ethers';

const CONTRACT_ADDRESS = "0x4dFEA0C2B472a14cD052a8f9DF9f19fa5CF03719";
const USER_ADDRESS = "0x89839eF5911343a6134c28B96342f7fb3ae5D483";
const INCENTIVE_ID = "0x364d61cf3d768376f4166414a05b8b3fdd7f41b75149648f42a1bf743d396d49";

const ABI = [
  "function getUserIncentives(address user) view returns (bytes32[])",
  "function incentives(bytes32) view returns (address,uint256,uint256,uint64,uint64,address,bytes32,bool,uint256,string)",
  "event LogIncentiveCreated(bytes32 indexed incentiveId, address indexed creator, address targetContract, uint256 chainId, uint256 amount, uint64 deadline, string description)"
];

async function main() {
  const provider = new ethers.JsonRpcProvider("https://ethereum-sepolia-rpc.publicnode.com");
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
  
  console.log("Testing incentive queries for user:", USER_ADDRESS);
  console.log("Contract:", CONTRACT_ADDRESS);
  console.log("");
  
  // Try getUserIncentives
  console.log("1. Testing getUserIncentives...");
  try {
    const incentiveIds = await contract.getUserIncentives(USER_ADDRESS);
    console.log("   Result:", incentiveIds);
    console.log("   Count:", incentiveIds.length);
  } catch (error) {
    console.log("   Error:", error.message);
  }
  
  console.log("");
  console.log("2. Testing incentives mapping with known ID...");
  console.log("   Incentive ID:", INCENTIVE_ID);
  try {
    const data = await contract.incentives(INCENTIVE_ID);
    console.log("   Result:", {
      creator: data[0],
      amount: ethers.formatEther(data[1]),
      reserved: data[2].toString(),
      deadline: new Date(Number(data[3]) * 1000).toISOString(),
      createdAt: new Date(Number(data[4]) * 1000).toISOString(),
      targetContract: data[5],
      specID: data[6],
      isActive: data[7],
      chainId: data[8].toString(),
      description: data[9]
    });
  } catch (error) {
    console.log("   Error:", error.message);
  }
  
  console.log("");
  console.log("3. Querying LogIncentiveCreated events...");
  try {
    const filter = contract.filters.LogIncentiveCreated(null, USER_ADDRESS);
    const events = await contract.queryFilter(filter, 0, 'latest');
    console.log("   Found events:", events.length);
    
    for (const event of events) {
      console.log("   Event:", {
        incentiveId: event.args.incentiveId,
        creator: event.args.creator,
        targetContract: event.args.targetContract,
        chainId: event.args.chainId.toString(),
        amount: ethers.formatEther(event.args.amount),
        deadline: new Date(Number(event.args.deadline) * 1000).toISOString(),
        description: event.args.description,
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash
      });
    }
  } catch (error) {
    console.log("   Error:", error.message);
  }
}

main().catch(console.error);