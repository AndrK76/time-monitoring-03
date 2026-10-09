CREATE TABLE macroscop_zone_info (
    id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    place_id                VARCHAR(255) NOT NULL,
    macroscop_zone_left     DOUBLE PRECISION,
    macroscop_zone_top      DOUBLE PRECISION,
    macroscop_zone_width    DOUBLE PRECISION,
    macroscop_zone_height   DOUBLE PRECISION,
    valid_from              TIMESTAMPTZ NOT NULL,
    valid_to                TIMESTAMPTZ,
    CONSTRAINT fk_macroscop_zone_info_place
        FOREIGN KEY (place_id) REFERENCES evt_places (id) ON DELETE CASCADE
);

CREATE INDEX ix_macroscop_zone_info_place
    ON macroscop_zone_info (place_id, valid_from);

-- В каждый момент времени у места не более одной открытой записи.
CREATE UNIQUE INDEX ux_macroscop_zone_info_open
    ON macroscop_zone_info (place_id)
    WHERE valid_to IS NULL;

-- Переносим то, что уже есть в evt_places.
INSERT INTO macroscop_zone_info (
    place_id,
    macroscop_zone_left, macroscop_zone_top,
    macroscop_zone_width, macroscop_zone_height,
    valid_from
)
SELECT
    id,
    macroscop_zone_left, macroscop_zone_top,
    macroscop_zone_width, macroscop_zone_height,
    COALESCE(created_at, now()) AT TIME ZONE 'UTC'
FROM evt_places
WHERE macroscop_zone_left IS NOT NULL
   OR macroscop_zone_top IS NOT NULL
   OR macroscop_zone_width IS NOT NULL
   OR macroscop_zone_height IS NOT NULL;

-- Ссылка на текущую зону.
ALTER TABLE evt_places
    ADD COLUMN current_zone_id BIGINT;

ALTER TABLE evt_places
    ADD CONSTRAINT fk_evt_places_current_zone
        FOREIGN KEY (current_zone_id) REFERENCES macroscop_zone_info (id);

UPDATE evt_places ep
   SET current_zone_id = z.id
  FROM macroscop_zone_info z
 WHERE z.place_id = ep.id
   AND z.valid_to IS NULL;

-- Убираем старые колонки embeddable.
ALTER TABLE evt_places
    DROP COLUMN macroscop_zone_left,
    DROP COLUMN macroscop_zone_top,
    DROP COLUMN macroscop_zone_width,
    DROP COLUMN macroscop_zone_height;