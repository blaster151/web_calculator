export type AngleMode = "DEG" | "RAD";

const isDigit = (c: string) => /[0-9]/.test(c);
const isAlpha = (c: string) => /[a-z]/i.test(c);

export function factorial(n: number) {
  if (n < 0) throw new Error("Factorial of negative");
  if (Math.floor(n) !== n) throw new Error("Factorial requires integer");
  if (n > 170) throw new Error("n too large");
  let r = 1; for (let i = 2; i <= n; i++) r *= i; return r;
}

type Tok =
  | { type: "num"; value: number }
  | { type: "id"; value: string }
  | { type: "plus" | "minus" | "mul" | "div" | "pow" | "u-" }
  | { type: "lparen" | "rparen" | "comma" }
  | { type: "percent" | "bang" };

export function tokenize(s: string): Tok[] {
  const tokens: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === " " || ch === "\t") { i++; continue; }
    if (isDigit(ch) || (ch === "." && isDigit(s[i + 1] ?? ""))) {
      let j = i;
      while (isDigit(s[j] ?? "")) j++;
      if (s[j] === ".") { j++; while (isDigit(s[j] ?? "")) j++; }
      if (s[j] && (s[j] === "e" || s[j] === "E")) {
        let k = j + 1; if (s[k] === "+" || s[k] === "-") k++;
        const startK = k; while (isDigit(s[k] ?? "")) k++; if (k > startK) j = k;
      }
      tokens.push({ type: "num", value: parseFloat(s.slice(i, j)) }); i = j; continue;
    }
    if (isAlpha(ch)) {
      let j = i + 1; while (isAlpha(s[j] ?? "")) j++;
      tokens.push({ type: "id", value: s.slice(i, j).toLowerCase() }); i = j; continue;
    }
    const ops: Record<string, Tok["type"]> = {
      "+": "plus","-": "minus","*": "mul","×": "mul","/": "div","÷": "div","^": "pow",
      "(": "lparen",")": "rparen",",": "comma","%": "percent","!": "bang",
    };
    if (ops[ch]) { tokens.push({ type: ops[ch] as any } as Tok); i++; continue; }
    throw new Error(`Unexpected '${ch}'`);
  }
  const out: Tok[] = [];
  for (let k = 0; k < tokens.length; k++) {
    const t = tokens[k]; const next = tokens[k + 1]; out.push(t);
    const isValue = (x?: Tok) => x && (x.type === "num" || x.type === "rparen" || x.type === "bang" || x.type === "percent" || x.type === "id");
    if (isValue(t) && next && (next.type === "lparen" || next.type === "id")) out.push({ type: "mul" });
    else if ((t.type === "rparen" || t.type === "bang" || t.type === "percent") && next && (next.type === "num" || next.type === "id" || next.type === "lparen")) out.push({ type: "mul" });
    else if (t.type === "id" && next && next.type === "num") out.push({ type: "mul" });
  }
  return out;
}

