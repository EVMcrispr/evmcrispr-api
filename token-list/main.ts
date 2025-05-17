import { getNetworkName } from "./coingecko.ts";

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

  // Validate target domain
  try {
    const { name: networkName, id: networkId } = await getNetworkName(chainId);
    const coingeckoTokenList = `https://tokens.coingecko.com/${networkId}/all.json`;
    const superfluidTokenList =
      "https://raw.githubusercontent.com/superfluid-finance/tokenlist/main/superfluid.extended.tokenlist.json";
    const tokenLists = await Promise.all([
      fetch(coingeckoTokenList).then((res) => res.json()),
      fetch(superfluidTokenList).then((res) => res.json()),
    ]);
    const lastTimestamp = Math.max(
      ...tokenLists.map((tokenList) => new Date(tokenList.timestamp).getTime()),
    );
    const tokenList = {
      name: `EVMcrispr Token List (${networkName})`,
      logoURI: "https://evmcrispr.com/favicon.ico",
      timestamp: new Date(lastTimestamp).toISOString(),
      tokens: tokenLists[0].tokens
        .concat(
          tokenLists[1].tokens.filter((token) => token.chainId === chainId),
        )
        .reduce((acc, token) => {
          if (acc.find((t) => t.address === token.address)) {
            return acc;
          }
          acc.push(token);
          return acc;
        }, []),
      version: {
        patch: 1,
      },
    };

    return new Response(JSON.stringify(tokenList), {
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
