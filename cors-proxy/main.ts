// Define allowed domains (no protocol)
const ALLOWED_DOMAINS = ["mainnet.serve.giveth.io"];

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  // Extract target URL from path
  const prefix = "/v0/";
  const path = decodeURIComponent(url.pathname);
  if (!path.startsWith(prefix)) {
    return new Response("Not Found", { status: 404 });
  }

  const targetUrl = path.slice(prefix.length);
  if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
    return new Response("Invalid target URL", { status: 400 });
  }

  // Validate target domain
  try {
    const parsedTarget = new URL(targetUrl);
    if (!ALLOWED_DOMAINS.includes(parsedTarget.hostname)) {
      return new Response("Domain not allowed", { status: 403 });
    }

    // Prepare fetch options
    const fetchOptions: RequestInit = {
      method: req.method,
      headers: req.headers,
      body: req.body,
    };

    const response = await fetch(targetUrl, fetchOptions);
    const body = await response.arrayBuffer();
    const headers = Object.fromEntries((response.headers as any).entries());
    headers["Access-Control-Allow-Origin"] = "*";

    return new Response(body, {
      status: response.status,
      headers,
    });
  } catch (err) {
    return new Response(`Fetch error: ${err.message}`, { status: 500 });
  }
});
