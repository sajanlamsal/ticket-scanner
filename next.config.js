/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    // Note: TICKET_SECRET is server-only and should not be exposed
  },
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3', 'pg']
  }
}

module.exports = nextConfig