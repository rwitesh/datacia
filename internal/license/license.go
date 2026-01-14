package license

type License struct {
	ID        string
	Key       string
	MachineId string
}

// cachedLicense holds the loaded license in memory
// It's loaded once at startup and then used read-only
var license *License
