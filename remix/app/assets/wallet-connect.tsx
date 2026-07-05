import { clientEntry, css, on, type Handle } from 'remix/ui'
import { Button } from '../components/button.tsx'
import { WalletIcon } from '../components/icons/wallet.tsx'
import { ArrowRightIcon } from '../components/icons/arrow-right.tsx'
import { getNonce, postLogin } from '../data/api.ts'

declare global {
  interface Window {
    ethereum?: {
      request(args: { method: string; params?: unknown[] }): Promise<unknown>
    }
  }
}

type Status = 'checking' | 'idle' | 'connecting' | 'signing' | 'verifying' | 'not-installed' | 'error'

export const WalletConnect = clientEntry(
  import.meta.url,
  function WalletConnect(handle: Handle<Record<string, never>>) {
    let status: Status = 'checking'
    let errorMessage = ''
    let hydrated = false

    return () => {
      if (typeof window !== 'undefined' && !hydrated) {
        hydrated = true
        queueMicrotask(() => {
          status = window.ethereum ? 'idle' : 'not-installed'
          handle.update()
        })
      }

      if (status === 'checking') return null

      return (
      <div
        mix={css({
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          transition: 'transform 0.1s',
          '&:active': { transform: 'scale(0.97)' },
        })}
      >
        <Button
          variant="primary"
          mix={status === 'not-installed'
            ? on<HTMLButtonElement>('click', () => {
                window.open('https://metamask.io/download/', '_blank', 'noopener')
              })
            : on<HTMLButtonElement>('click', async () => {
                if (status === 'connecting' || status === 'signing' || status === 'verifying') return

                const eth = window.ethereum
                if (!eth) {
                  status = 'not-installed'
                  handle.update()
                  return
                }

                status = 'connecting'
                handle.update()

                try {
                  const accounts = (await eth.request({ method: 'eth_requestAccounts' })) as string[]
                  const address = accounts[0].toLowerCase()

                  status = 'signing'
                  handle.update()

                  const nonceRes = await getNonce(address)
                  if (!nonceRes.ok) throw new Error(nonceRes.error.message)
                  const { nonce } = nonceRes.data

                  const signature = (await eth.request({
                    method: 'personal_sign',
                    params: [nonce, address],
                  })) as string

                  status = 'verifying'
                  handle.update()

                  const loginRes = await postLogin(address, signature, nonce)

                  if (loginRes.ok && loginRes.data.redirect) {
                    window.location.href = loginRes.data.redirect
                    return
                  }

                  errorMessage = loginRes.ok ? 'No redirect returned' : loginRes.error.message
                  status = 'error'
                  handle.update()
                } catch (err) {
                  if (err && typeof err === 'object' && 'code' in err && (err as Record<string, unknown>).code === 4001) {
                    status = 'idle'
                    handle.update()
                    return
                  }
                  errorMessage = err instanceof Error ? err.message : 'Connection failed'
                  status = 'error'
                  handle.update()
                }
              })
          }
          disabled={status === 'connecting' || status === 'signing' || status === 'verifying'}
        >
          {status === 'not-installed' ? <ArrowRightIcon size={18} /> : <WalletIcon size={18} />}
          {status === 'connecting'
            ? 'Connecting\u2026'
            : status === 'signing'
              ? 'Signing\u2026'
              : status === 'verifying'
                ? 'Verifying\u2026'
                : status === 'not-installed'
                  ? 'Get MetaMask'
                  : 'Connect Wallet'}
        </Button>

        {status === 'error' && (
          <p
            role="alert"
            mix={css({
              fontSize: '11px',
              color: '#ff5050',
              textAlign: 'center',
              margin: 0,
            })}
          >
            {errorMessage}
          </p>
        )}
      </div>
    )
  }
},
)
