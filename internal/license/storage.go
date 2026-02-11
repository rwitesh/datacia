package license

import (
	"datacia/internal/paths"
	"datacia/internal/security"
	"encoding/json"
	"fmt"
	"os"
	"time"
)

type identityShard struct {
	ID        string    `json:"id"`
	Key       string    `json:"key"`
	MachineId string    `json:"machine_id"`
	CreatedAt time.Time `json:"created_at"`
}

type temporalShard struct {
	ExpiresAt time.Time `json:"expires_at"`
	LastCheck time.Time `json:"last_check"`
}

type authShard struct {
	Email     string `json:"email"`
	Signature []byte `json:"signature"`
}

func SaveLicense(l *License) error {
	shardPaths, err := paths.GetLicenseShardPaths()
	if err != nil {
		return err
	}

	shards := map[string]interface{}{
		shardPaths.Identity: identityShard{
			ID: l.ID, Key: l.Key, MachineId: l.MachineId, CreatedAt: l.CreatedAt,
		},
		shardPaths.Temporal: temporalShard{
			ExpiresAt: l.ExpiresAt, LastCheck: l.LastCheck,
		},
		shardPaths.Auth: authShard{
			Email: l.Email, Signature: l.Signature,
		},
	}

	for path, shard := range shards {
		if err := writeEncryptedShard(path, shard); err != nil {
			return fmt.Errorf("failed to write shard %s: %w", path, err)
		}
	}
	return nil
}

func LoadLicense() (*License, error) {
	shardPaths, err := paths.GetLicenseShardPaths()
	if err != nil {
		return nil, err
	}

	allPaths := []string{shardPaths.Identity, shardPaths.Temporal, shardPaths.Auth}
	existing := 0
	for _, p := range allPaths {
		if _, err := os.Stat(p); err == nil {
			existing++
		}
	}

	if existing == 0 {
		return nil, nil
	}
	if existing != len(allPaths) {
		return nil, fmt.Errorf("license data is incomplete (%d/%d shards found)", existing, len(allPaths))
	}

	var identity identityShard
	if err := readEncryptedShard(shardPaths.Identity, &identity); err != nil {
		return nil, fmt.Errorf("failed to read identity shard: %w", err)
	}

	var temporal temporalShard
	if err := readEncryptedShard(shardPaths.Temporal, &temporal); err != nil {
		return nil, fmt.Errorf("failed to read temporal shard: %w", err)
	}

	var auth authShard
	if err := readEncryptedShard(shardPaths.Auth, &auth); err != nil {
		return nil, fmt.Errorf("failed to read auth shard: %w", err)
	}

	return &License{
		ID:        identity.ID,
		Key:       identity.Key,
		MachineId: identity.MachineId,
		CreatedAt: identity.CreatedAt,
		ExpiresAt: temporal.ExpiresAt,
		LastCheck: temporal.LastCheck,
		Email:     auth.Email,
		Signature: auth.Signature,
	}, nil
}

func RemoveLicense() error {
	shardPaths, err := paths.GetLicenseShardPaths()
	if err != nil {
		return err
	}

	for _, p := range []string{shardPaths.Identity, shardPaths.Temporal, shardPaths.Auth} {
		if err := os.Remove(p); err != nil && !os.IsNotExist(err) {
			return fmt.Errorf("failed to remove shard %s: %w", p, err)
		}
	}
	return nil
}

func writeEncryptedShard(path string, data interface{}) error {
	jsonBytes, err := json.Marshal(data)
	if err != nil {
		return err
	}

	encrypted, err := security.EncryptString(string(jsonBytes))
	if err != nil {
		return err
	}

	tmpPath := path + ".tmp"
	if err := os.WriteFile(tmpPath, []byte(encrypted), 0600); err != nil {
		return err
	}

	if err := os.Rename(tmpPath, path); err != nil {
		os.Remove(tmpPath)
		return err
	}
	return nil
}

func readEncryptedShard(path string, target interface{}) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}

	decrypted, err := security.DecryptString(string(data))
	if err != nil {
		return fmt.Errorf("decryption failed (data may be corrupted): %w", err)
	}

	return json.Unmarshal([]byte(decrypted), target)
}
