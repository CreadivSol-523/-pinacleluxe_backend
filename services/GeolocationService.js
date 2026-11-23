import axios from "axios";

/**
 * Service to detect user's country from request headers and IP geolocation
 */
class GeolocationService {
    /**
     * Detect country from Express request object
     * @param {import('express').Request} req
     * @returns {Promise<{ countryCode: string, countryName?: string, isPakistan: boolean, detectionMethod: string }>}
     */
    static async detectCountry(req) {
        // 1. Cloudflare header: CF-IPCountry (fastest and most accurate when behind Cloudflare)
        const cfCountry = req.headers["cf-ipcountry"];
        if (cfCountry && typeof cfCountry === "string" && cfCountry.trim().length === 2 && cfCountry.toUpperCase() !== "XX" && cfCountry.toUpperCase() !== "T1") {
            const countryCode = cfCountry.trim().toUpperCase();
            return {
                countryCode,
                countryName: countryCode === "PK" ? "Pakistan" : undefined,
                isPakistan: countryCode === "PK",
                detectionMethod: "cloudflare",
            };
        }

        // 2. Extract Client IP from reverse proxy headers
        const forwardedFor = req.headers["x-forwarded-for"];
        let clientIp = "";

        if (forwardedFor && typeof forwardedFor === "string") {
            // First IP in comma-separated list is the original client
            clientIp = forwardedFor.split(",")[0].trim();
        } else if (req.headers["x-real-ip"]) {
            clientIp = String(req.headers["x-real-ip"]).trim();
        } else if (req.socket?.remoteAddress) {
            clientIp = req.socket.remoteAddress.trim();
        }

        // Normalize IPv4-mapped IPv6 (e.g., "::ffff:127.0.0.1")
        if (clientIp.startsWith("::ffff:")) {
            clientIp = clientIp.replace("::ffff:", "");
        }

        // 3. Handle private networks / localhost
        const isLocal =
            !clientIp ||
            clientIp === "127.0.0.1" ||
            clientIp === "::1" ||
            clientIp === "localhost" ||
            clientIp.startsWith("192.168.") ||
            clientIp.startsWith("10.") ||
            clientIp.startsWith("172.16.") ||
            clientIp.startsWith("172.31.");

        if (isLocal) {
            // Default to Pakistan in local development
            return {
                countryCode: "PK",
                countryName: "Pakistan",
                isPakistan: true,
                detectionMethod: "local_default",
            };
        }

        // 4. Primary IP Geolocation lookup
        try {
            const geoRes = await axios.get(`https://api.country.is/${clientIp}`, { timeout: 3000 });
            if (geoRes.data?.country && typeof geoRes.data.country === "string") {
                const countryCode = geoRes.data.country.trim().toUpperCase();
                return {
                    countryCode,
                    isPakistan: countryCode === "PK",
                    detectionMethod: "country_is",
                };
            }
        } catch (err) {
            // continue to fallback
        }

        // 5. Secondary fallback IP Geolocation lookup
        try {
            const geoRes2 = await axios.get(`https://ipwho.is/${clientIp}`, { timeout: 3500 });
            if (geoRes2.data?.success !== false && geoRes2.data?.country_code) {
                const countryCode = String(geoRes2.data.country_code).trim().toUpperCase();
                return {
                    countryCode,
                    countryName: geoRes2.data.country,
                    isPakistan: countryCode === "PK",
                    detectionMethod: "ipwho_is",
                };
            }
        } catch (err) {
            // continue to default
        }

        // 6. Graceful Fallback if IP detection fails completely
        return {
            countryCode: "UNKNOWN",
            countryName: "Unknown",
            isPakistan: false,
            detectionMethod: "fallback_unknown",
        };
    }
}

export default GeolocationService;
