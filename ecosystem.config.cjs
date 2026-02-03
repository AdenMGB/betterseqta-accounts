module.exports = {
  apps: [{
    name: "betterseqta-app",
    script: ".output/server/index.mjs",
    cwd: "/var/www/betterseqta", // Set the working directory
    env: {
      NODE_ENV: "development",
    },
    env_production: {
      NODE_ENV: "production",
      // IMPORTANT: Replace these placeholders with your actual production secrets
      DATABASE_URL: "mysql://betterseqta_user:your_strong_password@localhost:3306/betterseqta",
      JWT_SECRET: "your_super_secret_jwt_string_goes_here",
      DISCORD_CLIENT_ID: "your_client_id_here",
      DISCORD_CLIENT_SECRET: "your_secret_here",
      DISCORD_REDIRECT_URI: "http://redirect.urihere",
    }
  }]
}; 