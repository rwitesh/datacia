package license

import "time"

type License struct {
	ID        string
	Key       string
	MachineId string
	CreatedAt time.Time
	ExpiresAt time.Time
}

var license *License
