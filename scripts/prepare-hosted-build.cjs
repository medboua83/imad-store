// Some hosts install production dependencies before running the build command.
// Backend compilation must not rely on Next's later automatic type installation.
if (process.env.IMAD_HOSTING_MODE === "combined") {
  const required = ["typescript/package.json", "prisma/package.json", "@types/express/package.json", "@types/node/package.json"];
  const missing = required.some((name) => {
    try { require.resolve(name); return false; } catch { return true; }
  });
  if (missing) {
    console.log("Installing locked build dependencies required by the hosted API.");
    const { spawnSync } = require("node:child_process");
    const result = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["ci", "--include=dev"], { stdio: "inherit" });
    if (result.status !== 0) process.exit(result.status || 1);
  }
}
