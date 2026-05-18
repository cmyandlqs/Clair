import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MainLayout } from '@/components/layout/MainLayout'
import { I18nProvider } from '@/lib/i18n'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 1,
    },
  },
})

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <MainLayout />
      </I18nProvider>
    </QueryClientProvider>
  )
}