package logger

import (
	"github.com/sirupsen/logrus"
)

var (
	Logger *logrus.Logger
)

func Init(production bool) error {
	Logger = logrus.New()

	if production {
		Logger.SetFormatter(&logrus.JSONFormatter{})
		Logger.SetLevel(logrus.InfoLevel)
	} else {
		Logger.SetFormatter(&logrus.TextFormatter{
			FullTimestamp:   true,
			TimestampFormat: "2006-01-02T15:04:05.000Z07:00",
			ForceColors:     true,
		})
		Logger.SetLevel(logrus.DebugLevel)
	}

	return nil
}
