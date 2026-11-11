import { server } from "../../backend/src/index";

// Observe the actual entry point over IPC, independently of log formatting/reporters.
const ready = () => {
    if (!process.send) throw new Error("This fixture requires an IPC parent");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("A TCP listener is required");
    process.send({
        type: "imad-startup-ready",
        port: address.port,
        googleSdkLoaded: Object.keys(require.cache).some(path => /[\\/]node_modules[\\/]googleapis[\\/]/.test(path)),
    });
};
if (server.listening) ready();
else server.once("listening", ready);
