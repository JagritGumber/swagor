import { clientEntry, css, on, type Handle, type SerializableProps } from 'remix/ui'
import { Button } from '../components/composables/button'

interface WalletAddressProps extends SerializableProps {
  address: string
}

export const WalletAddress = clientEntry(
  import.meta.url,
  function WalletAddress(handle: Handle<WalletAddressProps>) {
    let copied = false
    let timer: ReturnType<typeof setTimeout> | undefined

    return () => {
      const address = handle.props.address
      if (!address) return null

      const truncated = `${address.slice(0, 6)}...${address.slice(-4)}`

      return (
        <div
          mix={css({
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '4px',
          })}
        >
          <span
            mix={css({
              fontSize: '12px',
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              color: '#64748b',
              cursor: 'pointer',
              transition: 'color 0.15s',
              '&:hover': { color: '#94a3b8' },
            })}
            {...on<HTMLElement>('click', async () => {
              try {
                await navigator.clipboard.writeText(address)
                copied = true
                handle.update()
                clearTimeout(timer)
                timer = setTimeout(() => { copied = false; handle.update() }, 2000)
              } catch {
                // clipboard not available
              }
            })}
          >
            {copied ? 'Copied!' : truncated}
          </span>
          <Button
            variant="outline"
            size="sm"
            mix={[
              css({ textDecoration: 'none' }),
              on<HTMLButtonElement>('click', () => {
                window.open(`https://faucet.circle.com?address=${address}`, '_blank', 'noopener')
              }),
            ]}
          >
            Faucet
          </Button>
        </div>
      )
    }
  },
)
