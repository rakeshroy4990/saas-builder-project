/**
 * Pediatric symptom triage — wizard, booking prefill, soft-block skip (smoke).
 * Requires APP_PERSISTENCE_PROVIDER=postgres and authenticated patient session in CI mocks.
 */
describe('Symptom triage flow', () => {
  it('opens triage page from home hero', () => {
    cy.visit('/');
    cy.get('#hospital-home-hero-triage-cta, button')
      .contains(/check symptoms/i)
      .first()
      .click({ force: true });
    cy.url().should('include', '/triage');
    cy.contains(/age \(months\)|symptoms/i).should('exist');
  });
});
