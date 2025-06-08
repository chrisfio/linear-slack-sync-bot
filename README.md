# 🤖 Linear-Slack Sync Bot

A Slack bot that automatically syncs unsynced Linear issue notifications with Slack threads, enabling seamless bi-directional communication between Linear and Slack.

## ✨ Features

- **Automatic Detection**: Monitors Slack channels for unsynced Linear issue notifications
- **Bi-directional Sync**: Links Linear issues with Slack threads for unified discussions
- **Real-time Processing**: Instantly processes new Linear notifications as they appear
- **Health Monitoring**: Built-in health checks and monitoring endpoints
- **Railway Ready**: Optimized for deployment on Railway with proper health checks

## 🚀 How It Works

1. **Detection**: The bot listens for messages from Linear's Slack integration
2. **Extraction**: Extracts the Linear issue number from the notification message
3. **Synchronization**: Uses Linear's GraphQL API to link the issue with the Slack thread
4. **Confirmation**: Logs successful syncs and any errors for monitoring

## 📋 Prerequisites

- Node.js (v14 or higher)
- A Slack workspace with admin permissions
- Linear workspace with API access
- Railway account (for deployment)

## 🛠️ Setup Instructions

### 1. Slack App Configuration

1. Go to [api.slack.com](https://api.slack.com/apps) and create a new app
2. Enable **Socket Mode** and generate an App Token
3. Add the following **Bot Token Scopes**:
   - `app_mentions:read`
   - `channels:history`
   - `chat:write`
   - `im:history`
   - `mpim:history`

4. Install the app to your workspace and note the Bot User OAuth Token

### 2. Linear API Setup

1. Go to Linear → Settings → API
2. Create a new Personal API Key
3. Ensure the key has read/write permissions for issues

### 3. Environment Variables

Create a `.env` file with the following variables:

```env
# Slack Configuration
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_APP_TOKEN=xapp-your-app-token-here
SLACK_WORKSPACE_NAME=your-workspace-name

# Linear Configuration
LINEAR_API_KEY=lin_api_your-linear-api-key

# Server Configuration (optional)
PORT=3000
```

### 4. Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd linear-slack-sync-bot

# Install dependencies
npm install

# Start the bot locally
npm start
```

## 🚀 Deployment on Railway

### Quick Deploy

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template)

### Manual Deployment

1. **Connect Repository**:
   ```bash
   railway login
   railway link
   ```

2. **Set Environment Variables**:
   ```bash
   railway variables:set SLACK_BOT_TOKEN=xoxb-your-token
   railway variables:set SLACK_SIGNING_SECRET=your-secret
   railway variables:set SLACK_APP_TOKEN=xapp-your-token
   railway variables:set SLACK_WORKSPACE_NAME=your-workspace
   railway variables:set LINEAR_API_KEY=lin_api_your-key
   ```

3. **Deploy**:
   ```bash
   railway up
   ```

## 📡 Health Monitoring

The bot includes several monitoring endpoints:

- **`/health`** or **`/healthz`**: JSON health status
- **`/`**: HTML dashboard with connection status
- **Logs**: Detailed console logging for all operations

### Health Check Response
```json
{
  "status": "healthy",
  "slack_connected": true,
  "service": "linear-slack-sync-bot",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600,
  "memory": {...}
}
```

## 🔧 Configuration

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `SLACK_BOT_TOKEN` | Bot User OAuth Token from Slack | `xoxb-123-456-abc` |
| `SLACK_SIGNING_SECRET` | Signing Secret from Slack App | `abc123def456` |
| `SLACK_APP_TOKEN` | App-Level Token for Socket Mode | `xapp-1-A123-456-abc` |
| `SLACK_WORKSPACE_NAME` | Your Slack workspace name | `mycompany` |
| `LINEAR_API_KEY` | Personal API Key from Linear | `lin_api_abc123def456` |

### Optional Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | HTTP server port | `3000` |

## 🔍 Usage

1. **Add Linear Integration**: Ensure Linear's Slack integration is installed in your channels
2. **Invite the Bot**: Add your sync bot to channels where Linear notifications appear
3. **Automatic Sync**: The bot will automatically detect and sync unsynced Linear issues

### Example Workflow

1. Linear posts an unsynced issue notification to Slack
2. Bot detects the message and extracts issue number (e.g., `DEV-123`)
3. Bot queries Linear API to get issue details
4. Bot creates a sync link between the Linear issue and Slack thread
5. Future comments in Linear will sync to the Slack thread

## 🐛 Troubleshooting

### Common Issues

**Bot not responding to Linear notifications:**
- Verify the bot is in the same channel as Linear notifications
- Check that the Linear bot ID matches in the code (`B08V7MLLTHV`)
- Ensure bot has proper permissions to read messages

**Linear API errors:**
- Validate your `LINEAR_API_KEY` has proper permissions
- Check Linear API rate limits
- Verify issue numbers are being extracted correctly

**Connection issues:**
- Check all environment variables are set correctly
- Verify Slack app has Socket Mode enabled
- Ensure firewall allows outbound connections

### Debug Mode

Enable detailed logging by checking the console output. The bot logs:
- ✅ Successful syncs
- ❌ Failed operations  
- 🎯 Issue processing
- 🚨 Unsynced issue detection

---