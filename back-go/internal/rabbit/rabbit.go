// Package rabbit is the RabbitMQ transport from core-rabbit.
//
// The topology is fixed by the contract between the services: one topic exchange
// and one durable queue per service, each bound to its own routing key. Command
// bodies are the same JSON envelope the Java services produced, so a Java and a
// Go instance can share a broker during a rolling migration.
package rabbit

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"sync"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"

	"github.com/nightweb/time-monitoring-03/back-go/internal/common"
)

// Routing keys, from RabbitMQConfigProperties.
const (
	Exchange        = "mon3.exchange"
	RouteAdmin      = "mon3.admin"
	RouteAuth       = "mon3.auth"
	RouteMonitoring = "mon3.mon"
)

// Queue names, from each service's application.yml.
const (
	QueueAuth       = "mon3-auth-queue"
	QueueAdmin      = "mon3-admin-queue"
	QueueMonitoring = "mon3-monitoring-queue"
)

// Config carries the spring.rabbitmq settings.
type Config struct {
	Host     string
	Port     int
	Username string
	Password string
	VHost    string
	Queue    string
	// Retry mirrors spring.rabbitmq.listener.simple.retry: three attempts with
	// exponential backoff from InitialInterval up to MaxInterval.
	RetryAttempts     int
	RetryInitial      time.Duration
	RetryMax          time.Duration
	RetryMultiplier   float64
	Prefetch          int
	ReconnectInterval time.Duration
}

// Client is a reconnecting AMQP client.
//
// A connection is not safe for concurrent use, and one is shared by the command
// publisher and the listener, so sends and receives each hold their own guarded
// connection. Both are re-established on failure; the Java client did the same
// via Spring's auto-recovery.
type Client struct {
	cfg        Config
	sourceName string

	mu   sync.Mutex
	conn *amqp.Connection
	pub  *amqp.Channel
}

// NewClient dials the broker. It fails fast when the broker is unreachable, so
// a misconfigured deployment does not start and then silently drop every event.
func NewClient(cfg Config, sourceService string) (*Client, error) {
	c := &Client{cfg: cfg, sourceName: sourceService}
	if err := c.connect(); err != nil {
		return nil, err
	}
	return c, nil
}

func amqpURL(cfg Config) string {
	vhost := cfg.VHost
	if vhost == "" {
		vhost = "/"
	}
	return fmt.Sprintf("amqp://%s:%s@%s:%d%s", cfg.Username, cfg.Password, cfg.Host, cfg.Port, vhost)
}

func (c *Client) connect() error {
	conn, err := amqp.Dial(amqpURL(c.cfg))
	if err != nil {
		return fmt.Errorf("dial rabbitmq at %s:%d: %w", c.cfg.Host, c.cfg.Port, err)
	}
	ch, err := conn.Channel()
	if err != nil {
		_ = conn.Close()
		return fmt.Errorf("open rabbitmq channel: %w", err)
	}
	c.mu.Lock()
	c.conn, c.pub = conn, ch
	c.mu.Unlock()

	// Declaring here rather than relying on RabbitAdmin: idempotent, and it
	// makes a Go service able to start against a broker the Java stack populated.
	if err := c.declare(ch, c.cfg.Queue); err != nil {
		return err
	}
	return nil
}

func (c *Client) declare(ch *amqp.Channel, queue string) error {
	if queue == "" {
		return nil
	}
	if err := ch.ExchangeDeclare(Exchange, "topic", true, false, false, false, nil); err != nil {
		return fmt.Errorf("declare exchange: %w", err)
	}
	if _, err := ch.QueueDeclare(queue, true, false, false, false, nil); err != nil {
		return fmt.Errorf("declare queue %s: %w", queue, err)
	}
	// The binding key is the queue's own route, so each service receives only
	// what is addressed to it.
	key := routeForQueue(queue)
	if err := ch.QueueBind(queue, key, Exchange, false, nil); err != nil {
		return fmt.Errorf("bind queue %s: %w", queue, err)
	}
	return nil
}

