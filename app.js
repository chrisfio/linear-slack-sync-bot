const { App } = require('@slack/bolt');
const axios = require('axios');
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
    console.error('❌ Error fetching Linear issue:', error.message);
    if (error.response) {
      console.error('❌ Response data:', error.response.data);
    }
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

    console.log('🔍 Full response:', JSON.stringify(response.data, null, 2));

    // Check for GraphQL errors
    if (response.data.errors) {
      console.error('❌ GraphQL errors:', response.data.errors);
      return null;
    }

    if (response.data.data && response.data.data.attachmentLinkSlack) {
      return response.data.data.attachmentLinkSlack;
    }

    console.error('❌ Unexpected response structure:', response.data);
    return null;
  } catch (error) {
    console.error('❌ Error syncing Linear issue with Slack:', error.message);
    if (error.response) {
      console.error('❌ Response data:', error.response.data);
    }
    return null;
  }
}

// Listen for ALL messages (for debugging)
app.message(async ({ message, say }) => {
  console.log('Message received:', {
    text: message.text,
    user: message.user,
    bot_id: message.bot_id,
    username: message.username,
    app_id: message.app_id
  });

  // Only look for UNSYNCED Linear messages (Type 2 - no syncThreadAfterCreation)
  if (message.bot_id === 'B08V7MLLTHV') {
    console.log('🚨 UNSYNCED LINEAR ISSUE DETECTED!');
    
    // Extract issue information from attachments
    if (message.attachments && message.attachments[0] && message.attachments[0].blocks) {
      const sectionBlock = message.attachments[0].blocks.find(block => block.type === 'section');
      if (sectionBlock && sectionBlock.text && sectionBlock.text.text) {
        const issueLink = sectionBlock.text.text;
        console.log('🔗 Issue Link:', issueLink);
        
        // Extract issue number and title from the link
        const linkMatch = issueLink.match(/\|([^>]+)>/);
        if (linkMatch) {
          const issueInfo = linkMatch[1]; // e.g., "EAR-26 testing26"
          console.log('📋 Issue Info:', issueInfo);
          
          // Extract just the issue number
          const issueNumberMatch = issueInfo.match(/^([A-Z]+-\d+)/);
          if (issueNumberMatch) {
            const issueNumber = issueNumberMatch[1]; // e.g., "EAR-26"
            console.log('🎯 Issue Number:', issueNumber);
            
            // Get the Linear issue ID
            console.log('🔍 Fetching Linear issue details...');
            const linearIssue = await getLinearIssueId(issueNumber);
            
            if (linearIssue) {
              console.log('✅ Found Linear issue:', linearIssue.id);
              
              // Create Slack thread URL with workspace-specific format
              // Linear expects workspace.slack.com format, not slack.com/archives
              const slackUrl = `https://${process.env.SLACK_WORKSPACE_NAME}.slack.com/archives/${message.channel}/p${message.ts.replace('.', '')}`;
              console.log('🔗 Slack URL:', slackUrl);
              
              // Sync the issue with Slack
              console.log('🔄 Syncing Linear issue with Slack thread...');
              const syncResult = await syncLinearIssueWithSlack(linearIssue.id, slackUrl);
              
              if (syncResult && syncResult.success) {
                console.log('🎉 Successfully synced Linear issue with Slack!');
                console.log('📎 Attachment ID:', syncResult.attachment.id);
              } else {
                console.log('❌ Failed to sync Linear issue with Slack');
              }
            } else {
              console.log('❌ Could not find Linear issue with number:', issueNumber);
            }
          }
        }
      }
    }
    
    console.log('==========================================');
  }
});

// Listen for messages that mention our bot
app.event('app_mention', async ({ event, say }) => {
  console.log('Bot was mentioned:', event.text);
  await say(`Hello <@${event.user}>! I'm listening for Linear bot messages and automatically syncing them with Slack threads.`);
});

// Start your app
(async () => {
  await app.start();
  console.log('⚡️ Bolt app is running!');
})();
