/**
 * AppVault Local Google Drive OAuth2 Setup Helper
 * 
 * This script runs locally on your machine to authorize Google Drive access
 * and automatically saves the resulting refresh token to admin-web/.env.local.
 * NO SECRETS OR TOKENS ARE EVER SENT OVER THE INTERNET OR SHARED IN CHAT.
 * 
 * Usage:
 *   node scripts/setup-google-drive.js
 */

const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { exec } = require('child_process');

const ENV_PATH = path.join(__dirname, '..', '.env.local');
const REDIRECT_PORT = 8085;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/oauth2callback`;
const SCOPES = 'https://www.googleapis.com/auth/drive';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

function openBrowser(targetUrl) {
  const startCmd = process.platform === 'win32' ? 'start ""' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  exec(`${startCmd} "${targetUrl}"`);
}

function updateEnvLocal(key, value) {
  let content = '';
  if (fs.existsSync(ENV_PATH)) {
    content = fs.readFileSync(ENV_PATH, 'utf-8');
  }

  const regex = new RegExp(`^${key}=.*$`, 'm');
  if (regex.test(content)) {
    content = content.replace(regex, `${key}=${value}`);
  } else {
    content += (content.endsWith('\n') ? '' : '\n') + `${key}=${value}\n`;
  }

  fs.writeFileSync(ENV_PATH, content, 'utf-8');
}

async function main() {
  console.log('======================================================================');
  console.log('            AppVault Google Drive OAuth2 Setup Helper');
  console.log('======================================================================\n');
  console.log('Prerequisites:');
  console.log('1. Go to Google Cloud Console (https://console.cloud.google.com/)');
  console.log('2. Enable "Google Drive API" in APIs & Services -> Library');
  console.log('3. In APIs & Services -> Credentials -> Create Credentials -> OAuth client ID:');
  console.log('   - Application type: Web application');
  console.log(`   - Authorized redirect URI: ${REDIRECT_URI}`);
  console.log('4. Copy the Client ID and Client Secret.\n');

  let clientId = process.env.GOOGLE_CLIENT_ID;
  let clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (fs.existsSync(ENV_PATH)) {
    const envContent = fs.readFileSync(ENV_PATH, 'utf-8');
    const idMatch = envContent.match(/^GOOGLE_CLIENT_ID=(.*)$/m);
    const secretMatch = envContent.match(/^GOOGLE_CLIENT_SECRET=(.*)$/m);
    if (idMatch && idMatch[1] && !idMatch[1].includes('your_')) clientId = idMatch[1].trim();
    if (secretMatch && secretMatch[1] && !secretMatch[1].includes('your_')) clientSecret = secretMatch[1].trim();
  }

  if (!clientId) {
    clientId = (await question('Enter your GOOGLE_CLIENT_ID: ')).trim();
  } else {
    console.log(`Using GOOGLE_CLIENT_ID from .env.local: ${clientId.substring(0, 12)}...`);
  }

  if (!clientSecret) {
    clientSecret = (await question('Enter your GOOGLE_CLIENT_SECRET: ')).trim();
  } else {
    console.log('Using GOOGLE_CLIENT_SECRET from .env.local: [Set]');
  }

  if (!clientId || !clientSecret) {
    console.error('Error: Both Client ID and Client Secret are required.');
    process.exit(1);
  }

  // Start local server to capture authorization code
  const server = http.createServer(async (req, res) => {
    try {
      const parsedUrl = url.parse(req.url, true);
      if (parsedUrl.pathname === '/oauth2callback') {
        const code = parsedUrl.query.code;
        if (!code) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<h1>Error: No authorization code received.</h1>');
          return;
        }

        console.log('\n[INFO] Authorization code received. Exchanging for refresh token...');

        // Exchange code for tokens
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: REDIRECT_URI,
            grant_type: 'authorization_code'
          })
        });

        const tokenData = await tokenRes.json();
        if (!tokenRes.ok || !tokenData.refresh_token) {
          res.writeHead(500, { 'Content-Type': 'text/html' });
          res.end(`<h1>Token Exchange Failed</h1><pre>${JSON.stringify(tokenData, null, 2)}</pre>`);
          console.error('[ERROR] Token exchange failed:', tokenData);
          server.close();
          process.exit(1);
          return;
        }

        const refreshToken = tokenData.refresh_token;

        // Save directly to .env.local
        updateEnvLocal('GOOGLE_CLIENT_ID', clientId);
        updateEnvLocal('GOOGLE_CLIENT_SECRET', clientSecret);
        updateEnvLocal('GOOGLE_REFRESH_TOKEN', refreshToken);

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <div style="font-family: sans-serif; padding: 40px; text-align: center;">
            <h1 style="color: #10b981;">Google Drive Authorization Successful!</h1>
            <p>The refresh token has been saved to your <code>admin-web/.env.local</code> file.</p>
            <p>You can now close this tab and return to your terminal.</p>
          </div>
        `);

        console.log('\n[SUCCESS] Refresh token successfully saved to admin-web/.env.local!');
        console.log('AppVault Admin Web Panel can now upload media directly to Google Drive.');
        server.close();
        process.exit(0);
      }
    } catch (e) {
      console.error('[ERROR]', e);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal error');
    }
  });

  server.listen(REDIRECT_PORT, () => {
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(clientId)}&` +
      `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
      `response_type=code&` +
      `scope=${encodeURIComponent(SCOPES)}&` +
      `access_type=offline&` +
      `prompt=consent`;

    console.log(`\nOpening browser to authorize Google Drive access:`);
    console.log(authUrl);
    openBrowser(authUrl);
  });
}

main().catch(console.error);
