import { useCallback, useEffect, useMemo, useState } from "react";
import { evaluate } from "../../../src/lib/engine";

type KeyAction = "clear" | "equals" | "toggle-sign" | "backspace" | "undo" | "redo";

type KeyDefinition = {
  label: string;
  value?: string;
  action?: KeyAction;
  columnSpan?: string;
  variant?: "primary" | "secondary" | "accent" | "danger";
  displayValue?: string;
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
    { label: "sin", value: "sin(", displayValue: "sin(", variant: "secondary" },
    { label: "cos", value: "cos(", displayValue: "cos(", variant: "secondary" },
    { label: "tan", value: "tan(", displayValue: "tan(", variant: "secondary" },
    { label: "π", value: "pi", displayValue: "π", variant: "secondary" },
  ],
  [
    { label: "ln", value: "ln(", displayValue: "ln(", variant: "secondary" },
    { label: "log", value: "log(", displayValue: "log(", variant: "secondary" },
    { label: "√", value: "sqrt(", displayValue: "√(", variant: "secondary" },
    { label: "^", value: "^", variant: "secondary" },
  ],
  [
    { label: "e", value: "e", variant: "secondary" },
    { label: "x!", value: "!", displayValue: "!", variant: "secondary" },
    { label: "(", value: "(", variant: "secondary" },
    { label: ")", value: ")", variant: "secondary" },
  ],
];

const controlKeys: KeyDefinition[] = [
  { label: "AC", action: "clear", variant: "danger" },
  { label: "⌫", action: "backspace", variant: "secondary" },
  { label: "±", action: "toggle-sign", variant: "secondary" },
  { label: "↺", action: "undo", variant: "secondary", displayValue: "↺" },
  { label: "↻", action: "redo", variant: "secondary", displayValue: "↻" },
  { label: "%", value: "%", variant: "secondary" },
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

type Fragment = { display: string; formula: string };

type CalculatorState = {
  displayValue: string;
  formula: string;
  history: string | null;
  error: string | null;
  fragments: Fragment[];
};

type PersistedState = {
  state: CalculatorState;
  undoStack: CalculatorState[];
  redoStack: CalculatorState[];
};

const DEFAULT_STATE: CalculatorState = {
  displayValue: "0",
  formula: "0",
  history: null,
  error: null,
  fragments: [],
};

const STORAGE_KEY = "scientific-calculator-state-v2";
const MAX_HISTORY = 50;

const composeFromFragments = (fragments: Fragment[]) => {
  if (fragments.length === 0) {
    return { displayValue: "0", formula: "0" };
  }
  const displayValue = fragments.map((fragment) => fragment.display).join("");
  const formula = fragments.map((fragment) => fragment.formula).join("");
  return { displayValue, formula };
};

const fragmentsEqual = (a: Fragment[], b: Fragment[]) => {
  if (a.length !== b.length) return false;
  return a.every((fragment, index) => {
    const other = b[index];
    return fragment.display === other.display && fragment.formula === other.formula;
  });
};

const statesEqual = (a: CalculatorState, b: CalculatorState) => {
  return (
    a.displayValue === b.displayValue &&
    a.formula === b.formula &&
    a.history === b.history &&
    a.error === b.error &&
    fragmentsEqual(a.fragments, b.fragments)
  );
};

const isFragment = (value: unknown): value is Fragment => {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Fragment).display === "string" &&
    typeof (value as Fragment).formula === "string"
  );
};

const isCalculatorState = (value: unknown): value is CalculatorState => {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as CalculatorState;
  return (
    typeof candidate.displayValue === "string" &&
    typeof candidate.formula === "string" &&
    (candidate.history === null || typeof candidate.history === "string") &&
    (candidate.error === null || typeof candidate.error === "string") &&
    Array.isArray(candidate.fragments) &&
    candidate.fragments.every(isFragment)
  );
};

