import { clientEntry, css, on, type Handle } from 'remix/ui'

type Status = 'checking' | 'not-installed' | 'disconnected' | 'connected'
type Step = 'idle' | 'picking'

interface ArcWalletData {
  state: { address: string; connector?: string } | null
  wallets: Array<{ info: { uuid: string; name: string; icon?: string } }>
  isReady: boolean
  ARC_TESTNET_CHAIN_ID: number
  connect(uuid?: string): Promise<void>
  disconnect(): Promise<void>
  switchChain(chainId: number): Promise<void>
}

let _cachedBus: ArcWalletData | null = null

function getArcWallet(): ArcWalletData | null {
  if (_cachedBus) return _cachedBus
  const bus = (window as Record<string, unknown>).__arcWallet as ArcWalletData | undefined
  if (bus) _cachedBus = bus
  return bus ?? null
}

function truncateAddress(addr: string): string {
  return addr.slice(0, 6) + '\u2026' + addr.slice(-4)
}

const btnBase = css({
  appearance: 'none',
  border: 0,
  borderRadius: '8px',
  padding: '12px 24px',
  fontFamily: "'Inter', system-ui, sans-serif",
  fontSize: '15px',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'opacity 0.15s',
  ':hover': { opacity: 0.85 },
  ':disabled': { opacity: 0.4, cursor: 'not-allowed' },
})

