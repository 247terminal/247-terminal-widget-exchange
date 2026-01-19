import { render } from 'preact'
import './index.css'
import { App } from './app.tsx'
import { initialize_widget } from './services/initialization_service'

function DevLayout() {
    return (
        <div style={{
            display: 'flex',
            gap: '24px',
            padding: '24px',
            height: '100vh',
            boxSizing: 'border-box',
            background: '#1a1a1a',
        }}>
            <div style={{
                width: 'calc(100% / 6)',
                minWidth: '280px',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
            }}>
                <div style={{
                    color: '#888',
                    fontSize: '12px',
                    marginBottom: '8px',
                    fontFamily: 'monospace',
                }}>
                    1/6 width (~280px min)
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                    <App />
                </div>
            </div>

            <div style={{
                width: 'calc(100% / 3)',
                minWidth: '400px',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
            }}>
                <div style={{
                    color: '#888',
                    fontSize: '12px',
                    marginBottom: '8px',
                    fontFamily: 'monospace',
                }}>
                    1/3 width (~400px min)
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                    <App />
                </div>
            </div>
        </div>
    )
}

window.addEventListener('247terminal:trade', (event) => {
    console.log('🔔 Trade Event Received:', (event as CustomEvent).detail);
});

initialize_widget({
    api_key: 'wk_test_abc123def456',
    exchange_user_id: 'test-user-001',
}).then(() => {
    render(<DevLayout />, document.getElementById('app')!)
})
