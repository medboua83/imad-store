"use strict";
const { glob, globSync, hasMagic } = require("glob");

// Only the API/options used by node-gyp and typescript-eslint are supported.
// Reject new options so a future tool update cannot silently change discovery.
const supported = new Set(["cwd", "ignore", "expandDirectories"]);
function options(value = {}) {
  for (const key of Object.keys(value)) {
    if (!supported.has(key)) throw new TypeError(`Unsupported build glob option: ${key}`);
  }
  if (value.expandDirectories !== undefined && value.expandDirectories !== false)
    throw new TypeError("Build globs require explicit file patterns");
  return {
    cwd: value.cwd,
    ignore: value.ignore,
    absolute: false,
    dot: false,
    nodir: true,
    follow: true,
    magicalBraces: true,
    windowsPathsNoEscape: process.platform === "win32",
  };
}
function patterns(value) {
  const list = typeof value === "string" ? [value] : value;
  if (!Array.isArray(list) || list.some((p) => typeof p !== "string"))
    throw new TypeError("Expected build glob patterns");
  // Current callers supply exclusions through ignore. Do not silently interpret
  // negations differently from tinyglobby if another caller is introduced.
  if (list.some((p) => p.startsWith("!")))
    throw new TypeError("Use ignore for build glob exclusions");
  return list;
}
function paths(values) {
  return process.platform === "win32" ? values.map((value) => value.replaceAll("\\", "/")) : values;
}
exports.glob = async (value, config) => paths(await glob(patterns(value), options(config)));
exports.globSync = (value, config) => paths(globSync(patterns(value), options(config)));
exports.isDynamicPattern = (value) =>
  hasMagic(value, { magicalBraces: true, windowsPathsNoEscape: process.platform === "win32" });
