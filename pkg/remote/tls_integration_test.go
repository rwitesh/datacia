//go:build integration

package remote

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"errors"
	"fmt"
	"math/big"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"datacia/pkg/common"
)

// These tests start real PostgreSQL, MySQL and ClickHouse servers in Docker
// with throwaway certificates and check every SSL mode against them. Run:
//
//	go test -tags integration -run TestSSLModes -v ./pkg/remote
//
// Containers use random host ports and are removed when the tests end.

const (
	containerPrefix = "datacia-tls-"
	containerLabel  = "datacia-tls=1"
	// Pinned: the expected errors come from the server and driver versions.
	clickhouseImage = "clickhouse/clickhouse-server:26.7"
)

var (
	setupMu     sync.Mutex
	setupResult = map[string]error{}
	certDir     string
	endpointMu  sync.Mutex
	endpoints   = map[string]string{} // target name -> published host:port
)

// removeContainers removes every container started by these tests, including
// ones left by a run that was killed before it could clean up.
func removeContainers() {
	out, _ := docker("ps", "-aq", "--filter", "label="+containerLabel)
	if ids := strings.Fields(out); len(ids) > 0 {
		_ = exec.Command("docker", append([]string{"rm", "-f"}, ids...)...).Run()
	}
}

func TestMain(m *testing.M) {
	removeContainers()
	code := m.Run()
	removeContainers()
	if certDir != "" {
		os.RemoveAll(certDir)
	}
	os.Exit(code)
}

type certSet struct{ crt, key []byte }

func newCert(tb testing.TB, ca *x509.Certificate, caKey *rsa.PrivateKey, isCA bool, cn string, notAfter time.Time, dns ...string) (*x509.Certificate, *rsa.PrivateKey, certSet) {
	tb.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		tb.Fatal(err)
	}
	serial, _ := rand.Int(rand.Reader, big.NewInt(1<<62))
	tmpl := &x509.Certificate{
		SerialNumber:          serial,
		Subject:               pkix.Name{CommonName: cn},
		NotBefore:             time.Now().Add(-48 * time.Hour),
		NotAfter:              notAfter,
		KeyUsage:              x509.KeyUsageDigitalSignature | x509.KeyUsageKeyEncipherment,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		DNSNames:              dns,
		BasicConstraintsValid: true,
		IsCA:                  isCA,
	}
	if isCA {
		tmpl.KeyUsage |= x509.KeyUsageCertSign
	}
	parent, signer := tmpl, key
	if ca != nil {
		parent, signer = ca, caKey
	}
	der, err := x509.CreateCertificate(rand.Reader, tmpl, parent, &key.PublicKey, signer)
	if err != nil {
		tb.Fatal(err)
	}
	cert, _ := x509.ParseCertificate(der)
	return cert, key, certSet{
		crt: pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der}),
		key: pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(key)}),
	}
}

func writeFile(tb testing.TB, path string, data []byte) {
	tb.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		tb.Fatal(err)
	}
	// The key is throwaway and the server user inside the container must read it.
	if err := os.WriteFile(path, data, 0o644); err != nil {
		tb.Fatal(err)
	}
}

const pgHBA = `local all all trust
hostssl all all all scram-sha-256
host all all all reject
`

const clickhouseTLS = `<clickhouse>
  <tcp_port_secure>9440</tcp_port_secure>
  <openSSL><server>
    <certificateFile>/certs/server.crt</certificateFile>
    <privateKeyFile>/certs/server.key</privateKeyFile>
    <verificationMode>none</verificationMode>
    <loadDefaultCAFile>false</loadDefaultCAFile>
  </server></openSSL>
</clickhouse>
`

func docker(args ...string) (string, error) {
	out, err := exec.Command("docker", args...).CombinedOutput()
	return strings.TrimSpace(string(out)), err
}

func publishedAddr(name, port string) (string, error) {
	out, err := docker("port", name, port+"/tcp")
	if err != nil {
		return "", fmt.Errorf("%s: %s", err, out)
	}
	_, p, err := net.SplitHostPort(strings.Split(out, "\n")[0])
	return "127.0.0.1:" + p, err
}

var serverPrefix = map[string]string{"postgres": "pg-", "mysql": "mysql-", "clickhouse": "clickhouse-"}

