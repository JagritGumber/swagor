import { createReaderAuctionModeState } from '@packages/strategy-lab/reader/reader-auction-mode/create-reader-auction-mode-state'
import { createReaderVpStateMemory } from '@packages/strategy-lab/reader/reader-vp-state/create-reader-vp-state-memory'

let cachedAsset: string | null = null
let auctionModeState = createReaderAuctionModeState()
let vpStateMemory = createReaderVpStateMemory()

export function getReaderState(asset: string) {
  if (cachedAsset !== asset.toUpperCase()) {
    cachedAsset = asset.toUpperCase()
    auctionModeState = createReaderAuctionModeState()
    vpStateMemory = createReaderVpStateMemory()
  }
  return { auctionModeState, vpStateMemory }
}
