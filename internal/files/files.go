package files

import (
	"encoding/json"
	"fmt"
	"os"
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

// ExportDataToFile exports data to a file with the given format (csv or json)
// data: JSON array string of rows
// suggestedFilename: default filename suggestion
func (s *FileService) ExportDataToFile(format string, data string, suggestedFilename string) (string, error) {
	// Parse the JSON data
	var rows []map[string]interface{}
	if err := json.Unmarshal([]byte(data), &rows); err != nil {
		return "", fmt.Errorf("failed to parse data: %w", err)
	}

	if len(rows) == 0 {
		return "", fmt.Errorf("no data to export")
	}

	var content string
	var ext string

	switch strings.ToLower(format) {
	case "csv":
		ext = ".csv"
		content = convertToCSV(rows)
	case "json":
		ext = ".json"
		// Pretty-print JSON
		jsonBytes, err := json.MarshalIndent(rows, "", "  ")
		if err != nil {
			return "", fmt.Errorf("failed to format JSON: %w", err)
		}
		content = string(jsonBytes)
	default:
		return "", fmt.Errorf("unsupported format: %s", format)
	}

	filename := suggestedFilename
	if !strings.HasSuffix(strings.ToLower(filename), ext) {
		filename = strings.TrimSuffix(filename, ".csv")
		filename = strings.TrimSuffix(filename, ".json")
		filename += ext
	}

	// Open save dialog
	path, err := application.SaveFileDialog().SetFilename(filename).PromptForSingleSelection()
	if err != nil {
		return "", err
	}

	if path == "" {
		return "", nil // User cancelled
	}
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		return "", fmt.Errorf("failed to write file: %w", err)
	}

	return path, nil
}

func convertToCSV(rows []map[string]interface{}) string {
	if len(rows) == 0 {
		return ""
	}

	// Get headers from first row
	var headers []string
	for key := range rows[0] {
		headers = append(headers, key)
	}

	var sb strings.Builder

	// Write header row
	sb.WriteString(strings.Join(headers, ","))
	sb.WriteString("\n")

	// Write data rows
	for _, row := range rows {
		var values []string
		for _, header := range headers {
			val := row[header]
			values = append(values, escapeCSVValue(val))
		}
		sb.WriteString(strings.Join(values, ","))
		sb.WriteString("\n")
	}

	return sb.String()
}

// properly escapes a value for CSV format
func escapeCSVValue(val interface{}) string {
	if val == nil {
		return ""
	}

	str := fmt.Sprintf("%v", val)

	// If the value contains comma, quote, or newline, wrap in quotes and escape quotes
	if strings.ContainsAny(str, ",\"\n\r") {
		str = strings.ReplaceAll(str, "\"", "\"\"")
		str = "\"" + str + "\""
	}

	return str
}
