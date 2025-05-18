import type { Abi } from "viem";

export async function getAbiEntriesFromEtherscan(
  address: string,
  chainId: number,
  apiKey?: string,
): Promise<Abi> {

  const baseUrl = "https://api.etherscan.io/v2/api";
  console.log(`${baseUrl}?module=contract&action=getabi&address=${address}&apikey=${apiKey || ""}`)
  const response = await fetch(
    `${baseUrl}?chainId=${chainId}&module=contract&action=getabi&address=${address}&apikey=${apiKey || ""}`,
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
