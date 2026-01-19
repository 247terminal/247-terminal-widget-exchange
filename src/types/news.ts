export interface NewsItem {
    _id?: string;
    title: string;
    body?: string;
    time: number;
    type?: string;
    source?: string;
    icon?: string;
    link?: string;
    image?: string;
    url?: string;
    info?: NewsItemInfo;
    scraped_time?: number;
    sentiment?: 'positive' | 'negative' | 'neutral';
    coins?: string[];
}

export interface NewsItemInfo {
    binanceUid?: string | null;
    squareUid?: string;
    isReply?: boolean;
    isRetweet?: boolean;
    isQuote?: boolean;
    isSelfReply?: boolean;
    isArticle?: boolean;
    authorVerificationType?: number;
    isTranslated?: boolean;
    originalLanguage?: string;
    embedded_tweet?: EmbeddedTweet;
    username?: string;
    profileUrl?: string;
}

export interface EmbeddedTweet {
    id: string;
    text: string;
    author_name: string;
    author_handle: string;
    author_avatar?: string;
    created_at: string;
    link?: string;
    image?: string;
}

export interface SentimentData {
    news_id: string;
    sentiment: 'positive' | 'negative' | 'neutral';
    confidence?: number;
}

export interface TradingVolumeAlert {
    type: 'trading_volume_alert';
    title: string;
    body?: string;
    time: number;
    link?: string;
    icon?: string;
    coin: string;
    direction: 'LONG' | 'SHORT';
    volume: number;
    user_count: number;
}

export interface TradingConfig {
    enabled: boolean;
    coins: CoinConfig[];
    preset_amounts: number[];
}

export interface CoinConfig {
    symbol: string;
    name: string;
    enabled: boolean;
}

export type NewsType = 'news' | 'twitter' | 'alert' | 'discord';

export type WebSocketMessage =
    | { type: 'auth_success'; exchange_id: string }
    | { type: 'auth_error'; error: string; code: number }
    | { type: 'news'; data: NewsItem }
    | { type: 'ai_sentiment'; news_id: string; sentiment: string }
    | { type: 'trading_volume_alert' } & TradingVolumeAlert
    | { type: 'pong' };
