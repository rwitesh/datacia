package logger

func Error(msg string, attrs ...string) {
	if Logger == nil {
		return
	}
	e := Logger.Error()
	for i := 0; i+1 < len(attrs); i += 2 {
		e = e.String(attrs[i], attrs[i+1])
	}
	e.Emit(msg)
}

func Warn(msg string, attrs ...string) {
	if Logger == nil {
		return
	}
	e := Logger.Warn()
	for i := 0; i+1 < len(attrs); i += 2 {
		e = e.String(attrs[i], attrs[i+1])
	}
	e.Emit(msg)
}

func Info(msg string, attrs ...string) {
	if Logger == nil {
		return
	}
	e := Logger.Info()
	for i := 0; i+1 < len(attrs); i += 2 {
		e = e.String(attrs[i], attrs[i+1])
	}
	e.Emit(msg)
}

func Debug(msg string, attrs ...string) {
	if Logger == nil {
		return
	}
	e := Logger.Debug()
	for i := 0; i+1 < len(attrs); i += 2 {
		e = e.String(attrs[i], attrs[i+1])
	}
	e.Emit(msg)
}
