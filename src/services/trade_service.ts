import config from "../config/_index.ts";
import { api_service } from "./api_service.ts";
import { use_widget_store } from "../store/widget_store.ts";
import type { TradeParams, TradeEventDetail, TradeResult } from "../types/trade.ts";

interface TradeRequest {
    coin: string,
    amount_usd: number;
    side: 'long' | 'short';
    news_id: string;
}

export async function execute_trade(request: TradeRequest): Promise<TradeResult> {
    const { feature_flags } = use_widget_store.getState();

    if (!feature_flags?.allow_trading) return { success: false, error: 'Trading is disabled for this widget' };
    if (config.trading.sandbox_mode) return execute_sandbox_trade(request);

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
        amount: request.amount_usd,
        news_id: request.news_id,
        timestamp: Date.now(),
    };

    const token_response = await api_service.generate_trade_token(trade_params);
    if (!token_response) return { success: false, error: 'Failed to generate trade token' };

    dispatch_trade_event({
        token: token_response.token,
        trade_id: token_response.trade_id,
    });

    return {
        success: true,
        trade_id: token_response.trade_id,
    }
}

function dispatch_trade_event(detail: TradeEventDetail): void {
    const trade_event = new CustomEvent<TradeEventDetail>('247terminal:trade', {
        detail,
        bubbles: true,
        composed: true,
    });
    
    document.dispatchEvent(trade_event);
}