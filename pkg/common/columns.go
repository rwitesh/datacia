package common

import "fmt"

// UniqueColumnNames renames repeated result column names to name_2, name_3, ...
// Rows are maps keyed by column name, so `SELECT a.id, b.id` would otherwise
// keep only the last value. A suffix never reuses a name that already appears
// in the result, so `id, id, id_2` becomes `id, id_3, id_2`. The input slice
// is not modified.
func UniqueColumnNames(columns []string) []string {
	taken := make(map[string]bool, len(columns))
	for _, name := range columns {
		taken[name] = true
	}

	unique := make([]string, len(columns))
	seen := make(map[string]bool, len(columns))
	for i, name := range columns {
		if !seen[name] {
			seen[name] = true
			unique[i] = name
			continue
		}
		candidate := name
		for n := 2; taken[candidate]; n++ {
			candidate = fmt.Sprintf("%s_%d", name, n)
		}
		taken[candidate] = true
		unique[i] = candidate
	}
	return unique
}
