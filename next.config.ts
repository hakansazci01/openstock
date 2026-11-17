import type { NextConfig } from "next";
import withBundleAnalyzer from '@next/bundle-analyzer';

const withBundleAnalyzerConfig = withBundleAnalyzer({
    enabled: process.env.ANALYZE === 'true',
});

const nextConfig: NextConfig = {
    devIndicators: false,
    // /whats-new was live briefly before the changelog replaced it
    async redirects() {
        return [{ source: '/whats-new', destination: '/changelog', permanent: true }];
    },
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'github.com',
            },
            {
                protocol: 'https',
                hostname: 'i.ytimg.com',
            },
            {
                protocol: 'https',
                hostname: 'static2.finnhub.io',
            },
        ],
    },
    turbopack: {
        root: process.cwd(),
    },
};

export default withBundleAnalyzerConfig(nextConfig);
