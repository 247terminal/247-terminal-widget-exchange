import { api_service } from "./api_service.ts";
import { websocket_service } from "./websocket_service.ts";
import { use_widget_store } from "../store/widget_store.ts";
import { use_news_store } from "../store/news_store.ts";
import { build_theme } from "../config/theme.ts";
import config from "../config/_index.ts";

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

        if (options.exchange_user_id) {
            const saved_preferences = await api_service.fetch_user_preferences();
            if (saved_preferences) {
                widget_store.set_user_preferences(saved_preferences);
            }
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