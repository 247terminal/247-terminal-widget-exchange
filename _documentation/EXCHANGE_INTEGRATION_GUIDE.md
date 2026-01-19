# 247 Terminal Widget - Exchange Integration Guide

## Overview

The 247 Terminal Widget is an embeddable trading component that provides real-time cryptocurrency news with integrated trading capabilities. This guide covers the steps required to integrate the widget into your exchange platform.

---

## Architecture

```
┌────────────────────────────────────────┐
│     Your Exchange Website              │
│     ┌──────────────────────────┐       │
│     │   247 Terminal Widget    │       │
│     │   • News Feed            │       │
│     │   • Trade Buttons        │       │
│     └───────────┬──────────────┘       │
└─────────────────┼──────────────────────┘
                  │
        ┌─────────┴─────────┐
        │                   │
     HTTPS              WebSocket
        │                   │
        ▼                   ▼
┌───────────────────────────────────────┐
│     247 Terminal Backend              │
│     • REST API                        │
│     • WebSocket Server                │
│     • Trade Token Generation          │
└───────────────────┬───────────────────┘
                    │
                    │ JWT Trade Token
                    ▼
┌───────────────────────────────────────┐
│     Your Exchange Backend             │
│     • Verify JWT Signature            │
│     • Execute Trade                   │
└───────────────────────────────────────┘
```

---

## Prerequisites

Before integration, you will receive from 247 Terminal:

| Item | Description | Usage |
|------|-------------|-------|
| **API Key** | `wk_live_xxxx` format | Embedded in widget frontend |
| **Secret Signing Key** | Shared securely | Stored on your backend to verify trade JWTs |
| **Widget Bundle URL** | CDN-hosted `widget.js` | Script to embed on your site |

---

## Frontend Integration

### Step 1: Add the Widget Container

Add a container element where you want the widget to appear:

```html
<div id="terminal-widget"></div>
```

### Step 2: Include the Widget Script

Add the script tag before your closing `</body>` tag:

```html
<script src="https://cdn.247terminal.com/widget.js"></script>
```

### Step 3: Initialize the Widget

Initialize the widget with your API key and the current user's identifier:

```javascript
const widget_instance = await ExchangeWidget.init({
    container_selector: '#terminal-widget',
    api_key: 'wk_live_your_api_key',
    exchange_user_id: 'your_user_unique_id'
});
```

### Configuration Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `container_selector` | `string` | Yes | CSS selector for the widget container |
| `api_key` | `string` | Yes | Your 247 Terminal API key |
| `exchange_user_id` | `string` | No | Unique identifier for the logged-in user |

### Widget Instance Methods

```javascript
widget_instance.destroy();
```

---

## Backend Integration

Your backend must handle trade execution by verifying JWT tokens from the widget.

### Trade Flow

1. User initiates trade in widget
2. Widget requests trade token from 247 Terminal backend
3. Widget dispatches event with signed JWT
4. Your frontend sends JWT to your backend
5. Your backend verifies JWT signature using secret key
6. Your backend executes the trade

### Handling Trade Events

Listen for trade events from the widget:

```javascript
window.addEventListener('247terminal:trade', (event) => {
    const { token, trade_id } = event.detail;

    // Send token to your backend for verification and execution
    // Trade details (coin, side, amount) are extracted from the verified JWT
    fetch('/api/execute-trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, trade_id })
    });
});
```

### Trade Event Detail Structure

| Field | Type | Description |
|-------|------|-------------|
| `token` | `string` | JWT signed by 247 Terminal backend |
| `trade_id` | `string` | Unique identifier for this trade |

**Security Note:** Trade details (coin, side, amount, etc.) are intentionally excluded from the event payload for security. All trade parameters must be extracted from the verified JWT token on your backend to prevent tampering.

### JWT Token Payload Structure

The JWT token signed by 247 Terminal contains the following payload:

```json
{
    "trade_id": "uuid-of-the-trade",
    "exchange_id": "your_exchange_id",
    "user_id": "the_exchange_user_id",
    "coin": "BTC",
    "amount": 100,
    "side": "long",
    "news_id": "news_item_id_or_null",
    "iat": 1703347200,
    "exp": 1703347230
}
```

| Field | Type | Description |
|-------|------|-------------|
| `trade_id` | `string` | Unique identifier for this trade |
| `exchange_id` | `string` | Your exchange identifier |
| `user_id` | `string` | The user's ID on your exchange |
| `coin` | `string` | Cryptocurrency symbol (BTC, ETH, SOL) |
| `amount` | `number` | Trade amount in USD |
| `side` | `string` | Trade direction: "long" or "short" |
| `news_id` | `string\|null` | Associated news item ID (can be null) |
| `iat` | `number` | Issued at timestamp (Unix seconds) |
| `exp` | `number` | Expiration timestamp (30 seconds after issue) |

### JWT Verification (Backend)

Verify the trade token using your secret signing key:

```javascript
import jwt from 'jsonwebtoken';

function verify_trade_token(token, secret_key) {
    try {
        const decoded = jwt.verify(token, secret_key);

        return {
            valid: true,
            trade_id: decoded.trade_id,
            exchange_id: decoded.exchange_id,
            user_id: decoded.user_id,
            coin: decoded.coin,
            amount: decoded.amount,
            side: decoded.side,
            news_id: decoded.news_id
        };
    } catch (error) {
        return { valid: false, error: error.message };
    }
}
```

### Backend Trade Execution Flow

