package ai

import (
	"context"
	"crypto/sha256"
	"sync"
	"time"
)

const modelCacheTTL = time.Hour

// modelCache keeps each provider's model list, so opening the model picker
// doesn't call the provider every time.
type modelCache struct {
	mu      sync.Mutex
	entries map[string]cachedModels // keyed by provider ID
}

type cachedModels struct {
	source  [sha256.Size]byte // the base URL and key the list came from
	models  []Model
	fetched time.Time
}

func (c *modelCache) list(ctx context.Context, p Provider, url, key string) ([]Model, error) {
	source := sha256.Sum256([]byte(url + "\x00" + key))
	c.mu.Lock()
	e, ok := c.entries[p.ID]
	c.mu.Unlock()
	if ok && e.source == source && time.Since(e.fetched) < modelCacheTTL {
		return e.models, nil
	}

	listed, err := p.list(ctx, key, url)
	if err != nil {
		return nil, userError(p, err)
	}
	models := sortModels(listed)
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.entries == nil {
		c.entries = map[string]cachedModels{}
	}
	c.entries[p.ID] = cachedModels{source, models, time.Now()}
	return models, nil
}
