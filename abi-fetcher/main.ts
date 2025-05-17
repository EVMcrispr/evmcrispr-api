import { isAddress, type Abi } from "npm:viem";
import { getAbiEntriesFromEtherscan } from "./etherscan.ts";
import { getAbiEntriesFromSourcify } from "./sourcify.ts";

const ETHERSCAN_API_KEY = Deno.env.get("ETHERSCAN_API_KEY");

async function getAbiEntries(
  address: string,
  chainId: number,
  apiKey?: string,
): Promise<Abi> {
  try {
    const abi = await timeout(
      getAbiEntriesFromSourcify(address, chainId),
      5000,
    );
    return abi;
  } catch (error) {
    const abi = await getAbiEntriesFromEtherscan(address, chainId, apiKey);
    return abi;
  }
}

function timeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), ms),
    ),
  ]);
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  // Extract target URL from path
  const prefix = "/v0/";
  const path = decodeURIComponent(url.pathname);
  if (!path.startsWith(prefix)) {
    return new Response("Not Found", { status: 404 });
  }
  const chainId = Number(path.slice(prefix.length).split("/")[0]);
  if (!Number.isInteger(chainId)) {
    return new Response("Invalid chainId", { status: 400 });
  }
  const contractAddress = path.slice(prefix.length).split("/")[1];
  if (!isAddress(contractAddress)) {
    return new Response("Invalid contract address", { status: 400 });
  }

  console.log(chainId, contractAddress);

  try {
    const abi = await getAbiEntries(contractAddress, chainId, ETHERSCAN_API_KEY);
    return new Response(JSON.stringify(abi), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    return new Response(`Fetch error: ${err.message}`, { status: 500 });
  }
});
