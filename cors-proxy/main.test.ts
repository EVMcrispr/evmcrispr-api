import { assertEquals } from "jsr:@std/assert";

Deno.test("simple test", async () => {
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
