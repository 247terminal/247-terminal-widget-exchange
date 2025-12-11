# Secure Trading Widget: Detailed Implementation Guide

## 1. Overview

This guide provides a comprehensive plan for building the secure, embeddable, and multi-tenant trading widget. It covers everything from project setup to deployment, incorporating modern best practices for security, performance, and maintainability.

The primary goal is to create a self-contained frontend application that can be safely embedded into any third-party exchange website. It will communicate with our backend to authorize trades securely without exposing sensitive information or allowing circumvention of our tracking mechanisms.

## 2. Technology Stack

The technology choices below are optimized for building a lightweight, secure, and maintainable widget.

-   **Build Tool:** **Vite**
    -   **Reasoning:** Provides an extremely fast development experience (HMR) and a highly optimized build process, which is essential for frontend development.

-   **Framework:** **Preact**
    -   **Reasoning:** A lightweight (3kb) alternative to React with the same modern API. Its small bundle size is a significant advantage for an embeddable widget, as it reduces the initial load time on the host page. The familiar React-like API minimizes the learning curve and allows us to leverage the vast React ecosystem. While React itself is secure, Preact provides these benefits without the baggage of a larger library, making it ideal for this use case.

-   **Language:** **TypeScript**
    -   **Reasoning:** Non-negotiable for a financial application. It provides compile-time type checking, which prevents a wide class of common bugs and improves code quality and maintainability.

-   **Styling:** **Styled-Components**
    -   **Reasoning:** Provides automatic style encapsulation by generating unique class names. This is the most critical feature for a widget's styling, as it **guarantees** that our widget's styles will not conflict with the host page's CSS, and vice-versa.

-   **State Management:** **Zustand**
    -   **Reasoning:** A small, fast, and scalable state-management solution. Its simple, hook-based API reduces boilerplate and makes managing state straightforward without the complexity of larger libraries like Redux.

## 3. Project Setup

Follow these steps to create and configure the project.

**1. Scaffold the Project with Vite**
This command will create a new project in a folder named `trading-widget` using the Preact and TypeScript template.

```bash
npm create vite@latest trading-widget -- --template preact-ts
```

**2. Navigate into the Project Directory**
```bash
cd trading-widget
```

**3. Install Dependencies**
Install the core libraries for styling and state management.

```bash
npm install styled-components zustand
```

**4. Install Development Dependencies**
Install the necessary type definitions for our chosen libraries.

```bash
npm install -D @types/styled-components
```

**5. Start the Development Server**
This will launch the application on a local development server.

```bash
npm run dev
```

## 4. Project Structure

The scaffolded project will have a standard structure. We will organize it as follows to ensure clarity and separation of concerns. Note the use of `snake_case` for new files and directories to maintain consistency.

```
/src
|-- /assets               # Static assets like images or fonts
|-- /components           # Generic, reusable UI components (e.g., Button, Input)
|-- /features             # Complex components with business logic (e.g., TradeForm)
|-- /hooks                # Custom Preact hooks (e.g., use_api, use_websocket)
|-- /services             # Modules for external communication
|   |-- api_service.ts    # Handles all HTTP requests to our backend
|   |-- websocket_service.ts # Manages WebSocket connection
|-- /store                # State management (Zustand store)
|   |-- widget_store.ts   # The central store for the widget
|-- /styles               # Global styles and theme configuration
|   |-- theme.ts          # Theme variables (colors, fonts)
|-- /types                # Global TypeScript type definitions
|   |-- index.ts          # Main type definitions
|-- app.tsx               # Main application component, rendered inside the shadow DOM
|-- main.tsx              # DO NOT USE - We will use widget.ts instead
|-- widget.ts             # PUBLIC INTERFACE - The entry point for the host page
```

## 5. Public Interface and Initialization

The widget must be initialized by the host page. We will expose a global `OurWidget` object with an `init` function. The entry point of our application will be `src/widget.ts`.

A **Shadow DOM** will be used to render the widget. This is the most robust way to ensure complete isolation of both styles and markup, preventing any possibility of collision with the host page.

**`src/widget.ts`**
```typescript
import { render } from 'preact';
import { App } from './app.tsx';
import { use_widget_store } from './store/widget_store.ts';

// Define the configuration object structure
interface WidgetConfig {
    container_selector: string;
    exchange_id: string;
    exchange_user_id: string;
}

// Define the public interface that will be attached to the window
const OurWidget = {
    init: (config: WidgetConfig) => {
        const { container_selector, exchange_id, exchange_user_id } = config;

        // 1. Find the container element on the host page
        const container_element = document.querySelector(container_selector);
        if (!container_element) {
            console.error('Widget container not found');
            return;
        }

        // 2. Initialize the state management store with IDs
        use_widget_store.getState().initialize_ids({ exchange_id, exchange_user_id });

        // 3. Create a Shadow DOM for style and markup encapsulation
        const shadow_root = container_element.attachShadow({ mode: 'open' });

        // 4. Create a div inside the shadow DOM for Preact to render into
        const app_root = document.createElement('div');
        shadow_root.appendChild(app_root);

        // 5. Render the Preact application into the shadow DOM
        render(App(), app_root);
    }
};

// Expose the public interface on the window object
(window as any).OurWidget = OurWidget;

export default OurWidget;
```

