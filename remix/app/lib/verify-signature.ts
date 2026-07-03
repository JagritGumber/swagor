import { secp256k1 } from '@noble/curves/secp256k1.js'
import { keccak_256 } from '@noble/hashes/sha3.js'
import { bytesToHex } from '@noble/hashes/utils.js'

export function verifyEthereumSignature(address: string, nonce: string, signature: string): boolean {
  try {
    const message = `\x19Ethereum Signed Message:\n${nonce.length}${nonce}`
    const messageHash = keccak_256(new TextEncoder().encode(message))

    const hex = signature.startsWith('0x') ? signature.slice(2) : signature
    const sigBytes = new Uint8Array(hex.match(/.{2}/g)!.map(b => parseInt(b, 16)))

    if (sigBytes.length !== 65) return false

    const r = sigBytes.slice(0, 32)
    const s = sigBytes.slice(32, 64)
    const v = sigBytes[64]

    let recid: number
    if (v === 27 || v === 28) {
      recid = v - 27
    } else if (v >= 35) {
      recid = (v - 35) % 2
    } else if (v === 0 || v === 1) {
      recid = v
    } else {
      return false
    }

    const recoveredBytes = new Uint8Array([recid, ...r, ...s])

    const publicKey = secp256k1.Signature.fromBytes(recoveredBytes, 'recovered' as never)
      .recoverPublicKey(messageHash)
      .toBytes(false)

    const hash = keccak_256(publicKey.slice(1))
    const recoveredAddress = '0x' + bytesToHex(hash.slice(-20))

    return recoveredAddress.toLowerCase() === address.toLowerCase()
  } catch {
    return false
  }
}
