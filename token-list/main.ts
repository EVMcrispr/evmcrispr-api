import { getNetworkName } from "./coingecko.ts";
import { fetchWithCache } from "./cache.ts";

const kv = await Deno.openKv();

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  try {
    // Extract target URL from path
    const prefix = "/v0/";
    const path = decodeURIComponent(url.pathname);
    if (!path.startsWith(prefix)) {
      return new Response("Not Found", { status: 404 });
    }

    const chainIdStr = path.slice(prefix.length).split("/")[0];
    const chainId = Number(chainIdStr);
    if (!Number.isInteger(chainId) || chainId <= 0) {
        console.error(`Invalid chainId received: ${chainIdStr}`);
        return new Response("Invalid chainId", { status: 400 });
    }

    const { name: networkName, id: networkId } = await getNetworkName(chainId);
    if (!networkId) {
        console.error(`Could not get networkId for chainId: ${chainId}`);
        return new Response(`Unsupported chainId: ${chainId}`, { status: 400 });
    }

    const coingeckoTokenListUrl = `https://tokens.coingecko.com/${networkId}/all.json`;
    const superfluidTokenListUrl =
      "https://raw.githubusercontent.com/superfluid-finance/tokenlist/main/superfluid.extended.tokenlist.json";

    // Fetch both lists using the cache-aware function
    // Using specific cache key prefixes for clarity and potential future separate management
    const [coingeckoData, superfluidData] = await Promise.all([
      fetchWithCache(kv, coingeckoTokenListUrl, "coingecko_cache_v1"),
      fetchWithCache(kv, superfluidTokenListUrl, "superfluid_cache_v1"),
    ]);

    // Ensure both fetches returned data (either fresh or cached)
    // The fetchWithCache function throws if it can't get data,
    // so if we reach here, coingeckoData and superfluidData are populated.

    const lastTimestamp = Math.max(
      new Date(coingeckoData.timestamp || 0).getTime(),
      new Date(superfluidData.timestamp || 0).getTime()
    );

    const tokenList = {
      name: `EVMcrispr Token List (${networkName})`,
      logoURI: "https://evmcrispr.com/favicon.ico",
      timestamp: new Date(lastTimestamp).toISOString(),
      tokens: (coingeckoData.tokens || [])
        .concat(
          (superfluidData.tokens || []).filter((token: any) => token.chainId === chainId),
        )
        .reduce((acc: any[], token: any) => {
          if (!acc.find((t) => t.address && token.address && t.address.toLowerCase() === token.address.toLowerCase())) {
            acc.push(token);
          }
          return acc;
        }, []),
      version: {
        patch: 0,
        major: 1,
        minor: 0
      },
    };

    return new Response(JSON.stringify(tokenList), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    });
  } catch (err) {
    console.error("Main handler error:", err);
    return new Response(`Error: ${err.message}`, { status: 500 });
  }
});
