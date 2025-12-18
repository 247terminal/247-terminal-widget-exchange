# Secure Trading Widget: Backend Implementation Plan

This document outlines the backend tasks required to support the secure, multi-tenant trading widget.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Database Schema](#database-schema)
3. [Phase 1: Database Foundation](#phase-1-database-foundation)
4. [Phase 2: Application Structure](#phase-2-application-structure)
5. [Phase 3: Trade Token API](#phase-3-trade-token-api)
6. [Phase 4: Widget WebSocket](#phase-4-widget-websocket)
7. [Phase 5: Configuration API](#phase-5-configuration-api)
8. [Security Considerations](#security-considerations)
9. [Monitoring & Observability](#monitoring--observability)
10. [Environment Configuration](#environment-configuration)

---

## Architecture Overview

### System Components

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
                                │ Trade Request         │ WebSocket
                                │ (with JWT)            │ Connection
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

### Understanding the Two Keys

| Key | Purpose | Visibility | Used By |
|-----|---------|------------|---------|
| **`api_key`** | Identifies exchange for WebSocket auth & rate limiting | Public (embedded in widget) | Widget → Our Backend |
| **`secret_signing_key`** | Cryptographically signs trade JWTs | Private (never exposed to frontend) | Our Backend → Exchange Backend |

**Why two keys?**
- `api_key` can be safely exposed in frontend code - it only grants access to news streaming
- `secret_signing_key` must remain secret - it proves trade requests are authentic

---

## Database Schema

### `exchange_configurations`

Primary table storing exchange partner configurations.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `exchange_id` | VARCHAR(255) | PRIMARY KEY | Unique identifier (e.g., "blofin", "bybit") |
| `api_key` | VARCHAR(64) | UNIQUE, NOT NULL | Public key for WebSocket auth (format: `wk_live_xxxx`) |
| `secret_signing_key` | VARCHAR(255) | NOT NULL | Private key for JWT signing |
| `display_name` | VARCHAR(255) | | Human-readable name |
| `theme_config` | JSONB | DEFAULT '{}' | Widget theming options |
| `feature_flags` | JSONB | DEFAULT '{}' | Feature toggles |
| `allowed_origins` | TEXT[] | DEFAULT '{}' | CORS allowed origins |
| `rate_limit_connections` | INTEGER | DEFAULT 10000 | Max concurrent WebSocket connections |
| `rate_limit_messages_per_minute` | INTEGER | DEFAULT 60 | Max client→server messages per minute |
| `is_active` | BOOLEAN | DEFAULT true | Whether exchange is enabled |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | |

### `widget_trades`

Audit log of all trade token requests.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `trade_id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique trade identifier |
| `exchange_id` | VARCHAR(255) | FK → exchange_configurations | Originating exchange |
| `exchange_user_id` | VARCHAR(255) | NOT NULL | User ID from exchange |
| `trade_params` | JSONB | NOT NULL | Trade details (coin, amount, side) |
| `status` | VARCHAR(50) | DEFAULT 'initiated' | Trade status |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | |

### `widget_connection_logs` (Optional - for analytics)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `log_id` | UUID | PRIMARY KEY | |
| `exchange_id` | VARCHAR(255) | FK | |
| `client_ip` | INET | | Anonymized IP |
| `connected_at` | TIMESTAMPTZ | | |
| `disconnected_at` | TIMESTAMPTZ | | |
| `disconnect_reason` | VARCHAR(100) | | |

---

## Phase 1: Database Foundation

### Task 1: Migration File

**File:** `migrations/XXX_create_widget_tables.sql`

```sql
-- Exchange configurations table
CREATE TABLE exchange_configurations (
    exchange_id VARCHAR(255) PRIMARY KEY,
    api_key VARCHAR(64) UNIQUE NOT NULL,
    secret_signing_key VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    theme_config JSONB DEFAULT '{}'::jsonb,
    feature_flags JSONB DEFAULT '{}'::jsonb,
    allowed_origins TEXT[] DEFAULT '{}',
    rate_limit_connections INTEGER DEFAULT 10000,
    rate_limit_messages_per_minute INTEGER DEFAULT 60,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Widget trades audit log
CREATE TABLE widget_trades (
    trade_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exchange_id VARCHAR(255) NOT NULL REFERENCES exchange_configurations(exchange_id),
    exchange_user_id VARCHAR(255) NOT NULL,
    trade_params JSONB NOT NULL,
    status VARCHAR(50) DEFAULT 'initiated',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_exchange_configurations_api_key ON exchange_configurations(api_key);
CREATE INDEX idx_widget_trades_exchange_id ON widget_trades(exchange_id);
CREATE INDEX idx_widget_trades_created_at ON widget_trades(created_at);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_exchange_configurations_updated_at
    BEFORE UPDATE ON exchange_configurations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

### Task 2: Seed Test Exchange (Development)

```sql
INSERT INTO exchange_configurations (
    exchange_id,
    api_key,
    secret_signing_key,
    display_name,
    allowed_origins,
    is_active
) VALUES (
    'test_exchange',
    'wk_test_abc123def456',
    'sk_test_super_secret_key_for_jwt_signing',
    'Test Exchange',
    ARRAY['http://localhost:5173', 'http://localhost:3000'],
    true
);
```

---

## Phase 2: Application Structure

### Task 3: Create File Structure

```
app/
├── routes/
│   └── widget/
│       ├── widget.routes.js
│       ├── widget.controller.js
│       └── widget.service.js
├── models/
│   └── postgres/
│       └── widget.js
└── websocket/
    └── widget/
        ├── widget.websocket.js
        ├── widget.connection_manager.js
        └── widget.rate_limiter.js
```

### Task 4: Mount Routes

**File:** `app/routes/index.js`

```javascript
import widget_routes from './widget/widget.routes.js';

// ... existing routes ...

router.use(config.api.prefix + '/widget', widget_routes);
```

---

## Phase 3: Trade Token API

### Task 5: Widget Model

**File:** `app/models/postgres/widget.js`

```javascript
import { postgres } from '#config/postgres.js';
import { postgres_logger as logger } from '#config/logger.js';

export class widget_model {
    static async get_exchange_config(exchange_id) {
        try {
            const query = `
                SELECT * FROM exchange_configurations
                WHERE exchange_id = $1 AND is_active = true
            `;
            const result = await postgres.pool.query(query, [exchange_id]);
            return result.rows[0];
        } catch (error) {
            logger.error({ operation: 'get_exchange_config', error: error.message }, 'widget_model: error');
            throw error;
        }
    }

    static async get_exchange_by_api_key(api_key) {
        try {
            const query = `
                SELECT * FROM exchange_configurations
                WHERE api_key = $1
            `;
            const result = await postgres.pool.query(query, [api_key]);
            return result.rows[0];
        } catch (error) {
            logger.error({ operation: 'get_exchange_by_api_key', error: error.message }, 'widget_model: error');
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

    static async update_trade_status(trade_id, status) {
        try {
            const query = `
                UPDATE widget_trades
                SET status = $2
                WHERE trade_id = $1
            `;
            await postgres.pool.query(query, [trade_id, status]);
        } catch (error) {
            logger.error({ operation: 'update_trade_status', error: error.message }, 'widget_model: error');
            throw error;
        }
    }
}
```

### Task 6: Widget Service

**File:** `app/routes/widget/widget.service.js`

```javascript
import jwt from 'jsonwebtoken';
import { widget_model } from '#models/postgres/widget.js';
import { logger } from '#config/logger.js';

const TOKEN_EXPIRY_SECONDS = 30; // Short-lived for security

export const widget_service = {
    async create_signed_token({ exchange_id, exchange_user_id, trade_params }) {
        const exchange_config = await widget_model.get_exchange_config(exchange_id);

        if (!exchange_config) {
            const error = new Error('invalid or inactive exchange id');
            error.code = 'INVALID_EXCHANGE';
            throw error;
        }

        const { secret_signing_key } = exchange_config;

        // Validate trade_params structure
        if (!trade_params.coin || !trade_params.amount || !trade_params.side) {
            const error = new Error('invalid trade parameters');
            error.code = 'INVALID_TRADE_PARAMS';
            throw error;
        }

        if (!['long', 'short'].includes(trade_params.side)) {
            const error = new Error('side must be long or short');
            error.code = 'INVALID_TRADE_PARAMS';
            throw error;
        }

        if (typeof trade_params.amount !== 'number' || trade_params.amount <= 0) {
            const error = new Error('amount must be a positive number');
            error.code = 'INVALID_TRADE_PARAMS';
            throw error;
        }

        // Log the trade request
        const trade_id = await widget_model.create_trade_log({
            exchange_id,
            exchange_user_id,
            trade_params
        });

        // Create JWT payload
        const payload = {
            trade_id,
            exchange_id,
            user_id: exchange_user_id,
            coin: trade_params.coin,
            amount: trade_params.amount,
            side: trade_params.side,
            news_id: trade_params.news_id || null,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + TOKEN_EXPIRY_SECONDS,
        };

        return {
            token: jwt.sign(payload, secret_signing_key),
            trade_id,
            expires_in: TOKEN_EXPIRY_SECONDS
        };
    },

    async get_config(exchange_id) {
        const exchange_config = await widget_model.get_exchange_config(exchange_id);

        if (!exchange_config) {
            return null;
        }

        // Return only public configuration
        return {
            exchange_id: exchange_config.exchange_id,
            display_name: exchange_config.display_name,
            theme_config: exchange_config.theme_config,
            feature_flags: exchange_config.feature_flags
        };
    }
};
```

### Task 7: Widget Controller

**File:** `app/routes/widget/widget.controller.js`

```javascript
import { widget_service } from './widget.service.js';
import { success_response, error_response } from '#utils/response.js';
import { logger } from '#config/logger.js';

export const widget_controller = {
    async generate_trade_token(req, res, next) {
        try {
            const { exchange_id, exchange_user_id, trade_params } = req.body;

            // Validate required fields
            if (!exchange_id) {
                return error_response(res, 'exchange_id is required', 400);
            }
            if (!exchange_user_id) {
                return error_response(res, 'exchange_user_id is required', 400);
            }
            if (!trade_params || typeof trade_params !== 'object') {
                return error_response(res, 'trade_params object is required', 400);
            }

            const result = await widget_service.create_signed_token({
                exchange_id,
                exchange_user_id,
                trade_params
            });

            logger.info({
                exchange_id,
                trade_id: result.trade_id,
                coin: trade_params.coin,
                side: trade_params.side
            }, 'widget: trade token generated');

            success_response(res, result, 'token generated successfully');

        } catch (error) {
            logger.error({
                operation: 'generate_trade_token',
                error: error.message,
                code: error.code
            }, 'widget_controller: error');

            if (error.code === 'INVALID_EXCHANGE') {
                return error_response(res, error.message, 400);
            }
            if (error.code === 'INVALID_TRADE_PARAMS') {
                return error_response(res, error.message, 400);
            }
            next(error);
        }
    },

    async get_config(req, res, next) {
        try {
            const { id } = req.query;

            if (!id) {
                return error_response(res, 'exchange id query parameter is required', 400);
            }

            const config = await widget_service.get_config(id);

            if (!config) {
                return error_response(res, 'exchange not found', 404);
            }

            success_response(res, config);

        } catch (error) {
            logger.error({ operation: 'get_config', error: error.message }, 'widget_controller: error');
            next(error);
        }
    }
};
```

### Task 8: Widget Routes

**File:** `app/routes/widget/widget.routes.js`

```javascript
import express from 'express';
import { widget_controller } from './widget.controller.js';

const router = express.Router();

// Trade token generation - requires exchange backend auth
router.post('/generate-trade-token', widget_controller.generate_trade_token);

// Public config endpoint - cached
router.get('/config', widget_controller.get_config);

export default router;
```

---

## Phase 4: Widget WebSocket

### WebSocket Message Types

#### Client → Server Messages

| Type | Payload | Description |
|------|---------|-------------|
| `auth` | `{ api_key: string }` | Initial authentication |
| `ping` | `{}` | Keepalive ping |

#### Server → Client Messages

| Type | Payload | Description |
|------|---------|-------------|
| `auth_success` | `{ exchange_id: string }` | Authentication successful |
| `auth_error` | `{ error: string, code: number }` | Authentication failed |
| `news` | `NewsItem` | New news item |
| `pong` | `{}` | Keepalive response |
| `error` | `{ error: string, code: number }` | General error |

### WebSocket Close Codes

| Code | Name | Description |
|------|------|-------------|
| 4001 | `AUTH_TIMEOUT` | Client didn't authenticate within 10 seconds |
| 4002 | `AUTH_FAILED` | Invalid or missing API key |
| 4003 | `EXCHANGE_INACTIVE` | Exchange is disabled |
| 4004 | `RATE_LIMIT_CONNECTIONS` | Too many connections for this exchange |
| 4005 | `RATE_LIMIT_IP` | Too many connections from this IP |
| 4006 | `RATE_LIMIT_MESSAGES` | Too many messages per minute |
| 4007 | `INVALID_MESSAGE` | Malformed message received |
| 4008 | `ORIGIN_NOT_ALLOWED` | Connection from unauthorized origin |
| 4009 | `SERVER_SHUTDOWN` | Server is shutting down gracefully |

### Task 9: Connection Manager

**File:** `app/websocket/widget/widget.connection_manager.js`

```javascript
import { redis } from '#config/redis.js';
import { logger } from '#config/logger.js';

const REDIS_PREFIX = 'widget';
const CONNECTION_TTL = 86400; // 24 hours

export const widget_connection_manager = {
    connections: new Map(), // socket_id -> { socket, exchange_id, ip, connected_at }

    async add_connection(socket_id, exchange_id, ip, socket) {
        this.connections.set(socket_id, {
            socket,
            exchange_id,
            ip,
            connected_at: Date.now()
        });

        const pipeline = redis.client.multi();

        // Add to exchange connection set
        pipeline.sadd(`${REDIS_PREFIX}:connections:${exchange_id}`, socket_id);
        pipeline.expire(`${REDIS_PREFIX}:connections:${exchange_id}`, CONNECTION_TTL);

        // Increment exchange connection count
        pipeline.incr(`${REDIS_PREFIX}:connections:${exchange_id}:count`);
        pipeline.expire(`${REDIS_PREFIX}:connections:${exchange_id}:count`, CONNECTION_TTL);

        // Increment IP connection count
        pipeline.incr(`${REDIS_PREFIX}:connections:ip:${ip}`);
        pipeline.expire(`${REDIS_PREFIX}:connections:ip:${ip}`, CONNECTION_TTL);

        await pipeline.exec();

        logger.debug({ socket_id, exchange_id, ip }, 'widget_connection_manager: connection added');
    },

    async remove_connection(socket_id) {
        const connection = this.connections.get(socket_id);
        if (!connection) return;

        const { exchange_id, ip } = connection;
        this.connections.delete(socket_id);

        const pipeline = redis.client.multi();

        pipeline.srem(`${REDIS_PREFIX}:connections:${exchange_id}`, socket_id);
        pipeline.decr(`${REDIS_PREFIX}:connections:${exchange_id}:count`);
        pipeline.decr(`${REDIS_PREFIX}:connections:ip:${ip}`);

        await pipeline.exec();

        logger.debug({ socket_id, exchange_id }, 'widget_connection_manager: connection removed');
    },

    async get_exchange_connection_count(exchange_id) {
        const count = await redis.client.get(`${REDIS_PREFIX}:connections:${exchange_id}:count`);
        return parseInt(count || '0', 10);
    },

    async get_ip_connection_count(ip) {
        const count = await redis.client.get(`${REDIS_PREFIX}:connections:ip:${ip}`);
        return parseInt(count || '0', 10);
    },

    get_connections_for_exchange(exchange_id) {
        const result = [];
        for (const [socket_id, conn] of this.connections) {
            if (conn.exchange_id === exchange_id) {
                result.push({ socket_id, ...conn });
            }
        }
        return result;
    },

    get_all_connections() {
        return Array.from(this.connections.values());
    },

    broadcast_to_all(message) {
        const payload = JSON.stringify(message);
        let sent = 0;

        for (const [socket_id, conn] of this.connections) {
            try {
                if (conn.socket.readyState === 1) { // WebSocket.OPEN
                    conn.socket.send(payload);
                    sent++;
                }
            } catch (error) {
                logger.error({ socket_id, error: error.message }, 'widget_connection_manager: broadcast error');
            }
        }

        return sent;
    },

    broadcast_to_exchange(exchange_id, message) {
        const payload = JSON.stringify(message);
        let sent = 0;

        for (const [socket_id, conn] of this.connections) {
            if (conn.exchange_id === exchange_id) {
                try {
                    if (conn.socket.readyState === 1) {
                        conn.socket.send(payload);
                        sent++;
                    }
                } catch (error) {
                    logger.error({ socket_id, error: error.message }, 'widget_connection_manager: broadcast error');
                }
            }
        }

        return sent;
    },

    async graceful_shutdown() {
        logger.info({ connection_count: this.connections.size }, 'widget_connection_manager: initiating graceful shutdown');

        const close_message = JSON.stringify({
            type: 'error',
            error: 'server shutting down',
            code: 4009
        });

        for (const [socket_id, conn] of this.connections) {
            try {
                conn.socket.send(close_message);
                conn.socket.close(4009, 'Server shutdown');
            } catch (error) {
                // Ignore errors during shutdown
            }
        }

        this.connections.clear();
    }
};
```

### Task 10: Rate Limiter

**File:** `app/websocket/widget/widget.rate_limiter.js`

```javascript
import { redis } from '#config/redis.js';
import { widget_connection_manager } from './widget.connection_manager.js';

const DEFAULT_LIMITS = {
    max_connections_per_exchange: 10000,
    max_connections_per_ip: 10,
    messages_per_minute: 60
};

export const widget_rate_limiter = {
    async check_connection_limits(exchange_id, ip, exchange_limits = {}) {
        const limits = { ...DEFAULT_LIMITS, ...exchange_limits };

        // Check exchange connection limit
        const exchange_count = await widget_connection_manager.get_exchange_connection_count(exchange_id);
        if (exchange_count >= limits.max_connections_per_exchange) {
            return { allowed: false, code: 4004, reason: 'exchange connection limit reached' };
        }

        // Check IP connection limit
        const ip_count = await widget_connection_manager.get_ip_connection_count(ip);
        if (ip_count >= limits.max_connections_per_ip) {
            return { allowed: false, code: 4005, reason: 'ip connection limit reached' };
        }

        return { allowed: true };
    },

    async check_message_rate(socket_id, exchange_id, limit = DEFAULT_LIMITS.messages_per_minute) {
        const minute_key = `widget:rate:${socket_id}:${Math.floor(Date.now() / 60000)}`;

        const count = await redis.client.incr(minute_key);
        if (count === 1) {
            await redis.client.expire(minute_key, 60);
        }

        if (count > limit) {
            return { allowed: false, code: 4006, reason: 'message rate limit exceeded' };
        }

        return { allowed: true };
    }
};
```

### Task 11: WebSocket Handler

**File:** `app/websocket/widget/widget.websocket.js`

```javascript
import { WebSocketServer } from 'ws';
import { widget_model } from '#models/postgres/widget.js';
import { widget_connection_manager } from './widget.connection_manager.js';
import { widget_rate_limiter } from './widget.rate_limiter.js';
import { logger } from '#config/logger.js';

const AUTH_TIMEOUT_MS = 10000; // 10 seconds to authenticate
const HEARTBEAT_INTERVAL_MS = 30000; // 30 seconds

export function setup_widget_websocket(server) {
    const wss = new WebSocketServer({
        server,
        path: '/ws/widget',
        maxPayload: 1024 // 1KB max message size
    });

    wss.on('connection', (socket, req) => {
        const socket_id = generate_socket_id();
        const ip = get_client_ip(req);
        let exchange_id = null;
        let is_authenticated = false;
        let auth_timeout = null;
        let heartbeat_interval = null;

        logger.debug({ socket_id, ip }, 'widget_websocket: new connection');

        // Set auth timeout
        auth_timeout = setTimeout(() => {
            if (!is_authenticated) {
                send_error(socket, 'authentication timeout', 4001);
                socket.close(4001, 'Auth timeout');
            }
        }, AUTH_TIMEOUT_MS);

        socket.on('message', async (data) => {
            try {
                const message = JSON.parse(data.toString());

                if (!is_authenticated) {
                    await handle_auth(message);
                } else {
                    await handle_message(message);
                }
            } catch (error) {
                logger.error({ socket_id, error: error.message }, 'widget_websocket: message error');
                send_error(socket, 'invalid message format', 4007);
            }
        });

        socket.on('close', async (code, reason) => {
            cleanup();
            if (is_authenticated) {
                await widget_connection_manager.remove_connection(socket_id);
            }
            logger.debug({ socket_id, exchange_id, code }, 'widget_websocket: connection closed');
        });

        socket.on('error', (error) => {
            logger.error({ socket_id, error: error.message }, 'widget_websocket: socket error');
        });

        async function handle_auth(message) {
            if (message.type !== 'auth' || !message.api_key) {
                send_error(socket, 'invalid auth message', 4002);
                socket.close(4002, 'Invalid auth');
                return;
            }

            // Validate API key
            const exchange_config = await widget_model.get_exchange_by_api_key(message.api_key);

            if (!exchange_config) {
                send_error(socket, 'invalid api key', 4002);
                socket.close(4002, 'Invalid API key');
                return;
            }

            if (!exchange_config.is_active) {
                send_error(socket, 'exchange inactive', 4003);
                socket.close(4003, 'Exchange inactive');
                return;
            }

            // Check origin if configured
            const origin = req.headers.origin;
            if (exchange_config.allowed_origins?.length > 0 && origin) {
                if (!exchange_config.allowed_origins.includes(origin)) {
                    send_error(socket, 'origin not allowed', 4008);
                    socket.close(4008, 'Origin not allowed');
                    return;
                }
            }

            // Check rate limits
            const rate_check = await widget_rate_limiter.check_connection_limits(
                exchange_config.exchange_id,
                ip,
                {
                    max_connections_per_exchange: exchange_config.rate_limit_connections,
                }
            );

            if (!rate_check.allowed) {
                send_error(socket, rate_check.reason, rate_check.code);
                socket.close(rate_check.code, rate_check.reason);
                return;
            }

            // Authentication successful
            clearTimeout(auth_timeout);
            is_authenticated = true;
            exchange_id = exchange_config.exchange_id;

            await widget_connection_manager.add_connection(socket_id, exchange_id, ip, socket);

            // Start heartbeat
            heartbeat_interval = setInterval(() => {
                if (socket.readyState === 1) {
                    socket.ping();
                }
            }, HEARTBEAT_INTERVAL_MS);

            socket.send(JSON.stringify({
                type: 'auth_success',
                exchange_id: exchange_id
            }));

            logger.info({ socket_id, exchange_id, ip }, 'widget_websocket: authenticated');
        }

        async function handle_message(message) {
            // Check message rate limit
            const rate_check = await widget_rate_limiter.check_message_rate(socket_id, exchange_id);
            if (!rate_check.allowed) {
                send_error(socket, rate_check.reason, rate_check.code);
                return;
            }

            switch (message.type) {
                case 'ping':
                    socket.send(JSON.stringify({ type: 'pong' }));
                    break;
                default:
                    // Ignore unknown message types
                    break;
            }
        }

        function cleanup() {
            if (auth_timeout) clearTimeout(auth_timeout);
            if (heartbeat_interval) clearInterval(heartbeat_interval);
        }

        function send_error(socket, error, code) {
            try {
                socket.send(JSON.stringify({ type: 'error', error, code }));
            } catch (e) {
                // Socket may already be closed
            }
        }
    });

    return wss;
}

function generate_socket_id() {
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function get_client_ip(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
           req.socket.remoteAddress ||
           'unknown';
}
```

### Task 12: Broadcasting News to Widget Clients

Integrate with existing news broadcaster:

```javascript
// In your existing news broadcast logic, add:
import { widget_connection_manager } from '#websocket/widget/widget.connection_manager.js';

// When broadcasting new news items:
function broadcast_news_item(news_item) {
    // ... existing broadcast to news WebSocket clients ...

    // Also broadcast to all widget clients
    const widget_message = {
        type: 'news',
        data: news_item
    };

    const sent = widget_connection_manager.broadcast_to_all(widget_message);
    logger.debug({ sent, news_id: news_item._id }, 'widget: news broadcasted');
}
```

---

## Phase 5: Configuration API

### Task 13: Caching Layer

Add Redis caching for config endpoint:

```javascript
// In widget.service.js

const CONFIG_CACHE_TTL = 300; // 5 minutes

export const widget_service = {
    // ... existing methods ...

    async get_config(exchange_id) {
        // Try cache first
        const cache_key = `widget:config:${exchange_id}`;
        const cached = await redis.client.get(cache_key);

        if (cached) {
            return JSON.parse(cached);
        }

        const exchange_config = await widget_model.get_exchange_config(exchange_id);

        if (!exchange_config) {
            return null;
        }

        const config = {
            exchange_id: exchange_config.exchange_id,
            display_name: exchange_config.display_name,
            theme_config: exchange_config.theme_config,
            feature_flags: exchange_config.feature_flags
        };

        // Cache the result
        await redis.client.setex(cache_key, CONFIG_CACHE_TTL, JSON.stringify(config));

        return config;
    }
};
```

---

## Security Considerations

### API Key Format & Generation

```javascript
import crypto from 'crypto';

function generate_api_key() {
    // Format: wk_live_<32 random hex chars>
    const random_bytes = crypto.randomBytes(16).toString('hex');
    return `wk_live_${random_bytes}`;
}

function generate_secret_signing_key() {
    // Format: sk_live_<64 random hex chars>
    const random_bytes = crypto.randomBytes(32).toString('hex');
    return `sk_live_${random_bytes}`;
}
```

### Origin Validation

- Store allowed origins per exchange in `allowed_origins` array
- Validate `Origin` header on WebSocket upgrade
- For REST endpoints, implement CORS middleware

### JWT Security

- Short expiry (30 seconds) to minimize replay window
- Include `iat` (issued at) to allow exchanges to reject old tokens
- Include `trade_id` for idempotency checking on exchange side

### Rate Limiting Summary

| Limit | Default | Purpose |
|-------|---------|---------|
| Connections per exchange | 10,000 | Prevent runaway connections |
| Connections per IP | 10 | Prevent single-source abuse |
| Messages per minute | 60 | Prevent message flooding |
| Auth timeout | 10s | Prevent connection hoarding |

---

## Monitoring & Observability

### Metrics to Track

```javascript
// Prometheus-style metrics
const widget_metrics = {
    // Connections
    widget_connections_total: Counter,           // Total connections ever
    widget_connections_active: Gauge,            // Current active connections
    widget_connections_by_exchange: Gauge,       // Active per exchange

    // Authentication
    widget_auth_success_total: Counter,
    widget_auth_failure_total: Counter,
    widget_auth_failure_by_reason: Counter,      // Labels: reason

    // Messages
    widget_messages_received_total: Counter,
    widget_news_broadcasts_total: Counter,

    // Rate limiting
    widget_rate_limit_hits_total: Counter,       // Labels: limit_type

    // Trade tokens
    widget_trade_tokens_generated_total: Counter,
    widget_trade_token_errors_total: Counter,    // Labels: error_code
};
```

### Logging Format

```javascript
// All widget logs should include:
{
    context: 'widget',
    socket_id: string,      // When applicable
    exchange_id: string,    // When known
    operation: string,      // What was being done
    // ... additional context
}
```

---

## Environment Configuration

Add to your environment/config:

```javascript
// config/widget.js
export const widget_config = {
    websocket: {
        path: '/ws/widget',
        auth_timeout_ms: parseInt(process.env.WIDGET_AUTH_TIMEOUT_MS || '10000'),
        heartbeat_interval_ms: parseInt(process.env.WIDGET_HEARTBEAT_INTERVAL_MS || '30000'),
        max_payload_bytes: parseInt(process.env.WIDGET_MAX_PAYLOAD_BYTES || '1024'),
    },
    rate_limits: {
        default_connections_per_exchange: parseInt(process.env.WIDGET_DEFAULT_CONNECTIONS || '10000'),
        default_connections_per_ip: parseInt(process.env.WIDGET_DEFAULT_CONNECTIONS_PER_IP || '10'),
        default_messages_per_minute: parseInt(process.env.WIDGET_DEFAULT_MESSAGES_PER_MINUTE || '60'),
    },
    trade_token: {
        expiry_seconds: parseInt(process.env.WIDGET_TOKEN_EXPIRY_SECONDS || '30'),
    },
    cache: {
        config_ttl_seconds: parseInt(process.env.WIDGET_CONFIG_CACHE_TTL || '300'),
    }
};
```

---

## Summary: Implementation Checklist

### Database
- [ ] Create migration file with both tables
- [ ] Add seed data for test exchange
- [ ] Run migration

### REST API
- [ ] Create widget model
- [ ] Create widget service
- [ ] Create widget controller
- [ ] Create widget routes
- [ ] Mount routes in main router
- [ ] Test trade token endpoint
- [ ] Test config endpoint

### WebSocket
- [ ] Create connection manager
- [ ] Create rate limiter
- [ ] Create WebSocket handler
- [ ] Mount WebSocket server
- [ ] Integrate with news broadcaster
- [ ] Test authentication flow
- [ ] Test rate limiting
- [ ] Test graceful shutdown

### Security
- [ ] Implement origin validation
- [ ] Configure CORS for REST endpoints
- [ ] Add API key validation
- [ ] Test rate limits

### Monitoring
- [ ] Add logging throughout
- [ ] Set up metrics collection
- [ ] Create dashboard/alerts

---

## Key Differences from Main News WebSocket

| Aspect | Main News WebSocket (`/ws/news`) | Widget WebSocket (`/ws/widget`) |
|--------|----------------------------------|--------------------------------|
| **Auth** | License key + session token | API key only |
| **Users** | 247 Terminal subscribers | Exchange website visitors |
| **Rate limit by** | User ID | Exchange ID + IP |
| **Connection scale** | Hundreds | Potentially thousands per exchange |
| **Purpose** | Premium feature for subscribers | Service for exchange partners |
| **Origin check** | N/A | Per-exchange allowed origins |
