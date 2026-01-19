export type TradeSide = 'long' | 'short';

export interface TradeParams {
    coin: string;
    side: TradeSide;
    amount: number;
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
    is_sandbox?: boolean;
}

export interface TradeResult {
    success: boolean;
    trade_id?: string;
    error?: string;
    is_sandbox?: boolean;
}