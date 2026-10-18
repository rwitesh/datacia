package files

import (
	"encoding/json"
	"testing"
)

func TestRowsToCSV(t *testing.T) {
	data := `[
		{"name": "a,b", "id": 1234567, "big": 12345678901234567, "ok": true, "tags": ["x"], "note": null},
		{"name": "say \"hi\"", "id": 2.5, "big": 0, "ok": false, "tags": {"k": 1}}
	]`
	got, err := rowsToCSV(data, []string{"id", "name", "big", "ok", "tags", "note"})
	if err != nil {
		t.Fatal(err)
	}
	want := "id,name,big,ok,tags,note\n" +
		"1234567,\"a,b\",12345678901234567,true,\"[\"\"x\"\"]\",\n" +
		"2.5,\"say \"\"hi\"\"\",0,false,\"{\"\"k\"\":1}\",\n"
	if string(got) != want {
		t.Errorf("got:\n%s\nwant:\n%s", got, want)
	}
}

func TestRowsToCSVErrors(t *testing.T) {
	if _, err := rowsToCSV(`[]`, []string{"a"}); err == nil {
		t.Error("empty rows should fail")
	}
	if _, err := rowsToCSV(`[{"a":1}]`, nil); err == nil {
		t.Error("missing columns should fail")
	}
	if _, err := rowsToCSV(`not json`, []string{"a"}); err == nil {
		t.Error("invalid JSON should fail")
	}
}

func TestCSVValueNeutralizesFormulas(t *testing.T) {
	for _, tc := range []struct {
		in   interface{}
		want string
	}{
		{"=1+1", "'=1+1"},
		{"-1+cmd", "'-1+cmd"},
		{"-12.50", "-12.50"},
		{"+1", "+1"},
		{"@SUM(A1)", "'@SUM(A1)"},
		{"\tcmd", "'\tcmd"},
		{"\rcmd", "'\rcmd"},
		{"plain", "plain"},
		{"a=b", "a=b"},
		{"", ""},
		{nil, ""},
		{json.Number("-5"), "-5"},
		{true, "true"},
		{map[string]any{"a": "=1"}, `{"a":"=1"}`},
	} {
		if got := csvValue(tc.in); got != tc.want {
			t.Errorf("csvValue(%#v) = %q, want %q", tc.in, got, tc.want)
		}
	}
}