// setup starts the servers of one engine, once.
func setup(t *testing.T, engine string) {
	t.Helper()
	setupMu.Lock()
	defer setupMu.Unlock()
	if err, done := setupResult[engine]; done {
		if err != nil {
			t.Fatal(err)
		}
		return
	}
	// t.Fatal inside startServers exits this goroutine, so assume failure
	// until it returns and later tests report it instead of running blind.
	setupResult[engine] = errors.New("setup did not finish")
	setupResult[engine] = startServers(t, engine)
	if err := setupResult[engine]; err != nil {
		t.Fatal(err)
	}
}

func writeCerts(t *testing.T) error {
	if _, err := docker("info"); err != nil {
		return fmt.Errorf("docker is not available: %w", err)
	}
	var err error
	if certDir, err = os.MkdirTemp("", "datacia-tls-"); err != nil {
		return err
	}
	valid := time.Now().Add(24 * time.Hour)
	ca, caKey, caSet := newCert(t, nil, nil, true, "datacia test CA", valid)
	_, _, otherCA := newCert(t, nil, nil, true, "other CA", valid)
	writeFile(t, filepath.Join(certDir, "other-ca.crt"), otherCA.crt)
	writeFile(t, filepath.Join(certDir, "ca.crt"), caSet.crt)
	// The certificates name localhost only, so 127.0.0.1 is a host name mismatch.
	for dir, notAfter := range map[string]time.Time{"good": valid, "expired": time.Now().Add(-time.Hour)} {
		_, _, srv := newCert(t, ca, caKey, false, "localhost", notAfter, "localhost")
		writeFile(t, filepath.Join(certDir, dir, "server.crt"), srv.crt)
		writeFile(t, filepath.Join(certDir, dir, "server.key"), srv.key)
		writeFile(t, filepath.Join(certDir, dir, "ca.crt"), caSet.crt)
		writeFile(t, filepath.Join(certDir, dir, "pg_hba.conf"), []byte(pgHBA))
		writeFile(t, filepath.Join(certDir, dir, "tls.xml"), []byte(clickhouseTLS))
	}
	return nil
}

func startServers(t *testing.T, engine string) error {
	if certDir == "" {
		if err := writeCerts(t); err != nil {
			return err
		}
	}

	pgWrapper := `cp /certs/server.crt /certs/server.key /certs/pg_hba.conf /tmp/ &&
chown postgres /tmp/server.key /tmp/pg_hba.conf && chmod 600 /tmp/server.key &&
exec docker-entrypoint.sh postgres -c ssl=on -c ssl_cert_file=/tmp/server.crt -c ssl_key_file=/tmp/server.key -c hba_file=/tmp/pg_hba.conf`
	// target name -> docker run arguments and the container port to publish.
	type server struct {
		name, port string
		args       []string
	}
	servers := []server{
		{"pg-plain", "5432", []string{"-e", "POSTGRES_PASSWORD=test", "postgres:17-alpine"}},
		{"mysql-plain", "3306", []string{"-e", "MYSQL_ROOT_PASSWORD=test", "mysql:8.0", "--skip-ssl"}},
		{"clickhouse-plain", "9000", []string{"-e", "CLICKHOUSE_PASSWORD=test", clickhouseImage}},
	}
	for _, dir := range []string{"good", "expired"} {
		mount := []string{"-v", filepath.Join(certDir, dir) + ":/certs:ro"}
		servers = append(servers,
			server{"pg-tls-" + dir, "5432", append(append([]string{"-e", "POSTGRES_PASSWORD=test"}, mount...), "--entrypoint", "sh", "postgres:17-alpine", "-c", pgWrapper)},
			server{"mysql-tls-" + dir, "3306", append(append([]string{"-e", "MYSQL_ROOT_PASSWORD=test"}, mount...), "mysql:8.0",
				"--require_secure_transport=ON", "--ssl-ca=/certs/ca.crt", "--ssl-cert=/certs/server.crt", "--ssl-key=/certs/server.key")},
			server{"clickhouse-tls-" + dir, "9440", []string{"-e", "CLICKHOUSE_PASSWORD=test",
				"-v", filepath.Join(certDir, dir, "tls.xml") + ":/etc/clickhouse-server/config.d/tls.xml:ro",
				"-v", filepath.Join(certDir, dir) + ":/certs:ro", clickhouseImage}},
		)
	}

	var wg sync.WaitGroup
	errs := make(chan error, len(servers))
	for _, s := range servers {
		if !strings.HasPrefix(s.name, serverPrefix[engine]) {
			continue
		}
		container := containerPrefix + s.name + "-" + fmt.Sprint(os.Getpid())
		// The label lets the next run remove containers a killed run left behind.
		args := append([]string{"run", "-d", "--rm", "--label", containerLabel, "--name", container, "-p", "127.0.0.1::" + s.port}, s.args...)
		if out, err := docker(args...); err != nil {
			return fmt.Errorf("docker run %s: %s", s.name, out)
		}
		wg.Add(1)
		go func() {
			defer wg.Done()
			addr, err := publishedAddr(container, s.port)
			if err != nil {
				errs <- err
				return
			}
			endpointMu.Lock()
			endpoints[s.name] = addr
			endpointMu.Unlock()
		}()
	}
	wg.Wait()
	close(errs)
	return <-errs
}

