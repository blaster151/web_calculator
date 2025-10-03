import { useCallback, useEffect, useMemo, useState } from "react";

type KeyAction = "clear" | "equals" | "toggle-sign" | "backspace";

type KeyDefinition = {
  label: string;
  value?: string;
  action?: KeyAction;
  columnSpan?: string;
  variant?: "primary" | "secondary" | "accent" | "danger";
};

const baseButtonClasses =
  "flex min-h-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-900/80 p-3 text-base font-semibold text-slate-100 shadow transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 hover:bg-slate-800";

const variantMap: Record<NonNullable<KeyDefinition["variant"]>, string> = {
  primary: "bg-slate-800/80 hover:bg-slate-700",
  secondary: "bg-slate-900/40 hover:bg-slate-800 text-slate-300",
  accent: "bg-sky-600/80 hover:bg-sky-500 text-white border-sky-500",
  danger: "bg-rose-600/80 hover:bg-rose-500 text-white border-rose-500",
};

const scientificRows: KeyDefinition[][] = [
  [
    { label: "sin", value: "Math.sin(", variant: "secondary" },
    { label: "cos", value: "Math.cos(", variant: "secondary" },
    { label: "tan", value: "Math.tan(", variant: "secondary" },
    { label: "π", value: "Math.PI", variant: "secondary" },
  ],
  [
    { label: "ln", value: "Math.log(", variant: "secondary" },
    { label: "log", value: "Math.log10(", variant: "secondary" },
    { label: "√", value: "Math.sqrt(", variant: "secondary" },
    { label: "^", value: "**", variant: "secondary" },
  ],
  [
    { label: "e", value: "Math.E", variant: "secondary" },
    { label: "x!", value: "!", variant: "secondary" },
    { label: "(", value: "(", variant: "secondary" },
    { label: ")", value: ")", variant: "secondary" },
  ],
];

const controlKeys: KeyDefinition[] = [
  { label: "AC", action: "clear", variant: "danger" },
  { label: "⌫", action: "backspace", variant: "secondary" },
  { label: "±", action: "toggle-sign", variant: "secondary" },
  { label: "%", value: "/100", variant: "secondary" },
];

const mainPadRows: KeyDefinition[][] = [
  [
    { label: "7", value: "7" },
    { label: "8", value: "8" },
    { label: "9", value: "9" },
    { label: "÷", value: "/", variant: "accent" },
  ],
  [
    { label: "4", value: "4" },
    { label: "5", value: "5" },
    { label: "6", value: "6" },
    { label: "×", value: "*", variant: "accent" },
  ],
  [
    { label: "1", value: "1" },
    { label: "2", value: "2" },
    { label: "3", value: "3" },
    { label: "−", value: "-", variant: "accent" },
  ],
  [
    { label: "0", value: "0", columnSpan: "col-span-2" },
    { label: ".", value: "." },
    { label: "=", action: "equals", variant: "accent" },
    { label: "+", value: "+", variant: "accent" },
  ],
];

const factorial = (value: number) => {
  if (value < 0) {
    throw new Error("Factorial is not defined for negative numbers");
  }
  if (!Number.isInteger(value)) {
    throw new Error("Factorial is only defined for integers");
  }
  let result = 1;
  for (let i = 2; i <= value; i += 1) {
    result *= i;
  }
  return result;
};

const sanitizeExpression = (formula: string) => {
  return formula.replace(/!+/g, "!");
};

const applyFactorial = (formula: string) => {
  return formula.replace(/([0-9.]+)!/g, (_, group: string) => {
    const numeric = Number(group);
    return factorial(numeric).toString();
  });
};

const evaluateFormula = (formula: string): number => {
  const sanitized = sanitizeExpression(formula);
  const withFactorials = applyFactorial(sanitized);
  // eslint-disable-next-line no-new-func
  const evaluator = Function(`"use strict"; return (${withFactorials});`);
  const result = evaluator();
  if (Number.isFinite(result)) {
    return result;
  }
  throw new Error("Result is not finite");
};

const allKeyDefinitions = [
  ...scientificRows.flat(),
  ...controlKeys,
  ...mainPadRows.flat(),
];

const keyboardKeyMap = new Map<string, KeyDefinition>();
allKeyDefinitions.forEach((key) => {
  keyboardKeyMap.set(key.label, key);
  if (key.value) {
    keyboardKeyMap.set(key.value, key);
  }
});

