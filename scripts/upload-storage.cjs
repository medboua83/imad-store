const path = require("node:path");
const fs = require("node:fs");
const { createHash } = require("node:crypto");

/** Hostinger replaces the release tree; media belongs to the website, not a release. */
function resolveUploadDirectory(projectRoot, configured = process.env.UPLOAD_DIR) {
    if (configured) return path.resolve(configured);
    const root = path.resolve(projectRoot);
    const hosted = root.match(
        /^(.+\/domains\/[^/]+)\/hbuilds\/(?:versions\/[^/]+|source\/repository|current)$/,
    );
    return hosted
        ? path.join(hosted[1], "shared", "uploads")
        : path.join(root, "backend", "uploads");
}

/** Restore explicitly published, content-addressed assets without replacing existing media. */
function seedPublishedUploads(projectRoot, directory) {
    fs.mkdirSync(directory, { recursive: true });
    let copied = 0;
    for (const folder of ["catalogue-demo", "catalogue-published"]) {
        const source = path.join(projectRoot, "apps", "web", "public", "images", folder);
        if (!fs.existsSync(source)) continue;
        for (const name of fs.readdirSync(source)) {
            if (!/^[a-f0-9]{64}\.webp$/.test(name)) continue;
            const file = path.join(source, name);
            if (!fs.statSync(file).isFile()) continue;
            if (
                createHash("sha256").update(fs.readFileSync(file)).digest("hex") !==
                name.slice(0, -5)
            )
                throw new Error("Published image checksum mismatch");
            try {
                fs.copyFileSync(file, path.join(directory, name), fs.constants.COPYFILE_EXCL);
                copied++;
            } catch (error) {
                if (error.code !== "EEXIST") throw error;
            }
        }
    }
    return copied;
}
module.exports = { resolveUploadDirectory, seedPublishedUploads };
