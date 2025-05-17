import type { Abi } from "viem";

type SourcifyResponse =
  | {
      name: string;
      path: string;
      content: string;
    }[]
  | { error: string; message: string };

function checkError(
  response: SourcifyResponse,
): response is { error: string; message: string } {
  return "error" in response;
}
export async function getAbiEntriesFromSourcify(
  address: string,
  chainId: number,
): Promise<Abi> {
  const response = (await fetch(
    `https://sourcify.dev/server/files/${chainId}/${address}/`,
  )
    .then((response) => response.json())
    .then((data) => data)) as SourcifyResponse;

  if (checkError(response)) {
    throw new Error(response.message);
  }

  const metadata: string | undefined = response.find(
    (file) => file.name === "metadata.json",
  )?.content;
  if (!metadata) {
    throw new Error(
      `Sourcify does not have metadata for ${address} on chain ${chainId}`,
    );
  }

  return JSON.parse(metadata).output?.abi;
}
