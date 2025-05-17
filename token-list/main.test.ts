import { assertEquals } from "jsr:@std/assert";

Deno.test("simple test", async () => {
  const response = await fetch("http://localhost:8000/v0/1");

  const data = await response.json();
  assertEquals(response.ok, true, "Response should be successful");
  assertEquals(
    typeof data.tokens[0].address,
    "string",
    "Project should have an ID",
  );
  assertEquals(
    Array.isArray(data.tokens),
    true,
    "Project should have addresses array",
  );
});
