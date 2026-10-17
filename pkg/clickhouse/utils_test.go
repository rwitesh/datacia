package clickhouse

import (
	"encoding/json"
	"math"
	"math/big"
	"net"
	"testing"

	"github.com/google/uuid"
)

func TestNormalizeValueJSON(t *testing.T) {
	id := uuid.MustParse("123e4567-e89b-12d3-a456-426614174000")
	nan := math.NaN()
	var nilInt *int32

	tests := []struct {
		name  string
		value interface{}
		want  string
	}{
		{"uuid", id, `"123e4567-e89b-12d3-a456-426614174000"`},
		{"nullable uuid", &id, `"123e4567-e89b-12d3-a456-426614174000"`},
		{"ipv4", net.ParseIP("10.0.0.1").To4(), `"10.0.0.1"`},
		{"ipv6", net.ParseIP("::1"), `"::1"`},
		{"nullable nan", &nan, `"NaN"`},
		{"null", nilInt, `null`},
		{"int256", big.NewInt(-12345678901234567), `-12345678901234567`},
		{"array", []int32{1, 2}, `[1,2]`},
		{"map", map[string]float64{"a": math.Inf(1)}, `{"a":"Infinity"}`},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := json.Marshal(normalizeValue(tt.value))
			if err != nil {
				t.Fatalf("marshal: %v", err)
			}
			if string(got) != tt.want {
				t.Errorf("got %s, want %s", got, tt.want)
			}
		})
	}
}
