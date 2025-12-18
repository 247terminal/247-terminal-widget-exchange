# Frontend Widget Integration Plan

> **Created:** 2025-12-18
>
> **Purpose:** Complete integration guide for the 247 Terminal embeddable widget frontend.
>
> **Goal:** Connect the frontend widget to the backend services (REST API + WebSocket) and prepare for production deployment.

---

## Table of Contents

1. [Overview](#overview)
2. [Current State](#current-state)
3. [Part 1: Configuration System](#part-1-configuration-system)
4. [Part 2: Type Definitions](#part-2-type-definitions)
5. [Part 3: Widget Store](#part-3-widget-store)
6. [Part 4: News Store](#part-4-news-store)
7. [Part 5: API Service](#part-5-api-service)
8. [Part 6: WebSocket Service](#part-6-websocket-service)
9. [Part 7: Trade Service](#part-7-trade-service)
10. [Part 8: Initialization Service](#part-8-initialization-service)
11. [Part 9: UI Components](#part-9-ui-components)
12. [Part 10: Widget Entry Point](#part-10-widget-entry-point)
13. [Part 11: App Component](#part-11-app-component)
14. [Part 12: Build Configuration](#part-12-build-configuration)
15. [Part 13: Testing](#part-13-testing)
16. [Part 14: Production Deployment](#part-14-production-deployment)
17. [File Summary](#file-summary)
18. [Quick Reference](#quick-reference)

---

## Overview

The 247 Terminal Widget is a secure, embeddable trading widget for exchange partners. This plan covers wiring the frontend components to the backend services.

### Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Preact | 10.27.2 | UI framework (3KB React alternative) |
| TypeScript | 5.9.3 | Type safety |
| Vite | - | Build tool |
| Zustand | 5.0.9 | State management |
| Styled-Components | 6.1.19 | CSS-in-JS theming |
| Framer Motion | 12.23.26 | Animations |

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Exchange Website                          │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              247 Terminal Widget (Shadow DOM)           │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │ │
│  │  │  News Feed   │  │ Trade        │  │ WebSocket    │  │ │
│  │  │  Component   │  │ Buttons      │  │ Client       │  │ │
│  │  └──────────────┘  └──────┬───────┘  └──────┬───────┘  │ │
│  └───────────────────────────┼─────────────────┼──────────┘ │
└──────────────────────────────┼─────────────────┼────────────┘
                               │                 │
                    HTTPS      │                 │ WebSocket
                    (trade     │                 │ (news
                    token)     │                 │ streaming)
                               ▼                 ▼
┌─────────────────────────────────────────────────────────────┐
│                   247 Terminal Backend                       │
│  ┌──────────────────┐  ┌──────────────────┐                 │
│  │ POST /widget/    │  │ WS /ws/widget    │                 │
│  │ generate-trade-  │  │                  │                 │
│  │ token            │  │                  │                 │
│  └──────────────────┘  └──────────────────┘                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Current State

### What Already Exists

| Component | File | Status |
|-----------|------|--------|
| Widget Entry Point | `src/widget.ts` | ✅ Exists (needs update) |
| WebSocket Service | `src/services/websocket_service.ts` | ✅ Exists (needs update) |
| API Service | `src/services/api_service.ts` | ✅ Exists (needs update) |
| Widget Store | `src/store/widget_store.ts` | ✅ Exists (needs update) |
| News Store | `src/store/news_store.ts` | ✅ Exists (needs update) |
| News Feed UI | `src/features/news_feed/*.tsx` | ✅ Exists |
| Trade Buttons | `src/components/*.tsx` | ✅ Exists |
| Theme System | `src/styles/theme.ts` | ✅ Exists (needs update) |

### What Needs to Be Created

| File | Purpose |
|------|---------|
| `src/config/_index.ts` | Centralized configuration |
| `src/config/theme.ts` | Theme builder with defaults |
| `src/types/trade.ts` | Trade type definitions |
| `src/services/initialization_service.ts` | Widget startup orchestration |
| `src/services/trade_service.ts` | Trade execution with sandbox |
| `src/components/LoadingState.tsx` | Loading spinner |
| `src/components/ErrorState.tsx` | Error display |
| `src/components/ConnectionStatus.tsx` | Connection indicator |
| `src/components/SandboxBanner.tsx` | Sandbox mode indicator |
| `src/components/TradeAmountSelector.tsx` | User-configurable amounts |
| `.env.development` | Dev environment variables |
| `.env.production` | Prod environment variables |
| `examples/embed.html` | Production embed example |
| `examples/sandbox-test.html` | Sandbox testing page |

---

## Part 1: Configuration System

### Why This Matters

Centralized configuration mirrors the backend pattern (`config/_index.js`) and allows environment-specific settings. Vite's `import.meta.env` replaces Node's `process.env` for browser environments.

### Task 1.1: Create Environment Files

**Create file:** `.env.development`

```bash
VITE_API_BASE_URL=http://localhost:3000/api/app/widget
VITE_WEBSOCKET_URL=ws://localhost:3000/ws/widget
VITE_SANDBOX_MODE=true
```

**Create file:** `.env.production`

```bash
VITE_API_BASE_URL=https://api.247terminal.com/api/app/widget
VITE_WEBSOCKET_URL=wss://api.247terminal.com/ws/widget
VITE_SANDBOX_MODE=false
```

### Task 1.2: Create Config Module

**Create file:** `src/config/_index.ts`

```typescript
const config = {
    environment: {
        is_production: import.meta.env.PROD,
        is_development: import.meta.env.DEV,
        mode: import.meta.env.MODE,
    },
    api: {
        base_url: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/app/widget',
        timeout: 30000,
    },
    websocket: {
        url: import.meta.env.VITE_WEBSOCKET_URL || 'ws://localhost:3000/ws/widget',
        reconnect: {
            max_attempts: 5,
            base_delay: 1000,
            max_delay: 16000,
        },
        ping_interval: 25000,
        auth_timeout: 10000,
    },
    trading: {
        enabled: true,
        sandbox_mode: import.meta.env.VITE_SANDBOX_MODE === 'true',
        default_amounts: [100, 250, 500],
        min_amount_options: 1,
        max_amount_options: 4,
        min_trade_amount: 1,
        max_trade_amount: 100000,
    },
    theme: {
        defaults: {
            colors: {
                background: '#0a0a0f',
                surface: '#12121a',
                surface_elevated: '#1a1a24',
                primary: '#3b82f6',
                secondary: '#8b5cf6',
                success: '#22c55e',
                danger: '#ef4444',
                warning: '#f59e0b',
                text_primary: '#ffffff',
                text_secondary: '#a1a1aa',
                text_muted: '#71717a',
                border: '#27272a',
                border_light: '#3f3f46',
            },
            fonts: {
                body: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                mono: "'SF Mono', 'Fira Code', monospace",
            },
            font_sizes: {
                xs: '10px',
                sm: '12px',
                md: '14px',
                lg: '16px',
                xl: '20px',
                xxl: '24px',
            },
            spacing: {
                xs: '4px',
                sm: '8px',
                md: '12px',
                lg: '16px',
                xl: '24px',
                xxl: '32px',
            },
            radii: {
                sm: '4px',
                md: '8px',
                lg: '12px',
                full: '9999px',
            },
            shadows: {
                sm: '0 1px 2px rgba(0, 0, 0, 0.3)',
                md: '0 4px 6px rgba(0, 0, 0, 0.4)',
                lg: '0 10px 15px rgba(0, 0, 0, 0.5)',
            },
            breakpoints: {
                narrow: 500,
                medium: 700,
                wide: 900,
            },
        },
    },
    time: {
        ms: {
            one_second: 1000,
            five_seconds: 5000,
            one_minute: 60000,
            one_hour: 3600000,
        },
    },
};

export default config;
```

### Task 1.3: Create Theme Builder

**Create file:** `src/config/theme.ts`

```typescript
import config from './_index';

export type ThemeConfig = typeof config.theme.defaults;

export function build_theme(exchange_config?: Partial<ThemeConfig>): ThemeConfig {
    const defaults = config.theme.defaults;

    if (!exchange_config) {
        return defaults;
    }

    return {
        colors: { ...defaults.colors, ...exchange_config.colors },
        fonts: { ...defaults.fonts, ...exchange_config.fonts },
        font_sizes: { ...defaults.font_sizes, ...exchange_config.font_sizes },
        spacing: { ...defaults.spacing, ...exchange_config.spacing },
        radii: { ...defaults.radii, ...exchange_config.radii },
        shadows: { ...defaults.shadows, ...exchange_config.shadows },
        breakpoints: { ...defaults.breakpoints, ...exchange_config.breakpoints },
    };
}
```

**Why deep merge:** Exchanges only override what they need. `{ colors: { primary: '#ff0000' } }` keeps all other defaults.

---

## Part 2: Type Definitions

### Why This Matters

Strong typing catches bugs at compile time and documents the data structures flowing through the system.

### Task 2.1: Create Trade Types

**Create file:** `src/types/trade.ts`

```typescript
export type TradeSide = 'long' | 'short';

export interface TradeParams {
    coin: string;
    side: TradeSide;
    amount_usd: number;
    news_id: string;
    timestamp: number;
}

export interface TradeTokenRequest {
    exchange_id: string;
    exchange_user_id: string;
    trade_params: TradeParams;
}

export interface TradeTokenResponse {
    success: boolean;
    data?: {
        token: string;
        trade_id: string;
        expires_at: number;
    };
    error?: string;
}

export interface TradeEventDetail {
    token: string;
    trade_id: string;
    coin: string;
    side: TradeSide;
    amount_usd: number;
    news_id: string;
    is_sandbox?: boolean;
}

export interface TradeResult {
    success: boolean;
    trade_id?: string;
    error?: string;
    is_sandbox?: boolean;
}
```

### Task 2.2: Create/Update News Types

**Update file:** `src/types/news.ts`

```typescript
export interface NewsItem {
    _id: string;
    title: string;
    body?: string;
    time: number;
    type?: 'news' | 'twitter' | 'alert';
    source?: string;
    source_handle?: string;
    sentiment?: 'positive' | 'negative' | 'neutral';
    coins?: string[];
    info?: {
        embedded_tweet?: EmbeddedTweet;
    };
}

export interface EmbeddedTweet {
    id: string;
    text: string;
    author_name: string;
    author_handle: string;
    author_avatar?: string;
    created_at: string;
}

export interface SentimentData {
    news_id: string;
    sentiment: 'positive' | 'negative' | 'neutral';
    confidence?: number;
}

export interface TradingVolumeAlert {
    type: 'trading_volume_alert';
    title: string;
    coin: string;
    volume_change: number;
    time: number;
}

export type WebSocketMessage =
    | { type: 'auth_success'; exchange_id: string }
    | { type: 'auth_error'; error: string; code: number }
    | { type: 'news'; data: NewsItem }
    | { type: 'ai_sentiment'; news_id: string; sentiment: string }
    | { type: 'trading_volume_alert' } & TradingVolumeAlert
    | { type: 'pong' };
```

### Task 2.3: Create Widget Types

**Create file:** `src/types/widget.ts`

```typescript
import type { ThemeConfig } from '../config/theme';

export interface FeatureFlags {
    allow_trading: boolean;
    show_sentiment: boolean;
    show_volume_alerts: boolean;
}

export interface WidgetConfigResponse {
    success: boolean;
    data: {
        exchange_id: string;
        display_name: string;
        theme_config?: Partial<ThemeConfig>;
        feature_flags: FeatureFlags;
    };
}

export interface TradeAmountConfig {
    presets: number[];
    selected_index: number;
    custom_amount: number | null;
}

export type InitializationStatus = 'idle' | 'loading' | 'ready' | 'error';
```

---

## Part 3: Widget Store

### Why This Matters

The widget store holds all widget-level state including API key, exchange config, theme, and user preferences for trade amounts.

### Task 3.1: Update Widget Store

**Update file:** `src/store/widget_store.ts`

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import config from '../config/_index';
import type { ThemeConfig } from '../config/theme';
import type { FeatureFlags, TradeAmountConfig, InitializationStatus } from '../types/widget';

const MIN_PRESETS = config.trading.min_amount_options;
const MAX_PRESETS = config.trading.max_amount_options;
const MIN_AMOUNT = config.trading.min_trade_amount;
const MAX_AMOUNT = config.trading.max_trade_amount;

interface WidgetState {
    api_key: string;
    exchange_id: string | null;
    exchange_user_id: string | null;
    theme: ThemeConfig | null;
    feature_flags: FeatureFlags | null;
    initialization_status: InitializationStatus;
    initialization_error: string | null;
    trade_amounts: TradeAmountConfig;
}

interface WidgetActions {
    initialize: (api_key: string, exchange_user_id: string | null) => void;
    set_exchange_id: (id: string) => void;
    set_theme: (theme: ThemeConfig) => void;
    set_feature_flags: (flags: FeatureFlags) => void;
    set_initialization_status: (status: InitializationStatus) => void;
    set_initialization_error: (error: string | null) => void;
    reset: () => void;
    set_trade_amount_presets: (presets: number[]) => void;
    select_trade_amount: (index: number) => void;
    set_custom_amount: (amount: number | null) => void;
    add_trade_amount_preset: (amount: number) => void;
    remove_trade_amount_preset: (index: number) => void;
    get_current_trade_amount: () => number;
}

function validate_amount(amount: number): boolean {
    return amount >= MIN_AMOUNT && amount <= MAX_AMOUNT && Number.isFinite(amount);
}

export const use_widget_store = create<WidgetState & WidgetActions>()(
    persist(
        (set, get) => ({
            api_key: '',
            exchange_id: null,
            exchange_user_id: null,
            theme: null,
            feature_flags: null,
            initialization_status: 'idle',
            initialization_error: null,
            trade_amounts: {
                presets: config.trading.default_amounts,
                selected_index: 0,
                custom_amount: null,
            },

            initialize: (api_key, exchange_user_id) => set({
                api_key,
                exchange_user_id,
                initialization_status: 'loading',
                initialization_error: null,
            }),

            set_exchange_id: (id) => set({ exchange_id: id }),
            set_theme: (theme) => set({ theme }),
            set_feature_flags: (flags) => set({ feature_flags: flags }),
            set_initialization_status: (status) => set({ initialization_status: status }),
            set_initialization_error: (error) => set({ initialization_error: error }),

            reset: () => set({
                api_key: '',
                exchange_id: null,
                exchange_user_id: null,
                theme: null,
                feature_flags: null,
                initialization_status: 'idle',
                initialization_error: null,
            }),

            set_trade_amount_presets: (presets) => {
                const valid_presets = presets
                    .filter(validate_amount)
                    .slice(0, MAX_PRESETS);

                if (valid_presets.length < MIN_PRESETS) {
                    console.warn(`[widget_store] At least ${MIN_PRESETS} trade amount preset required`);
                    return;
                }

                set((state) => ({
                    trade_amounts: {
                        ...state.trade_amounts,
                        presets: valid_presets,
                        selected_index: Math.min(state.trade_amounts.selected_index, valid_presets.length - 1),
                    },
                }));
            },

            select_trade_amount: (index) => {
                const { presets } = get().trade_amounts;
                if (index < 0 || index >= presets.length) return;

                set((state) => ({
                    trade_amounts: {
                        ...state.trade_amounts,
                        selected_index: index,
                        custom_amount: null,
                    },
                }));
            },

            set_custom_amount: (amount) => {
                if (amount !== null && !validate_amount(amount)) {
                    console.warn(`[widget_store] Invalid trade amount: ${amount}`);
                    return;
                }

                set((state) => ({
                    trade_amounts: {
                        ...state.trade_amounts,
                        custom_amount: amount,
                    },
                }));
            },

            add_trade_amount_preset: (amount) => {
                const { presets } = get().trade_amounts;

                if (presets.length >= MAX_PRESETS) {
                    console.warn(`[widget_store] Maximum ${MAX_PRESETS} presets allowed`);
                    return;
                }

                if (!validate_amount(amount)) {
                    console.warn(`[widget_store] Invalid amount: ${amount}`);
                    return;
                }

                if (presets.includes(amount)) {
                    console.warn(`[widget_store] Amount ${amount} already exists`);
                    return;
                }

                const new_presets = [...presets, amount].sort((a, b) => a - b);

                set((state) => ({
                    trade_amounts: {
                        ...state.trade_amounts,
                        presets: new_presets,
                    },
                }));
            },

            remove_trade_amount_preset: (index) => {
                const { presets } = get().trade_amounts;

                if (presets.length <= MIN_PRESETS) {
                    console.warn(`[widget_store] Minimum ${MIN_PRESETS} preset required`);
                    return;
                }

                const new_presets = presets.filter((_, i) => i !== index);

                set((state) => ({
                    trade_amounts: {
                        ...state.trade_amounts,
                        presets: new_presets,
                        selected_index: Math.min(state.trade_amounts.selected_index, new_presets.length - 1),
                    },
                }));
            },

            get_current_trade_amount: () => {
                const { presets, selected_index, custom_amount } = get().trade_amounts;
                return custom_amount ?? presets[selected_index];
            },
        }),
        {
            name: '247terminal-widget-storage',
            partialize: (state) => ({
                trade_amounts: state.trade_amounts,
            }),
        }
    )
);
```

---

## Part 4: News Store

### Why This Matters

The news store manages real-time news items, sentiment data, volume alerts, and connection status.

### Task 4.1: Update News Store

**Update file:** `src/store/news_store.ts`

```typescript
import { create } from 'zustand';
import type { NewsItem, SentimentData, TradingVolumeAlert } from '../types/news';

const MAX_NEWS_ITEMS = 100;
const MAX_VOLUME_ALERTS = 10;

interface NewsState {
    news_items: NewsItem[];
    sentiment_map: Map<string, SentimentData>;
    volume_alerts: TradingVolumeAlert[];
    selected_news_id: string | null;
    is_connected: boolean;
    connection_error: string | null;
}

interface NewsActions {
    add_news_item: (item: NewsItem) => void;
    add_sentiment: (sentiment: SentimentData) => void;
    add_volume_alert: (alert: TradingVolumeAlert) => void;
    set_selected_news: (id: string | null) => void;
    set_connection_status: (connected: boolean) => void;
    set_connection_error: (error: string | null) => void;
    clear_news: () => void;
}

export const use_news_store = create<NewsState & NewsActions>((set, get) => ({
    news_items: [],
    sentiment_map: new Map(),
    volume_alerts: [],
    selected_news_id: null,
    is_connected: false,
    connection_error: null,

    add_news_item: (item) => set((state) => {
        if (state.news_items.some(n => n._id === item._id)) {
            return state;
        }

        const updated = [item, ...state.news_items].slice(0, MAX_NEWS_ITEMS);
        return { news_items: updated };
    }),

    add_sentiment: (sentiment) => set((state) => {
        const new_map = new Map(state.sentiment_map);
        new_map.set(sentiment.news_id, sentiment);
        return { sentiment_map: new_map };
    }),

    add_volume_alert: (alert) => set((state) => ({
        volume_alerts: [alert, ...state.volume_alerts].slice(0, MAX_VOLUME_ALERTS),
    })),

    set_selected_news: (id) => set({ selected_news_id: id }),

    set_connection_status: (connected) => set({
        is_connected: connected,
        connection_error: connected ? null : get().connection_error,
    }),

    set_connection_error: (error) => set({ connection_error: error }),

    clear_news: () => set({
        news_items: [],
        sentiment_map: new Map(),
        volume_alerts: [],
        selected_news_id: null,
    }),
}));
```

---

## Part 5: API Service

### Why This Matters

The API service handles HTTP requests to the backend for fetching config and generating trade tokens.

### Task 5.1: Update API Service

**Update file:** `src/services/api_service.ts`

```typescript
import config from '../config/_index';
import { use_widget_store } from '../store/widget_store';
import type { WidgetConfigResponse } from '../types/widget';
import type { TradeParams, TradeTokenResponse } from '../types/trade';

export const api_service = {
    fetch_widget_config: async (): Promise<WidgetConfigResponse['data'] | null> => {
        const { api_key } = use_widget_store.getState();

        try {
            const response = await fetch(`${config.api.base_url}/config`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': api_key,
                },
            });

            if (!response.ok) {
                throw new Error(`Config fetch failed: ${response.status}`);
            }

            const result: WidgetConfigResponse = await response.json();

            if (!result.success) {
                throw new Error('Config response unsuccessful');
            }

            return result.data;
        } catch (error) {
            console.error('[api_service] fetch_widget_config error:', error);
            return null;
        }
    },

    generate_trade_token: async (trade_params: TradeParams): Promise<TradeTokenResponse['data'] | null> => {
        const { api_key, exchange_id, exchange_user_id } = use_widget_store.getState();

        if (!exchange_id || !exchange_user_id) {
            console.error('[api_service] Missing exchange_id or exchange_user_id');
            return null;
        }

        try {
            const response = await fetch(`${config.api.base_url}/generate-trade-token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': api_key,
                },
                body: JSON.stringify({
                    exchange_id,
                    exchange_user_id,
                    trade_params,
                }),
            });

            if (!response.ok) {
                throw new Error(`Trade token request failed: ${response.status}`);
            }

            const result: TradeTokenResponse = await response.json();

            if (!result.success) {
                throw new Error(result.error || 'Trade token response unsuccessful');
            }

            return result.data;
        } catch (error) {
            console.error('[api_service] generate_trade_token error:', error);
            return null;
        }
    },
};
```

---

## Part 6: WebSocket Service

### Why This Matters

The WebSocket service maintains the real-time connection for news streaming, handles authentication, reconnection, and keep-alive pings.

### Task 6.1: Update WebSocket Service

**Update file:** `src/services/websocket_service.ts`

```typescript
import config from '../config/_index';
import type { NewsItem, SentimentData, TradingVolumeAlert, WebSocketMessage } from '../types/news';

interface WebSocketServiceConfig {
    api_key: string;
    on_news: (news: NewsItem) => void;
    on_sentiment: (sentiment: SentimentData) => void;
    on_volume_alert: (alert: TradingVolumeAlert) => void;
    on_connection_change: (connected: boolean) => void;
    on_error: (error: string) => void;
}

class WebSocketService {
    private socket: WebSocket | null = null;
    private service_config: WebSocketServiceConfig | null = null;
    private reconnect_attempts = 0;
    private ping_interval_id: number | null = null;
    private is_authenticated = false;

    connect(service_config: WebSocketServiceConfig): void {
        this.service_config = service_config;
        this.establish_connection();
    }

    disconnect(): void {
        this.stop_ping_interval();
        if (this.socket) {
            this.socket.close(1000, 'Client disconnect');
            this.socket = null;
        }
        this.is_authenticated = false;
        this.reconnect_attempts = 0;
    }

    is_connected(): boolean {
        return this.socket?.readyState === WebSocket.OPEN && this.is_authenticated;
    }

    private establish_connection(): void {
        if (!this.service_config) return;

        this.socket = new WebSocket(config.websocket.url);

        this.socket.onopen = () => {
            this.send_auth_message();
        };

        this.socket.onmessage = (event) => {
            this.handle_message(event.data);
        };

        this.socket.onclose = (event) => {
            this.handle_close(event);
        };

        this.socket.onerror = () => {
            this.service_config?.on_error('WebSocket connection error');
        };
    }

    private send_auth_message(): void {
        if (!this.socket || !this.service_config) return;

        const auth_message = {
            type: 'auth',
            api_key: this.service_config.api_key,
        };

        this.socket.send(JSON.stringify(auth_message));
    }

    private handle_message(data: string): void {
        if (!this.service_config) return;

        if (data === 'pong') return;

        try {
            const message = JSON.parse(data) as WebSocketMessage;

            switch (message.type) {
                case 'auth_success':
                    this.is_authenticated = true;
                    this.reconnect_attempts = 0;
                    this.start_ping_interval();
                    this.service_config.on_connection_change(true);
                    break;

                case 'auth_error':
                    this.service_config.on_error(`Authentication failed: ${message.error}`);
                    this.service_config.on_connection_change(false);
                    break;

                case 'news':
                    this.service_config.on_news(message.data);
                    break;

                case 'ai_sentiment':
                    this.service_config.on_sentiment({
                        news_id: message.news_id,
                        sentiment: message.sentiment as 'positive' | 'negative' | 'neutral',
                    });
                    break;

                case 'trading_volume_alert':
                    this.service_config.on_volume_alert(message as TradingVolumeAlert);
                    break;

                case 'pong':
                    break;
            }
        } catch {
            // Non-JSON message, ignore
        }
    }

    private handle_close(event: CloseEvent): void {
        this.is_authenticated = false;
        this.stop_ping_interval();
        this.service_config?.on_connection_change(false);

        const no_reconnect_codes = [1000, 4001, 4002, 4003];
        if (no_reconnect_codes.includes(event.code)) return;

        this.schedule_reconnect();
    }

    private schedule_reconnect(): void {
        const { max_attempts, base_delay, max_delay } = config.websocket.reconnect;

        if (this.reconnect_attempts >= max_attempts) {
            this.service_config?.on_error('Max reconnection attempts reached');
            return;
        }

        const delay = Math.min(base_delay * Math.pow(2, this.reconnect_attempts), max_delay);
        this.reconnect_attempts++;

        setTimeout(() => {
            this.establish_connection();
        }, delay);
    }

    private start_ping_interval(): void {
        this.ping_interval_id = window.setInterval(() => {
            if (this.socket?.readyState === WebSocket.OPEN) {
                this.socket.send('ping');
            }
        }, config.websocket.ping_interval);
    }

    private stop_ping_interval(): void {
        if (this.ping_interval_id) {
            clearInterval(this.ping_interval_id);
            this.ping_interval_id = null;
        }
    }
}

export const websocket_service = new WebSocketService();
```

### WebSocket Close Codes Reference

| Code | Name | Reconnect? |
|------|------|------------|
| 1000 | Normal Close | No |
| 4001 | AUTH_TIMEOUT | No |
| 4002 | AUTH_FAILED | No |
| 4003 | EXCHANGE_INACTIVE | No |
| 4004 | RATE_LIMIT_CONNECTIONS | Yes |
| 4006 | RATE_LIMIT_MESSAGES | Yes |
| Other | Unknown | Yes |

---

## Part 7: Trade Service

### Why This Matters

The trade service handles trade execution with sandbox mode support. In sandbox mode, trades are simulated locally. In production, tokens are requested from the backend.

### Task 7.1: Create Trade Service

**Create file:** `src/services/trade_service.ts`

```typescript
import config from '../config/_index';
import { api_service } from './api_service';
import { use_widget_store } from '../store/widget_store';
import type { TradeParams, TradeEventDetail, TradeResult } from '../types/trade';

interface TradeRequest {
    coin: string;
    amount_usd: number;
    side: 'long' | 'short';
    news_id: string;
}

export async function execute_trade(request: TradeRequest): Promise<TradeResult> {
    const { feature_flags } = use_widget_store.getState();

    if (!feature_flags?.allow_trading) {
        return { success: false, error: 'Trading is disabled for this widget' };
    }

    if (config.trading.sandbox_mode) {
        return execute_sandbox_trade(request);
    }

    return execute_live_trade(request);
}

async function execute_sandbox_trade(request: TradeRequest): Promise<TradeResult> {
    await new Promise(resolve => setTimeout(resolve, 500));

    const mock_trade_id = `sandbox_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const mock_token = `sandbox.${btoa(JSON.stringify({
        trade_id: mock_trade_id,
        coin: request.coin,
        side: request.side,
        amount_usd: request.amount_usd,
        is_sandbox: true,
    }))}`;

    dispatch_trade_event({
        token: mock_token,
        trade_id: mock_trade_id,
        coin: request.coin,
        side: request.side,
        amount_usd: request.amount_usd,
        is_sandbox: true,
    });

    console.info('[SANDBOX] Trade simulated:', {
        trade_id: mock_trade_id,
        coin: request.coin,
        side: request.side,
        amount_usd: request.amount_usd,
    });

    return {
        success: true,
        trade_id: mock_trade_id,
        is_sandbox: true,
    };
}

async function execute_live_trade(request: TradeRequest): Promise<TradeResult> {
    const trade_params: TradeParams = {
        coin: request.coin,
        side: request.side,
        amount_usd: request.amount_usd,
        news_id: request.news_id,
        timestamp: Date.now(),
    };

    const token_response = await api_service.generate_trade_token(trade_params);

    if (!token_response) {
        return { success: false, error: 'Failed to generate trade token' };
    }

    dispatch_trade_event({
        token: token_response.token,
        trade_id: token_response.trade_id,
        coin: request.coin,
        side: request.side,
        amount_usd: request.amount_usd,
        news_id: request.news_id,
    });

    return {
        success: true,
        trade_id: token_response.trade_id,
    };
}

function dispatch_trade_event(detail: TradeEventDetail): void {
    const trade_event = new CustomEvent<TradeEventDetail>('247terminal:trade', {
        detail,
        bubbles: true,
        composed: true,
    });

    document.dispatchEvent(trade_event);
}
```

---

## Part 8: Initialization Service

### Why This Matters

The initialization service orchestrates the widget startup sequence: store init → fetch config → build theme → connect WebSocket.

### Task 8.1: Create Initialization Service

**Create file:** `src/services/initialization_service.ts`

```typescript
import { api_service } from './api_service';
import { websocket_service } from './websocket_service';
import { use_widget_store } from '../store/widget_store';
import { use_news_store } from '../store/news_store';
import { build_theme } from '../config/theme';
import config from '../config/_index';

interface InitOptions {
    api_key: string;
    exchange_user_id?: string;
}

export async function initialize_widget(options: InitOptions): Promise<boolean> {
    const widget_store = use_widget_store.getState();
    const news_store = use_news_store.getState();

    try {
        widget_store.initialize(options.api_key, options.exchange_user_id || null);

        const widget_config = await api_service.fetch_widget_config();

        if (!widget_config) {
            const theme = build_theme();
            widget_store.set_theme(theme);
            widget_store.set_feature_flags({
                allow_trading: config.trading.enabled,
                show_sentiment: true,
                show_volume_alerts: true,
            });
        } else {
            widget_store.set_exchange_id(widget_config.exchange_id);
            widget_store.set_theme(build_theme(widget_config.theme_config));
            widget_store.set_feature_flags(widget_config.feature_flags);
        }

        websocket_service.connect({
            api_key: options.api_key,
            on_news: (news_item) => news_store.add_news_item(news_item),
            on_sentiment: (sentiment) => news_store.add_sentiment(sentiment),
            on_volume_alert: (alert) => news_store.add_volume_alert(alert),
            on_connection_change: (connected) => news_store.set_connection_status(connected),
            on_error: (error) => news_store.set_connection_error(error),
        });

        widget_store.set_initialization_status('ready');
        return true;
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown initialization error';
        widget_store.set_initialization_error(message);
        widget_store.set_initialization_status('error');
        return false;
    }
}

export function destroy_widget(): void {
    websocket_service.disconnect();
    use_widget_store.getState().reset();
    use_news_store.getState().clear_news();
}
```

---

## Part 9: UI Components

### Why This Matters

These components provide visual feedback for loading, errors, connection status, sandbox mode, and trade amount selection.

### Task 9.1: Create Loading Component

**Create file:** `src/components/LoadingState.tsx`

```typescript
import styled, { keyframes } from 'styled-components';

const spin = keyframes`
    to { transform: rotate(360deg); }
`;

const Container = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: ${({ theme }) => theme.spacing.xl};
    color: ${({ theme }) => theme.colors.text_secondary};
    min-height: 200px;
`;

const Spinner = styled.div`
    width: 32px;
    height: 32px;
    border: 3px solid ${({ theme }) => theme.colors.border};
    border-top-color: ${({ theme }) => theme.colors.primary};
    border-radius: 50%;
    animation: ${spin} 1s linear infinite;
`;

const Text = styled.p`
    margin-top: ${({ theme }) => theme.spacing.md};
    font-size: ${({ theme }) => theme.font_sizes.sm};
`;

interface LoadingStateProps {
    message?: string;
}

export function LoadingState({ message = 'Loading...' }: LoadingStateProps) {
    return (
        <Container>
            <Spinner />
            <Text>{message}</Text>
        </Container>
    );
}
```

### Task 9.2: Create Error Component

**Create file:** `src/components/ErrorState.tsx`

```typescript
import styled from 'styled-components';

const Container = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: ${({ theme }) => theme.spacing.xl};
    min-height: 200px;
    text-align: center;
`;

const Icon = styled.div`
    font-size: 48px;
    margin-bottom: ${({ theme }) => theme.spacing.md};
`;

const Title = styled.p`
    font-size: ${({ theme }) => theme.font_sizes.md};
    color: ${({ theme }) => theme.colors.text_primary};
    margin-bottom: ${({ theme }) => theme.spacing.sm};
`;

const Detail = styled.p`
    font-size: ${({ theme }) => theme.font_sizes.sm};
    color: ${({ theme }) => theme.colors.text_secondary};
`;

interface ErrorStateProps {
    message: string;
    detail?: string;
}

export function ErrorState({ message, detail }: ErrorStateProps) {
    return (
        <Container>
            <Icon>⚠</Icon>
            <Title>{message}</Title>
            {detail && <Detail>{detail}</Detail>}
        </Container>
    );
}
```

### Task 9.3: Create Connection Status Component

**Create file:** `src/components/ConnectionStatus.tsx`

```typescript
import styled from 'styled-components';
import { use_news_store } from '../store/news_store';

const Container = styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    font-size: ${({ theme }) => theme.font_sizes.xs};
    color: ${({ theme }) => theme.colors.text_secondary};
    padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
`;

const Dot = styled.div<{ is_connected: boolean }>`
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: ${({ is_connected, theme }) =>
        is_connected ? theme.colors.success : theme.colors.danger};
`;

export function ConnectionStatus() {
    const is_connected = use_news_store((state) => state.is_connected);

    return (
        <Container>
            <Dot is_connected={is_connected} />
            {is_connected ? 'Live' : 'Disconnected'}
        </Container>
    );
}
```

### Task 9.4: Create Sandbox Banner Component

**Create file:** `src/components/SandboxBanner.tsx`

```typescript
import styled from 'styled-components';
import config from '../config/_index';

const Banner = styled.div`
    background: ${({ theme }) => theme.colors.warning};
    color: #000;
    padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
    font-size: ${({ theme }) => theme.font_sizes.xs};
    text-align: center;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
`;

export function SandboxBanner() {
    if (!config.trading.sandbox_mode) {
        return null;
    }

    return <Banner>Sandbox Mode - Trades Are Simulated</Banner>;
}
```

### Task 9.5: Create Trade Amount Selector Component

**Create file:** `src/components/TradeAmountSelector.tsx`

```typescript
import { useState } from 'preact/hooks';
import styled from 'styled-components';
import { use_widget_store } from '../store/widget_store';
import config from '../config/_index';

const Container = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: ${({ theme }) => theme.spacing.sm};
    align-items: center;
`;

const AmountButton = styled.button<{ is_selected: boolean }>`
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
    border-radius: ${({ theme }) => theme.radii.md};
    border: 1px solid ${({ is_selected, theme }) =>
        is_selected ? theme.colors.primary : theme.colors.border};
    background: ${({ is_selected, theme }) =>
        is_selected ? theme.colors.primary : 'transparent'};
    color: ${({ is_selected, theme }) =>
        is_selected ? '#fff' : theme.colors.text_primary};
    font-size: ${({ theme }) => theme.font_sizes.sm};
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    min-width: 60px;

    &:hover:not(:disabled) {
        border-color: ${({ theme }) => theme.colors.primary};
    }

    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
`;

const RemoveIcon = styled.span`
    margin-left: 4px;
    opacity: 0.7;
    cursor: pointer;

    &:hover {
        opacity: 1;
    }
`;

const CustomInput = styled.input`
    width: 80px;
    padding: ${({ theme }) => theme.spacing.sm};
    border-radius: ${({ theme }) => theme.radii.md};
    border: 1px solid ${({ theme }) => theme.colors.border};
    background: transparent;
    color: ${({ theme }) => theme.colors.text_primary};
    font-size: ${({ theme }) => theme.font_sizes.sm};

    &:focus {
        outline: none;
        border-color: ${({ theme }) => theme.colors.primary};
    }

    &::placeholder {
        color: ${({ theme }) => theme.colors.text_muted};
    }
`;

const ActionButton = styled.button`
    padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
    background: transparent;
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.radii.sm};
    color: ${({ theme }) => theme.colors.text_secondary};
    cursor: pointer;
    font-size: ${({ theme }) => theme.font_sizes.xs};

    &:hover {
        color: ${({ theme }) => theme.colors.text_primary};
        border-color: ${({ theme }) => theme.colors.text_secondary};
    }
`;

interface TradeAmountSelectorProps {
    on_amount_change?: (amount: number) => void;
    disabled?: boolean;
}

export function TradeAmountSelector({ on_amount_change, disabled }: TradeAmountSelectorProps) {
    const [is_editing, set_is_editing] = useState(false);
    const [custom_input, set_custom_input] = useState('');

    const trade_amounts = use_widget_store((s) => s.trade_amounts);
    const select_trade_amount = use_widget_store((s) => s.select_trade_amount);
    const set_custom_amount = use_widget_store((s) => s.set_custom_amount);
    const add_trade_amount_preset = use_widget_store((s) => s.add_trade_amount_preset);
    const remove_trade_amount_preset = use_widget_store((s) => s.remove_trade_amount_preset);

    const { presets, selected_index, custom_amount } = trade_amounts;
    const can_add_preset = presets.length < config.trading.max_amount_options;
    const can_remove_preset = presets.length > config.trading.min_amount_options;

    function handle_preset_click(index: number) {
        if (disabled) return;
        select_trade_amount(index);
        on_amount_change?.(presets[index]);
    }

    function handle_custom_submit() {
        const amount = parseFloat(custom_input);
        if (amount >= config.trading.min_trade_amount && amount <= config.trading.max_trade_amount) {
            set_custom_amount(amount);
            on_amount_change?.(amount);
            set_custom_input('');
        }
    }

    function handle_add_preset() {
        const amount = parseFloat(custom_input);
        if (amount > 0 && can_add_preset) {
            add_trade_amount_preset(amount);
            set_custom_input('');
        }
    }

    function handle_remove_preset(e: Event, index: number) {
        e.stopPropagation();
        if (can_remove_preset) {
            remove_trade_amount_preset(index);
        }
    }

    function format_amount(amount: number): string {
        if (amount >= 1000) {
            const k_value = amount / 1000;
            return `$${k_value % 1 === 0 ? k_value.toFixed(0) : k_value.toFixed(1)}k`;
        }
        return `$${amount}`;
    }

    return (
        <Container>
            {presets.map((amount, index) => (
                <AmountButton
                    key={`${amount}-${index}`}
                    is_selected={custom_amount === null && selected_index === index}
                    onClick={() => handle_preset_click(index)}
                    disabled={disabled}
                >
                    {format_amount(amount)}
                    {is_editing && can_remove_preset && (
                        <RemoveIcon onClick={(e) => handle_remove_preset(e, index)}>×</RemoveIcon>
                    )}
                </AmountButton>
            ))}

            {custom_amount !== null && (
                <AmountButton is_selected={true} disabled={disabled}>
                    {format_amount(custom_amount)}
                </AmountButton>
            )}

            <CustomInput
                type="number"
                placeholder="Custom"
                value={custom_input}
                onInput={(e) => set_custom_input((e.target as HTMLInputElement).value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') handle_custom_submit();
                }}
                min={config.trading.min_trade_amount}
                max={config.trading.max_trade_amount}
                disabled={disabled}
            />

            {can_add_preset && custom_input && (
                <ActionButton onClick={handle_add_preset}>+ Save</ActionButton>
            )}

            <ActionButton onClick={() => set_is_editing(!is_editing)}>
                {is_editing ? 'Done' : 'Edit'}
            </ActionButton>
        </Container>
    );
}

export function use_selected_trade_amount(): number {
    return use_widget_store((s) => s.get_current_trade_amount());
}
```

---

## Part 10: Widget Entry Point

### Why This Matters

The entry point is the public API that exchanges use to embed the widget. It creates a Shadow DOM for style isolation and returns a handle for cleanup.

### Task 10.1: Update Widget Entry Point

**Update file:** `src/widget.ts`

```typescript
import { render } from 'preact';
import { App } from './app';
import { initialize_widget, destroy_widget } from './services/initialization_service';

interface WidgetConfig {
    container_selector: string;
    api_key: string;
    exchange_user_id?: string;
}

interface WidgetInstance {
    destroy: () => void;
}

const ExchangeWidget = {
    init: async (widget_config: WidgetConfig): Promise<WidgetInstance | null> => {
        const container = document.querySelector(widget_config.container_selector);

        if (!container) {
            console.error(`[ExchangeWidget] Container not found: ${widget_config.container_selector}`);
            return null;
        }

        const shadow_root = container.attachShadow({ mode: 'open' });

        const success = await initialize_widget({
            api_key: widget_config.api_key,
            exchange_user_id: widget_config.exchange_user_id,
        });

        if (!success) {
            console.error('[ExchangeWidget] Initialization failed');
            return null;
        }

        render(<App />, shadow_root);

        return {
            destroy: () => {
                destroy_widget();
                shadow_root.innerHTML = '';
            },
        };
    },
};

(window as any).ExchangeWidget = ExchangeWidget;

export { ExchangeWidget };
```

---

## Part 11: App Component

### Why This Matters

The App component is the root component that handles initialization states (loading, error, ready) and renders the appropriate UI.

### Task 11.1: Update App Component

**Update file:** `src/app.tsx`

```typescript
import { ThemeProvider } from 'styled-components';
import { use_widget_store } from './store/widget_store';
import { LoadingState } from './components/LoadingState';
import { ErrorState } from './components/ErrorState';
import { ConnectionStatus } from './components/ConnectionStatus';
import { SandboxBanner } from './components/SandboxBanner';
import { WidgetContainer } from './components/WidgetContainer';
import { NewsFeed } from './features/news_feed/news_feed';
import config from './config/_index';

export function App() {
    const initialization_status = use_widget_store((s) => s.initialization_status);
    const initialization_error = use_widget_store((s) => s.initialization_error);
    const theme = use_widget_store((s) => s.theme);

    const active_theme = theme || config.theme.defaults;

    return (
        <ThemeProvider theme={active_theme}>
            <WidgetContainer>
                <SandboxBanner />

                {initialization_status === 'loading' && (
                    <LoadingState message="Initializing widget..." />
                )}

                {initialization_status === 'error' && (
                    <ErrorState
                        message="Failed to initialize widget"
                        detail={initialization_error || undefined}
                    />
                )}

                {initialization_status === 'ready' && (
                    <>
                        <ConnectionStatus />
                        <NewsFeed />
                    </>
                )}
            </WidgetContainer>
        </ThemeProvider>
    );
}
```

---

## Part 12: Build Configuration

### Why This Matters

The widget must be built as a single UMD file that exchanges can embed with a `<script>` tag.

### Task 12.1: Update Vite Configuration

**Update file:** `vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
    plugins: [preact()],
    build: {
        lib: {
            entry: 'src/widget.ts',
            name: 'ExchangeWidget',
            formats: ['umd'],
            fileName: () => 'widget.js',
        },
        rollupOptions: {
            output: {
                manualChunks: undefined,
                inlineDynamicImports: true,
            },
        },
        cssCodeSplit: false,
        minify: 'esbuild',
        sourcemap: false,
    },
});
```

### Task 12.2: Create Production Embed Example

**Create file:** `examples/embed.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>247 Terminal Widget - Embed Example</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: #1a1a1a;
            color: #fff;
        }
        h1 { margin-bottom: 20px; }
        #terminal-widget {
            width: 400px;
            height: 600px;
            border: 1px solid #333;
            border-radius: 8px;
            overflow: hidden;
        }
        .trade-log {
            margin-top: 20px;
            padding: 16px;
            background: #2a2a2a;
            border-radius: 8px;
            font-family: monospace;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <h1>Exchange Website</h1>
    <div id="terminal-widget"></div>
    <div class="trade-log">
        <strong>Trade Events:</strong>
        <pre id="trade-output">Waiting for trades...</pre>
    </div>

    <script src="../dist/widget.js"></script>
    <script>
        document.addEventListener('247terminal:trade', function(event) {
            var output = document.getElementById('trade-output');
            output.textContent = JSON.stringify(event.detail, null, 2);
            console.log('Trade requested:', event.detail);
        });

        ExchangeWidget.init({
            container_selector: '#terminal-widget',
            api_key: 'wk_live_your_api_key',
            exchange_user_id: 'user-uuid-from-exchange',
        }).then(function(instance) {
            if (instance) {
                console.log('Widget initialized successfully');
            } else {
                console.error('Widget initialization failed');
            }
        });
    </script>
</body>
</html>
```

### Task 12.3: Create Sandbox Test Page

**Create file:** `examples/sandbox-test.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Widget Sandbox Test</title>
    <style>
        body {
            font-family: system-ui, sans-serif;
            background: #0a0a0f;
            color: #fff;
            padding: 20px;
            margin: 0;
        }
        h1 { color: #f59e0b; }
        #widget {
            width: 400px;
            height: 600px;
            border: 1px solid #333;
            border-radius: 8px;
        }
        #trade-log {
            margin-top: 20px;
            padding: 16px;
            background: #1a1a24;
            border-radius: 8px;
            font-family: monospace;
            font-size: 12px;
            max-height: 300px;
            overflow-y: auto;
        }
        .trade-entry {
            padding: 8px;
            margin-bottom: 8px;
            background: #12121a;
            border-radius: 4px;
            border-left: 3px solid #f59e0b;
        }
    </style>
</head>
<body>
    <h1>Sandbox Test Environment</h1>
    <p>Trades are simulated - no real orders will be placed.</p>

    <div id="widget"></div>

    <div id="trade-log">
        <strong>Trade Events:</strong>
        <div id="trade-entries"></div>
    </div>

    <script src="../dist/widget.js"></script>
    <script>
        document.addEventListener('247terminal:trade', function(event) {
            var entries = document.getElementById('trade-entries');
            var entry = document.createElement('div');
            entry.className = 'trade-entry';
            entry.innerHTML =
                '<div><strong>' + event.detail.side.toUpperCase() + ' ' + event.detail.coin + '</strong></div>' +
                '<div>Amount: $' + event.detail.amount_usd + '</div>' +
                '<div>Trade ID: ' + event.detail.trade_id + '</div>' +
                '<div>Sandbox: ' + (event.detail.is_sandbox ? 'Yes' : 'No') + '</div>' +
                '<div style="font-size:10px;color:#666">' + new Date().toISOString() + '</div>';
            entries.insertBefore(entry, entries.firstChild);
            console.log('[SANDBOX TEST] Trade event received:', event.detail);
        });

        ExchangeWidget.init({
            container_selector: '#widget',
            api_key: 'wk_test_sandbox123',
            exchange_user_id: 'test-user-001',
        }).then(function(instance) {
            if (instance) {
                console.log('Widget initialized in sandbox mode');
            }
        });
    </script>
</body>
</html>
```

---

## Part 13: Testing

### Task 13.1: Local Development Testing

**Terminal 1 - Start backend:**

```bash
cd ../247-terminal-backend
npm run dev
```

**Terminal 2 - Start widget dev server:**

```bash
pnpm dev
```

### Task 13.2: WebSocket Connection Test

```bash
cd _documentation
node test_widget_connection.js
```

**Expected output:**

```
[timestamp] ✅ Connection opened
[timestamp] 📤 Sending auth message
[timestamp] 📥 Received message (type: auth_success)
[timestamp] 🏓 Received pong
```

### Task 13.3: Integration Test Checklist

| Test | Steps | Expected Result |
|------|-------|-----------------|
| Config fetch | Init widget, check Network tab | 200 OK, config returned |
| WebSocket auth | Init widget, check WS frames | auth_success message |
| News display | Publish news from backend | News card appears |
| Trade token | Click trade button | Token generated, event dispatched |
| Reconnection | Stop/start backend | Widget reconnects automatically |
| Error state | Use invalid api_key | Error displayed |
| Shadow DOM | Inspect widget element | Styles isolated |
| Sandbox mode | Use sandbox test page | Trades simulated |
| Trade amounts | Add/remove presets | Persists across refresh |

### Task 13.4: Sandbox Testing Workflow

| Environment | Config | API Key | Result |
|-------------|--------|---------|--------|
| Local dev | `VITE_SANDBOX_MODE=true` | Any | Frontend simulation |
| Staging | `VITE_SANDBOX_MODE=false` | `wk_test_*` | Backend simulation |
| Production test | `VITE_SANDBOX_MODE=false` | `wk_test_*` | Backend simulation |
| Production live | `VITE_SANDBOX_MODE=false` | `wk_live_*` | Real trades |

---

## Part 14: Production Deployment

### Task 14.1: Build for Production

```bash
pnpm build
```

**Output:** `dist/widget.js` (single file, minified)

### Task 14.2: CDN Deployment Options

| Option | Pros | Cons |
|--------|------|------|
| AWS S3 + CloudFront | Full control, versioning | More setup |
| Vercel | Simple, automatic | Less control |
| Cloudflare Pages | Free, fast global CDN | Cloudflare ecosystem |

### Task 14.3: CDN Configuration

**Cache headers:**

```
Cache-Control: public, max-age=31536000, immutable
```

**CORS:**

```
Access-Control-Allow-Origin: *
```

**Versioned URL structure:**

```
https://cdn.247terminal.com/widget/v1/widget.js
https://cdn.247terminal.com/widget/v1.0.0/widget.js
https://cdn.247terminal.com/widget/latest/widget.js
```

### Task 14.4: Production Embed Code

```html
<div id="247-terminal-widget"></div>
<script src="https://cdn.247terminal.com/widget/v1/widget.js"></script>
<script>
    ExchangeWidget.init({
        container_selector: '#247-terminal-widget',
        api_key: 'wk_live_your_production_key',
        exchange_user_id: 'user-uuid-from-your-system',
    });

    document.addEventListener('247terminal:trade', function(event) {
        fetch('/api/execute-trade', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: event.detail.token,
                trade_id: event.detail.trade_id,
            }),
        });
    });
</script>
```

---

## File Summary

### Files to Create

| File | Purpose |
|------|---------|
| `src/config/_index.ts` | Centralized configuration |
| `src/config/theme.ts` | Theme builder with defaults |
| `src/types/trade.ts` | Trade type definitions |
| `src/types/widget.ts` | Widget type definitions |
| `src/services/initialization_service.ts` | Widget startup orchestration |
| `src/services/trade_service.ts` | Trade execution with sandbox |
| `src/components/LoadingState.tsx` | Loading spinner |
| `src/components/ErrorState.tsx` | Error display |
| `src/components/ConnectionStatus.tsx` | Connection indicator |
| `src/components/SandboxBanner.tsx` | Sandbox mode indicator |
| `src/components/TradeAmountSelector.tsx` | User-configurable amounts |
| `.env.development` | Dev environment variables |
| `.env.production` | Prod environment variables |
| `examples/embed.html` | Production embed example |
| `examples/sandbox-test.html` | Sandbox testing page |

### Files to Update

| File | Changes |
|------|---------|
| `src/widget.ts` | Use initialization service, Shadow DOM, return cleanup handle |
| `src/app.tsx` | Handle initialization states, sandbox banner |
| `src/services/api_service.ts` | Use config, typed responses |
| `src/services/websocket_service.ts` | Use config, proper reconnection |
| `src/store/widget_store.ts` | Add trade amounts, initialization status, persist |
| `src/store/news_store.ts` | Add all required methods |
| `src/types/news.ts` | Add WebSocketMessage union type |
| `vite.config.ts` | UMD build configuration |

---

## Quick Reference

### Backend Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/app/widget/config` | GET | Fetch widget configuration |
| `/api/app/widget/generate-trade-token` | POST | Generate signed trade JWT |
| `/ws/widget` | WebSocket | Real-time news streaming |

### WebSocket Messages

| Direction | Type | Purpose |
|-----------|------|---------|
| Client → Server | `auth` | Send api_key |
| Client → Server | `ping` | Keep connection alive |
| Server → Client | `auth_success` | Authentication confirmed |
| Server → Client | `auth_error` | Authentication failed |
| Server → Client | `news` | New news item |
| Server → Client | `ai_sentiment` | Sentiment update |
| Server → Client | `trading_volume_alert` | Volume spike alert |
| Server → Client | `pong` | Heartbeat response |

### Custom Events

| Event | When Fired | Payload |
|-------|------------|---------|
| `247terminal:trade` | User clicks trade button | `{ token, trade_id, coin, side, amount_usd, news_id, is_sandbox? }` |

### Trade Params Structure

```typescript
{
    coin: string;           // 'BTC', 'ETH', 'SOL'
    side: 'long' | 'short';
    amount_usd: number;     // Dollar value
    news_id: string;        // Required - tracks which news triggered trade
    timestamp: number;      // When clicked
}
```

---

## Notes

- All code follows snake_case naming convention
- No comments in code - self-documenting through clear naming
- TypeScript strict mode enabled
- Shadow DOM used for style isolation
- Zustand for state management with persist middleware
- Preact for minimal bundle size (~3KB vs React's ~40KB)
- Trade amounts persist to localStorage
- Sandbox mode for safe testing
- Default theme fallback when no exchange config
