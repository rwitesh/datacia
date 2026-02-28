package logger

import "github.com/sirupsen/logrus"

func Error(op string, err error, msg string) {
	Logger.WithField("op", op).WithError(err).Error(msg)
}

func Warn(op string, err error, msg string) {
	Logger.WithField("op", op).WithError(err).Warn(msg)
}

func Info(op string, msg string) {
	Logger.WithField("op", op).Info(msg)
}

func Debug(op string, msg string) {
	Logger.WithField("op", op).Debug(msg)
}

func ErrorWithFields(op string, err error, msg string, fields logrus.Fields) {
	Logger.WithField("op", op).WithFields(fields).WithError(err).Error(msg)
}

func WarnWithFields(op string, err error, msg string, fields logrus.Fields) {
	Logger.WithField("op", op).WithFields(fields).WithError(err).Warn(msg)
}

func InfoWithFields(op string, msg string, fields logrus.Fields) {
	Logger.WithField("op", op).WithFields(fields).Info(msg)
}

func DebugWithFields(op string, msg string, fields logrus.Fields) {
	Logger.WithField("op", op).WithFields(fields).Debug(msg)
}