// routeForQueue maps a queue name to its routing key.
func routeForQueue(queue string) string {
	switch queue {
	case QueueAuth:
		return RouteAuth
	case QueueAdmin:
		return RouteAdmin
	case QueueMonitoring:
		return RouteMonitoring
	default:
		return queue
	}
}

// Send publishes a command envelope to a routing key.
//
// The Java CommandSender swallowed nothing: it logged and returned. Here a
// publish failure is returned so the caller decides, and the callers do decide
// to log and continue, because the Java services deliberately let a broker
// outage not fail a business transaction.
func (c *Client) Send(ctx context.Context, route string, cmdType common.CommandMessageType, payload any) error {
	body, err := encodeCommand(cmdType, payload, c.sourceName, currentUserContext(ctx))
	if err != nil {
		return err
	}
	return c.publish(ctx, route, body)
}

func (c *Client) publish(ctx context.Context, route string, body []byte) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.pub == nil || c.pub.IsClosed() {
		if err := c.reconnectLocked(); err != nil {
			return err
		}
	}
	err := c.pub.PublishWithContext(ctx, Exchange, route, false, false, amqp.Publishing{
		ContentType:  "application/json",
		DeliveryMode: amqp.Persistent,
		Timestamp:    time.Now(),
		Body:         body,
	})
	if err != nil {
		// Drop the connection so the next publish redials instead of failing
		// every send against a dead channel.
		c.dropLocked()
		return fmt.Errorf("publish to %s: %w", route, err)
	}
	return nil
}

func (c *Client) reconnectLocked() error {
	c.dropLocked()
	return c.connect()
}

func (c *Client) dropLocked() {
	if c.pub != nil {
		_ = c.pub.Close()
		c.pub = nil
	}
	if c.conn != nil {
		_ = c.conn.Close()
		c.conn = nil
	}
}

// Close releases both channels.
func (c *Client) Close() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.dropLocked()
}

// userContextKey carries the requesting identity so a handler's command carries
// the same user context the Java SecurityContextMapper would have attached.
type userContextKey struct{}

// WithUserContext attaches a user context for command publishing.
func WithUserContext(ctx context.Context, uc *common.UserContext) context.Context {
	return context.WithValue(ctx, userContextKey{}, uc)
}

func currentUserContext(ctx context.Context) *common.UserContext {
	uc, _ := ctx.Value(userContextKey{}).(*common.UserContext)
	return uc
}

func encodeCommand(cmdType common.CommandMessageType, payload any, sourceService string, uc *common.UserContext) ([]byte, error) {
	raw, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshal %s payload: %w", cmdType, err)
	}
	cmdID := newUUID()
	now := common.NowLocalDateTime()
	msg := common.CommandMessage{
		CommandID:     cmdID,
		CommandType:   cmdType,
		Payload:       raw,
		UserContext:   uc,
		Timestamp:     &now,
		SourceService: sourceService,
		CorrelationID: cmdID,
	}
	if msg.UserContext == nil {
		msg.UserContext = common.AnonymousUserContext()
	}
	body, err := json.Marshal(msg)
	if err != nil {
		return nil, fmt.Errorf("marshal command envelope: %w", err)
	}
	return body, nil
}

// Handler processes one command. Returning an error triggers the retry policy.
type Handler func(ctx context.Context, cmd *common.CommandMessage) error

// Consume subscribes to the configured queue until ctx is cancelled.
//
// The Java listeners caught every exception inside the handler and logged, so
// the broker always acknowledged and the configured retry never engaged. That is
// reproduced faithfully by default: pass swallowErrors=false to opt into the
// retry policy instead, which is the more useful behaviour for a transient
// database fault.
func (c *Client) Consume(ctx context.Context, handler Handler, swallowErrors bool) {
	go c.consumeLoop(ctx, handler, swallowErrors)
}

