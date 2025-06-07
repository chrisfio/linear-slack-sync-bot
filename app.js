const { App } = require('@slack/bolt');
const axios = require('axios');
const http = require('http');
require('dotenv').config();

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
  // Only process unsynced Linear messages (Type 2)
  if (message.bot_id === 'B08V7MLLTHV') {
    console.log('🚨 Unsynced Linear issue detected');
    
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

// Create a simple HTTP server for Railway health checks
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'healthy', 
      service: 'linear-slack-sync-bot',
      timestamp: new Date().toISOString()
    }));
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Linear-Slack Sync Bot is running! 🤖');
  }
});

// Start your app
(async () => {
  await app.start();
  console.log('⚡️ Linear-Slack sync bot is running in production mode!');
  
  // Start HTTP server for Railway
  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    console.log(`🌐 HTTP server listening on port ${port} for Railway health checks`);
  });
})();
