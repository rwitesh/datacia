//go:build integration

package remote

import (
	"bytes"
	"datacia/internal/db"
	"datacia/internal/paths"
	"datacia/pkg/common"
	"datacia/pkg/ssh"
	"errors"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"

	"github.com/adrg/xdg"
	gossh "golang.org/x/crypto/ssh"
)

// These tests run the real connect path against an OpenSSH bastion and a
// database that is only reachable from it, all in Docker:
//
//	go test -tags integration -race -run TestSSHTunnel ./pkg/remote
//
// Containers are named datacia-ssh-* and removed afterwards.

const (
	labNetwork = "datacia-ssh-net"
	labBastion = "datacia-ssh-bastion"
	labPG      = "datacia-ssh-pg"
	labMySQL   = "datacia-ssh-mysql"
	labDBPass  = "labpass"
	probeID    = "11111111-1111-1111-1111-111111111111"
)

type sshLab struct {
	port     string // bastion port published on 127.0.0.1
	password string
	keyPath  string
	rsaKey   string
	pass     string // passphrase-protected key
}

func docker(t *testing.T, args ...string) string {
	t.Helper()
	out, err := exec.Command("docker", args...).CombinedOutput()
	if err != nil {
		t.Fatalf("docker %s: %v\n%s", strings.Join(args, " "), err, out)
	}
	return strings.TrimSpace(string(out))
}

func dockerQuiet(args ...string) { _ = exec.Command("docker", args...).Run() }

func removeLab() {
	dockerQuiet("rm", "-f", labBastion, labPG, labMySQL)
	dockerQuiet("network", "rm", labNetwork)
}

func keygen(t *testing.T, typ, path, passphrase string) string {
	t.Helper()
	out, err := exec.Command("ssh-keygen", "-q", "-t", typ, "-N", passphrase, "-f", path).CombinedOutput()
	if err != nil {
		t.Fatalf("ssh-keygen: %v\n%s", err, out)
	}
	pub, err := os.ReadFile(path + ".pub")
	if err != nil {
		t.Fatal(err)
	}
	return string(pub)
}

func startLab(t *testing.T) *sshLab {
	t.Helper()
	if _, err := exec.LookPath("docker"); err != nil {
		t.Skip("docker not available")
	}
	if err := exec.Command("docker", "info").Run(); err != nil {
		t.Skip("docker daemon not running")
	}
	if _, err := exec.LookPath("ssh-keygen"); err != nil {
		t.Skip("ssh-keygen not available")
	}
	removeLab()
	t.Cleanup(removeLab)

	dir := t.TempDir()
	lab := &sshLab{password: "pw-" + filepath.Base(dir), keyPath: filepath.Join(dir, "id_ed25519"), rsaKey: filepath.Join(dir, "id_rsa"), pass: filepath.Join(dir, "id_locked")}
	keys := keygen(t, "ed25519", lab.keyPath, "") + keygen(t, "rsa", lab.rsaKey, "")
	keygen(t, "ed25519", lab.pass, "secret")

	docker(t, "build", "-q", "-t", labBastion+":test", "testdata/ssh-bastion")
	docker(t, "network", "create", labNetwork)
	// Neither database publishes a port: only the bastion can reach them.
	docker(t, "run", "-d", "--name", labPG, "--network", labNetwork, "--network-alias", "db",
		"-e", "POSTGRES_PASSWORD="+labDBPass, "postgres:17-alpine")
	docker(t, "run", "-d", "--name", labMySQL, "--network", labNetwork, "--network-alias", "mysql",
		"-e", "MYSQL_ROOT_PASSWORD="+labDBPass, "mysql:8.0")
	docker(t, "run", "-d", "--name", labBastion, "--network", labNetwork, "-p", "127.0.0.1::22",
		"-e", "TUNNEL_PASSWORD="+lab.password, "-e", "TUNNEL_AUTHORIZED_KEYS="+keys, labBastion+":test")
	lab.port = publishedPort(t)

	waitFor(t, "sshd", func() bool { return sshdUp(lab.port) })
	waitFor(t, "postgres", func() bool {
		return exec.Command("docker", "exec", labPG, "pg_isready", "-h", "127.0.0.1").Run() == nil
	})
	// MySQL's init phase only listens on a socket, so a TCP ping means it is final.
	waitFor(t, "mysql", func() bool {
		return exec.Command("docker", "exec", labMySQL, "mysqladmin", "-h127.0.0.1", "-uroot", "-p"+labDBPass, "ping").Run() == nil
	})
	return lab
}

