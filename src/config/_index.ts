const config = {
    environment: {
        is_production: import.meta.env.PROD,
        is_development: import.meta.env.DEV,
        mode: import.meta.env.MODE,
    },
    api: {
        base_url: import.meta.env.VITE_API_BASE_URL,
        timeout: 30000,
    },
    websocket: {
        url: import.meta.env.VITE_WEBSOCKET_URL,
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
}

export default config;
