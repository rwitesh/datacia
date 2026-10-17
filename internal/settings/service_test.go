package settings

import "testing"

func TestUpdateSettingsSavesKeys(t *testing.T) {
	globalInfo = &Info{Settings: defaultSettings()}
	t.Cleanup(func() { globalInfo = nil })
	svc := &Service{}

	next := defaultSettings()
	next.AI.Keys = map[string]string{"openai": "ignored-from-frontend"}
	next.AI.Providers = map[string]AIProviderConfig{
		"local": {BaseURL: "http://box/v1"},
		"empty": {},
	}
	info, err := svc.UpdateSettings(next, map[string]string{"openai": " sk-1 ", "anthropic": "sk-2"})
	if err != nil {
		t.Fatal(err)
	}
	if key, err := AIKey("openai"); err != nil || key != "sk-1" {
		t.Fatalf("openai key %q, %v", key, err)
	}
	if enc := GetSettingsRaw().AI.Keys["openai"]; enc == "sk-1" || enc == "" {
		t.Fatal("key not stored encrypted")
	}
	if len(info.Settings.AI.Keys) != 0 || len(Get().Settings.AI.Keys) != 0 {
		t.Fatal("settings sent to the frontend include keys")
	}
	if _, ok := info.Settings.AI.Providers["empty"]; ok {
		t.Fatal("empty provider config kept")
	}

	if err := SetAIModel("openai", "gpt-x"); err != nil {
		t.Fatal(err)
	}
	if ai := Get().Settings.AI; ai.DefaultProvider != "" || ai.DefaultModel != "" {
		t.Fatal("settings sent to the frontend include the default model")
	}

	// Saving without key changes keeps the stored keys.
	if _, err := svc.UpdateSettings(next, nil); err != nil {
		t.Fatal(err)
	}
	if key, _ := AIKey("anthropic"); key != "sk-2" {
		t.Fatal("UpdateSettings dropped a key")
	}
	if ai := GetSettingsRaw().AI; ai.DefaultProvider != "openai" || ai.DefaultModel != "gpt-x" {
		t.Fatal("UpdateSettings changed the default model")
	}

	if _, err := svc.UpdateSettings(next, map[string]string{"anthropic": ""}); err != nil {
		t.Fatal(err)
	}
	if key, _ := AIKey("anthropic"); key != "" {
		t.Fatal("key not removed")
	}
	if key, _ := AIKey("openai"); key != "sk-1" {
		t.Fatal("removing one key changed another")
	}

	if _, err := svc.UpdateSettings(next, map[string]string{"openai": "   "}); err == nil {
		t.Fatal("blank key accepted")
	}
	if key, _ := AIKey("openai"); key != "sk-1" {
		t.Fatal("blank key changed the saved one")
	}
}

func TestSetAIKey(t *testing.T) {
	globalInfo = &Info{Settings: defaultSettings()}
	t.Cleanup(func() { globalInfo = nil })

	if err := SetAIKey("openrouter", "sk-or"); err != nil {
		t.Fatal(err)
	}
	if key, _ := AIKey("openrouter"); key != "sk-or" {
		t.Fatalf("key %q", key)
	}
	if err := SetAIKey("openrouter", ""); err != nil {
		t.Fatal(err)
	}
	if key, _ := AIKey("openrouter"); key != "" {
		t.Fatal("key not removed")
	}
}
