import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow API calls to backend during development
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:8000/:path*",
      },
    ];
  },
  allowedDevOrigins: [
    "192.168.7.8",
    "rich-readers-kiss.loca.lt",
    "myams-206-84-227-162.run.pinggy-free.link",
    "grumpy-paws-talk.loca.lt",
    "short-phones-take.loca.lt",
    "localhost"
  ]
};

export default nextConfig;
