import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
    output: "standalone",
    experimental: {
        // Traces files from the monorepo root so all workspace packages are included
        outputFileTracingRoot: path.join(__dirname, "../../"),
    },
    async rewrites() {
        const upstream = (process.env.API_UPSTREAM_URL || "http://127.0.0.1:4000").replace(/\/$/, "");
        return { fallback: [{ source: "/api/:path*", destination: `${upstream}/api/:path*` }] };
    },
    images: {
        // Serve source assets directly so standalone deployments do not require sharp.
        unoptimized: true,
        remotePatterns: [
            { protocol: "https", hostname: "placeholder.co" },
            { protocol: "https", hostname: "res.cloudinary.com" },
        ],
    },
    eslint: {
        ignoreDuringBuilds: false,
    },
    typescript: {
        ignoreBuildErrors: false,
    },
};

export default nextConfig;