func (c *Client) consumeLoop(ctx context.Context, handler Handler, swallowErrors bool) {
	backoff := c.cfg.ReconnectInterval
	if backoff <= 0 {
		backoff = 5 * time.Second
	}
	for ctx.Err() == nil {
		err := c.consumeOnce(ctx, handler, swallowErrors)
		if ctx.Err() != nil {
			return
		}
		if err == nil {
			return
		}
		slog.Error("rabbit consumer stopped, reconnecting", "queue", c.cfg.Queue, "err", err, "retryIn", backoff)
		select {
		case <-ctx.Done():
			return
		case <-time.After(backoff):
		}
		if backoff < 30*time.Second {
			backoff *= 2
		}
	}
}

func (c *Client) consumeOnce(ctx context.Context, handler Handler, swallowErrors bool) error {
	conn, err := amqp.Dial(amqpURL(c.cfg))
	if err != nil {
		return fmt.Errorf("dial for consume: %w", err)
	}
	defer conn.Close()

	ch, err := conn.Channel()
	if err != nil {
		return fmt.Errorf("open consume channel: %w", err)
	}
	defer ch.Close()

	if err := c.declare(ch, c.cfg.Queue); err != nil {
		return err
	}
	prefetch := c.cfg.Prefetch
	if prefetch <= 0 {
		prefetch = 10
	}
	if err := ch.Qos(prefetch, 0, false); err != nil {
		return fmt.Errorf("set qos: %w", err)
	}

	deliveries, err := ch.Consume(c.cfg.Queue, "", false, false, false, false, nil)
	if err != nil {
		return fmt.Errorf("consume %s: %w", c.cfg.Queue, err)
	}

	slog.Info("rabbit consumer started", "queue", c.cfg.Queue, "route", routeForQueue(c.cfg.Queue))
	for {
		select {
		case <-ctx.Done():
			return nil
		case d, ok := <-deliveries:
			if !ok {
				return errors.New("delivery channel closed")
			}
			c.handleDelivery(ctx, d, handler, swallowErrors)
		}
	}
}

func (c *Client) handleDelivery(ctx context.Context, d amqp.Delivery, handler Handler, swallowErrors bool) {
	var cmd common.CommandMessage
	if err := json.Unmarshal(d.Body, &cmd); err != nil {
		// An undecodable body can never succeed, so retrying is pointless.
		slog.Error("undecodable command dropped", "err", err, "body", truncate(string(d.Body), 512))
		_ = d.Reject(false)
		return
	}

	err := c.withRetry(ctx, func() error { return handler(ctx, &cmd) })
	if err != nil {
		if swallowErrors {
			// The Java behaviour: log, then acknowledge, so the message is
			// consumed even though the handler failed.
			slog.Error("command failed, acknowledging anyway",
				"commandId", cmd.CommandID, "commandType", cmd.CommandType,
				"source", cmd.SourceService, "err", err)
			_ = d.Ack(false)
			return
		}
		slog.Error("command failed, rejecting", "commandId", cmd.CommandID, "commandType", cmd.CommandType, "err", err)
		_ = d.Nack(false, true)
		return
	}
	_ = d.Ack(false)
}

// withRetry applies the listener retry policy: maxAttempts tries with
// exponential backoff between InitialInterval and MaxInterval.
func (c *Client) withRetry(ctx context.Context, fn func() error) error {
	attempts := c.cfg.RetryAttempts
	if attempts <= 0 {
		attempts = 3
	}
	initial := c.cfg.RetryInitial
	if initial <= 0 {
		initial = time.Second
	}
	max := c.cfg.RetryMax
	if max <= 0 {
		max = 10 * time.Second
	}
	mult := c.cfg.RetryMultiplier
	if mult <= 0 {
		mult = 2.0
	}

	delay := initial
	var err error
	for attempt := 1; attempt <= attempts; attempt++ {
		if err = fn(); err == nil {
			return nil
		}
		if attempt == attempts {
			break
		}
		slog.Debug("command attempt failed, retrying", "attempt", attempt, "maxAttempts", attempts, "delay", delay, "err", err)
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(delay):
		}
		delay = time.Duration(float64(delay) * mult)
		if delay > max {
			delay = max
		}
	}
	return err
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}
