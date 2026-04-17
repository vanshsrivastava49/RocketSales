import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import AuthPage from './pages/AuthPage'
import AppShell from './components/AppShell'
import { AlertsProvider } from './contexts/AlertsContext'

function AppRouter() {
  const { user, loading } = useAuth()

  if (loading) return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--bg)',
      color: 'var(--muted2)', fontFamily: 'var(--mono)', fontSize: 14,
      gap: 12,
    }}>
      <span style={{
        width: 18, height: 18, border: '2px solid rgba(124,92,252,0.3)',
        borderTopColor: 'var(--accent)', borderRadius: '50%',
        animation: 'spin 0.7s linear infinite', display: 'inline-block',
      }} />
      Loading RocketSales…
    </div>
  )

  // ✅ FIX: Only render AlertsProvider when user is authenticated.
  // Previously AlertsProvider was always mounted, so it tried to fetch
  // /alerts/history before login and on every unauthenticated render,
  // flooding the backend with 401s and causing the context to throw
  // during the login→dashboard transition before `user` was set.
  if (!user) return <AuthPage />

  return (
    <AlertsProvider>
      <AppShell />
    </AlertsProvider>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 13,
            borderRadius: 10,
          },
          success: { iconTheme: { primary: '#00e5b4', secondary: 'var(--surface)' } },
          error:   { iconTheme: { primary: '#ff6b6b', secondary: 'var(--surface)' } },
        }}
      />
      <AppRouter />
    </AuthProvider>
  )
}