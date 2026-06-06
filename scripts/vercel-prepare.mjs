import { cp, mkdir, writeFile, rm } from "fs/promises";
import { join } from "path";
import { fileURLToPath } from "url";

const root = join(fileURLToPath(import.meta.url), "..", "..");
const distDir = join(root, "dist");
const outputDir = join(root, ".vercel", "output");

await rm(outputDir, { recursive: true, force: true });
await mkdir(join(outputDir, "functions", "__server.func"), { recursive: true });
await mkdir(join(outputDir, "static"), { recursive: true });

await cp(join(distDir, "config.json"), join(outputDir, "config.json"));
await cp(join(distDir, "client"), join(outputDir, "static"), { recursive: true });
await cp(join(distDir, "server"), join(outputDir, "functions", "__server.func"), { recursive: true });

await writeFile(
  join(outputDir, "functions", "__server.func", ".vc-config.json"),
  JSON.stringify(
    { runtime: "nodejs20.x", handler: "index.mjs", launcherType: "Nodejs", shouldAddHelpers: false },
    null,
    2,
  ),
);

console.log("✓ .vercel/output prepared from Nitro build");
