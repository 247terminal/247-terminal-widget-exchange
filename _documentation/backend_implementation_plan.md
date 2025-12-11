# Secure Trading Widget: Backend Implementation Plan

This document outlines the specific backend tasks required to support the secure, multi-tenant trading widget.

## 1. Core Trade Token API

The central component of the backend is the secure endpoint for issuing one-time trade tokens.

-   **Create New Route:** `POST /api/app/widget/generate-trade-token`
-   **Authentication:** Requires session/auth middleware.
-   **Components:**
    -   `widget.controller.js`: Handle request/response, validation.
    -   `widget.service.js`: Business logic, JWT generation.
    -   `widget.js` (Model): Database interactions.

## 2. Dynamic Configuration API

-   **Create New Route:** `GET /api/app/widget/config`
-   **Query Parameter:** `id`
-   **Authentication:** Public.
-   **Logic:** Return theme config and feature flags based on exchange ID. Implement caching.

## 3. Database Schema

### `exchange_configurations`
- `exchange_id` (PK, VARCHAR)
- `secret_signing_key` (VARCHAR)
- `theme_config` (JSONB)
- `feature_flags` (JSONB)
- `is_active` (BOOLEAN)

### `widget_trades`
- `trade_id` (PK, UUID)
- `exchange_id` (FK, VARCHAR)
- `exchange_user_id` (VARCHAR)
- `trade_params` (JSONB)
- `status` (VARCHAR)
- `created_at` (TIMESTAMP)

---

# Detailed Implementation Steps

## Phase 1: Database Foundation

### Task 1: Migration File (`migrations/006_create_widget_tables.sql`)

```sqlcan y
CREATE TABLE exchange_configurations (
    exchange_id VARCHAR(255) PRIMARY KEY,
    secret_signing_key VARCHAR(255) NOT NULL,
    theme_config JSONB DEFAULT '{}'::jsonb,
    feature_flags JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE widget_trades (
    trade_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exchange_id VARCHAR(255) NOT NULL REFERENCES exchange_configurations(exchange_id),
    exchange_user_id VARCHAR(255) NOT NULL,
    trade_params JSONB NOT NULL,
    status VARCHAR(50) DEFAULT 'initiated',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_widget_trades_exchange_id ON widget_trades(exchange_id);
```

## Phase 2: Application Structure

### Task 2: Create Files
- `app/routes/widget/widget.routes.js`
- `app/routes/widget/widget.controller.js`
- `app/routes/widget/widget.service.js`
- `app/models/postgres/widget.js`

### Task 3: Mount Routes (`app/routes/index.js`)

```javascript
import widget_routes from './widget/widget.routes.js';
// ...
router.use(config.api.prefix + '/widget', widget_routes);
```

## Phase 3: Secure Trade Token Endpoint

### Task 4: Widget Model (`app/models/postgres/widget.js`)

```javascript
import { postgres } from '#config/postgres.js';
import { postgres_logger as logger } from '#config/logger.js';

export class widget_model {
    static async get_exchange_config(exchange_id) {
        try {
            const query = 'SELECT * FROM exchange_configurations WHERE exchange_id = $1 AND is_active = true';
            const result = await postgres.pool.query(query, [exchange_id]);
            return result.rows[0];
        } catch (error) {
            logger.error({ operation: 'get_exchange_config', error: error.message }, 'widget_model: error');
            throw error;
        }
    }

    static async create_trade_log({ exchange_id, exchange_user_id, trade_params }) {
        try {
            const query = `
                INSERT INTO widget_trades (exchange_id, exchange_user_id, trade_params, status)
                VALUES ($1, $2, $3, 'initiated')
                RETURNING trade_id
            `;
            const values = [exchange_id, exchange_user_id, trade_params];
            const result = await postgres.pool.query(query, values);
            return result.rows[0].trade_id;
        } catch (error) {
            logger.error({ operation: 'create_trade_log', error: error.message }, 'widget_model: error');
            throw error;
        }
    }
}
```

### Task 5: Widget Service (`app/routes/widget/widget.service.js`)