```javascript
app.post('/api/execute-trade', async (req, res) => {
    const { token } = req.body;

    // 1. Verify JWT signature (also checks expiration automatically)
    const verification = verify_trade_token(token, process.env.TERMINAL_SECRET_KEY);

    if (!verification.valid) {
        return res.status(401).json({ error: 'Invalid trade token' });
    }

    // 2. Extract trade details from verified token
    const { trade_id, user_id, coin, amount, side } = verification;

    // 3. Execute the trade on your exchange
    const result = await execute_user_trade({
        user_id,
        coin,
        side,
        amount_usd: amount
    });

    // 4. Return result to frontend (include trade details for UI feedback)
    res.json({
        success: true,
        trade_id,
        coin,
        side,
        amount,
        result
    });
});
```

**Important:** The token expires 30 seconds after issue. The `jwt.verify()` function automatically rejects expired tokens.

---

## Sandbox Mode

Test the integration using sandbox mode before going live.

### Enabling Sandbox Mode

Contact 247 Terminal to receive a sandbox API key (`wk_sandbox_xxxx`). In sandbox mode:

- News feed displays test data
- Trade tokens are generated but marked as sandbox
- No real trades are executed

### Testing Checklist

- [ ] Widget loads and displays news feed
- [ ] WebSocket connection establishes successfully
- [ ] Trade buttons trigger events
- [ ] Trade events contain valid JWT tokens
- [ ] Backend successfully verifies JWT signature
- [ ] User preferences persist across sessions

---

## Widget Features

### News Feed

- Real-time cryptocurrency news via WebSocket
- Multiple source types: news articles, tweets, alerts
- Embedded tweet display
- AI-powered sentiment indicators

### Trading Interface

Users can configure their preferred trading style:

| Feature | Options |
|---------|---------|
| **Button Style** | Swipe (drag to trade) or Standard (click buttons) |
| **Amount Presets** | 1, 2, or 4 preset amounts |
| **Long Press Duration** | 0ms, 500ms, 750ms, or 1000ms |

### User Preferences

Preferences sync automatically:

- Stored locally in browser (localStorage)
- Synced to 247 Terminal backend per user
- Restored when user returns

---

## Styling

The widget uses Shadow DOM for CSS isolation. It will not affect or be affected by your site's styles.

### Container Sizing

The widget is responsive. Set your container dimensions:

```css
#terminal-widget {
    width: 100%;
    max-width: 400px;
    height: 600px;
}
```

Minimum recommended width: **280px**

---

## Error Handling

### Connection States

The widget displays connection status indicators:

| State | Description |
|-------|-------------|
| **Connected** | WebSocket active, receiving updates |
| **Connecting** | Establishing connection |
| **Disconnected** | Connection lost, auto-retry in progress |
| **Error** | Failed to connect after max retries |

### WebSocket Close Codes

| Code | Meaning | Action |
|------|---------|--------|
| 4001 | Auth timeout | Check API key |
| 4002 | Auth failed | Verify API key is valid |
| 4003 | Exchange inactive | Contact 247 Terminal |
| 4004 | Rate limit (connections) | Reduce connection frequency |
| 4008 | Origin not allowed | Add your domain to allowlist |

---

## Security Considerations

1. **API Key**: Safe to embed in frontend code. Identifies your exchange only.

2. **Secret Signing Key**: Keep on backend only. Never expose to frontend.

3. **Trade Tokens**:
   - Single-use, short-lived JWTs
   - Always verify signature before executing trades
   - Check expiration timestamp

4. **Origin Validation**: Your domain must be registered with 247 Terminal.

---

## Integration Checklist

### Frontend

- [ ] Widget script added to page
- [ ] Container element created
- [ ] Widget initialized with correct API key
- [ ] Trade event listener implemented
- [ ] Error states handled gracefully

### Backend

- [ ] Secret signing key stored securely
- [ ] JWT verification endpoint created
- [ ] Trade execution logic implemented
- [ ] Token expiration validation added

### Testing

- [ ] Sandbox mode tested successfully
- [ ] Live mode verified with test trades
- [ ] User preferences persist correctly
- [ ] WebSocket reconnection works

---

## Support

For integration support or to request API credentials:

- Email: support@247terminal.com
- Documentation: https://docs.247terminal.com

---

## Complete Integration Example

```html
<!DOCTYPE html>
<html>
<head>
    <title>Exchange Trading</title>
    <style>
        #terminal-widget {
            width: 350px;
            height: 600px;
            border-radius: 8px;
            overflow: hidden;
        }
    </style>
</head>
<body>
    <div id="terminal-widget"></div>

    <script src="https://cdn.247terminal.com/widget.js"></script>
    <script>
        async function init_widget() {
            const current_user_id = get_logged_in_user_id();

            const widget = await ExchangeWidget.init({
                container_selector: '#terminal-widget',
                api_key: 'wk_live_your_api_key',
                exchange_user_id: current_user_id
            });

            window.addEventListener('247terminal:trade', async (event) => {
                const { token, trade_id } = event.detail;

                try {
                    const response = await fetch('/api/execute-trade', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ token, trade_id })
                    });

                    const result = await response.json();

                    if (response.ok) {
                        show_notification(`Trade executed: ${result.side} ${result.coin} $${result.amount}`);
                    } else {
                        show_notification(result.error || 'Trade failed', 'error');
                    }
                } catch (error) {
                    show_notification('Network error', 'error');
                }
            });
        }

        init_widget();
    </script>
</body>
</html>
```

---

**Version:** 1.1
**Last Updated:** January 2026
