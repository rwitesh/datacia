package files

import (
	"bytes"
	"encoding/base64"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/wailsapp/wails/v3/pkg/application"
)

type FileService struct {
	app *application.App
}

func NewFileService(app *application.App) *FileService {
	return &FileService{
		app: app,
	}
}

// ExportDataToFile asks where to save and writes the export there. data is a
// JSON array of rows for csv and json (columns gives the CSV column order), or
// base64 image data for png. It returns the saved path, or "" if cancelled.
func (s *FileService) ExportDataToFile(format string, data string, columns []string, suggestedFilename string) (string, error) {
	if data == "" {
		return "", fmt.Errorf("no data to export")
	}

	var content []byte
	var ext string

	switch strings.ToLower(format) {
	case "csv":
		ext = ".csv"
		csvContent, err := rowsToCSV(data, columns)
		if err != nil {
			return "", err
		}
		content = csvContent
	case "json":
		ext = ".json"
		var rows []json.RawMessage
		if err := json.Unmarshal([]byte(data), &rows); err != nil {
			return "", fmt.Errorf("failed to parse data: %w", err)
		}
		if len(rows) == 0 {
			return "", fmt.Errorf("no data to export")
		}
		// Indent rather than decode and re-encode, which would sort the keys
		// and could change how numbers are written.
		var buf bytes.Buffer
		if err := json.Indent(&buf, []byte(data), "", "  "); err != nil {
			return "", fmt.Errorf("failed to format JSON: %w", err)
		}
		content = buf.Bytes()
	case "png":
		ext = ".png"
		// Remove data URL prefix if present
		if idx := strings.Index(data, ","); idx != -1 {
			data = data[idx+1:]
		}
		// Decode base64
		decoded, err := base64.StdEncoding.DecodeString(data)
		if err != nil {
			return "", fmt.Errorf("failed to decode image data: %w", err)
		}
		content = decoded
	default:
		return "", fmt.Errorf("unsupported format: %s", format)
	}

	filename := suggestedFilename
	if !strings.HasSuffix(strings.ToLower(filename), ext) {
		// Clean up existing known extensions if present but wrong
		filename = strings.TrimSuffix(filename, ".csv")
		filename = strings.TrimSuffix(filename, ".json")
		filename = strings.TrimSuffix(filename, ".png")
		filename += ext
	}

	// Configure save dialog based on format
	dialog := s.app.Dialog.SaveFile().SetFilename(filename)

	if ext == ".png" {
		dialog.AddFilter("PNG Image", "*.png")
	}

	path, err := dialog.PromptForSingleSelection()
	if err != nil {
		return "", err
	}

	if path == "" {
		return "", nil // User cancelled
	}

	if err := os.WriteFile(path, content, 0644); err != nil {
		return "", fmt.Errorf("failed to write file: %w", err)
	}

	return path, nil
}

func rowsToCSV(data string, columns []string) ([]byte, error) {
	if len(columns) == 0 {
		return nil, fmt.Errorf("no columns to export")
	}
	// UseNumber keeps numbers as written; float64 would print 1234567 as
	// 1.234567e+06 and round large integers.
	decoder := json.NewDecoder(strings.NewReader(data))
	decoder.UseNumber()
	var rows []map[string]interface{}
	if err := decoder.Decode(&rows); err != nil {
		return nil, fmt.Errorf("failed to parse data: %w", err)
	}
	if len(rows) == 0 {
		return nil, fmt.Errorf("no data to export")
	}

	var buf bytes.Buffer
	writer := csv.NewWriter(&buf)
	_ = writer.Write(columns)
	record := make([]string, len(columns))
	for _, row := range rows {
		for i, column := range columns {
			record[i] = csvValue(row[column])
		}
		_ = writer.Write(record)
	}
	writer.Flush()
	return buf.Bytes(), writer.Error()
}

func csvValue(value interface{}) string {
	switch v := value.(type) {
	case nil:
		return ""
	case string:
		return neutralizeFormula(v)
	case json.Number:
		return v.String()
	case bool:
		return strconv.FormatBool(v)
	default:
		// Objects and arrays, e.g. JSON columns.
		encoded, err := json.Marshal(v)
		if err != nil {
			return fmt.Sprint(v)
		}
		return string(encoded)
	}
}

// neutralizeFormula prefixes cells a spreadsheet would run as a formula, so
// a hostile value in the database can't execute when the export is opened.
func neutralizeFormula(s string) string {
	if s != "" && strings.ContainsRune("=+-@\t\r", rune(s[0])) {
		return "'" + s
	}
	return s
}