```javascript
import jwt from 'jsonwebtoken';
import { widget_model } from '#models/postgres/widget.js';
import { logger } from '#config/logger.js';

export const widget_service = {
    async create_signed_token({ exchange_id, exchange_user_id, trade_params }) {
        const exchange_config = await widget_model.get_exchange_config(exchange_id);
        
        if (!exchange_config) {
            throw new Error('invalid or inactive exchange id');
        }

        const { secret_signing_key } = exchange_config;

        await widget_model.create_trade_log({
            exchange_id,
            exchange_user_id,
            trade_params
        });

        const payload = {
            ...trade_params,
            user_id: exchange_user_id,
            exp: Math.floor(Date.now() / 1000) + 10,
        };

        return jwt.sign(payload, secret_signing_key);
    }
};
```

### Task 6: Widget Controller (`app/routes/widget/widget.controller.js`)

```javascript
import { widget_service } from './widget.service.js';
import { success_response, error_response } from '#utils/response.js';
import { logger } from '#config/logger.js';

export const widget_controller = {
    async generate_trade_token(req, res, next) {
        try {
            const { exchange_id, exchange_user_id, trade_params } = req.body;

            if (!exchange_id || !exchange_user_id || !trade_params) {
                return error_response(res, 'missing required fields', 400);
            }

            const token = await widget_service.create_signed_token({
                exchange_id,
                exchange_user_id,
                trade_params
            });

            success_response(res, { token }, 'token generated successfully');

        } catch (error) {
            logger.error({ operation: 'generate_trade_token', error: error.message }, 'widget_controller: error');
            if (error.message === 'invalid or inactive exchange id') {
                return error_response(res, error.message, 400);
            }
            next(error);
        }
    }
};
```

### Task 7: Widget Routes (`app/routes/widget/widget.routes.js`)

```javascript
import express from 'express';
import { widget_controller } from './widget.controller.js';
// import { auth_middleware } from '#middleware/auth.js';

const router = express.Router();

router.post(
    '/generate-trade-token',
    // auth_middleware,
    widget_controller.generate_trade_token
);

export default router;
```

---

## Phase 4: Widget News WebSocket

The widget requires a dedicated WebSocket endpoint for streaming news to exchange users.

### Understanding the Two Keys

| Key | Purpose | Where Used | Who Knows It |
|-----|---------|------------|--------------|
| **`api_key`** | Identifies the exchange for WebSocket auth & rate limiting | Widget frontend → WebSocket connection | Public (in frontend code) |
| **`secret_signing_key`** | Cryptographically signs trade tokens (JWT) | Backend only → signs JWTs that exchange verifies | Only our backend + exchange backend |

### News Flow (uses `api_key`)

```
┌─────────────────┐         ┌─────────────────┐
│  Widget         │         │  Our Backend    │
│  (has api_key)  │────────>│  Validates key  │
│                 │<────────│  Streams news   │
└─────────────────┘         └─────────────────┘
```

### Trade Flow (uses `secret_signing_key`)

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│  Widget         │         │  Our Backend    │         │  Exchange       │
│                 │────────>│  Signs JWT with │────────>│  Verifies JWT   │
│                 │         │  secret_signing │         │  with same key  │
└─────────────────┘         │  _key           │         └─────────────────┘
                            └─────────────────┘
```

### Task 8: Database Schema Update

Add `api_key` column to `exchange_configurations` table:

```sql
ALTER TABLE exchange_configurations
ADD COLUMN api_key VARCHAR(64) UNIQUE NOT NULL,
ADD COLUMN rate_limit_connections INTEGER DEFAULT 10000,
ADD COLUMN rate_limit_messages_per_minute INTEGER DEFAULT 100;

