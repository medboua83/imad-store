import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
    // Local browser previews use both loopback hostnames; never allow arbitrary origins.
    allowedDevOrigins: ["127.0.0.1", "localhost"],
    // Passenger needs one public listener for Next and Express. A custom Next
    // server uses the regular build, not the separate standalone entrypoint.
    output: process.env.IMAD_HOSTING_MODE === "combined" ? undefined : "standalone",
    outputFileTracingRoot: path.join(__dirname, "../../"),
    async headers() {
        // Next owns HTML in both combined and standalone hosting; Express/Helmet
        // already protects API responses. Keep the browser policy here as well.
        const development = process.env.NODE_ENV === "development";
        const policy = [
            "default-src 'self'",
            `script-src 'self' 'unsafe-inline'${development ? " 'unsafe-eval'" : ""} https://connect.facebook.net`,
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob: https://res.cloudinary.com https://placeholder.co https://www.facebook.com",
            "font-src 'self' data:",
            `connect-src 'self'${development ? " ws: wss:" : ""} https://www.facebook.com https://connect.facebook.net`,
            "frame-src https://www.facebook.com",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'none'",
        ].join("; ");
        return [{
            source: "/:path*",
            headers: [
                { key: "Content-Security-Policy", value: policy },
                { key: "X-Frame-Options", value: "DENY" },
                { key: "X-Content-Type-Options", value: "nosniff" },
                { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
                { key: "Strict-Transport-Security", value: "max-age=31536000" },
            ],
        }];
    },
    async rewrites() {
        if (process.env.IMAD_HOSTING_MODE === "combined") return [];
        const upstream = (process.env.API_UPSTREAM_URL || "http://127.0.0.1:4000").replace(/\/$/, "");
        return { fallback: [{ source: "/api/:path*", destination: `${upstream}/api/:path*` }, { source: "/uploads/:path*", destination: `${upstream}/uploads/:path*` }] };
    },
    images: {
        // Serve source assets directly so standalone deployments do not require sharp.
        unoptimized: true,
        remotePatterns: [
            { protocol: "https", hostname: "placeholder.co" },
            { protocol: "https", hostname: "res.cloudinary.com" },
        ],
    },
    typescript: {
        ignoreBuildErrors: false,
    },
};

export default nextConfig;
