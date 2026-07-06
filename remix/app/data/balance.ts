import { createPublicClient, formatEther, http } from 'viem'
import { networks } from '../lib/networks.ts'

const client = createPublicClient({
  transport: http(networks.testnet.rpc),
})

export async function getWalletBalance(address: string): Promise<number> {
  const balance = await client.getBalance({ address: address as `0x${string}` })
  return parseFloat(formatEther(balance))
}
