import { clientEntry, css, on, type Handle, type SerializableProps } from 'remix/ui'

interface WalletConnectProps extends SerializableProps {
  nonceUrl: string
  loginUrl: string
  redirectUrl: string
}

type Status = 'idle' | 'connecting' | 'signing' | 'verifying' | 'success' | 'no-wallet' | 'error'

export const WalletConnect = clientEntry(
  import.meta.url,
  function WalletConnect(handle: Handle<WalletConnectProps>) {
    let status: Status = 'idle'
    let errorMessage = ''

    return () => (
      <div
        mix={css({
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
        })}
      >
        {status === 'no-wallet' ? (
          <p
            mix={css({
              fontSize: '13px',
              color: '#8892a4',
              textAlign: 'center',
              lineHeight: 1.6,
            })}
          >
            No wallet detected. Install{' '}
            <a
              href="https://metamask.io"
              target="_blank"
              rel="noopener noreferrer"
              mix={css({ color: '#00ff85', textDecoration: 'underline' })}
            >
              MetaMask
            </a>{' '}
            or another Ethereum wallet to continue.
          </p>
        ) : status === 'error' ? (
          <p mix={css({ fontSize: '13px', color: '#ff5050', textAlign: 'center', lineHeight: 1.6 })}>
            {errorMessage}
          </p>
        ) : null}

        <button
          mix={[
            css({
              appearance: 'none',
              border: 0,
              borderRadius: '8px',
              padding: '12px 24px',
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: '15px',
              fontWeight: 600,
              cursor: 'pointer',
              background: '#00ff85',
              color: '#000',
              transition: 'opacity 0.15s',
              ':hover': { opacity: 0.85 },
              ':disabled': { opacity: 0.4, cursor: 'not-allowed' },
            }),
            on('click', async () => {
              if (status === 'connecting' || status === 'signing' || status === 'verifying') return

              const ethereum = (window as unknown as Record<string, unknown>).ethereum as
                | { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> }
                | undefined

              if (!ethereum || !ethereum.request) {
                status = 'no-wallet'
                handle.update()
                return
              }

              status = 'connecting'
              handle.update()

              try {
                const accounts = (await ethereum.request({
                  method: 'eth_requestAccounts',
                })) as string[]

                const address = accounts[0].toLowerCase()

                status = 'signing'
                handle.update()

                const nonceRes = await fetch(`${handle.props.nonceUrl}?address=${address}`)
                if (!nonceRes.ok) {
                  const errText = await nonceRes.text()
                  status = 'error'
                  errorMessage = errText || 'Failed to get challenge'
                  handle.update()
                  return
                }

                const { nonce } = (await nonceRes.json()) as { nonce: string }

                status = 'verifying'
                handle.update()

                const signature = (await ethereum.request({
                  method: 'personal_sign',
                  params: [nonce, address],
                })) as string

                const loginRes = await fetch(handle.props.loginUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ address, signature, nonce }),
                })

                const result = (await loginRes.json()) as { ok: boolean; redirect?: string; error?: string }

                if (result.ok && result.redirect) {
                  status = 'success'
                  handle.update()
                  window.location.href = result.redirect
                  return
                }

                status = 'error'
                errorMessage = result.error ?? 'Authentication failed'
                handle.update()
              } catch (err) {
                status = 'error'
                errorMessage = err instanceof Error ? err.message : 'Connection failed'
                handle.update()
              }
            }),
          ]}
          disabled={status === 'connecting' || status === 'signing' || status === 'verifying'}
        >
          {status === 'connecting'
            ? 'Connecting wallet...'
            : status === 'signing'
              ? 'Signing message...'
              : status === 'verifying'
                ? 'Verifying...'
                : 'Connect Wallet'}
        </button>
      </div>
    )
  },
)
