package common

import (
	"slices"
	"testing"
)

func TestUniqueColumnNames(t *testing.T) {
	for _, tc := range []struct {
		in, want []string
	}{
		{nil, []string{}},
		{[]string{"id", "name"}, []string{"id", "name"}},
		{[]string{"id", "id"}, []string{"id", "id_2"}},
		{[]string{"id", "id", "id"}, []string{"id", "id_2", "id_3"}},
		{[]string{"id", "id", "id_2"}, []string{"id", "id_3", "id_2"}},
		{[]string{"id_2", "id", "id"}, []string{"id_2", "id", "id_3"}},
		{[]string{"id", "ID"}, []string{"id", "ID"}},
		{[]string{"?column?", "?column?"}, []string{"?column?", "?column?_2"}},
		{[]string{"", ""}, []string{"", "_2"}},
	} {
		in := slices.Clone(tc.in)
		if got := UniqueColumnNames(tc.in); !slices.Equal(got, tc.want) {
			t.Errorf("UniqueColumnNames(%q) = %q, want %q", tc.in, got, tc.want)
		}
		if !slices.Equal(in, tc.in) {
			t.Errorf("UniqueColumnNames modified its input %q", in)
		}
	}
}