CREATE INDEX idx_exchange_configurations_api_key ON exchange_configurations(api_key);
```

### Task 9: Widget WebSocket Service (`app/websocket/widget/widget.service.js`)

Create a new WebSocket service for the widget news feed:

- **Endpoint:** `/ws/widget`
- **Authentication:** API key based (validates against `exchange_configurations.api_key`)
- **No license key required** - This is different from the main news WebSocket

#### Authentication Flow

```
Widget                               Backend
   │                                   │
   │  WebSocket connect                │
   ├──────────────────────────────────>│
   │                                   │
   │  Send: { type: "auth",            │
   │          api_key: "exch_..." }    │
   ├──────────────────────────────────>│
   │                                   │
   │                    1. Validate api_key exists
   │                    2. Get exchange_id from key
   │                    3. Check exchange is_active
   │                    4. Check rate limits
   │                    5. Log connection
   │                                   │
   │  Receive: { type: "authorized",   │
   │             exchange_id: "blofin" }│
   │<──────────────────────────────────┤
   │                                   │
   │  News broadcasts begin            │
   │<══════════════════════════════════│
```

### Task 10: Rate Limiting Strategy

Each widget instance creates its own WebSocket connection. With many exchanges and users, this can scale to thousands of concurrent connections.

#### Rate Limits (stored per exchange in Redis)

```javascript
const default_rate_limits = {
    max_connections_per_exchange: 10000,   // Total concurrent connections for this exchange
    max_connections_per_ip: 5,             // Prevent single IP abuse
    messages_per_minute_per_connection: 60 // Client-to-server messages (pings, etc.)
};
```

#### Redis Keys Structure

```
widget:connections:{exchange_id}              // SET of socket_ids
widget:connections:{exchange_id}:count        // INT connection count
widget:connections:ip:{ip_address}            // INT connections from this IP
widget:rate:{exchange_id}:minute:{timestamp}  // INT messages this minute
```

#### Implementation Notes

1. **On Connection:**
   - Validate `api_key` → get `exchange_id`
   - Check `widget:connections:{exchange_id}:count` < `rate_limit_connections`
   - Check `widget:connections:ip:{ip}` < `max_connections_per_ip`
   - Increment counters, add to connection set
   - Return `{ type: "authorized", exchange_id }` or close with 4008

2. **On Disconnect:**
   - Decrement counters
   - Remove from connection set

3. **On Message (client → server):**
   - Check message rate limit
   - Handle ping/pong for keepalive

4. **Broadcasting:**
   - Use existing `news_broadcaster` pattern
   - Broadcast to all connected widget clients (same as news WebSocket)

### Task 11: Widget WebSocket Auth Middleware

Create `app/websocket/widget/auth.middleware.js`:

```javascript
import { widget_model } from '#models/postgres/widget.js';
import { logger } from '#config/logger.js';

export const widget_websocket_auth = {
    async validate_api_key(api_key) {
        if (!api_key) {
            return { success: false, error: 'api_key required' };
        }

        const exchange_config = await widget_model.get_exchange_by_api_key(api_key);

        if (!exchange_config) {
            return { success: false, error: 'invalid api_key' };
        }

        if (!exchange_config.is_active) {
            return { success: false, error: 'exchange inactive' };
        }

        return {
            success: true,
            exchange_id: exchange_config.exchange_id,
            rate_limits: {
                max_connections: exchange_config.rate_limit_connections,
                messages_per_minute: exchange_config.rate_limit_messages_per_minute
            }
        };
    }
};
```

### Task 12: Add Model Method for API Key Lookup

Add to `app/models/postgres/widget.js`:

```javascript
static async get_exchange_by_api_key(api_key) {
    try {
        const query = 'SELECT * FROM exchange_configurations WHERE api_key = $1';
        const result = await postgres.pool.query(query, [api_key]);
        return result.rows[0];
    } catch (error) {
        logger.error({ operation: 'get_exchange_by_api_key', error: error.message }, 'widget_model: error');
        throw error;
    }
}
```

---

## Summary: Key Differences from Main News WebSocket

| Aspect | Main News WebSocket (`/ws/news`) | Widget WebSocket (`/ws/widget`) |
|--------|----------------------------------|--------------------------------|
| **Auth** | License key + session token | API key only |
| **Users** | 247 Terminal subscribers | Exchange website visitors |
| **Rate limit by** | User ID | Exchange ID + IP |
| **Connection scale** | Hundreds | Potentially thousands per exchange |
| **Purpose** | Premium feature for subscribers | Service for exchange partners |