type sslCase struct {
	name   string
	target string
	mode   string
	ca     string // "", "good" or "other"
	host   string // overrides localhost
	// wantErr is a substring of the expected error; empty means it connects.
	wantErr string
}

func (c sslCase) config(engine string) common.ConnectionConfig {
	addr := endpoints[c.target]
	_, port, _ := net.SplitHostPort(addr)
	host := c.host
	if host == "" {
		host = "localhost"
	}
	cfg := common.ConnectionConfig{Engine: engine, Host: host, Port: port, Username: "postgres", Password: "test", Database: "postgres", SSLMode: c.mode}
	switch engine {
	case "mysql":
		cfg.Username, cfg.Database = "root", "mysql"
	case "clickhouse":
		cfg.Username, cfg.Database = "default", "default"
	}
	switch c.ca {
	case "good":
		cfg.SSLCAPath = filepath.Join(certDir, "ca.crt")
	case "other":
		cfg.SSLCAPath = filepath.Join(certDir, "other-ca.crt")
	}
	return cfg
}

func waitReady(t *testing.T, engine, target string) {
	t.Helper()
	c := sslCase{target: target, mode: common.SSLModeRequire}
	if strings.HasSuffix(target, "-plain") {
		c.mode = common.SSLModeDisable
	}
	var err error
	for deadline := time.Now().Add(120 * time.Second); time.Now().Before(deadline); time.Sleep(time.Second) {
		if err = (&Engine{}).TestConnection(c.config(engine)); err == nil {
			return
		}
	}
	t.Fatalf("%s never became ready: %v", target, err)
}

func runCases(t *testing.T, engine string, targets []string, cases []sslCase) {
	setup(t, engine)
	for _, target := range targets {
		waitReady(t, engine, target)
	}
	for _, c := range cases {
		t.Run(c.target+"/"+c.name, func(t *testing.T) {
			err := (&Engine{}).TestConnection(c.config(engine))
			t.Logf("result: %v", err)
			switch {
			case c.wantErr == "" && err != nil:
				t.Errorf("want success, got %v", err)
			case c.wantErr != "" && err == nil:
				t.Errorf("want error containing %q, connected", c.wantErr)
			case c.wantErr != "" && !strings.Contains(err.Error(), c.wantErr):
				t.Errorf("want error containing %q, got %v", c.wantErr, err)
			}
		})
	}
}

// tlsOnlyCases are the same for every engine; only the errors differ.
func tlsOnlyCases(target, expired string, automatic, disable string) []sslCase {
	const (
		auto    = common.SSLModeAutomatic
		off     = common.SSLModeDisable
		require = common.SSLModeRequire
		verify  = common.SSLModeVerifyFull
	)
	return []sslCase{
		{name: "automatic", target: target, mode: auto, wantErr: automatic},
		{name: "disable", target: target, mode: off, wantErr: disable},
		{name: "require", target: target, mode: require},
		{name: "verify-full with CA", target: target, mode: verify, ca: "good"},
		{name: "verify-full wrong CA", target: target, mode: verify, ca: "other", wantErr: "failed to verify certificate"},
		{name: "verify-full system roots", target: target, mode: verify, wantErr: "failed to verify certificate"},
		{name: "verify-full wrong host", target: target, mode: verify, ca: "good", host: "127.0.0.1", wantErr: "127.0.0.1 because it doesn't contain any IP SANs"},
		{name: "require expired cert", target: expired, mode: require},
		{name: "verify-full expired cert", target: expired, mode: verify, ca: "good", wantErr: "expired"},
	}
}

