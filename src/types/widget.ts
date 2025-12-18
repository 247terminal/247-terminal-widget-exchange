import type { ThemeConfig } from "../config/theme.ts";

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
