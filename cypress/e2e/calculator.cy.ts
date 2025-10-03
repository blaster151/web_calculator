
describe("Calculator E2E", () => {
  beforeEach(() => {
    cy.visit("/");
  });

  it("evaluates sin(30) in DEG to 0.5", () => {
    cy.contains("Scientific Calculator");
    cy.get("input[placeholder*='Type']").clear().type("sin(30)");
    cy.contains("=").click();
    cy.get("input").should(($inp) => {
      expect($inp.val()).to.contain("0.5");
    });
  });

  it("RAD mode sin(pi/2) = 1", () => {
    cy.get("select").select("RAD");
    cy.get("input").clear().type("sin(pi/2)");
    cy.contains("=").click();
    cy.get("input").should(($inp) => expect($inp.val()).to.contain("1"));
  });

  it("memory ops", () => {
    cy.get("input").clear().type("2^8");
    cy.contains("=").click();
    cy.contains("M+").click();
    cy.get("input").clear();
    cy.contains("MR").click();
    cy.get("input").should(($inp) => expect(($inp.val() as string)).to.match(/256$/));
  });

  it("factorial", () => {
    cy.get("input").clear().type("5!");
    cy.contains("=").click();
    cy.get("input").should(($inp) => expect($inp.val()).to.contain("120"));
  });
});
