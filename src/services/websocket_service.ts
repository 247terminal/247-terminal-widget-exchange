import { use_news_store } from "../store/news_store";
import type { NewsItem, SentimentData, TradingVolumeAlert, WebSocketMessage } from "../types/news";

const WS_BASE_URL = 'wss://api.247terminal.com/ws/widget';

interface WebSocketServiceConfig {
    api_key: string;
    on_open?: () => void;
    on_close?: (event: CloseEvent) => void;
    on_error?: (event: Event) => void;
}

class WebSocketService {
    private socket: WebSocket | null = null;
    private config: WebSocketServiceConfig | null = null;
    private reconnect_attempts = 0;
    private max_reconnect_attempts = 5;
    private reconnect_delay = 1000;
    private ping_interval: ReturnType<typeof setInterval> | null = null;

    connect(config: WebSocketServiceConfig) {
        this.config = config;
        this.establish_connection();
    }

    private establish_connection() {
        if (!this.config) return;

        const { set_connection_status, add_news_item, add_sentiment, add_volume_alert } = use_news_store.getState();

        try {
            this.socket = new WebSocket(WS_BASE_URL);
        
            this.socket.onopen = () => {
                this.send_auth_message();
                this.start_ping_interval();
                this.reconnect_attempts = 0;
            };
            
            this.socket.onmessage = (event) => {
                this.handle_message(event.data);
            };

            this.socket.onclose = (event) => {
                this.stop_ping_interval();
                set_connection_status(false);
                this.config?.on_close?.(event);

                if (event.code !== 1000 && this.reconnect_attempts < this.max_reconnect_attempts) this.schedule_reconnect();
            };

            this.socket.onerror = (error) => {
                set_connection_status(false, 'websocket connection error');
                this.config?.on_error?.(error);
            };
        } catch (error) {
            set_connection_status(false, 'failed to create websocket connection');
        }
    }

    private send_auth_message() {
        if (!this.socket || !this.config) return;

        const auth_message = {
            type: 'auth',
            api_key: this.config.api_key,
        };

        this.socket.send(JSON.stringify(auth_message));
    }

    private handle_message(data: string) {
        const { set_connection_status, add_news_item, add_sentiment, add_volume_alert } = use_news_store.getState();

        try {
            const message: WebSocketMessage = JSON.parse(data);

            if ('type' in message) {
                if (message.type === 'authorized') {
                    set_connection_status(true);
                    this.config?.on_open?.();
                    return;
                }
                if (message.type === 'ai_sentiment') {
                    add_sentiment(message as SentimentData);
                    return;
                }
                if (message.type === 'trading_volume_alert') {
                    add_volume_alert(message as TradingVolumeAlert);
                    return
                }
            }

            if ('_id' in message && 'title' in message) {
                add_news_item(message as NewsItem);
            }
        } catch (error) {
            console.error('failed to parse websocket message:', error);
        }
    }

    private start_ping_interval() {
        this.ping_interval = setInterval(() => {
            if (this.socket?.readyState === WebSocket.OPEN) {
                this.socket.send('ping');
            }
        }, 3000);
    }

    private stop_ping_interval() {
        if (this.ping_interval) {
            clearInterval(this.ping_interval);
            this.ping_interval = null;
        }
    }

    private schedule_reconnect() {
        this.reconnect_attempts++;
        const delay = this.reconnect_delay * Math.pow(2, this.reconnect_attempts - 1);

        setTimeout(() => {
            this.establish_connection();
        }, delay);
    }

    disconnect() {
        this.stop_ping_interval();
        if (this.socket) {
            this.socket.close(1000, 'client disconnecting')
            this.socket = null;
        }
        this.config = null;
        this.reconnect_attempts = 0;
    }

    is_connected(): boolean {
        return this.socket?.readyState === WebSocket.OPEN;
    }
}

export const websocket_service = new WebSocketService()