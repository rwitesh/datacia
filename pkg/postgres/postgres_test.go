package postgres

import (
	"errors"
	"fmt"
	"net/url"
	"os"
	"testing"
	"time"

	"datacia/pkg/common"
)

// connectTest connects to the server in DATACIA_TEST_POSTGRES, a URL such as
// postgres://user:password@localhost:5432/db, or skips the test.
func connectTest(t *testing.T) *Postgres {
	t.Helper()
	raw := os.Getenv("DATACIA_TEST_POSTGRES")
	if raw == "" {
		t.Skip("DATACIA_TEST_POSTGRES not set")
	}
	u, err := url.Parse(raw)
	if err != nil {
		t.Fatal(err)
	}
	password, _ := u.User.Password()
	p := New()
	if err := p.Connect(u.Hostname(), u.Port(), u.User.Username(), password, u.Path[1:]); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { p.Close() })
	return p
}

func run(t *testing.T, p *Postgres, queryType common.QueryType, sql string) common.QueryResult {
	t.Helper()
	res, err := p.RunQuery("", string(queryType), sql)
	if err != nil {
		t.Fatalf("%s: %v", sql, err)
	}
	return res
}

func TestSessionKeepsState(t *testing.T) {
	p := connectTest(t)
	run(t, p, common.QueryTypeCommand, "SET application_name = 'datacia_session'")
	run(t, p, common.QueryTypeCommand, "CREATE TEMP TABLE t (n int)")
	run(t, p, common.QueryTypeCommand, "BEGIN")
	run(t, p, common.QueryTypeCommand, "INSERT INTO t VALUES (1)")
	run(t, p, common.QueryTypeCommand, "ROLLBACK")
	if res := run(t, p, common.QueryTypeRead, "SELECT n FROM t"); len(res.Data) != 0 {
		t.Fatalf("after rollback: %d rows, want 0", len(res.Data))
	}
	res := run(t, p, common.QueryTypeRead, "SELECT current_setting('application_name') AS name")
	if got := res.Data[0]["name"]; got != "datacia_session" {
		t.Fatalf("application_name = %v, want datacia_session", got)
	}
}

func TestCancelStopsQueryOnServer(t *testing.T) {
	p := connectTest(t)
	run(t, p, common.QueryTypeCommand, "SET application_name = 'datacia_cancel'")
	const id = "11111111-1111-1111-1111-111111111111"
	time.AfterFunc(500*time.Millisecond, func() { p.CancelQuery(id) })
	start := time.Now()
	if _, err := p.RunQuery(id, string(common.QueryTypeRead), "SELECT pg_sleep(20)"); err == nil {
		t.Fatal("cancelled query succeeded")
	}
	if elapsed := time.Since(start); elapsed > 5*time.Second {
		t.Fatalf("cancel took %v", elapsed)
	}
	// Still the same session, and nothing left running on the server.
	res := run(t, p, common.QueryTypeRead, "SELECT current_setting('application_name') AS name")
	if got := res.Data[0]["name"]; got != "datacia_cancel" {
		t.Fatalf("session lost after cancel: application_name = %v", got)
	}
	res = run(t, p, common.QueryTypeRead, "SELECT count(*) AS n FROM pg_stat_activity WHERE query = 'SELECT pg_sleep(20)' AND state = 'active'")
	if n := res.Data[0]["n"]; n != int64(0) {
		t.Fatalf("%v cancelled queries still running", n)
	}
}

func TestLostSessionInTransaction(t *testing.T) {
	p := connectTest(t)
	pid := run(t, p, common.QueryTypeRead, "SELECT pg_backend_pid() AS pid").Data[0]["pid"]
	run(t, p, common.QueryTypeCommand, "BEGIN")
	// Terminate the session from another pooled connection.
	if _, err := p.ReadOnlyQuery(t.Context(), fmt.Sprintf("SELECT pg_terminate_backend(%v)", pid), 1); err != nil {
		t.Fatal(err)
	}
	time.Sleep(200 * time.Millisecond)
	// The first statement finds the connection closed.
	p.RunQuery("", string(common.QueryTypeCommand), "INSERT INTO nowhere VALUES (1)")
	if _, err := p.RunQuery("", string(common.QueryTypeRead), "SELECT 1"); !errors.Is(err, common.ErrSessionLost) {
		t.Fatalf("err = %v, want ErrSessionLost", err)
	}
	run(t, p, common.QueryTypeRead, "SELECT 1")
}
