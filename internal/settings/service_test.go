package settings

import "testing"

func TestAIKeysStayInBackend(t *testing.T) {
	globalInfo = &Info{Settings: defaultSettings()}
	t.Cleanup(func() { globalInfo = nil })

	if err := SetAIKey("openai", "enc-1"); err != nil {
		t.Fatal(err)
	}
	if AIKey("openai") != "enc-1" {
		t.Fatal("key not stored")
	}
	if keys := Get().Settings.AI.Keys; len(keys) != 0 {
		t.Fatalf("sanitized settings expose keys: %v", keys)
	}

	next := defaultSettings()
	next.AI.Keys = map[string]string{"openai": "from-frontend"}
	next.AI.Providers = map[string]AIProviderConfig{"openai": {Models: []string{"m"}}}
	info := (&Service{}).UpdateSettings(next)
	if AIKey("openai") != "enc-1" {
		t.Fatal("UpdateSettings changed a key")
	}
	if got := info.Settings.AI.Providers["openai"].Models; len(got) != 1 {
		t.Fatalf("providers not saved: %v", got)
	}

	if err := SetAIKey("openai", ""); err != nil || AIKey("openai") != "" {
		t.Fatal("key not removed")
	}
}
