import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { RouterProvider } from '@tanstack/react-router'
import './index.css'
import { registerSW } from 'virtual:pwa-register'
import { initializeFontScale } from '@/hooks/useFontScale'
import { queryClient } from './lib/query-client'
import { createAppRouter } from './router'
import { I18nProvider } from './lib/i18n-context'
import { restoreSpaRedirect } from './lib/spaRedirect'
import { installScrollRestorationGuard } from './lib/scrollStorageGuard'

async function bootstrap() {
    installScrollRestorationGuard()
    initializeFontScale()

    // Handle GitHub Pages 404 redirect for SPA routing
    // When GitHub Pages can't find a path (e.g. /sessions/xxx), it serves 404.html
    // which stores the path in sessionStorage and redirects to /
    restoreSpaRedirect()

    const updateSW = registerSW({
        onNeedRefresh() {
            if (confirm('New version available! Reload to update?')) {
                updateSW(true)
            }
        },
        onOfflineReady() {
            console.log('App ready for offline use')
        },
        onRegistered(registration) {
            if (registration) {
                setInterval(() => {
                    registration.update()
                }, 60 * 60 * 1000)
            }
        },
        onRegisterError(error) {
            console.error('SW registration error:', error)
        }
    })

    const router = createAppRouter()

    ReactDOM.createRoot(document.getElementById('root')!).render(
        <React.StrictMode>
            <I18nProvider>
                <QueryClientProvider client={queryClient}>
                    <RouterProvider router={router} />
                    {import.meta.env.DEV ? <ReactQueryDevtools initialIsOpen={false} /> : null}
                </QueryClientProvider>
            </I18nProvider>
        </React.StrictMode>
    )
}

bootstrap()
