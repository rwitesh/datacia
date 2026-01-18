package security

import "crypto/ed25519"

// Key part 1: 0-15
var pk_part1 = []byte{
    0xfa, 0x50, 0xec, 0xa5, 0x32, 0x38, 0x44, 0x41,
    0x0a, 0xf5, 0x82, 0x5d, 0xc5, 0x17, 0x80, 0xd5,
}

// Key part 2: 16-31
var pk_part2 = []byte{
    0x08, 0x8e, 0x42, 0x2d, 0xa8, 0x23, 0x45, 0xc7,
    0xad, 0x23, 0xa0, 0x44, 0x74, 0xcc, 0xbd, 0x4f,
}

// GetPublicKey reconstructs the Ed25519 public key from scattered parts.
// This prevents simple string search/replace attacks in the binary.
func GetPublicKey() ed25519.PublicKey {
    key := make([]byte, 32)
    copy(key[0:16], pk_part1)
    copy(key[16:32], pk_part2)
    return ed25519.PublicKey(key)
}
