/** @type {import('next').NextConfig} */
const nextConfig = {
  // The dev machine's LAN IP may change; allow any IPv4 origin for dev routes
  // (HMR, middleware) so the app keeps working from whatever IP the server has.
  allowedDevOrigins: ["*.*.*.*"],
};

export default nextConfig;