func sshdUp(port string) bool {
	c, err := net.DialTimeout("tcp", "127.0.0.1:"+port, time.Second)
	if err != nil {
		return false
	}
	defer c.Close()
	c.SetReadDeadline(time.Now().Add(time.Second))
	buf := make([]byte, 4)
	_, err = c.Read(buf)
	return err == nil && string(buf) == "SSH-"
}

// servedFingerprints returns the fingerprint sshd presents for each host key
// type, which only changes once it has re-read its keys.
func servedFingerprints(port string) []string {
	var fps []string
	for _, alg := range []string{gossh.KeyAlgoED25519, gossh.KeyAlgoRSASHA256, gossh.KeyAlgoECDSA256} {
		cfg := &gossh.ClientConfig{
			User:              "probe",
			HostKeyAlgorithms: []string{alg},
			HostKeyCallback: func(_ string, _ net.Addr, key gossh.PublicKey) error {
				fps = append(fps, gossh.FingerprintSHA256(key))
				return nil
			},
			Timeout: 2 * time.Second,
		}
		// The handshake fails at authentication; only the host key matters.
		if c, err := gossh.Dial("tcp", "127.0.0.1:"+port, cfg); err == nil {
			c.Close()
		}
	}
	return fps
}

func publishedPort(t *testing.T) string {
	t.Helper()
	addr := strings.Fields(docker(t, "port", labBastion, "22/tcp"))[0]
	return addr[strings.LastIndex(addr, ":")+1:]
}

func waitFor(t *testing.T, what string, ready func() bool) {
	t.Helper()
	deadline := time.Now().Add(90 * time.Second)
	for time.Now().Before(deadline) {
		if ready() {
			return
		}
		time.Sleep(500 * time.Millisecond)
	}
	t.Fatalf("%s did not become ready", what)
}

// hostFingerprints returns the SHA256 fingerprints `ssh-keygen -lf` prints for
// the bastion's host keys.
func hostFingerprints(t *testing.T) []string {
	t.Helper()
	var fps []string
	for _, typ := range []string{"ed25519", "rsa", "ecdsa"} {
		out := docker(t, "exec", labBastion, "ssh-keygen", "-lf", "/etc/ssh/ssh_host_"+typ+"_key.pub")
		fps = append(fps, strings.Fields(out)[1])
	}
	return fps
}

func contains(list []string, s string) bool {
	for _, v := range list {
		if v == s {
			return true
		}
	}
	return false
}

// isolatedEngine returns an Engine whose known_hosts and store live in a temp
// dir, so tests never touch the real app data.
func isolatedEngine(t *testing.T) (*Engine, string) {
	t.Helper()
	dir := t.TempDir()
	t.Setenv("XDG_DATA_HOME", dir)
	xdg.Reload()
	t.Cleanup(xdg.Reload)
	knownHosts, err := paths.GetKnownHostsPath()
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(knownHosts, dir) {
		t.Fatalf("known_hosts %s is outside the test dir", knownHosts)
	}
	store, err := db.OpenFile(filepath.Join(dir, "data.db"), bytes.Repeat([]byte{1}, 32))
	if err != nil {
		t.Fatal(err)
	}
	e := &Engine{store: store}
	t.Cleanup(func() { e.ServiceShutdown() })
	return e, knownHosts
}

func (l *sshLab) config(engine string) common.ConnectionConfig {
	c := common.ConnectionConfig{
		Engine: engine, Host: "db", Port: "5432", Username: "postgres", Password: labDBPass, Database: "postgres",
		SSH: common.SSHConfig{Enabled: true, Host: "127.0.0.1", Port: l.port, Username: "tunnel", Password: l.password},
	}
	if engine == "mysql" {
		c.Host, c.Port, c.Username, c.Database = "mysql", "3306", "root", "mysql"
	}
	return c
}

func asUnknown(t *testing.T, err error) *ssh.HostKeyUnknownError {
	t.Helper()
	var unknown *ssh.HostKeyUnknownError
	if !errors.As(err, &unknown) {
		t.Fatalf("want HostKeyUnknownError, got %T: %v", err, err)
	}
	// The UI reads the error by its fields, so it must come back unwrapped.
	if err != error(unknown) {
		t.Fatalf("host key error was wrapped: %v", err)
	}
	return unknown
}

