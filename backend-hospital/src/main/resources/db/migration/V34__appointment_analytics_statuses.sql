-- Analytics-ready appointment statuses: Open, COMPLETED, CANCELLED, NO_SHOW, RESCHEDULED.
-- Legacy rows may still use Open / SCHEDULED; matviews normalize at query time.

COMMENT ON COLUMN appointments.status IS
    'Lifecycle: Open (active slot), COMPLETED, CANCELLED, NO_SHOW, RESCHEDULED, DELETED (admin soft-remove).';
