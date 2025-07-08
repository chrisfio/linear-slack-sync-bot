const { App } = require('@slack/bolt');
const axios = require('axios');
const http = require('http');
require('dotenv').config();

// Configure Linear bot IDs that need syncing from environment variables
// Add new bot IDs to the UNSYNCED_LINEAR_BOT_IDS environment variable as Linear creates different alert types
const UNSYNCED_LINEAR_BOT_IDS = process.env.UNSYNCED_LINEAR_BOT_IDS 
  ? process.env.UNSYNCED_LINEAR_BOT_IDS.split(',').map(id => id.trim())
  : [];

// Initialize your app with your bot token and signing secret
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN
});

// Function to get Linear issue ID from issue number
async function getLinearIssueId(issueNumber) {
  const query = `
    query GetIssue($issueId: String!) {
      issue(id: $issueId) {
        id
        identifier
        title
      }
    }
  `;

  try {
    const response = await axios.post('https://api.linear.app/graphql', {
      query,
      variables: { issueId: issueNumber }
    }, {
      headers: {
        'Authorization': `${process.env.LINEAR_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.data.data && response.data.data.issue) {
      return response.data.data.issue;
    }
    return null;
  } catch (error) {
    console.error('❌ Error fetching Linear issue:', issueNumber, error.message);
    return null;
  }
}

// Function to sync Linear issue with Slack thread
async function syncLinearIssueWithSlack(issueId, slackUrl) {
  const mutation = `
    mutation AttachmentLinkSlack($issueId: String!, $url: String!) {
      attachmentLinkSlack(issueId: $issueId, url: $url, syncToCommentThread: true) {
        success
        attachment {
          id
        }
      }
    }
  `;

  try {
    const response = await axios.post('https://api.linear.app/graphql', {
      query: mutation,
      variables: { 
        issueId: issueId,
        url: slackUrl
      }
    }, {
      headers: {
        'Authorization': `${process.env.LINEAR_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    // Check for GraphQL errors
    if (response.data.errors) {
      console.error('❌ Linear API errors for issue:', issueId, response.data.errors);
      return null;
    }

    if (response.data.data && response.data.data.attachmentLinkSlack) {
      return response.data.data.attachmentLinkSlack;
    }

    console.error('❌ Unexpected Linear API response for issue:', issueId);
    return null;
  } catch (error) {
    console.error('❌ Error syncing Linear issue with Slack:', issueId, error.message);
    return null;
  }
}

// Listen for messages - optimized for production
app.message(async ({ message, say }) => {
  // Only process unsynced Linear messages
  if (UNSYNCED_LINEAR_BOT_IDS.includes(message.bot_id)) {
    console.log('🚨 Unsynced Linear issue detected from bot:', message.bot_id);
    
    // Extract issue information from attachments
    if (message.attachments && message.attachments[0] && message.attachments[0].blocks) {
      const sectionBlock = message.attachments[0].blocks.find(block => block.type === 'section');
      if (sectionBlock && sectionBlock.text && sectionBlock.text.text) {
        const issueLink = sectionBlock.text.text;
        
        // Extract issue number from the link
        const linkMatch = issueLink.match(/\|([^>]+)>/);
        if (linkMatch) {
          const issueInfo = linkMatch[1];
          const issueNumberMatch = issueInfo.match(/^([A-Z]+-\d+)/);
          
          if (issueNumberMatch) {
            const issueNumber = issueNumberMatch[1];
            console.log('🎯 Processing issue:', issueNumber);
            
            // Get the Linear issue ID
            const linearIssue = await getLinearIssueId(issueNumber);
            
            if (linearIssue) {
              // Create Slack thread URL with workspace-specific format
              const slackUrl = `https://${process.env.SLACK_WORKSPACE_NAME}.slack.com/archives/${message.channel}/p${message.ts.replace('.', '')}`;
              
              // Sync the issue with Slack
              const syncResult = await syncLinearIssueWithSlack(linearIssue.id, slackUrl);
              
              if (syncResult && syncResult.success) {
                console.log('✅ Successfully synced:', issueNumber, '→ Slack thread');
              } else {
                console.log('❌ Failed to sync:', issueNumber);
              }
            } else {
              console.log('❌ Linear issue not found:', issueNumber);
            }
          }
        }
      }
    }
  }
});

// Listen for messages that mention our bot
app.event('app_mention', async ({ event, say }) => {
  console.log('👋 Bot mentioned by user:', event.user);
  await say(`Hello <@${event.user}>! I'm automatically syncing unsynced Linear issues with Slack threads.`);
});

// Track application state
let isSlackReady = false;
let startTime = Date.now();

// Create a robust HTTP server for Railway
const server = http.createServer((req, res) => {
  // Set CORS headers for Railway
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.url === '/health' || req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'healthy', // Always healthy once HTTP server is up
      slack_connected: isSlackReady,
      service: 'linear-slack-sync-bot',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - startTime) / 1000),
      memory: process.memoryUsage()
    }));
  } else if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <html>
        <head><title>Linear-Slack Sync Bot</title></head>
        <body style="font-family: Arial, sans-serif; margin: 40px;">
          <h1>🤖 Linear-Slack Sync Bot</h1>
          <p><strong>HTTP Server:</strong> ✅ Running</p>
          <p><strong>Slack Connection:</strong> ${isSlackReady ? '✅ Connected' : '⏳ Connecting...'}</p>
          <p><strong>Uptime:</strong> ${Math.floor((Date.now() - startTime) / 1000)} seconds</p>
          <p><a href="/health">Health Check (JSON)</a></p>
          <hr>
          <p><em>This bot automatically syncs unsynced Linear issues with Slack threads.</em></p>
        </body>
      </html>
    `);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
  console.log(`🔄 Received ${signal}, shutting down gracefully...`);
  
  server.close(() => {
    console.log('🌐 HTTP server closed');
    app.stop?.().then(() => {
      console.log('⚡️ Slack app stopped');
      process.exit(0);
    }).catch(() => {
      process.exit(1);
    });
  });
  
  // Force exit after 10 seconds
  setTimeout(() => {
    console.log('⏰ Force shutdown after timeout');
    process.exit(1);
  }, 10000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start the application - HTTP server FIRST for Railway
(async () => {
  try {
    // Start HTTP server immediately for Railway health checks
    const port = process.env.PORT || 3000;
    server.listen(port, '0.0.0.0', () => {
      console.log(`🌐 HTTP server listening on port ${port} - Railway ready!`);
    });
    
    // Then start Slack connection
    await app.start();
    isSlackReady = true;
    console.log('⚡️ Linear-Slack sync bot fully operational!');
    
  } catch (error) {
    console.error('❌ Failed to start bot:', error);
    process.exit(1);
  }
})();
