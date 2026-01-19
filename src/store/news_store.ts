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

        const raw = item as any;
        const normalized_item: NewsItem = {
            ...item,
            body: item.body || raw.content || '',
            time: typeof item.time === 'string'
                ? new Date(item.time).getTime()
                : (item.time || Date.now()),
            scraped_time: item.scraped_time || raw.scrapedTime || Date.now(),
        };

        const updated = [normalized_item, ...state.news_items]
            .sort((a, b) => b.time - a.time)
            .slice(0, MAX_NEWS_ITEMS);
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