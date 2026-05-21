import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  // Allow fetching from external RSS/API sources during build
  serverExternalPackages: ['cheerio'],
}

export default nextConfig

