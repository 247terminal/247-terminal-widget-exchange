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