export const ArcWalletConnect = clientEntry(
  import.meta.url,
  function ArcWalletConnect(handle: Handle<Record<string, never>>) {
    let status: Status = 'checking'
    let walletState: { address: string; connector?: string } | null = null
    let wallets: Array<{ info: { uuid: string; name: string; icon?: string } }> = []
    let step: Step = 'idle'
    let error: string | null = null
    let busy = false
    let copied = false
    let hydrated = false

    function syncFromBus() {
      const bus = getArcWallet()
      if (!bus) {
        status = 'not-installed'
        handle.update()
        return
      }
      walletState = bus.state
      wallets = bus.wallets
      if (bus.state) {
        status = 'connected'
      } else if (bus.isReady) {
        status = bus.wallets.length === 0 && !(window as Record<string, unknown>).ethereum
          ? 'not-installed'
          : 'disconnected'
      }
      handle.update()
    }

    return () => {
      if (typeof window !== 'undefined' && !hydrated) {
        hydrated = true
        queueMicrotask(() => {
          const bus = getArcWallet()
          if (bus) {
            walletState = bus.state
            wallets = bus.wallets
            if (bus.state) {
              status = 'connected'
            } else if (bus.isReady) {
              status = bus.wallets.length === 0 && !(window as Record<string, unknown>).ethereum
                ? 'not-installed'
                : 'disconnected'
            }
          } else if ((window as Record<string, unknown>).ethereum) {
            status = 'disconnected'
          } else {
            status = 'not-installed'
          }
          window.addEventListener('arc:wallet:changed', syncFromBus)
          window.addEventListener('arc:wallet:wallets-changed', syncFromBus)
          window.addEventListener('arc:wallet:ready', syncFromBus)
          handle.update()
        })
      }

      if (status === 'checking') return null

      const cardStyle = css({
        borderRadius: '12px',
        padding: '20px',
        background: '#131920',
        border: '1px solid #1e293b',
      })

      if (status === 'not-installed') {
        return (
          <div mix={cardStyle}>
            <div
              mix={css({
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
              })}
            >
              <div
                mix={css({ display: 'flex', alignItems: 'center', gap: '12px' })}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8892a4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 1 0 0 4h3a1 1 0 0 0 1-1v-2.5" />
                  <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
                </svg>
                <p
                  mix={css({
                    fontSize: '13px',
                    color: '#8892a4',
                    margin: 0,
                    lineHeight: 1.5,
                  })}
                >
                  No wallet detected. Install a browser wallet to connect to Arc Testnet.
                </p>
              </div>
              <a
                href="https://metamask.io/download/"
                target="_blank"
                rel="noopener noreferrer"
                mix={css({
                  ...btnBase,
                  background: '#00ff85',
                  color: '#000',
                  fontSize: '13px',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                })}
              >
                Get MetaMask <i class="ph ph-arrow-right" mix={css({ fontSize: '16px' })}></i>
              </a>
            </div>
          </div>
        )
      }

      if (status === 'connected' && walletState) {
        return (
          <div mix={cardStyle}>
            <div
              mix={css({
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px',
              })}
            >
              <div
                mix={css({ display: 'flex', alignItems: 'center', gap: '8px' })}
              >
                <span
                  mix={css({
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    borderRadius: '999px',
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: 500,
                    background: 'rgba(0, 255, 133, 0.1)',
                    color: '#00ff85',
                  })}
                >
                  <span
                    mix={css({
                      display: 'inline-block',
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: 'currentColor',
                    })}
                  />
                  Connected
                </span>
                <span
                  mix={css({ fontSize: '11px', color: '#8892a4' })}
                >
                  Arc Testnet{walletState.connector ? ` \u00b7 ${walletState.connector}` : ''}
                </span>
              </div>
              <div
                mix={css({ display: 'flex', alignItems: 'center', gap: '12px' })}
              >
                <button
                  mix={[
                    css({
                      background: 'transparent',
                      border: 0,
                      cursor: 'pointer',
                      padding: 0,
                      fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
                      fontSize: '13px',
                      color: '#00ff85',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }),
                    on('click', async () => {
                      try {
                        await navigator.clipboard.writeText(walletState!.address)
                        copied = true
                        handle.update()
                        setTimeout(() => {
                          copied = false
                          handle.update()
                        }, 2000)
                      } catch { /* noop */ }
                    }),
                  ]}
                  title={walletState.address}
                >
                  {truncateAddress(walletState.address)}
                  {copied ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8DD89F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8892a4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                    </svg>
                  )}
                </button>
                <button
                  mix={[
                    css({
                      background: 'transparent',
                      border: 0,
                      cursor: 'pointer',
                      padding: 0,
                      fontSize: '11px',
                      color: '#8892a4',
                      textDecoration: 'underline',
                      ':disabled': { opacity: 0.4, cursor: 'not-allowed' },
                    }),
                    on('click', async () => {
                      const bus = getArcWallet()
                      if (!bus) return
                      busy = true
                      handle.update()
                      try {
                        await bus.disconnect()
                      } finally {
                        busy = false
                        handle.update()
                      }
                    }),
                  ]}
                  disabled={busy}
                >
                  Disconnect
                </button>
              </div>
            </div>
          </div>
        )
      }

      if (status === 'disconnected' && step === 'picking') {
        return (
          <div mix={cardStyle}>
            <div
              mix={css({
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '12px',
              })}
            >
              <button
                mix={[
                  css({
                    background: 'transparent',
                    border: 0,
                    cursor: 'pointer',
                    padding: 0,
                    fontSize: '13px',
                    color: '#8892a4',
                    ':disabled': { opacity: 0.4 },
                  }),
                  on('click', () => {
                    step = 'idle'
                    error = null
                    handle.update()
                  }),
                ]}
                disabled={busy}
              >
<i class="ph ph-arrow-left"></i> Back
              </button>
              <strong
                mix={css({ fontSize: '13px', color: '#e2e8f0', margin: 0 })}
              >
                Choose a wallet
              </strong>
            </div>
            <div
              mix={css({ display: 'flex', flexDirection: 'column', gap: '6px' })}
            >
              {wallets.map(w => (
                <button
                  key={w.info.uuid}
                  mix={[
                    css({
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px',
                      borderRadius: '8px',
                      background: 'transparent',
                      border: 0,
                      cursor: 'pointer',
                      textAlign: 'left',
                      color: '#e2e8f0',
                      ':hover': { background: '#1a2332' },
                      ':disabled': { opacity: 0.4, cursor: 'not-allowed' },
                    }),
                    on('click', async () => {
                      const bus = getArcWallet()
                      if (!bus) return
                      error = null
                      busy = true
                      handle.update()
                      try {
                        await bus.connect(w.info.uuid)
                        try {
                          await bus.switchChain(bus.ARC_TESTNET_CHAIN_ID)
                        } catch (switchErr) {
                          if (switchErr && (switchErr as Record<string, unknown>).code !== 4001) throw switchErr
                        }
                        step = 'idle'
                      } catch (err) {
                        const e = err as Record<string, unknown>
                        if (e.code === 4001) {
                          error = 'Request rejected. Try again when ready.'
                        } else {
                          error = 'Something went wrong. Please try again.'
                        }
                      } finally {
                        busy = false
                        handle.update()
                      }
                    }),
                  ]}
                  disabled={busy}
                >
                  {w.info.icon && (
                    <img
                      src={w.info.icon}
                      alt=""
                      width={28}
                      height={28}
                      style={{ borderRadius: 6 }}
                    />
                  )}
                  <span style={{ fontSize: '14px' }}>{w.info.name}</span>
                </button>
              ))}
            </div>
            {error && (
              <p
                role="alert"
                mix={css({
                  fontSize: '11px',
                  color: '#ff5050',
                  marginTop: '8px',
                  marginBottom: 0,
                })}
              >
                {error}
              </p>
            )}
          </div>
        )
      }

      return (
        <div mix={cardStyle}>
          <div
            mix={css({
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            })}
          >
            <div
              mix={css({ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 })}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8892a4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 1 0 0 4h3a1 1 0 0 0 1-1v-2.5" />
                <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
              </svg>
              <p
                mix={css({
                  fontSize: '13px',
                  color: '#8892a4',
                  margin: 0,
                  lineHeight: 1.5,
                })}
              >
                Adds the network configuration and connects your account.
              </p>
            </div>
            <button
              mix={[
                css({
                  ...btnBase,
                  background: '#00ff85',
                  color: '#000',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }),
                on('click', async () => {
                  const bus = getArcWallet()
                  if (!bus) return
                  error = null
                  busy = true
                  handle.update()
                  try {
                    await bus.connect()
                    try {
                      await bus.switchChain(bus.ARC_TESTNET_CHAIN_ID)
                    } catch (switchErr) {
                      if (switchErr && (switchErr as Record<string, unknown>).code !== 4001) throw switchErr
                    }
                  } catch (err) {
                    const e = err as Record<string, unknown>
                    if (e.code === 'MULTIPLE_WALLETS') {
                      step = 'picking'
                    } else if (e.code === 4001) {
                      error = 'Request rejected. Try again when ready.'
                    } else if (/No wallet detected/i.test(String(e.message || ''))) {
                      error = 'No wallet found. Install a browser wallet to continue.'
                    } else if (/User cancelled/i.test(String(e.message || ''))) {
                      // no-op
                    } else {
                      error = 'Something went wrong. Please try again.'
                    }
                  } finally {
                    busy = false
                    handle.update()
                  }
                }),
              ]}
              disabled={busy}
            >
              {busy ? 'Connecting\u2026' : 'Connect Wallet'}
            </button>
          </div>
          {error && (
            <p
              role="alert"
              mix={css({
                fontSize: '11px',
                color: '#ff5050',
                marginTop: '8px',
                marginBottom: 0,
              })}
            >
              {error}
            </p>
          )}
        </div>
      )
    }
  },
)
