import { render } from 'preact';
import { StyleSheetManager } from 'styled-components';
import { App } from './app';
import { initialize_widget, destroy_widget } from './services/initialization_service';

interface WidgetConfig {
    container_selector: string;
    api_key: string;
    exchange_user_id?: string;
}

interface WidgetInstance {
    destroy: () => void;
}

const ExchangeWidget = {
    init: async (widget_config: WidgetConfig): Promise<WidgetInstance | null> => {
        const container = document.querySelector(widget_config.container_selector);

        if (!container) {
            console.error(`[ExchangeWidget] Container not found: ${widget_config.container_selector}`);
            return null;
        }

        const shadow_root = container.attachShadow({ mode: 'open' });

        const style_container = document.createElement('div');
        const app_container = document.createElement('div');
        app_container.style.height = '100%';
        shadow_root.appendChild(style_container);
        shadow_root.appendChild(app_container);

        const success = await initialize_widget({
            api_key: widget_config.api_key,
            exchange_user_id: widget_config.exchange_user_id,
        });

        if (!success) {
            console.error('[ExchangeWidget] Initialization failed');
            return null;
        }

        render(
            <StyleSheetManager target={style_container}>
                <App />
            </StyleSheetManager>,
            app_container
        );

        return {
            destroy: () => {
                destroy_widget();
                shadow_root.innerHTML = '';
            },
        };
    },
};

(window as any).ExchangeWidget = ExchangeWidget;

export { ExchangeWidget };