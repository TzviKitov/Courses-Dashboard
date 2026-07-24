import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Parent folders may have other lockfiles; pin Turbopack to this app.
  turbopack: {
    root: path.resolve(process.cwd()),
  },
};

export default nextConfig;
