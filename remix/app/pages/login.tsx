import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'

import { Document } from '../document.tsx'
import { FONT_UI, SURFACE_BODY, TEXT_MUTED } from '../constants/theme.ts'
import { WalletConnect } from '../assets/wallet-connect.tsx'
import { PageLoader } from '../assets/page-loader.tsx'
import { WalletIcon } from '../components/icons/wallet.tsx'

interface LoginPageProps {
  error?: string
  user?: { address: string }
}

export function LoginPage(handle: Handle<LoginPageProps>) {
  const { user } = handle.props

  return () => (
    <Document
      title="Selbo - Sign In"
      head={
        <>
          <meta name="color-scheme" content="dark" />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link
            rel="stylesheet"
            href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          />
          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </>
      }
      user={user}
      hideNavLinks
    >
      <div
        mix={css({
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: SURFACE_BODY,
          fontFamily: FONT_UI,
          gap: '24px',
          padding: '24px',
        })}
      >
        <h1
          mix={css({
            fontSize: '24px',
            fontWeight: 700,
            color: '#fff',
            margin: 0,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
          })}
        >
          <WalletIcon size={24} /> Sign In
        </h1>
        <p
          mix={css({
            fontSize: '13px',
            color: TEXT_MUTED,
            textAlign: 'center',
            lineHeight: 1.6,
            maxWidth: '360px',
            margin: 0,
          })}
        >
          Connect your wallet to access your Selbo dashboard. Your wallet is your identity.
        </p>

        <WalletConnect />
      </div>
      <PageLoader />
    </Document>
  )
}
