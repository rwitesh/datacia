package mysql

import (
	"errors"
	"fmt"
	"net/url"
	"os"
	"testing"
	"time"

	"datacia/pkg/common"
)

// connectTest connects to the server in DATACIA_TEST_MYSQL, a URL such as
// mysql://user:password@localhost:3306/db, or skips the test.
func connectTest(t *testing.T) *MySQL {
	t.Helper()
	raw := os.Getenv("DATACIA_TEST_MYSQL")
	if raw == "" {
		t.Skip("DATACIA_TEST_MYSQL not set")
	}
	u, err := url.Parse(raw)
	if err != nil {
		t.Fatal(err)
	}
	password, _ := u.User.Password()
	m := New()
	if err := m.Connect(u.Hostname(), u.Port(), u.User.Username(), password, u.Path[1:]); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { m.Close() })
	return m
}

func run(t *testing.T, m *MySQL, queryType common.QueryType, sql string) common.QueryResult {
	t.Helper()
	res, err := m.RunQuery("", string(queryType), sql)
	if err != nil {
		t.Fatalf("%s: %v", sql, err)
	}
	return res
}

func TestSessionKeepsState(t *testing.T) {
	m := connectTest(t)
	run(t, m, common.QueryTypeCommand, "SET @marker = 'datacia'")
	run(t, m, common.QueryTypeCommand, "DROP TABLE IF EXISTS session_test")
	run(t, m, common.QueryTypeCommand, "CREATE TABLE session_test (n int) ENGINE=InnoDB")
	t.Cleanup(func() { m.RunQuery("", string(common.QueryTypeCommand), "DROP TABLE session_test") })
	run(t, m, common.QueryTypeCommand, "BEGIN")
	run(t, m, common.QueryTypeCommand, "INSERT INTO session_test VALUES (1)")
	run(t, m, common.QueryTypeCommand, "ROLLBACK")
	if res := run(t, m, common.QueryTypeRead, "SELECT n FROM session_test"); len(res.Data) != 0 {
		t.Fatalf("after rollback: %d rows, want 0", len(res.Data))
	}
	if got := run(t, m, common.QueryTypeRead, "SELECT @marker AS v").Data[0]["v"]; got != "datacia" {
		t.Fatalf("@marker = %v, want datacia", got)
	}
}

func TestCancelKillsQueryOnServer(t *testing.T) {
	m := connectTest(t)
	run(t, m, common.QueryTypeCommand, "SET @marker = 'datacia'")
	const id = "11111111-1111-1111-1111-111111111111"
	time.AfterFunc(500*time.Millisecond, func() { m.CancelQuery(id) })
	start := time.Now()
	m.RunQuery(id, string(common.QueryTypeRead), "SELECT SLEEP(20)")
	if elapsed := time.Since(start); elapsed > 3*time.Second {
		t.Fatalf("cancel took %v", elapsed)
	}
	// Still the same session, and nothing left running on the server.
	if got := run(t, m, common.QueryTypeRead, "SELECT @marker AS v").Data[0]["v"]; got != "datacia" {
		t.Fatalf("session lost after cancel: @marker = %v", got)
	}
	res := run(t, m, common.QueryTypeRead, "SELECT COUNT(*) AS n FROM information_schema.processlist WHERE info = 'SELECT SLEEP(20)'")
	if n := res.Data[0]["n"]; n != int64(0) {
		t.Fatalf("%v cancelled queries still running", n)
	}
}

func TestQueuedQueryCanBeCancelled(t *testing.T) {
	m := connectTest(t)
	go m.RunQuery("", string(common.QueryTypeRead), "SELECT SLEEP(2)")
	time.Sleep(200 * time.Millisecond)
	const id = "22222222-2222-2222-2222-222222222222"
	time.AfterFunc(200*time.Millisecond, func() { m.CancelQuery(id) })
	start := time.Now()
	if _, err := m.RunQuery(id, string(common.QueryTypeRead), "SELECT 1"); err == nil {
		t.Fatal("cancelled while waiting, but ran")
	}
	if elapsed := time.Since(start); elapsed > time.Second {
		t.Fatalf("waited %v for the session after cancel", elapsed)
	}
}

func TestLostSessionInTransaction(t *testing.T) {
	m := connectTest(t)
	run(t, m, common.QueryTypeCommand, "BEGIN")
	// Kill the session's connection from the pool.
	if _, err := m.db.Exec(fmt.Sprintf("KILL %d", m.sessionID)); err != nil {
		t.Fatal(err)
	}
	if _, err := m.RunQuery("", string(common.QueryTypeRead), "SELECT 1"); !errors.Is(err, common.ErrSessionLost) {
		t.Fatalf("err = %v, want ErrSessionLost", err)
	}
	run(t, m, common.QueryTypeRead, "SELECT 1")
}