const ScientificCalculator = () => {
  const [displayValue, setDisplayValue] = useState("0");
  const [formula, setFormula] = useState("0");
  const [history, setHistory] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const formattedHistory = useMemo(() => {
    if (!history) return "";
    return `${history} =`;
  }, [history]);

  const updateValues = useCallback((display: string, nextFormula: string) => {
    setDisplayValue(display);
    setFormula(nextFormula);
  }, []);

  const handleAppend = useCallback((key: KeyDefinition) => {
    setError(null);
    setHistory(null);
    const nextDisplay = displayValue === "0" ? key.label : `${displayValue}${key.label}`;
    const newFormulaFragment = key.value ?? key.label;
    const nextFormula = formula === "0" ? newFormulaFragment : `${formula}${newFormulaFragment}`;
    updateValues(nextDisplay, nextFormula);
  }, [displayValue, formula, updateValues]);

  const handleClear = useCallback(() => {
    setError(null);
    setHistory(null);
    updateValues("0", "0");
  }, [updateValues]);

  const handleBackspace = useCallback(() => {
    setError(null);
    setHistory(null);
    if (displayValue.length <= 1) {
      updateValues("0", "0");
      return;
    }
    updateValues(displayValue.slice(0, -1), formula.slice(0, -1));
  }, [displayValue, formula, updateValues]);

  const handleToggleSign = useCallback(() => {
    setError(null);
    setHistory(null);
    if (displayValue === "0") {
      return;
    }
    if (displayValue.startsWith("-")) {
      updateValues(displayValue.slice(1), formula.slice(1));
    } else {
      updateValues(`-${displayValue}`, formula.startsWith("-") ? formula : `-(${formula})`);
    }
  }, [displayValue, formula, updateValues]);

  const handleEquals = useCallback(() => {
    try {
      const result = evaluateFormula(formula);
      setHistory(displayValue);
      updateValues(result.toString(), result.toString());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to evaluate expression");
    }
  }, [displayValue, formula, updateValues]);

  const handleKeyPress = useCallback(
    (key: KeyDefinition) => {
      if (key.action === "clear") {
        handleClear();
        return;
      }
      if (key.action === "backspace") {
        handleBackspace();
        return;
      }
      if (key.action === "toggle-sign") {
        handleToggleSign();
        return;
      }
      if (key.action === "equals") {
        handleEquals();
        return;
      }
      handleAppend(key);
    },
    [handleAppend, handleBackspace, handleClear, handleEquals, handleToggleSign],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        handleEquals();
        return;
      }

      if (event.key === "Backspace") {
        event.preventDefault();
        handleBackspace();
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        handleClear();
        return;
      }

      const keyDefinition = keyboardKeyMap.get(event.key);
      if (keyDefinition) {
        event.preventDefault();
        handleKeyPress(keyDefinition);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleBackspace, handleClear, handleEquals, handleKeyPress]);

  const renderButton = (key: KeyDefinition, extraClassName = "") => {
    const variantClass = key.variant ? variantMap[key.variant] : "";

    return (
      <button
        key={key.label}
        type="button"
        className={`${baseButtonClasses} ${variantClass} ${extraClassName}`.trim()}
        onClick={() => handleKeyPress(key)}
      >
        {key.label}
      </button>
    );
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-slate-950 px-4 py-10">
      <div className="w-full max-w-4xl rounded-3xl border border-slate-800 bg-slate-900/70 shadow-2xl backdrop-blur">
        <div className="flex flex-col gap-6 p-8">
          <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white">
                Scientific Calculator
              </h1>
              <p className="text-sm text-slate-400">
                Perform advanced calculations with trigonometric, logarithmic, and power
                operations.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-3 py-1">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" aria-hidden />
                Ready
              </span>
            </div>
          </header>

          <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6 shadow-inner">
            <div className="flex flex-col items-end gap-2">
              <span className="min-h-[1.25rem] text-sm text-slate-500">{formattedHistory}</span>
              <output className="w-full font-mono text-right text-4xl font-medium tracking-tight text-white sm:text-5xl md:text-6xl">
                {displayValue}
              </output>
              {error ? (
                <p className="w-full text-right text-sm font-medium text-rose-400">{error}</p>
              ) : null}
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
            <div className="grid gap-4">
              {scientificRows.map((row) => (
                <div key={row.map((key) => key.label).join("-")} className="grid grid-cols-4 gap-3">
                  {row.map((key) => renderButton(key))}
                </div>
              ))}
              <div className="grid grid-cols-4 gap-3">
                {controlKeys.map((key) => renderButton(key))}
              </div>
            </div>
            <div className="grid gap-3">
              {mainPadRows.map((row) => (
                <div key={row.map((key) => key.label).join("-")} className="grid grid-cols-4 gap-3">
                  {row.map((key) => renderButton(key, key.columnSpan ?? ""))}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default ScientificCalculator;
