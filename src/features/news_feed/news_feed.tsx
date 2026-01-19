import { useState } from 'preact/hooks';
import styled from 'styled-components';
import { use_news_store } from '../../store/news_store';
import { use_widget_store } from '../../store/widget_store';
import { NewsCard } from './news_card';
import { NewsDetail } from './news_detail';
import { SettingsMenu } from '../../components/SettingsMenu';
import { MoreIcon } from '../../components/icons';
import type { NewsItem, TradingConfig } from '../../types/news';
import config from '../../config/_index';
import { execute_trade } from '../../services/trade_service';

const Container = styled.div`
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
`;

const Header = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: ${({ theme }) => theme.spacing.md};
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const HeaderLeft = styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
`;

const Title = styled.h2`
    margin: 0;
    font-size: ${({ theme }) => theme.font_sizes.lg};
`;

const ConnectionStatus = styled.span<{ $is_connected: boolean }>`
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: ${({ $is_connected, theme }) =>
        $is_connected ? theme.colors.success : theme.colors.danger};
`;

const HeaderRight = styled.div`
    position: relative;
`;

const SettingsButton = styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border: none;
    border-radius: ${({ theme }) => theme.radii.sm};
    background: transparent;
    color: ${({ theme }) => theme.colors.text_secondary};
    cursor: pointer;
    transition: background-color 0.15s ease, color 0.15s ease;

    &:hover {
        background: ${({ theme }) => theme.colors.border};
        color: ${({ theme }) => theme.colors.text_primary};
    }
`;

const NewsList = styled.div`
    flex: 1;
    overflow-y: auto;
    padding: ${({ theme }) => theme.spacing.md};
    scrollbar-width: none;
    -ms-overflow-style: none;

    &::-webkit-scrollbar {
        display: none;
    }
`;

const EmptyState = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: ${({ theme }) => theme.colors.text_secondary};
`;

interface NewsFeedProps {
    on_trade_from_news?: (news_item: NewsItem) => void;
}

export function NewsFeed({ on_trade_from_news }: NewsFeedProps) {
    const [is_settings_open, set_is_settings_open] = useState(false);

    const {
        news_items,
        sentiment_map,
        is_connected,
        selected_news_id,
        set_selected_news
    } = use_news_store();

    const user_preferences = use_widget_store((s) => s.user_preferences);

    const build_trading_config = (news_coins?: string[]): TradingConfig | undefined => {
        if (!news_coins || news_coins.length === 0) return undefined;

        return {
            enabled: config.trading.enabled,
            coins: news_coins.map(symbol => ({ symbol, name: symbol, enabled: true })),
            preset_amounts: user_preferences.trade_amount_presets,
        };
    };

    const handle_trade = async (coin: string, amount: number, side: 'long' | 'short', news_id: string) => {
        const result = await execute_trade({
            coin,
            amount_usd: amount,
            side,
            news_id,
        });

        if (!result.success) {
            console.error('[news feed] trade failed: ', result.error);
            return;
        }

        console.info('[news feed] trade dispatched', {
            trade_id: result.trade_id,
            is_sandbox: result.is_sandbox,
        });
    };

    const toggle_settings = () => {
        set_is_settings_open(current => !current);
    };

    const selected_news = selected_news_id
        ? news_items.find(n => n._id === selected_news_id)
        : null;

    if (selected_news) {
        const sentiment_data = selected_news._id ? sentiment_map.get(selected_news._id) : undefined;
        return (
            <NewsDetail
                news_item={selected_news}
                sentiment={sentiment_data}
                on_back={() => set_selected_news(null)}
                on_trade={() => on_trade_from_news?.(selected_news)}
            />
        );
    }

    return (
        <Container>
            <Header>
                <HeaderLeft>
                    <Title>News Feed</Title>
                    <ConnectionStatus $is_connected={is_connected} />
                </HeaderLeft>
                <HeaderRight>
                    <SettingsButton onClick={toggle_settings} aria-label="Open settings">
                        <MoreIcon size={18} />
                    </SettingsButton>
                    <SettingsMenu
                        is_open={is_settings_open}
                        on_close={() => set_is_settings_open(false)}
                    />
                </HeaderRight>
            </Header>
            <NewsList>
                {news_items.length === 0 ? (
                    <EmptyState>
                        {is_connected ? 'Waiting for news...' : 'Connecting...'}
                    </EmptyState>
                ) : (
                    news_items.map((item, index) => {
                        const item_sentiment = item._id ? sentiment_map.get(item._id) : undefined;
                        const item_trading_config = build_trading_config(item.coins);
                        return (
                            <NewsCard
                                key={item._id || `news-${index}`}
                                news_item={item}
                                sentiment={item_sentiment?.sentiment}
                                on_click={item._id ? set_selected_news : undefined}
                                trading_config={item_trading_config}
                                button_style={user_preferences.button_style}
                                long_press_duration={user_preferences.long_press_duration}
                                on_trade={handle_trade}
                            />
                        );
                    })
                )}
            </NewsList>
        </Container>
    );
}