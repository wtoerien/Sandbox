import type { NextConfig } from "next";

const devOrigins: string[] = [];
if (process.env.REPLIT_DEV_DOMAIN) {
  devOrigins.push(process.env.REPLIT_DEV_DOMAIN);
  devOrigins.push(`https://${process.env.REPLIT_DEV_DOMAIN}`);
}

const nextConfig: NextConfig = {
  allowedDevOrigins: devOrigins.length > 0 ? devOrigins : undefined,
};

export default nextConfig;
