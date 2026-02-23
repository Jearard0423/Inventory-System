#!/usr/bin/env node
/*
  Usage:
    CLIENT_ID=your-client-id CLIENT_SECRET=your-client-secret node scripts/get_gmail_refresh_token.js

  This script will:
  - print an OAuth consent URL
  - start a local HTTP server at http://localhost:3001 to receive the callback
  - exchange the code for tokens and print the refresh_token

  Notes:
  - Create an OAuth Client ID in Google Cloud Console. Use Redirect URI: http://localhost:3001/oauth2callback
  - Scope used: https://mail.google.com/ (full SMTP/IMAP access) + profile/email
  - Do NOT commit client secrets; run locally and copy the refresh token into your `.env.local` as `SMTP_OAUTH_REFRESH_TOKEN`
*/

const http = require('http')
const url = require('url')
const { OAuth2Client } = require('google-auth-library')

const CLIENT_ID = process.env.CLIENT_ID || process.env.SMTP_OAUTH_CLIENT_ID
const CLIENT_SECRET = process.env.CLIENT_SECRET || process.env.SMTP_OAUTH_CLIENT_SECRET
const PORT = parseInt(process.env.PORT || '3001', 10)

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Missing CLIENT_ID and CLIENT_SECRET. Set env vars CLIENT_ID and CLIENT_SECRET (or SMTP_OAUTH_CLIENT_ID/SECRET).')
  process.exit(1)
}

const redirectUri = `http://localhost:${PORT}/oauth2callback`
const oauth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, redirectUri)

const scope = [
  'https://mail.google.com/',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
]

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope,
  prompt: 'consent',
})

console.log('Consent URL:')
console.log(authUrl)
console.log('\nCallback URL (listening):', redirectUri)

// Try to open the URL automatically for convenience
try {
  const { exec } = require('child_process')
  // Linux: xdg-open, macOS: open, Windows: start
  const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open'
  exec(`${opener} "${authUrl}"`, (err) => {
    if (err) console.log('Could not open browser automatically — please open the URL above manually')
  })
} catch (e) {
  // ignore
}

const server = http.createServer(async (req, res) => {
  try {
    const q = url.parse(req.url, true)
    if (q.pathname !== '/oauth2callback') {
      res.writeHead(404)
      res.end('Not found')
      return
    }

    const code = q.query.code
    if (!code) {
      res.writeHead(400)
      res.end('Missing code in query')
      return
    }

    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end('<h2>Received code — you can close this tab.</h2><p>Return to the terminal to see tokens.</p>')

    console.log('\nExchanging code for tokens...')
    const r = await oauth2Client.getToken(code)
    const tokens = r.tokens

    console.log('\n=== Tokens ===')
    console.log('access_token:', tokens.access_token)
    console.log('refresh_token:', tokens.refresh_token)
    console.log('scope:', tokens.scope)
    console.log('expiry_date:', tokens.expiry_date)

    // Optionally write to .env.local if the user requested it
    const autoWrite = process.env.WRITE_ENV === '1' || process.argv.includes('--write') || process.env.AUTO_WRITE === '1'
    if (autoWrite) {
      const fs = require('fs')
      const path = require('path')
      const envPath = path.resolve(process.cwd(), '.env.local')
      const lines = [
        `SMTP_USER=${process.env.SMTP_USER || ''}`,
        `SMTP_OAUTH_CLIENT_ID=${CLIENT_ID}`,
        `SMTP_OAUTH_CLIENT_SECRET=${CLIENT_SECRET}`,
        `SMTP_OAUTH_REFRESH_TOKEN=${tokens.refresh_token || ''}`,
      ]
      // Append without overwriting existing file content to be safe
      let existing = ''
      try { existing = fs.readFileSync(envPath, 'utf8') } catch (e) { /* ignore */ }
      const toWrite = existing + '\n' + lines.join('\n') + '\n'
      fs.writeFileSync(envPath, toWrite, { encoding: 'utf8' })
      console.log(`\nWrote OAuth vars to ${envPath} (passwords/secrets are stored locally).`)
    } else {
      console.log('\nCopy the refresh_token value into your .env.local as SMTP_OAUTH_REFRESH_TOKEN')
      console.log('Or re-run with WRITE_ENV=1 or --write to automatically append to .env.local')
    }

    // Close server after success
    setTimeout(() => server.close(), 1000)
  } catch (err) {
    console.error('Error handling callback:', err)
    res.writeHead(500)
    res.end('Server error')
  }
})

server.listen(PORT, () => {
  // keep running until callback received
})
