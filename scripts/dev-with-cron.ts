
import { spawn } from 'child_process';
import http from 'http';

// Load environment variables
require('dotenv').config();

const CRON_SECRET = process.env.CRON_SECRET || 'your-super-secret-key-for-cron-job';
const CHECK_INTERVAL = 60000; // 1 minute

console.log('🚀 Starting Development Server with Auto-Cron...');

// 1. Start Next.js Dev Server
const nextDev = spawn('next', ['dev'], {
  stdio: 'inherit',
  shell: true
});

// 2. Setup Cron Pinger
const pingCron = () => {
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/cron/notifications',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${CRON_SECRET}`
    }
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      if (res.statusCode === 200) {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`[${timestamp}] 🔔 Cron Triggered: Success`);
      } else {
         // Suppress connection refused errors during startup
         if(res.statusCode !== 500) {
            console.log(`[Cron] Status: ${res.statusCode}`);
         }
      }
    });
  });

  req.on('error', (e) => {
    // Ignore connection refused errors (server starting up)
    if ((e as any).code !== 'ECONNREFUSED') {
      console.error(`[Cron] Error: ${e.message}`);
    }
  });

  req.end();
};

// Wait for server to be ready before starting pinger
setTimeout(() => {
  console.log('⏰ Starting Cron Pinger (Every 60s)...');
  pingCron(); // Initial ping
  setInterval(pingCron, CHECK_INTERVAL);
}, 10000); // Wait 10s for Next.js to boot

// Handle cleanup
process.on('SIGINT', () => {
  nextDev.kill();
  process.exit();
});