const loadPersistedState = (): PersistedState | undefined => {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !isCalculatorState((parsed as PersistedState).state) ||
      !Array.isArray((parsed as PersistedState).undoStack) ||
      !Array.isArray((parsed as PersistedState).redoStack)
    ) {
      return undefined;
    }
    const undoStack = (parsed as PersistedState).undoStack.filter(isCalculatorState);
    const redoStack = (parsed as PersistedState).redoStack.filter(isCalculatorState);
    return {
      state: (parsed as PersistedState).state,
      undoStack,
      redoStack,
    };
  } catch {
    return undefined;
  }
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
  if (key.displayValue) {
    keyboardKeyMap.set(key.displayValue, key);
  }
});

const ScientificCalculator = () => {
  const persisted = useMemo(() => loadPersistedState(), []);
  const [state, setState] = useState<CalculatorState>(() => persisted?.state ?? DEFAULT_STATE);
  const [undoStack, setUndoStack] = useState<CalculatorState[]>(() => persisted?.undoStack ?? []);
  const [redoStack, setRedoStack] = useState<CalculatorState[]>(() => persisted?.redoStack ?? []);

  const formattedHistory = useMemo(() => {
    if (!state.history) return "";
    return `${state.history} =`;
  }, [state.history]);

  const persistState = useCallback(
    (nextState: CalculatorState, nextUndo: CalculatorState[], nextRedo: CalculatorState[]) => {
      if (typeof window === "undefined") return;
      const payload: PersistedState = {
        state: nextState,
        undoStack: nextUndo.slice(-MAX_HISTORY),
        redoStack: nextRedo.slice(-MAX_HISTORY),
      };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch {
        /* ignore persistence errors */
      }
    },
    [],
  );

  const commitChange = useCallback(
    (updater: (previous: CalculatorState) => CalculatorState, options?: { recordHistory?: boolean }) => {
      const shouldRecord = options?.recordHistory ?? true;
      setState((previous) => {
        const next = updater(previous);
        if (statesEqual(previous, next)) {
          return previous;
        }
        if (!shouldRecord) {
          return next;
        }
        setUndoStack((stack) => {
          const updated = [...stack, previous];
          return updated.length > MAX_HISTORY ? updated.slice(updated.length - MAX_HISTORY) : updated;
        });
        setRedoStack([]);
        return next;
      });
    },
    [setRedoStack, setUndoStack],
  );

  useEffect(() => {
    persistState(state, undoStack, redoStack);
  }, [persistState, state, undoStack, redoStack]);

  const updateWithFragments = useCallback(
    (fragments: Fragment[], overrides?: Partial<Pick<CalculatorState, "history" | "error" | "displayValue" | "formula">>) => {
      const composed = composeFromFragments(fragments);
      return {
        displayValue: overrides?.displayValue ?? composed.displayValue,
        formula: overrides?.formula ?? composed.formula,
        history: overrides?.history ?? null,
        error: overrides?.error ?? null,
        fragments,
      } satisfies CalculatorState;
    },
    [],
  );

  const handleAppend = useCallback(
    (key: KeyDefinition) => {
      const displayFragment = key.displayValue ?? key.label;
      const formulaFragment = key.value ?? displayFragment;
      commitChange((previous) => {
        const shouldReset = previous.history !== null && /^[0-9.]$/.test(displayFragment);
        const baseFragments = shouldReset || previous.fragments.length === 0 ? [] : previous.fragments;
        const nextFragments = [...baseFragments, { display: displayFragment, formula: formulaFragment }];
        return updateWithFragments(nextFragments, { history: null });
      });
    },
    [commitChange, updateWithFragments],
  );

  const handleClear = useCallback(() => {
    commitChange(() => DEFAULT_STATE);
  }, [commitChange]);

  const handleBackspace = useCallback(() => {
    commitChange((previous) => {
      if (previous.fragments.length === 0) {
        return DEFAULT_STATE;
      }
      const nextFragments = previous.fragments.slice(0, -1);
      if (nextFragments.length === 0) {
        return DEFAULT_STATE;
      }
      return updateWithFragments(nextFragments, { history: null });
    });
  }, [commitChange, updateWithFragments]);

  const handleToggleSign = useCallback(() => {
    commitChange((previous) => {
      if (previous.displayValue === "0") {
        return previous;
      }
      if (previous.displayValue.startsWith("-")) {
        const withoutSign = previous.displayValue.slice(1);
        const nextFormula = previous.formula.startsWith("-(") && previous.formula.endsWith(")")
          ? previous.formula.slice(2, -1)
          : previous.formula.startsWith("-")
          ? previous.formula.slice(1)
          : previous.formula;
        const nextFragments: Fragment[] = [{ display: withoutSign, formula: nextFormula }];
        return updateWithFragments(nextFragments, { history: null });
      }
      const nextFragments: Fragment[] = [
        {
          display: `-${previous.displayValue}`,
          formula: previous.formula.startsWith("-") ? previous.formula : `-(${previous.formula})`,
        },
      ];
      return updateWithFragments(nextFragments, { history: null });
    });
  }, [commitChange, updateWithFragments]);

  const handleEquals = useCallback(() => {
    commitChange((previous) => {
      try {
        const result = evaluate(previous.formula);
        const resultString = Number.isFinite(result) ? result.toString() : "";
        if (resultString === "") {
          throw new Error("Result is not finite");
        }
        const nextFragments: Fragment[] = [{ display: resultString, formula: resultString }];
        return updateWithFragments(nextFragments, { history: previous.displayValue, error: null });
      } catch (error) {
        return {
          ...previous,
          error: error instanceof Error ? error.message : "Unable to evaluate expression",
        };
      }
    });
  }, [commitChange, updateWithFragments]);

  const handleUndo = useCallback(() => {
    setUndoStack((stack) => {
      if (stack.length === 0) {
        return stack;
      }
      const previousState = stack[stack.length - 1];
      setRedoStack((redo) => {
        const updated = [...redo, state];
        return updated.length > MAX_HISTORY ? updated.slice(updated.length - MAX_HISTORY) : updated;
      });
      commitChange(() => previousState, { recordHistory: false });
      return stack.slice(0, -1);
    });
  }, [commitChange, state]);

  const handleRedo = useCallback(() => {
    setRedoStack((stack) => {
      if (stack.length === 0) {
        return stack;
      }
      const nextState = stack[stack.length - 1];
      setUndoStack((undo) => {
        const updated = [...undo, state];
        return updated.length > MAX_HISTORY ? updated.slice(updated.length - MAX_HISTORY) : updated;
      });
      commitChange(() => nextState, { recordHistory: false });
      return stack.slice(0, -1);
    });
  }, [commitChange, state]);

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
      if (key.action === "undo") {
        handleUndo();
        return;
      }
      if (key.action === "redo") {
        handleRedo();
        return;
      }
      handleAppend(key);
    },
    [handleAppend, handleBackspace, handleClear, handleEquals, handleRedo, handleToggleSign, handleUndo],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }

      if ((event.ctrlKey || event.metaKey) && (event.key.toLowerCase() === "y" || (event.shiftKey && event.key.toLowerCase() === "z"))) {
        event.preventDefault();
        handleRedo();
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey) {
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
  }, [handleBackspace, handleClear, handleEquals, handleKeyPress, handleRedo, handleUndo]);

  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;

  const renderButton = (key: KeyDefinition, extraClassName = "") => {
    const variantClass = key.variant ? variantMap[key.variant] : "";
    const isDisabled = (key.action === "undo" && !canUndo) || (key.action === "redo" && !canRedo);

    return (
      <button
        key={key.label}
        type="button"
        className={`${baseButtonClasses} ${variantClass} ${extraClassName} ${
          isDisabled ? "opacity-40" : ""
        }`.trim()}
        onClick={() => {
          if (!isDisabled) {
            handleKeyPress(key);
          }
        }}
        disabled={isDisabled}
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
                {state.displayValue}
              </output>
              {state.error ? (
                <p className="w-full text-right text-sm font-medium text-rose-400">{state.error}</p>
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
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
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
