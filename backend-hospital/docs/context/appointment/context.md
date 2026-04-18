# Package: `com.flexshell.appointment`

## Role

Mongo-backed **appointment** persistence: entity + repository; orchestration lives in `AppointmentService`.

## Related

- `AppointmentController` — `/api/appointment` (`/create` multipart with prescriptions, `/update/{id}`, `/delete/{id}`, `/get`, `/get/{id}`, file download `/file/{appointmentId}/{fileId}`)

## Notes

- Create/update accept multipart form (`appointment` part + optional `prescriptions` files).

---

*Last updated: 2026-04-18*
