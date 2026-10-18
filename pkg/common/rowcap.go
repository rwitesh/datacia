package common

import "context"

// RowIterator is satisfied by sql.Rows, pgx.Rows and the ClickHouse driver's rows.
type RowIterator interface {
	Next() bool
}

// ScanCapped calls scanRow for each row until maxRows have been read (0 means no
// cap). Reaching the cap only counts as truncation when one more row exists, so a
// result of exactly maxRows isn't flagged. The caller still checks rows.Err().
func ScanCapped(ctx context.Context, rows RowIterator, maxRows int, scanRow func() error) (truncated bool, err error) {
	n := 0
	for rows.Next() {
		if maxRows > 0 && n == maxRows {
			return true, nil
		}
		if err := ctx.Err(); err != nil {
			return false, err
		}
		if err := scanRow(); err != nil {
			return false, err
		}
		n++
	}
	return false, nil
}
