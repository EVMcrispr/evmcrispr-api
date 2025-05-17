import { assertEquals } from "jsr:@std/assert";

Deno.test("CORS proxy", async () => {
  const slug = "evmcrispr-0";
  const response = await fetch(
    "http://localhost:8000/v0/https://mainnet.serve.giveth.io/graphql",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `
        query GetProjectAddresses($slug: String!) {
          projectsBySlugs(slugs: [$slug]) {
            projects {
              id
              addresses {
                address
                networkId
              }
            }
          }
        }
        `,
        variables: {
          slug,
        },
      }),
    },
  );

  const data = await response.json();
  assertEquals(response.ok, true, "Response should be successful");
  assertEquals(
    typeof data.data.projectsBySlugs.projects[0].id,
    "string",
    "Project should have an ID",
  );
  assertEquals(
    Array.isArray(data.data.projectsBySlugs.projects[0].addresses),
    true,
    "Project should have addresses array",
  );
});

Deno.test("Simulate browser CORS preflight OPTIONS request", async () => {
  const response = await fetch(
    "http://localhost:8000/v0/https://mainnet.serve.giveth.io/graphql",
    {
      method: "OPTIONS",
      headers: {
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.5",
        "Access-Control-Request-Headers": "content-type",
        "Access-Control-Request-Method": "POST",
        "Origin": "http://localhost:3000",
        "Referer": "http://localhost:3000/",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-site",
      },
    },
  );

  assertEquals(response.status, 204, "Expected a 204 No Content status");
  assertEquals(response.headers.get("access-control-allow-origin"), "*");
  assertEquals(
    response.headers.get("access-control-allow-methods")?.includes("POST"),
    true,
    "Expected POST to be allowed"
  );
  assertEquals(
    response.headers.get("access-control-allow-headers")?.includes("Content-Type"),
    true,
    "Expected content-type to be allowed"
  );
});
