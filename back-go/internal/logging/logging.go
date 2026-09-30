// Package logging configures the standard-library structured logger.
//
// The Java services used log4j2 via Lombok's @Log4j2 with a per-package level
// from application.yml. slog gives the same split (level per subtree) without a
// third-party dependency, so the same LOG_LEVEL variable works.
package logging

import (
	"log/slog"
	"os"
	"strings"
)

// Init builds the root logger. format is "json" or "text"; level is a slog
// level name such as DEBUG, INFO, WARN, ERROR.
func Init(service, level, format string) *slog.Logger {
	var lvl slog.Level
	switch strings.ToUpper(strings.TrimSpace(level)) {
	case "TRACE", "DEBUG":
		lvl = slog.LevelDebug
	case "WARN", "WARNING":
		lvl = slog.LevelWarn
	case "ERROR":
		lvl = slog.LevelError
	default:
		lvl = slog.LevelInfo
	}

	opts := &slog.HandlerOptions{Level: lvl}
	var handler slog.Handler
	if strings.EqualFold(format, "json") {
		handler = slog.NewJSONHandler(os.Stdout, opts)
	} else {
		handler = slog.NewTextHandler(os.Stdout, opts)
	}

	log := slog.New(handler).With("service", service)
	slog.SetDefault(log)
	return log
}
