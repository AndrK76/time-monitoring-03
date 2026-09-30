package app

import (
	"log/slog"

	"github.com/nightweb/time-monitoring-03/back-go/internal/config"
	"github.com/nightweb/time-monitoring-03/back-go/internal/logging"
)

// loggingFor applies the per-service log level.
//
// The Java services hard-coded ru.igorit.monitoring to DEBUG and left the rest at
// info, so application packages were verbose while the framework was quiet. The
// Go equivalent is a service-wide level, overridable per deployment.
func loggingFor(props *config.Properties, service string) *slog.Logger {
	level := props.Get("LOG_LEVEL", "LOG_LEVEL", "INFO")
	format := props.Get("LOG_FORMAT", "LOG_FORMAT", "json")
	return logging.Init(service, level, format)
}
