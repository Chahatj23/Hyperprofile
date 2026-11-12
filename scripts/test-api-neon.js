import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

console.log("=== STARTING API SERVER WITH NEON POSTGRESQL ===");

const server = spawn("pnpm", ["--filter", "@hyperprofile/api", "dev"], {
  cwd: root,
  shell: true,
  stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, API_PORT: "4000" }
});

let serverOutput = "";
server.stdout.on("data", (data) => {
  serverOutput += data.toString();
});
server.stderr.on("data", (data) => {
  serverOutput += data.toString();
});

async function waitAndTest() {
  // Wait up to 15s for server to start
  let ready = false;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch("http://localhost:4000/health");
      if (res.ok) {
        ready = true;
        break;
      }
    } catch {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  if (!ready) {
    console.error("Server did not become ready in time. Logs:\n", serverOutput);
    server.kill();
    process.exit(1);
  }

  console.log("✓ Fastify API server successfully started on port 4000.");

  console.log("\n[API Test 1] Health Check Endpoint...");
  const healthRes = await fetch("http://localhost:4000/health");
  const healthJson = await healthRes.json();
  console.log("  Response:", JSON.stringify(healthJson));

  console.log("\n[API Test 2] Query Neon DB - Reserved Slugs Check ('admin')...");
  const slugAdminRes = await fetch("http://localhost:4000/v1/creator/check-slug?slug=admin");
  const slugAdminJson = await slugAdminRes.json();
  console.log("  Response:", JSON.stringify(slugAdminJson));
  if (slugAdminJson.available !== false) {
    throw new Error("Expected reserved slug 'admin' to be unavailable in Neon DB");
  }
  console.log("  ✓ Correctly identified reserved slug from Neon DB");

  console.log("\n[API Test 3] Query Neon DB - Existing Creator Check ('jinbandhan')...");
  const slugJinRes = await fetch("http://localhost:4000/v1/creator/check-slug?slug=jinbandhan");
  const slugJinJson = await slugJinRes.json();
  console.log("  Response:", JSON.stringify(slugJinJson));
  if (slugJinJson.available !== false) {
    throw new Error("Expected existing creator 'jinbandhan' to be unavailable in Neon DB");
  }
  console.log("  ✓ Correctly identified registered creator '@jinbandhan' in Neon DB");

  console.log("\n[API Test 4] Query Neon DB - Available Slug Check ('neon-fastify-demo')...");
  const slugAvailRes = await fetch("http://localhost:4000/v1/creator/check-slug?slug=neon-fastify-demo");
  const slugAvailJson = await slugAvailRes.json();
  console.log("  Response:", JSON.stringify(slugAvailJson));
  if (slugAvailJson.available !== true) {
    throw new Error("Expected slug 'neon-fastify-demo' to be available");
  }
  console.log("  ✓ Correctly confirmed available slug against Neon DB");

  console.log("\n========================================================");
  console.log(" FASTIFY API + NEON POSTGRESQL END-TO-END VERIFIED! ✓");
  console.log("========================================================");

  server.kill();
  process.exit(0);
}

waitAndTest().catch((err) => {
  console.error("Test error:", err);
  if (serverOutput) {
    console.error("Server output:\n", serverOutput);
  }
  server.kill();
  process.exit(1);
});
