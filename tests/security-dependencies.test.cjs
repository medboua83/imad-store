const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { createRequire } = require("node:module");
const nativeRequire = createRequire(require.resolve("node-gyp/package.json"));
const { glob, globSync, isDynamicPattern } = nativeRequire("tinyglobby");
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "imad-security-glob-"));
function write(name, body = "") {
  const target = path.join(directory, name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, body);
  return target;
}
write("build/test.sln");
write("build/test.mk");
write("build/directory.sln/ignored.txt");
write("a".repeat(64) + "!");
const source = write("app/src/example.ts", "export const example: number = 1;");
write(
  "app/tsconfig.json",
  JSON.stringify({ compilerOptions: { strict: true }, include: ["src/*.ts"] }),
);
write("node_modules/ignored/tsconfig.json", "not a valid tsconfig");

test("node-gyp file discovery remains compatible with the safe matcher", async () => {
  assert.deepEqual(await glob("build/*.sln", { cwd: directory, expandDirectories: false }), [
    "build/test.sln",
  ]);
  assert.deepEqual(globSync("build/*.mk", { cwd: directory, expandDirectories: false }), [
    "build/test.mk",
  ]);
  assert.equal(isDynamicPattern("app/tsconfig.json"), false);
  assert.equal(isDynamicPattern("app/**/tsconfig.json"), true);
  assert.throws(
    () => globSync("**/*", { cwd: directory, expandDirectories: true }),
    /explicit file patterns/,
  );
  assert.throws(() => globSync("**/*", { cwd: directory, unreviewedOption: true }), /Unsupported/);
});
test("TypeScript project discovery excludes node_modules and provides real type services", () => {
  const lintRequire = createRequire(
    require.resolve("typescript-eslint", { paths: [path.join(__dirname, "../apps/web")] }),
  );
  const parser = lintRequire("@typescript-eslint/typescript-estree");
  const parserRequire = createRequire(lintRequire.resolve("@typescript-eslint/typescript-estree"));
  assert.equal(parserRequire("tinyglobby"), nativeRequire("tinyglobby"));
  const result = parser.parseAndGenerateServices(fs.readFileSync(source, "utf8"), {
    filePath: source,
    tsconfigRootDir: directory,
    project: ["**/tsconfig.json"],
  });
  assert.deepEqual(
    result.services.program.getRootFileNames().map((p) => path.resolve(p)),
    [path.resolve(source)],
  );
});
test("known repeated-extglob attack patterns complete in an isolated bounded process", () => {
  const result = spawnSync(
    process.execPath,
    [
      "-e",
      `const {createRequire}=require('node:module');const {globSync}=createRequire(require.resolve('node-gyp/package.json'))('tinyglobby');const patterns=['+(*)b','+(*a)b','*(*)b','*(*a)b'];for(const pattern of patterns)globSync(pattern,{cwd:process.argv[1],expandDirectories:false});`,
      directory,
    ],
    { cwd: process.cwd(), timeout: 2000, encoding: "utf8" },
  );
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr);
});
test("the lockfile removes vulnerable matcher and unused email SDK and pins corrected Next", () => {
  const lock = JSON.parse(fs.readFileSync(path.join(__dirname, "../package-lock.json"), "utf8"));
  assert.equal(
    Object.keys(lock.packages).some((p) => /(^|\/)picomatch$/.test(p)),
    false,
  );
  const semver = nativeRequire("semver");
  const resend = lock.packages["node_modules/resend"];
  if (resend) assert.ok(semver.gte(resend.version, "6.38.1"));
  assert.ok(semver.gte(lock.packages["node_modules/next"].version, "16.4.6"));
});
test.after(() => {
  const relative = path.relative(os.tmpdir(), directory);
  assert.ok(relative.startsWith("imad-security-glob-") && !relative.includes(path.sep));
  fs.rmSync(directory, { recursive: true, force: true });
});
