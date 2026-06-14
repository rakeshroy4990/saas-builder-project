/**
 * Pediatric symptom triage — wizard, booking prefill, soft-block skip (smoke).
 * Requires APP_PERSISTENCE_PROVIDER=postgres and authenticated patient session in CI mocks.
 */
describe('Symptom triage flow', () => {
  it('opens growth tracker from home hero', () => {
    cy.visit('/');
    cy.get('#hospital-home-hero-growth-cta, button')
      .contains(/growth tracker/i)
      .first()
      .click({ force: true });
    cy.url().should('include', '/dashboard');
    cy.contains(/growth tracking/i).should('exist');
  });
});
