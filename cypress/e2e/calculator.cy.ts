
const STORAGE_KEY = "scientific-calculator-state-v2";

const visitFresh = () =>
  cy.visit("/", {
    onBeforeLoad(win) {
      win.localStorage.removeItem(STORAGE_KEY);
    },
  });

const getDisplay = () => cy.get("output");

const pressKey = (label: string) => {
  cy.contains("button", label).click();
};

describe("Calculator E2E", () => {
  it("evaluates sin(30) in degree mode", () => {
    visitFresh();
    cy.contains("Scientific Calculator");

    pressKey("sin");
    pressKey("3");
    pressKey("0");
    pressKey(")");
    pressKey("=");

    getDisplay().should("have.text", "0.5");
    cy.contains("span", "sin(30) =");
  });

  it("computes factorial results", () => {
    visitFresh();

    pressKey("5");
    pressKey("x!");
    pressKey("=");

    getDisplay().should("have.text", "120");
  });

  it("supports undo and redo of evaluated expressions", () => {
    visitFresh();

    pressKey("1");
    pressKey("+");
    pressKey("2");

    getDisplay().should("have.text", "1+2");
    cy.contains("button", "↺").should("be.disabled");
    cy.contains("button", "↻").should("be.disabled");

    pressKey("=");

    getDisplay().should("have.text", "3");
    cy.contains("button", "↺").should("not.be.disabled");
    cy.contains("button", "↻").should("be.disabled");

    pressKey("↺");

    getDisplay().should("have.text", "1+2");
    cy.contains("button", "↺").should("be.disabled");
    cy.contains("button", "↻").should("not.be.disabled");

    pressKey("↻");

    getDisplay().should("have.text", "3");
  });

  it("persists calculator state and history between reloads", () => {
    visitFresh();

    pressKey("2");
    pressKey("+");
    pressKey("2");
    pressKey("=");

    getDisplay().should("have.text", "4");
    cy.contains("span", "2+2 =");

    cy.reload();

    getDisplay().should("have.text", "4");
    cy.contains("span", "2+2 =");
    cy.contains("button", "↺").should("not.be.disabled").click();

    getDisplay().should("have.text", "2+2");
    cy.contains("button", "↻").should("not.be.disabled");
  });
});
