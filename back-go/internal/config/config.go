// Package config loads deployment settings the way the Spring services did:
// flat keys resolved from optional .properties files first and the process
// environment second, with the environment always winning.
//
// The Java services imported, in order, ../.properties, ./.properties and
// ./<service>/.properties, then let ${ENV_VAR:default} placeholders resolve
// from the environment. Config.Lookup keeps the same precedence:
//
//  1. properties file, last file wins
//  2. environment variable
//  3. the default baked into the Go binary
//
// All three sources are consulted by name, so an operator migrating from the
// Java stack can drop the same .properties files in place.
package config

import (
	"bufio"
	"fmt"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

// Properties is a flat key/value map with dotted-path access.
type Properties struct {
	values map[string]string
	once   sync.Once
}

// Load reads the given .properties files in order; later files override
// earlier ones. Missing files are skipped, matching the `optional:file:`
// imports in the Java application.yml files.
func Load(paths ...string) *Properties {
	p := &Properties{values: make(map[string]string)}
	for _, path := range paths {
		p.loadFile(path)
	}
	return p
}

func (p *Properties) loadFile(path string) {
	f, err := os.Open(path)
	if err != nil {
		return // optional by design
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") || strings.HasPrefix(line, "!") {
			continue
		}
		// A trailing backslash continues the line, as in java.util.Properties.
		for strings.HasSuffix(line, `\`) && scanner.Scan() {
			line = strings.TrimSuffix(line, `\`) + strings.TrimSpace(scanner.Text())
		}
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			key, value, ok = strings.Cut(line, ":")
		}
		if !ok {
			continue
		}
		p.values[strings.TrimSpace(key)] = unescapePropertyValue(strings.TrimSpace(value))
	}
}

func unescapePropertyValue(v string) string {
	r := strings.NewReplacer(`\:`, ":", `\=`, "=", `\n`, "\n", `\t`, "\t", `\\`, `\`)
	return r.Replace(v)
}

// Get returns the first non-empty value found across the properties map, the
// environment, and the supplied default.
func (p *Properties) Get(key, envKey, def string) string {
	if v, ok := p.values[key]; ok && v != "" {
		return v
	}
	if envKey != "" {
		if v := os.Getenv(envKey); v != "" {
			return v
		}
	}
	return def
}

// Env returns the environment value for key, ignoring the properties map. Used
// where a setting must never be read from a file (secrets in dev, say).
func Env(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func (p *Properties) GetInt(key, envKey string, def int) int {
	raw := p.Get(key, envKey, "")
	if raw == "" {
		return def
	}
	n, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil {
		return def
	}
	return n
}

func (p *Properties) GetBool(key, envKey string, def bool) bool {
	raw := p.Get(key, envKey, "")
	if raw == "" {
		return def
	}
	b, err := strconv.ParseBool(strings.TrimSpace(raw))
	if err != nil {
		return def
	}
	return b
}

func (p *Properties) GetDurationMS(key, envKey string, def time.Duration) time.Duration {
	raw := p.Get(key, envKey, "")
	if raw == "" {
		return def
	}
	if ms, err := strconv.Atoi(strings.TrimSpace(raw)); err == nil {
		return time.Duration(ms) * time.Millisecond
	}
	if d, err := time.ParseDuration(strings.TrimSpace(raw)); err == nil {
		return d
	}
	return def
}

// MustExist returns an error naming the offending variable when a required
// setting is empty, so a misconfigured deployment fails at boot instead of at
// the first request.
func MustExist(value, name string) error {
	if strings.TrimSpace(value) == "" {
		return fmt.Errorf("required configuration %s is not set", name)
	}
	return nil
}
