# Widget Implementation Status - Consolidated Plan

> **Last Updated:** 2025-12-18
>
> This document consolidates all widget-related implementation plans into a single source of truth.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Implementation Status](#implementation-status)
4. [Outstanding Tasks](#outstanding-tasks)
5. [Backend Component Reference](#backend-component-reference)
6. [Frontend Widget (Separate Repository)](#frontend-widget-separate-repository)
7. [API Reference](#api-reference)
8. [Testing Checklist](#testing-checklist)

---

## Executive Summary

The 247 Terminal Widget is a secure, embeddable trading widget designed for exchange partners. The widget enables exchanges to integrate our news-driven trading capabilities into their platforms while ensuring we can reliably track and bill for every trade.

### Core Security Mechanism

The widget uses a **One-Time Trade Token** system:
1. Widget requests a signed JWT from our backend before any trade
2. Exchange backend must validate this JWT to execute the trade
3. This makes our backend a mandatory, non-bypassable step in the trade flow

### Key Components

| Component | Status | Location |
|-----------|--------|----------|
| Database Schema | ✅ Complete | `migrations/006_*.sql`, `migrations/007_*.sql` |
| Widget Model (Postgres) | ✅ Complete | `app/models/postgres/widget.js` |
| Widget Connection (Redis) | ✅ Complete | `app/models/redis/widget_connection.js` |
| REST API (Trade Token) | ✅ Complete | `app/routes/widget/` |
| REST API (Config) | ✅ Complete | `app/routes/widget/` |
| WebSocket Service | ✅ Complete | `app/websocket/widget/` |
| News Broadcasting | ✅ Complete | `app/websocket/news/news.broadcaster.js` |
| Trade Stats (Public) | ✅ Complete | `app/models/redis/trade_stats.js` |
| Frontend Widget | ❌ Not Started | Separate repository required |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Exchange Website                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     247 Terminal Widget                              │   │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────────┐  │   │
│  │  │ News Feed   │    │ Trade       │    │ WebSocket Client        │  │   │
│  │  │ Component   │    │ Buttons     │    │ (receives news)         │  │   │
│  │  └─────────────┘    └──────┬──────┘    └───────────┬─────────────┘  │   │
│  └────────────────────────────┼───────────────────────┼────────────────┘   │
└───────────────────────────────┼───────────────────────┼────────────────────┘
                                │                       │
                                │ HTTPS Request         │ WebSocket
                                │ (get trade token)     │ Connection
                                ▼                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         247 Terminal Backend                                 │
│  ┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────┐  │
│  │ POST /widget/       │    │ WS /ws/widget       │    │ GET /widget/    │  │
│  │ generate-trade-token│    │ (news streaming)    │    │ config          │  │
│  └──────────┬──────────┘    └──────────┬──────────┘    └────────┬────────┘  │
│             │                          │                        │           │
│             ▼                          ▼                        ▼           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     PostgreSQL + Redis                               │   │
│  │  • exchange_configurations    • Rate limit counters                  │   │
│  │  • widget_trades              • Connection tracking                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                │
                                │ Signed JWT
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Exchange Backend                                     │
│  • Verifies JWT signature using shared secret_signing_key                   │
│  • Executes trade on behalf of user                                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Two-Key Security Model

| Key | Purpose | Visibility | Used By |
|-----|---------|------------|---------|
| **`api_key`** | Identifies exchange for WebSocket auth | Public (embedded in widget) | Widget → Our Backend |
| **`secret_signing_key`** | Cryptographically signs trade JWTs | Private (never exposed) | Our Backend → Exchange Backend |

---

## Implementation Status

### Phase 1: Database Foundation ✅ COMPLETE

**Migration 006** - `migrations/006_create_widget_tables.sql`
- `exchange_configurations` table (base)
- `widget_trades` table
- Index on `widget_trades(exchange_id)`

**Migration 007** - `migrations/007_add_widget_columns.sql`
- Added: `api_key`, `display_name`, `allowed_origins`, `rate_limit_connections`, `rate_limit_messages_per_minute`
- Index on `exchange_configurations(api_key)`
- Index on `widget_trades(created_at)`
- Auto-update trigger for `updated_at`

### Phase 2: Widget Model (Postgres) ✅ COMPLETE

**File:** `app/models/postgres/widget.js`

| Method | Status | Description |
|--------|--------|-------------|
| `get_exchange_config(exchange_id)` | ✅ | Get active exchange by ID |
| `get_exchange_by_api_key(api_key)` | ✅ | Get exchange by API key (for WebSocket auth) |
| `create_trade_log(...)` | ✅ | Log trade token request |
| `update_trade_status(trade_id, status)` | ✅ | Update trade status |

### Phase 3: Widget Connection Model (Redis) ✅ COMPLETE

**File:** `app/models/redis/widget_connection.js`

| Method | Status | Description |
|--------|--------|-------------|
| `add(socket_id, exchange_id)` | ✅ | Track new connection |
| `remove(socket_id, exchange_id)` | ✅ | Remove connection |
| `get(socket_id)` | ✅ | Get connection details |
| `get_exchange_socket_ids(exchange_id)` | ✅ | Get all sockets for exchange |
| `count_exchange_connections(exchange_id)` | ✅ | Count exchange connections |
| `exists(socket_id)` | ✅ | Check if connection exists |
| `count_total_connections()` | ✅ | Count all widget connections |

### Phase 4: REST API ✅ COMPLETE

**Trade Token Endpoint**
- Route: `POST /api/app/widget/generate-trade-token`
- Controller: `app/routes/widget/widget.controller.js`
- Service: `app/routes/widget/widget.service.js`

**Config Endpoint**
- Route: `GET /api/app/widget/config?id={exchange_id}`
- Controller: `app/routes/widget/widget.controller.js`
- Service: `app/routes/widget/widget.service.js` (with Redis caching)

### Phase 5: WebSocket Service ✅ COMPLETE

**File:** `app/websocket/widget/widget.service.js`

| Feature | Status | Description |
|---------|--------|-------------|
| API Key Authentication | ✅ | Validates `api_key` from auth message |
| Exchange Connection Tracking | ✅ | Uses Redis for connection state |
| Connection Rate Limiting | ✅ | Per-IP and per-exchange limits |
| Message Rate Limiting | ✅ | Configurable messages per minute |
| Heartbeat/Ping-Pong | ✅ | Keep-alive with timeout |
| Auth Timeout | ✅ | 10 second timeout for auth |
| `broadcast_news(news_item)` | ✅ | Broadcast news to all widget clients |
| `broadcast_to_exchange(exchange_id, data)` | ✅ | Broadcast to specific exchange |

### Phase 6: News Broadcasting Integration ✅ COMPLETE

**File:** `app/websocket/news/news.broadcaster.js`

The `broadcast_news()` method automatically sends news to widget clients:
```javascript
broadcast_news(news_item) {
    const news_count = this.#broadcast(news_item);
    const widget_service = websocket.get_service('widget');
    if (widget_service) widget_service.broadcast_news(news_item);
    return news_count;
}
```

### Phase 7: Trade Stats (Public Widget) ✅ COMPLETE

**Redis Model:** `app/models/redis/trade_stats.js`
- `record_trade()` - Increment daily trade count
- `get_trade_count(days)` - Get trade counts by day
- `get_widget_stats()` - Get 7d/30d trade stats
- `sync_from_mongodb(days)` - Backfill from MongoDB

**Public API:** `app/routes/public/public.routes.js`
- Route: `GET /api/public/stats`

---

## Outstanding Tasks

### Backend - ✅ COMPLETE

All backend tasks have been completed and verified:

- ✅ Database migrations (006, 007) applied
- ✅ Test exchange data seeded
- ✅ REST routes mounted and working
- ✅ WebSocket service working (API key auth, rate limiting, heartbeat)
- ✅ News broadcasting to widget clients working

**Verified with test scripts:**
- `scripts/test_widget_connection.js` - WebSocket connection + auth
- `scripts/test_publish_news.js` - News broadcast to widget clients

### Backend - Optional Enhancements (Future)

#### 1. Origin Validation
- [ ] Implement origin validation in WebSocket auth
- Location: `app/websocket/widget/widget.service.js` in `validate_api_key_auth()`

```javascript
// Check origin if configured
const origin = req.headers.origin;
if (exchange_config.allowed_origins?.length > 0 && origin) {
    if (!exchange_config.allowed_origins.includes(origin)) {
        return { error: { code: 4008, reason: 'origin not allowed' } };
    }
}
```

#### 2. Widget Dashboard Stats Endpoint

Extend the existing dashboard (`app/routes/dashboard/`) to include widget metrics.

**New Endpoint:**
```
GET /dashboard/stats/widget
```

**Response:**
```json
{
  "connections": {
    "total_active": 45,
    "by_exchange": [
      { "exchange_id": "blofin", "active": 42 },
      { "exchange_id": "test_exchange", "active": 3 }
    ]
  },
  "trade_tokens": {
    "total": 1234,
    "today": 89,
    "7d": 456,
    "30d": 1234,
    "by_exchange": [
      { "exchange_id": "blofin", "count": 1200 },
      { "exchange_id": "test_exchange", "count": 34 }
    ]
  }
}
```

**Data Sources:**
- `widget_connection.count_total_connections()` - from Redis (active connections)
- `widget_connection.count_exchange_connections(id)` - from Redis (per-exchange)
- `widget_trades` table - from PostgreSQL (trade token history)

**Implementation Tasks:**
- [ ] Add `get_widget_stats()` method to `dashboard.service.js`
- [ ] Add `get_widget_stats` controller method to `dashboard.controller.js`
- [ ] Add route `router.get('/stats/widget', dashboard_controller.get_widget_stats)` to `dashboard.routes.js`
- [ ] Query `exchange_configurations` for list of exchanges
- [ ] Aggregate `widget_trades` by exchange and time periods

### Frontend Widget (Separate Repository) - NOT STARTED

The frontend widget should be developed in a **separate repository** with the following structure:

```
widget-frontend/
├── src/
│   ├── components/       # UI components (Button, Input, etc.)
│   ├── features/         # Feature components (TradeForm, NewsDisplay)
│   ├── hooks/            # Custom hooks (useApi, useWebSocket)
│   ├── services/
│   │   ├── api.service.ts     # HTTP requests to backend
│   │   └── websocket.service.ts
│   ├── store/            # State management (Zustand)
│   ├── styles/           # Theme configuration
│   ├── types/            # TypeScript definitions
│   ├── main.tsx          # Entry point
│   └── widget.ts         # Public API (OurWidget.init())
├── vite.config.ts
└── package.json
```

**Frontend Tasks:**
- [ ] Set up React + Vite + TypeScript project
- [ ] Implement `OurWidget.init({ container, exchangeId, exchangeUserId })`
- [ ] Create WebSocket service for news streaming
- [ ] Create API service for trade token generation
- [ ] Build trading form component
- [ ] Build news display component
- [ ] Implement dynamic theming from config API
- [ ] Set up CI/CD for CDN deployment

---

## Backend Component Reference

### File Structure

```
app/
├── routes/
│   └── widget/
│       ├── widget.routes.js        # REST routes
│       ├── widget.controller.js    # REST controller
│       └── widget.service.js       # REST service
├── models/
│   ├── postgres/
│   │   └── widget.js               # PostgreSQL model
│   └── redis/
│       ├── widget_connection.js    # Connection tracking
│       └── trade_stats.js          # Trade statistics
└── websocket/
    └── widget/
        ├── widget.routes.js        # WebSocket setup
        └── widget.service.js       # WebSocket service
```

### Configuration

**File:** `config/_index.js`

```javascript
websocket: {
    widget: {
        enabled: false,
        redis_prefix: 'ws:rate-limit:widget:',
        connections_per_ip_per_minute: 20,
        max_concurrent_per_ip: 20,
        max_concurrent_per_user: 10,
        messages_per_second: 5,
        messages_per_minute: 60,
        auth_timeout_ms: 10000,
        interval: 30000,  // heartbeat interval
    }
}
```

---

## API Reference

### REST Endpoints

#### Generate Trade Token

```http
POST /api/app/widget/generate-trade-token
Content-Type: application/json

{
    "exchange_id": "blofin",
    "exchange_user_id": "user-uuid-here",
    "trade_params": {
        "coin": "BTC",
        "amount": 100,
        "side": "long",
        "news_id": "optional-news-id"
    }
}
```

**Response:**
```json
{
    "success": true,
    "data": {
        "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "trade_id": "uuid",
        "expires_in": 30
    },
    "message": "token generated successfully"
}
```

#### Get Widget Config

```http
GET /api/app/widget/config?id=blofin
```

**Response:**
```json
{
    "success": true,
    "data": {
        "exchange_id": "blofin",
        "display_name": "Blofin Exchange",
        "theme_config": {
            "primaryColor": "#3A86FF",
            "backgroundColor": "#121212"
        },
        "feature_flags": {
            "showPnl": true,
            "allowMarketOrders": true
        }
    }
}
```

### WebSocket Protocol

#### Connection URL
```
wss://api.247terminal.com/ws/widget
```

#### Authentication (Client → Server)
```json
{ "type": "auth", "api_key": "wk_live_xxxx" }
```

#### Auth Success (Server → Client)
```json
{ "type": "auth_success", "exchange_id": "blofin" }
```

#### Auth Error (Server → Client)
```json
{ "type": "auth_error", "error": "invalid api key", "code": 4002 }
```

#### News Broadcast (Server → Client)
```json
{
    "type": "news",
    "data": {
        "_id": "abc123",
        "title": "Bitcoin Surges Past $100K",
        "time": 1702400000000,
        "coins": ["BTC"]
    }
}
```

#### Ping/Pong
```
Client: "ping" or { "type": "ping" }
Server: "pong" or { "type": "pong" }
```

### WebSocket Close Codes

| Code | Name | Description |
|------|------|-------------|
| 4001 | AUTH_TIMEOUT | Client didn't authenticate within 10 seconds |
| 4002 | AUTH_FAILED | Invalid or missing API key |
| 4003 | EXCHANGE_INACTIVE | Exchange is disabled |
| 4004 | RATE_LIMIT_CONNECTIONS | Too many connections for this exchange |
| 4006 | RATE_LIMIT_MESSAGES | Too many messages per minute |
| 4008 | ORIGIN_NOT_ALLOWED | Connection from unauthorized origin |

---

## Testing Checklist

### Database Tests
```bash
# Verify tables exist
psql -c "SELECT * FROM exchange_configurations LIMIT 1;"
psql -c "SELECT * FROM widget_trades LIMIT 1;"

# Check test exchange
psql -c "SELECT exchange_id, api_key, display_name FROM exchange_configurations WHERE exchange_id = 'test_exchange';"
```

### REST API Tests
```bash
# Test config endpoint
curl "http://localhost:3000/api/app/widget/config?id=test_exchange"

# Test trade token generation
curl -X POST "http://localhost:3000/api/app/widget/generate-trade-token" \
  -H "Content-Type: application/json" \
  -d '{
    "exchange_id": "test_exchange",
    "exchange_user_id": "user123",
    "trade_params": {
        "coin": "BTC",
        "amount": 100,
        "side": "long"
    }
  }'
```

### WebSocket Tests
```javascript
// Browser console or Node.js
const ws = new WebSocket('ws://localhost:3000/ws/widget');

ws.onopen = () => {
    console.log('Connected');
    ws.send(JSON.stringify({ type: 'auth', api_key: 'wk_test_abc123def456' }));
};

ws.onmessage = (e) => {
    console.log('Received:', JSON.parse(e.data));
};

ws.onerror = (e) => console.error('Error:', e);
ws.onclose = (e) => console.log('Closed:', e.code, e.reason);
```

### News Broadcasting Test
```bash
# Publish test news to Redis (will be broadcast to widget clients)
redis-cli PUBLISH news-feed '{"_id":"test123","title":"Test News","time":1702400000000}'
```

### Example Test Output

**Terminal 1:** Widget connection test
```bash
node scripts/test_widget_connection.js
```

**Terminal 2:** Publish test news (after connection is authenticated)
```bash
node scripts/test_publish_news.js
```

**Expected Output:**
```
[2025-12-18T06:03:26.648Z] 📘 === Widget WebSocket Test Client ===
[2025-12-18T06:03:26.650Z] 📘 URL: ws://localhost:3000/ws/widget
[2025-12-18T06:03:26.650Z] 📘 API Key: wk_test_abc123def456
[2025-12-18T06:03:26.650Z] 📘 Press Ctrl+C to exit

[2025-12-18T06:03:26.650Z] 📘 Connecting to ws://localhost:3000/ws/widget...
[2025-12-18T06:03:26.659Z] ✅ Connection opened
[2025-12-18T06:03:26.659Z] 📤 Sending auth message
{
  "type": "auth",
  "api_key": "wk_test_abc123def456"
}
[2025-12-18T06:03:26.731Z] 📥 Received message (type: auth_success)
{
  "type": "auth_success",
  "exchange_id": "test_exchange"
}
[2025-12-18T06:03:39.593Z] 📥 Received message (type: news)
{
  "type": "news",
  "data": {
    "_id": "test_1766037819580",
    "type": "news",
    "title": "Test News Item - Widget Pipeline Test",
    "content": "This is a test news item to verify the widget broadcast pipeline is working correctly.",
    "source": "test_script",
    "timestamp": "2025-12-18T06:03:39.580Z",
    "coins": [
      "BTC",
      "ETH"
    ],
    "sentiment": "neutral"
  }
}
[2025-12-18T06:03:51.657Z] 🏓 Sending ping
[2025-12-18T06:03:51.658Z] 🏓 Received pong
[2025-12-18T06:04:16.659Z] 🏓 Sending ping
[2025-12-18T06:04:16.660Z] 🏓 Received pong
```

