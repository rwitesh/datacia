package common

import "testing"

func TestTableDataSQL(t *testing.T) {
	tests := []struct {
		name, table, orderBy, orderDir, quote, want string
		wantErr                                     bool
	}{
		{"plain", "users", "", "", QuoteDoubleQuote, `SELECT * FROM "users" LIMIT 10 OFFSET 20`, false},
		{"ascending", "users", "id", "asc", QuoteBacktick, "SELECT * FROM `users` ORDER BY `id` ASC LIMIT 10 OFFSET 20", false},
		{"descending", "users", "id", "desc", QuoteDoubleQuote, `SELECT * FROM "users" ORDER BY "id" DESC LIMIT 10 OFFSET 20`, false},
		{"unknown direction sorts ascending", "users", "id", "x; DROP", QuoteDoubleQuote, `SELECT * FROM "users" ORDER BY "id" ASC LIMIT 10 OFFSET 20`, false},
		{"unsafe table", `users"; DROP TABLE x; --`, "", "", QuoteDoubleQuote, "", true},
		{"unsafe column", "users", "id; DROP", "", QuoteDoubleQuote, "", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := TableDataSQL(tt.table, tt.orderBy, tt.orderDir, 10, 20, tt.quote)
			if (err != nil) != tt.wantErr {
				t.Fatalf("err = %v, wantErr %v", err, tt.wantErr)
			}
			if got != tt.want {
				t.Errorf("got %q, want %q", got, tt.want)
			}
		})
	}
}
