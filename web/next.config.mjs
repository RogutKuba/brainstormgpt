import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

// Make sure this is called before the config is defined
initOpenNextCloudflareForDev();

/** @type {import('next').NextConfig} */
const nextConfig = {};

export default nextConfig;
