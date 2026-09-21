import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Scholarship evidence is uploaded one file per Server Action. The database and UI
  // still enforce a 10 MB limit; this leaves room for multipart request overhead.
  experimental: { serverActions: { bodySizeLimit: "12mb" } },
};

export default nextConfig;
