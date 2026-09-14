import type { NextConfig } from "next";

// The FastAPI backend (backend/). The browser keeps calling same-origin
// /api/*, which is proxied there.
const API_URL = process.env.API_URL || "http://localhost:8000";

const config: NextConfig = {
  rewrites: async () => [
    { source: "/api/:path*", destination: `${API_URL}/api/:path*` },
  ],
};
export default config;
