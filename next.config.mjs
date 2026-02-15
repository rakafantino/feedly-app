
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  reloadOnOnline: false,
});

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  reactStrictMode: true,
  
  // Konfigurasi untuk menangani modul Server-Side di Client
  serverExternalPackages: ['bcrypt', 'bcryptjs'],
  
  // Konfigurasi eksperimental
  experimental: {
    externalDir: true
  },
  
  // PWA Headers handled by Serwist usually, but keeping custom headers for now
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
        ],
      },
      // ... keep other headers ...
       {
        source: '/manifest.json',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, immutable',
          },
        ],
      },
      {
        source: '/icons/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
  
  // Konfigurasi webpack yang lebih spesifik untuk masalah bcrypt
  webpack: (config, { isServer, dev }) => {
    // Avoid eval in development mode to support Service Workers
    if (dev) {
      // config.devtool = 'source-map'; // Disabled to prevent Next.js warning about performance regression
      
      // Prevent infinite loop by ignoring generated SW files
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          ...(Array.isArray(config.watchOptions?.ignored) 
            ? config.watchOptions.ignored 
            : []),
          '**/public/sw.js',
          '**/public/sw.js.map',
        ],
      };
    }

    // Jika bukan di server, abaikan bcrypt dan module native lainnya
    if (!isServer) {
      // Secara eksplisit abaikan bcrypt dan node-pre-gyp
      config.resolve.alias = {
        ...config.resolve.alias,
        bcrypt: false,
        bcryptjs: false,
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

export default withSerwist(nextConfig);