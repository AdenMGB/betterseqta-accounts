/** @type {import('pm2').StartOptions} */
module.exports = {
  apps: [
    {
      name: "bs-edge-api",
      cwd: __dirname,
      script: "node",
      args: "dist/index.js",
      interpreter: "none",
      env_file: ".env",
      autorestart: true,
      max_memory_restart: "512M",
      instances: 1,
      exec_mode: "fork",
    },
  ],
};