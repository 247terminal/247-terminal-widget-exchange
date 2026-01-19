import { ThemeProvider } from 'styled-components';
import { use_widget_store } from './store/widget_store';
import { LoadingState } from './components/LoadingState';
import { ErrorState } from './components/ErrorState';
import { SandboxBanner } from './components/SandboxBanner';
import { WidgetContainer } from './components/WidgetContainer';
import { NewsFeed } from './features/news_feed/news_feed';
import config from './config/_index';

export function App() {
    const initialization_status = use_widget_store((s) => s.initialization_status);
    const initialization_error = use_widget_store((s) => s.initialization_error);
    const theme = use_widget_store((s) => s.theme);

    const active_theme = theme || config.theme.defaults;

    return (
        <ThemeProvider theme={active_theme}>
            <WidgetContainer>
                <SandboxBanner />

                {initialization_status === 'loading' && (
                    <LoadingState message="Initializing widget..." />
                )}

                {initialization_status === 'error' && (
                    <ErrorState
                        message="Failed to initialize widget"
                        detail={initialization_error || undefined}
                    />
                )}

                {initialization_status === 'ready' && (
                    <NewsFeed />
                )}
            </WidgetContainer>
        </ThemeProvider>
    );
}