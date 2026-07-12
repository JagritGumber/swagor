import { useEffect, useState } from 'react'
import { Button } from '@/components/composables/button'
import { Wallet, ArrowRight } from '@phosphor-icons/react'
import { getNonce, postLogin } from '@/data/api.ts'

declare global {
  interface Window {
    ethereum?: {
      request(args: { method: string; params?: unknown[] }): Promise<unknown>
    }
  }
}

type Status = 'checking' | 'idle' | 'connecting' | 'signing' | 'verifying' | 'not-installed' | 'error'

export function WalletConnect() {
  const [status, setStatus] = useState<Status>('checking')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    setStatus(typeof window !== 'undefined' && window.ethereum ? 'idle' : 'not-installed')
  }, [])

  if (status === 'checking') return null

  const busy = status === 'connecting' || status === 'signing' || status === 'verifying'

  async function onConnect() {
    if (busy) return

    const eth = window.ethereum
    if (!eth) {
      setStatus('not-installed')
      return
    }

    setStatus('connecting')
    setErrorMessage('')

    try {
      const accounts = (await eth.request({ method: 'eth_requestAccounts' })) as string[]
      if (!accounts[0]) {
        throw new Error('No wallet account returned')
      }
      const address = accounts[0].toLowerCase()

      setStatus('signing')

      const nonceRes = await getNonce(address)
      if (!nonceRes.ok) throw new Error(nonceRes.error.message)
      const { nonce } = nonceRes.data

      const signature = (await eth.request({
        method: 'personal_sign',
        params: [nonce, address],
      })) as string

      setStatus('verifying')

      const loginRes = await postLogin(address, signature, nonce)

      if (loginRes.ok && loginRes.data.redirect) {
        window.location.href = loginRes.data.redirect
        return
      }

      setErrorMessage(loginRes.ok ? 'No redirect returned' : loginRes.error.message)
      setStatus('error')
    } catch (err) {
      if (err && typeof err === 'object' && 'code' in err && (err as { code: unknown }).code === 4001) {
        setStatus('idle')
        return
      }
      setErrorMessage(err instanceof Error ? err.message : 'Connection failed')
      setStatus('error')
    }
  }

  return (
    <div className="flex flex-col items-center gap-gap-4 transition-transform duration-100 active:scale-[0.97]">
      <Button
        variant="primary"
        disabled={busy}
        onClick={
          status === 'not-installed'
            ? () => {
                window.open('https://metamask.io/download/', '_blank', 'noopener')
              }
            : onConnect
        }
      >
        {status === 'not-installed' ? <ArrowRight size={18} /> : <Wallet size={18} />}
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

      {status === 'error' ? (
        <p role="alert" className="m-0 text-center text-[11px] text-[#ff5050]">
          {errorMessage}
        </p>
      ) : null}
    </div>
  )
}