## 6. State Management

The Zustand store is the single source of truth for the widget's state.

**`src/store/widget_store.ts`**
```typescript
import { create } from 'zustand';

interface ThemeConfig {
    primary_color?: string;
    background_color?: string;
    // ... other theme properties
}

interface FeatureFlags {
    show_pnl?: boolean;
    allow_market_orders?: boolean;
    // ... other feature flags
}

interface WidgetState {
    exchange_id: string | null;
    exchange_user_id: string | null;
    theme_config: ThemeConfig;
    feature_flags: FeatureFlags;
    is_loading: boolean;
    error: string | null;
    
    initialize_ids: (ids: { exchange_id: string; exchange_user_id: string }) => void;
    set_config: (config: { theme_config: ThemeConfig; feature_flags: FeatureFlags }) => void;
    set_loading: (is_loading: boolean) => void;
    set_error: (error: string | null) => void;
}

export const use_widget_store = create<WidgetState>((set) => ({
    exchange_id: null,
    exchange_user_id: null,
    theme_config: {},
    feature_flags: {},
    is_loading: false,
    error: null,

    initialize_ids: (ids) => set({ 
        exchange_id: ids.exchange_id, 
        exchange_user_id: ids.exchange_user_id 
    }),

    set_config: (config) => set({
        theme_config: config.theme_config,
        feature_flags: config.feature_flags,
    }),

    set_loading: (is_loading) => set({ is_loading }),
    set_error: (error) => set({ error }),
}));
```

## 7. Service Layer

Services handle all external communication, keeping API logic separate from UI components.

**`src/services/api_service.ts`**
```typescript
import { use_widget_store } from '../store/widget_store';

const API_BASE_URL = 'https://your-backend.com/api/app/widget';

interface TradeParams {
    pair: string;
    amount: number;
    side: 'buy' | 'sell';
}

export const api_service = {
    fetch_widget_config: async () => {
        const { exchange_id, set_config, set_error } = use_widget_store.getState();
        try {
            const response = await fetch(`${API_BASE_URL}/config?id=${exchange_id}`);
            if (!response.ok) {
                throw new Error('Failed to fetch widget configuration.');
            }
            const config = await response.json();
            set_config(config);
        } catch (err: any) {
            set_error(err.message);
        }
    },

    generate_trade_token: async (trade_params: TradeParams): Promise<string | null> => {
        const { exchange_id, exchange_user_id, set_error } = use_widget_store.getState();
        try {
            const response = await fetch(`${API_BASE_URL}/generate-trade-token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    exchange_id,
                    exchange_user_id,
                    trade_params,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to generate trade token.');
            }

            const { token } = await response.json();
            return token;
        } catch (err: any) {
            set_error(err.message);
            return null;
        }
    },
};
```

## 8. Exchange API Interaction

As defined in the high-level plan, all requests from the widget to the host exchange's API **must** include two headers:

-   `Authorization: Bearer <jwt>`: The one-time token from our backend.
-   `X-Source-Provider: 247-Terminal-Widget`: The static identifier.

**Example within `TradeForm.tsx` feature:**
```typescript
// ... inside a component function ...
const { set_loading } = use_widget_store();

const handle_trade_execution = async (trade_params: TradeParams) => {
    set_loading(true);
    
    // 1. Get token from our backend
    const token = await api_service.generate_trade_token(trade_params);

    if (token) {
        // 2. Make request to the EXCHANGE's API
        const exchange_response = await fetch('https://exchange.com/api/v1/trade', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-Source-Provider': '247-Terminal-Widget',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(trade_params)
        });
        
        // 3. Handle exchange response...
    }
    
    set_loading(false);
};
```

## 9. Build Configuration

To deploy the widget, we need to configure Vite to produce a single, bundled JavaScript file that can be easily loaded by the host exchange.

**`vite.config.ts`**
```typescript
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()],
  build: {
    lib: {
      // The entry point is our public widget interface
      entry: 'src/widget.ts', 
      // The name of the global variable
      name: 'OurWidget', 
      // The output format
      formats: ['umd'], 
      // The name of the output file
      fileName: () => 'main.js', 
    },
    rollupOptions: {
        // We don't need to split chunks for a single widget file
        output: {
            manualChunks: undefined,
        },
    },
  },
});
```
After running `npm run build`, a single `main.js` file will be created in the `dist` directory. This is the file that will be deployed to the CDN and loaded by the exchange.
