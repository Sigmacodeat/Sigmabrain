import type { NextConfig } from "next";

// Security headers for every route. HSTS only bites over HTTPS (production);
// browsers ignore it on plain http://localhost. CSP is intentionally not set
// here yet — adding one untested would break inline styles/PWA; tracked for
// the post-launch hardening pass with proper report-only rollout.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