export function toRPN(tokens: Tok[]): Tok[] {
  const out: Tok[] = []; const stack: Tok[] = [];
  const precedence: Record<string, number> = { "u-": 5, pow: 4, mul: 3, div: 3, plus: 2, minus: 2 };
  const rightAssoc: Record<string, boolean> = { pow: true, "u-": true };
  const tks = tokens.map((t, idx) => {
    if (t.type === "minus") {
      const prev = tokens[idx - 1];
      const isStart = idx === 0 || (prev && ["plus","minus","mul","div","pow","lparen","comma"].includes(prev.type));
      if (isStart) return { type: "u-" } as Tok;
    }
    return t;
  });
  for (const t of tks) {
    if (t.type === "num") out.push(t);
    else if (t.type === "id") stack.push(t);
    else if (["plus","minus","mul","div","pow","u-"].includes(t.type)) {
      while (stack.length) {
        const top = stack[stack.length - 1] as Tok;
        if (["plus","minus","mul","div","pow","u-"].includes((top as any).type)) {
          const pt = precedence[t.type] || 0, ptop = precedence[(top as any).type] || 0;
          if ((rightAssoc[t.type] && pt < ptop) || (!rightAssoc[t.type] && pt <= ptop)) out.push(stack.pop() as Tok); else break;
        } else if (top.type === "id") out.push(stack.pop() as Tok);
        else break;
      }
      stack.push(t);
    } else if (t.type === "lparen") stack.push(t);
    else if (t.type === "rparen") {
      while (stack.length && (stack[stack.length - 1] as Tok).type !== "lparen") out.push(stack.pop() as Tok);
      if (!stack.length) throw new Error("Mismatched parentheses");
      stack.pop();
      if (stack.length && (stack[stack.length - 1] as Tok).type === "id") out.push(stack.pop() as Tok);
    } else if (t.type === "comma") {
      while (stack.length && (stack[stack.length - 1] as Tok).type !== "lparen") out.push(stack.pop() as Tok);
      if (!stack.length) throw new Error("Comma not inside function");
    } else if (t.type === "percent" || t.type === "bang") out.push(t);
    else throw new Error("Bad token: " + (t as any).type);
  }
  while (stack.length) {
    const x = stack.pop() as Tok;
    if (x.type === "lparen" || x.type === "rparen") throw new Error("Mismatched parentheses");
    out.push(x);
  }
  return out;
}

export function evaluate(expr: string, angleMode: AngleMode = "DEG") {
  const toRad = (x: number) => (angleMode === "DEG" ? (x * Math.PI) / 180 : x);
  const fromRad = (x: number) => (angleMode === "DEG" ? (x * 180) / Math.PI : x);
  const rpn = toRPN(tokenize(expr));
  const stack: number[] = [];
  const fn1: Record<string,(x:number)=>number> = {
    sin: (x)=>Math.sin(toRad(x)), cos:(x)=>Math.cos(toRad(x)), tan:(x)=>Math.tan(toRad(x)),
    asin:(x)=>fromRad(Math.asin(x)), acos:(x)=>fromRad(Math.acos(x)), atan:(x)=>fromRad(Math.atan(x)),
    ln:(x)=>Math.log(x), log:(x)=>Math.log10(x), sqrt:(x)=>Math.sqrt(x), exp:(x)=>Math.exp(x), abs:(x)=>Math.abs(x),
  };
  const fn2: Record<string,(a:number,b:number)=>number> = {
    pow:(a,b)=>Math.pow(a,b), min:(a,b)=>Math.min(a,b), max:(a,b)=>Math.max(a,b),
  };
  for (const t of rpn) {
    if ((t as any).type === "num") stack.push((t as any).value);
    else if (["plus","minus","mul","div","pow"].includes((t as any).type)) {
      const b = stack.pop(); const a = stack.pop(); if (a===undefined || b===undefined) throw new Error("Arity error");
      let v=0; if (t.type==="plus") v=a+b; else if (t.type==="minus") v=a-b; else if (t.type==="mul") v=a*b; else if (t.type==="div") v=a/b; else if (t.type==="pow") v=Math.pow(a,b);
      stack.push(v);
    } else if (t.type === "u-") { const a = stack.pop(); if (a===undefined) throw new Error("Arity error"); stack.push(-a); }
    else if (t.type === "id") {
      const name = t.value;
      if (name === "pi") stack.push(Math.PI);
      else if (name === "e") stack.push(Math.E);
      else if (fn1[name]) { const a = stack.pop(); if (a===undefined) throw new Error("Arity error"); stack.push(fn1[name](a)); }
      else if (fn2[name]) { const b = stack.pop(); const a = stack.pop(); if (a===undefined||b===undefined) throw new Error("Arity error"); stack.push(fn2[name](a,b)); }
      else throw new Error("Unknown id: " + name);
    } else if (t.type === "percent") { const a = stack.pop(); if (a===undefined) throw new Error("Arity error"); stack.push(a/100); }
    else if (t.type === "bang") { const a = stack.pop(); if (a===undefined) throw new Error("Arity error"); stack.push(factorial(a)); }
    else throw new Error("Bad RPN token");
  }
  if (stack.length !== 1) throw new Error("Invalid expression");
  return stack[0];
}
