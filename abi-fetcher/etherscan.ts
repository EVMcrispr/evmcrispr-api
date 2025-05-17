import type { Abi } from "viem";
import * as chains from "viem/chains";

const explorers = Object.fromEntries(
  Object.values(chains)
    .map<[number, string | undefined]>((chain) => {
      const blockExplorer = chain.blockExplorers?.default;
      const apiUrl =
        blockExplorer && "apiUrl" in blockExplorer
          ? blockExplorer.apiUrl
          : undefined;
      return [chain.id, apiUrl];
    })
    .filter(([, apiUrl]) => apiUrl !== undefined),
);

export async function getAbiEntriesFromEtherscan(
  address: string,
  chainId: number,
  apiKey?: string,
): Promise<Abi> {
  if (!explorers[chainId]) {
    throw new Error(`Unsupported chainId: ${chainId}`);
  }

  const baseUrl = explorers[chainId];
  console.log(`${baseUrl}?module=contract&action=getabi&address=${address}&apikey=${apiKey || ""}`)
  const response = await fetch(
    `${baseUrl}?module=contract&action=getabi&address=${address}&apikey=${apiKey || ""}`,
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch ABI from Etherscan: ${response.statusText}`,
    );
  }

  const data = await response.json();

  if (data.status !== "1") {
    throw new Error(`Etherscan API error: ${data.message}`);
  }

  return JSON.parse(data.result);
}