func plainOnlyCases(target, refused string) []sslCase {
	return []sslCase{
		{name: "automatic", target: target, mode: common.SSLModeAutomatic},
		{name: "disable", target: target, mode: common.SSLModeDisable},
		{name: "require never falls back", target: target, mode: common.SSLModeRequire, wantErr: refused},
		{name: "verify-full never falls back", target: target, mode: common.SSLModeVerifyFull, ca: "good", wantErr: refused},
	}
}

func TestSSLModesPostgres(t *testing.T) {
	cases := tlsOnlyCases("pg-tls-good", "pg-tls-expired", "", "no encryption")
	cases = append(cases, plainOnlyCases("pg-plain", "server refused TLS")...)
	runCases(t, "postgres", []string{"pg-plain", "pg-tls-good", "pg-tls-expired"}, cases)
}

func TestSSLModesMySQL(t *testing.T) {
	// Automatic is plaintext, so a server that requires TLS refuses it.
	cases := tlsOnlyCases("mysql-tls-good", "mysql-tls-expired", "insecure transport", "insecure transport")
	cases = append(cases, plainOnlyCases("mysql-plain", "does not support TLS")...)
	runCases(t, "mysql", []string{"mysql-plain", "mysql-tls-good", "mysql-tls-expired"}, cases)
}

func TestSSLModesClickHouse(t *testing.T) {
	// The native protocol can't negotiate: TLS only works on the secure port.
	cases := tlsOnlyCases("clickhouse-tls-good", "clickhouse-tls-expired", "unexpected packet", "unexpected packet")
	cases = append(cases, plainOnlyCases("clickhouse-plain", "does not look like a TLS handshake")...)
	runCases(t, "clickhouse", []string{"clickhouse-plain", "clickhouse-tls-good", "clickhouse-tls-expired"}, cases)
}

// A TLS-only server refuses plaintext, so a successful switch shows the new
// connection kept the SSL mode (and the CA, for verify-full).
func TestChangeDatabaseKeepsSSL(t *testing.T) {
	tests := []struct {
		engine, target, database, sslQuery string
	}{
		{"postgres", "pg-tls-good", "template1", "SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()"},
		{"mysql", "mysql-tls-good", "sys", "SELECT VARIABLE_VALUE AS cipher FROM performance_schema.session_status WHERE VARIABLE_NAME = 'Ssl_cipher'"},
		{"clickhouse", "clickhouse-tls-good", "system", "SELECT 1"},
	}
	for _, tt := range tests {
		for _, mode := range []string{common.SSLModeRequire, common.SSLModeVerifyFull} {
			t.Run(tt.engine+"/"+mode, func(t *testing.T) {
				setup(t, tt.engine)
				waitReady(t, tt.engine, tt.target)
				c := sslCase{target: tt.target, mode: mode, ca: "good"}
				e := &Engine{}
				if err := e.Connect(c.config(tt.engine)); err != nil {
					t.Fatal(err)
				}
				t.Cleanup(func() { e.CloseCurrentConnection(false) })
				if err := e.ChangeDatabaseByName(tt.database); err != nil {
					t.Fatalf("switching database: %v", err)
				}
				res, err := e.ReadOnlyQuery(t.Context(), tt.sslQuery, 1)
				if err != nil {
					t.Fatal(err)
				}
				t.Logf("%s on %s: %v", tt.sslQuery, tt.database, res.Data)
				if len(res.Data) != 1 {
					t.Fatalf("unexpected result %v", res.Data)
				}
				// ClickHouse has no session TLS check; its secure port refusing
				// plaintext is the proof.
				if tt.engine != "clickhouse" {
					for _, v := range res.Data[0] {
						if v != true && (v == nil || v == "" || v == false) {
							t.Errorf("new connection is not encrypted: %v", res.Data)
						}
					}
				}
			})
		}
	}
}
