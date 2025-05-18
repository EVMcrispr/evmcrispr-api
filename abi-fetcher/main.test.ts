import { assertEquals } from "jsr:@std/assert";

Deno.test("Ethereum WETH", async () => {
  const response = await fetch("http://localhost:8000/v0/1/0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2");

  if (!response.ok) {
    throw new Error("Response should be successful");
  }

  const data = await response.json();
  assertEquals(response.ok, true, "Response should be successful");
  assertEquals(
    Array.isArray(data),
    true,
    "Response should be an array",
  );
  assertEquals(
    data.length,
    16,
    "Response should have 16 items",
  );
  assertEquals(
    typeof data[0],
    "object",
    "Response should have an object",
  );
});

Deno.test("Optimism WETH", async () => {
  const response = await fetch("http://localhost:8000/v0/10/0x4200000000000000000000000000000000000006");

  if (!response.ok) {
    throw new Error("Response should be successful");
  }

  const data = await response.json();
  assertEquals(response.ok, true, "Response should be successful");
  assertEquals(
    Array.isArray(data),
    true,
    "Response should be an array",
  );
  assertEquals(
    data.length,
    16,
    "Response should have 16 items",
  );
  assertEquals(
    typeof data[0],
    "object",
    "Response should have an object",
  );
});