# Package: `com.flexshell.config`

## Role

Spring **configuration** beans: security filter chain, CORS, seeding, and other `@Configuration` classes.

## Key types

- **`SecurityConfig`** — `SecurityFilterChain`: CSRF off, stateless, JWT filter, path-specific `permitAll` / `authenticated` / `hasRole("ADMIN")`
- **`UserSeedInitializer`** — optional dev/test user seed when enabled via properties

## Related properties

See `src/main/resources/application.properties`: JWT, cookies, CORS, bootstrap admin, seed users.

---

*Last updated: 2026-04-18*
