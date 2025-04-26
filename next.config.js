/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['www.google.com']
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL
  }
};

module.exports = nextConfig;