func selectOne(t *testing.T, e *Engine) {
	t.Helper()
	res, err := e.RunQuery(probeID, "read", "select 1 as one")
	if err != nil {
		t.Fatalf("query through the tunnel: %v", err)
	}
	if len(res.Data) != 1 {
		t.Fatalf("unexpected result %+v", res)
	}
}

func goroutines() int {
	runtime.GC()
	return runtime.NumGoroutine()
}

func TestSSHTunnel(t *testing.T) {
	lab := startLab(t)
	fps := hostFingerprints(t)
	// The database must not be reachable without the tunnel.
	if out, err := exec.Command("docker", "port", labPG).CombinedOutput(); err != nil || len(bytes.TrimSpace(out)) != 0 {
		t.Fatalf("postgres publishes ports: %q %v", out, err)
	}

	t.Run("unknown key then accepted then remembered", func(t *testing.T) {
		e, knownHosts := isolatedEngine(t)
		cfg := lab.config("postgres")

		unknown := asUnknown(t, e.TestConnection(cfg))
		if !contains(fps, unknown.Fingerprint) {
			t.Fatalf("fingerprint %s is none of ssh-keygen's %v", unknown.Fingerprint, fps)
		}
		if unknown.Code != ssh.HostKeyUnknownCode || unknown.Host != "[127.0.0.1]:"+lab.port {
			t.Fatalf("unexpected error fields %+v", unknown)
		}
		if _, err := os.Stat(knownHosts); err == nil {
			if data, _ := os.ReadFile(knownHosts); len(data) != 0 {
				t.Fatal("known_hosts written before the user accepted")
			}
		}

		cfg.SSH.AcceptedFingerprint = unknown.Fingerprint
		if err := e.Connect(cfg); err != nil {
			t.Fatalf("connect with accepted fingerprint: %v", err)
		}
		selectOne(t, e)
		data, err := os.ReadFile(knownHosts)
		if err != nil || strings.Count(string(data), "\n") != 1 || !strings.Contains(string(data), unknown.Host) {
			t.Fatalf("known_hosts after accepting: %q %v", data, err)
		}
		if info, _ := os.Stat(knownHosts); info.Mode().Perm() != 0o600 {
			t.Errorf("known_hosts mode %v", info.Mode().Perm())
		}

		// Without an accepted fingerprint: remembered, no prompt, and the file is unchanged.
		cfg.SSH.AcceptedFingerprint = ""
		if err := e.TestConnection(cfg); err != nil {
			t.Fatalf("reconnect: %v", err)
		}
		if err := e.Connect(cfg); err != nil {
			t.Fatalf("reconnect: %v", err)
		}
		selectOne(t, e)
		after, _ := os.ReadFile(knownHosts)
		if !bytes.Equal(data, after) {
			t.Fatalf("known_hosts changed on reconnect: %q", after)
		}
	})

	t.Run("accepted fingerprint that does not match is refused", func(t *testing.T) {
		e, knownHosts := isolatedEngine(t)
		cfg := lab.config("postgres")
		cfg.SSH.AcceptedFingerprint = "SHA256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
		asUnknown(t, e.Connect(cfg))
		if data, _ := os.ReadFile(knownHosts); len(data) != 0 {
			t.Fatalf("known_hosts written for a mismatching fingerprint: %q", data)
		}
	})

	t.Run("wrong credentials", func(t *testing.T) {
		e, _ := isolatedEngine(t)
		cfg := lab.config("postgres")
		cfg.SSH.AcceptedFingerprint = asUnknown(t, e.TestConnection(cfg)).Fingerprint

		bad := cfg
		bad.SSH.Password = "nope"
		if err := e.TestConnection(bad); err == nil || !strings.Contains(err.Error(), "unable to authenticate") {
			t.Fatalf("wrong password: %v", err)
		}

		// A key the server doesn't know.
		other := filepath.Join(t.TempDir(), "other")
		keygen(t, "ed25519", other, "")
		bad = cfg
		bad.SSH.Password, bad.SSH.KeyPath = "", other
		if err := e.TestConnection(bad); err == nil || !strings.Contains(err.Error(), "unable to authenticate") {
			t.Fatalf("wrong key: %v", err)
		}

		bad.SSH.KeyPath = lab.pass
		err := e.TestConnection(bad)
		t.Logf("passphrase-protected key: %v", err)
		if err == nil || !strings.Contains(err.Error(), "passphrase") {
			t.Fatalf("passphrase-protected key should fail clearly: %v", err)
		}

		bad.SSH.KeyPath = filepath.Join(t.TempDir(), "missing")
		if err := e.TestConnection(bad); err == nil || !strings.Contains(err.Error(), "failed to read private key") {
			t.Fatalf("missing key file: %v", err)
		}

		// Wrong database password: the tunnel works, the database refuses.
		bad = cfg
		bad.Password = "nope"
		if err := e.TestConnection(bad); err == nil || !strings.Contains(err.Error(), "28P01") {
			t.Fatalf("wrong database password: %v", err)
		}
	})

	t.Run("key auth and both databases", func(t *testing.T) {
		e, _ := isolatedEngine(t)
		for _, key := range []string{lab.keyPath, lab.rsaKey} {
			for _, engine := range []string{"postgres", "mysql"} {
				cfg := lab.config(engine)
				cfg.SSH.Password, cfg.SSH.KeyPath = "", key
				if unknown, ok := e.Connect(cfg).(*ssh.HostKeyUnknownError); ok {
					cfg.SSH.AcceptedFingerprint = unknown.Fingerprint
				}
				if err := e.Connect(cfg); err != nil {
					t.Fatalf("%s with %s: %v", engine, filepath.Base(key), err)
				}
				selectOne(t, e)
				if tables, err := e.ListTables(); err != nil {
					t.Fatalf("%s tables: %v", engine, err)
				} else {
					t.Logf("%s via %s: %d tables", engine, filepath.Base(key), len(tables))
				}
			}
		}
	})

	t.Run("saved connection through EstablishConnection", func(t *testing.T) {
		e, _ := isolatedEngine(t)
		cfg := lab.config("postgres")
		cfg.Name = "lab"
		if err := e.SaveConnection(cfg); err != nil {
			t.Fatal(err)
		}
		list, err := e.ListConnections()
		if err != nil || len(list) != 1 {
			t.Fatalf("saved connections: %v %v", list, err)
		}
		var id string
		for id = range list {
		}
		unknown := asUnknown(t, e.EstablishConnection(id, ""))
		if err := e.EstablishConnection(id, unknown.Fingerprint); err != nil {
			t.Fatal(err)
		}
		selectOne(t, e)
		if err := e.EstablishConnection(id, ""); err != nil {
			t.Fatalf("second connect still prompts: %v", err)
		}
	})

	t.Run("close is prompt and leaks no goroutines", func(t *testing.T) {
		e, _ := isolatedEngine(t)
		cfg := lab.config("postgres")
		cfg.SSH.AcceptedFingerprint = asUnknown(t, e.TestConnection(cfg)).Fingerprint
		_ = e.Connect(cfg)
		e.CloseCurrentConnection(false)
		time.Sleep(500 * time.Millisecond)
		before := goroutines()
		for range 5 {
			if err := e.Connect(cfg); err != nil {
				t.Fatal(err)
			}
			selectOne(t, e)
			start := time.Now()
			if err := e.CloseCurrentConnection(false); err != nil {
				t.Fatal(err)
			}
			if d := time.Since(start); d > 3*time.Second {
				t.Fatalf("close took %v", d)
			}
			if err := e.TestConnection(cfg); err != nil {
				t.Fatal(err)
			}
		}
		var after int
		for range 20 {
			if after = goroutines(); after <= before {
				break
			}
			time.Sleep(250 * time.Millisecond)
		}
		if after > before {
			buf := make([]byte, 1<<16)
			t.Fatalf("goroutines grew from %d to %d\n%s", before, after, buf[:runtime.Stack(buf, true)])
		}
	})

	t.Run("changed host key is refused", func(t *testing.T) {
		e, knownHosts := isolatedEngine(t)
		cfg := lab.config("postgres")
		cfg.SSH.AcceptedFingerprint = asUnknown(t, e.TestConnection(cfg)).Fingerprint
		if err := e.TestConnection(cfg); err != nil {
			t.Fatal(err)
		}
		before, _ := os.ReadFile(knownHosts)

		// New host keys, same address; sshd re-reads them on SIGHUP.
		docker(t, "exec", labBastion, "sh", "-c", "rm /etc/ssh/ssh_host_*; ssh-keygen -A >/dev/null; kill -HUP 1")
		newFps := hostFingerprints(t)
		waitFor(t, "sshd to serve the new keys", func() bool {
			served := servedFingerprints(lab.port)
			return len(served) == 3 && contains(newFps, served[0]) && contains(newFps, served[1]) && contains(newFps, served[2])
		})

		for _, accepted := range []string{"", cfg.SSH.AcceptedFingerprint, newFps[0], newFps[1], newFps[2]} {
			cfg.SSH.AcceptedFingerprint = accepted
			err := e.TestConnection(cfg)
			if err == nil || !strings.Contains(err.Error(), "has changed") {
				t.Fatalf("accepted %q after key change: %v", accepted, err)
			}
			var unknown *ssh.HostKeyUnknownError
			if errors.As(err, &unknown) {
				t.Fatal("a changed key was offered for acceptance")
			}
		}
		if after, _ := os.ReadFile(knownHosts); !bytes.Equal(before, after) {
			t.Fatalf("known_hosts modified by a changed key: %q", after)
		}
	})

	t.Run("bastion stopped mid-session", func(t *testing.T) {
		e, _ := isolatedEngine(t)
		cfg := lab.config("postgres")
		cfg.SSH.AcceptedFingerprint = asUnknown(t, e.TestConnection(cfg)).Fingerprint
		time.Sleep(500 * time.Millisecond)
		before := goroutines()
		if err := e.Connect(cfg); err != nil {
			t.Fatal(err)
		}
		selectOne(t, e)

		docker(t, "stop", "-t", "0", labBastion)
		start := time.Now()
		var err error
		for time.Since(start) < 20*time.Second {
			if _, err = e.RunQuery(probeID, "read", "select 1"); err != nil && errors.Is(err, ssh.ErrTunnelLost) {
				break
			}
			time.Sleep(100 * time.Millisecond)
		}
		t.Logf("tunnel loss after docker stop surfaced as %q in %v", err, time.Since(start))
		if !errors.Is(err, ssh.ErrTunnelLost) {
			t.Fatalf("want ErrTunnelLost, got %v", err)
		}
		if _, err := e.ListTables(); !errors.Is(err, ssh.ErrTunnelLost) {
			t.Fatalf("ListTables after loss: %v", err)
		}

		start = time.Now()
		if err := e.CloseCurrentConnection(false); err != nil {
			t.Logf("close after loss returned %v", err)
		}
		if d := time.Since(start); d > 3*time.Second {
			t.Fatalf("close took %v", d)
		}
		var after int
		for range 20 {
			if after = goroutines(); after <= before {
				break
			}
			time.Sleep(250 * time.Millisecond)
		}
		if after > before {
			buf := make([]byte, 1<<16)
			t.Fatalf("goroutines grew from %d to %d\n%s", before, after, buf[:runtime.Stack(buf, true)])
		}

		// Connecting while the bastion is down fails fast and clearly.
		start = time.Now()
		err = e.TestConnection(cfg)
		t.Logf("connect while down: %v (%v)", err, time.Since(start))
		if err == nil {
			t.Fatal("connected through a stopped bastion")
		}
	})

	t.Run("bastion silently unreachable", func(t *testing.T) {
		if testing.Short() {
			t.Skip("takes about a minute")
		}
		docker(t, "start", labBastion)
		// The published port may change on restart.
		lab.port = publishedPort(t)
		waitFor(t, "sshd", func() bool { return sshdUp(lab.port) })

		e, _ := isolatedEngine(t)
		cfg := lab.config("postgres")
		cfg.SSH.AcceptedFingerprint = asUnknown(t, e.TestConnection(cfg)).Fingerprint
		if err := e.Connect(cfg); err != nil {
			t.Fatal(err)
		}
		selectOne(t, e)

		// A paused container keeps ACKing TCP, so only the keepalive can notice.
		docker(t, "pause", labBastion)
		defer dockerQuiet("unpause", labBastion)
		start := time.Now()
		var err error
		for time.Since(start) < 90*time.Second {
			_, err = e.RunQuery(probeID, "read", "select 1")
			if errors.Is(err, ssh.ErrTunnelLost) {
				break
			}
			if err != nil {
				t.Logf("query failed after %v: %v", time.Since(start).Round(time.Second), err)
			}
			time.Sleep(time.Second)
		}
		t.Logf("paused bastion: %q after %v", err, time.Since(start))
		if !errors.Is(err, ssh.ErrTunnelLost) {
			t.Fatalf("want ErrTunnelLost, got %v", err)
		}
	})
}
