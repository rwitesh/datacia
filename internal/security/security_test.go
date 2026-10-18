package security

import (
	"bytes"
	"encoding/hex"
	"testing"
)

// TestDeriveEncryptionKeyIsStable pins the key derivation. If this fails, a
// change to the salt or KDF would make existing users' saved credentials
// unreadable.
func TestDeriveEncryptionKeyIsStable(t *testing.T) {
	got := hex.EncodeToString(deriveEncryptionKey(Sha256Hex("test-device")))
	const want = "88dfb0476340eaff7a01368066d0a682f3fb4ebc3ee949175a080ee32c81aef5"
	if got != want {
		t.Errorf("deriveEncryptionKey changed: got %s, want %s", got, want)
	}
}

func TestEncryptDecryptRoundTrip(t *testing.T) {
	key := deriveEncryptionKey(Sha256Hex("test-device"))
	plaintext := []byte("s3cret password")

	ciphertext, err := Encrypt(key, plaintext)
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(ciphertext, plaintext) {
		t.Fatal("ciphertext contains the plaintext")
	}
	got, err := Decrypt(key, ciphertext)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(got, plaintext) {
		t.Errorf("got %q, want %q", got, plaintext)
	}

	otherKey := deriveEncryptionKey(Sha256Hex("other-device"))
	if _, err := Decrypt(otherKey, ciphertext); err == nil {
		t.Error("decrypting with another machine's key should fail")
	}
}

// The device ID goes to error reports, so it must not be the machine ID the
// encryption key is derived from.
func TestAnonymousDeviceIDHidesMachineID(t *testing.T) {
	machineID := Sha256Hex("test-device")
	got := anonymousDeviceID(machineID)
	if got == machineID || got == "" {
		t.Fatalf("device ID %q exposes the machine ID", got)
	}
	if got != anonymousDeviceID(machineID) {
		t.Fatal("device ID is not stable")
	}
}
