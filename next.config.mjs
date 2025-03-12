/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  reactStrictMode: true,
  
  // Konfigurasi untuk menangani modul Server-Side di Client
  serverExternalPackages: ['bcrypt'],
  
  // Konfigurasi webpack yang lebih spesifik untuk masalah bcrypt
  webpack: (config, { isServer }) => {
    // Jika bukan di server, abaikan bcrypt dan module native lainnya
    if (!isServer) {
      // Secara eksplisit abaikan bcrypt dan node-pre-gyp
      config.resolve.alias = {
        ...config.resolve.alias,
        bcrypt: false,
        "@mapbox/node-pre-gyp": false,
      };
      
      // Hindari modul Node.js native lainnya
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        http: false,
        https: false,
        zlib: false,
        path: false,
        os: false,
        'aws-sdk': false,
        'mock-aws-s3': false,
        'nock': false,
      };
    }
    
    return config;
  },
};

export default nextConfig;