// Evaluates a calculator token list to a number. Pure -- no DOM, no eval().
//
// Tokens are { type, text } (constants also carry a numeric `value`), where
// type is one of: number, constant, operator, sign, open, close, postfix.
// An "open" token is either a bare "(" or a function prefix such as "sin(".
//
// Grammar, lowest precedence first. A group still open at the end of the
// input is closed implicitly, which is how "=" auto-closes parentheses.
//
//   expression := term (("+" | "-") term)*   ("a+b%" / "a-b%" mean b% OF a)
//   term       := unary (("*" | "/") unary)*
//   unary      := sign unary | power
//   power      := postfixed ("^" unary)?
//   postfixed  := atom postfix*
//   atom       := number | constant | open expression close?

const CONSTANTS = {
    'π': Math.PI,
    e: Math.E,
};

const DIVIDE_BY_ZERO = "Can't divide by zero.";
const UNDEFINED_RESULT = "Can't show undefined result.";

// The phone does its arithmetic in decimal, so 0.1+0.2-0.3 is exactly 0.
// Rounding every intermediate result to 15 significant digits hides the
// binary-float dust (0.30000000000000004) the same way.
const clean = (x) => parseFloat(x.toPrecision(15));

// sin(180deg) is 0 on the phone, not 1.2e-16.
const snap = (x) => (Math.abs(x) < 1e-12 ? 0 : x);

const toRadians = (x, angleMode) => (angleMode === 'deg' ? (x * Math.PI) / 180 : x);
const fromRadians = (x, angleMode) => (angleMode === 'deg' ? (x * 180) / Math.PI : x);

function factorial(n) {
    if (n < 0 || !Number.isInteger(n)) {
        return NaN;
    }
    let result = 1;
    for (let i = 2; i <= n; i++) {
        result *= i;
    }
    return result;
}

// Keyed by the exact text shown on the display, so adding a function is a
// one-line change here plus a key in the scientific keypad.
const FUNCTIONS = {
    '(': (x) => x,
    'sin(': (x, angleMode) => snap(Math.sin(toRadians(x, angleMode))),
    'cos(': (x, angleMode) => snap(Math.cos(toRadians(x, angleMode))),
    'tan(': (x, angleMode) => snap(Math.tan(toRadians(x, angleMode))),
    'sin⁻¹(': (x, angleMode) => fromRadians(Math.asin(x), angleMode),
    'cos⁻¹(': (x, angleMode) => fromRadians(Math.acos(x), angleMode),
    'tan⁻¹(': (x, angleMode) => fromRadians(Math.atan(x), angleMode),
    'sinh(': Math.sinh,
    'cosh(': Math.cosh,
    'tanh(': Math.tanh,
    'sinh⁻¹(': Math.asinh,
    'cosh⁻¹(': Math.acosh,
    'tanh⁻¹(': Math.atanh,
    'ln(': Math.log,
    'log(': Math.log10,
    '√(': Math.sqrt,
    '∛(': Math.cbrt,
    'abs(': Math.abs,
    'e^(': Math.exp,
    '2^(': (x) => 2 ** x,
};

const POSTFIX = {
    '%': (x) => x / 100,
    '!': factorial,
};

// Throws a SyntaxError if the tokens aren't a complete expression, and a
// RangeError (message = what to tell the user) if the result isn't a finite
// number (division by zero, sqrt of a negative, ...).
function evaluate(tokens, angleMode) {
    let pos = 0;
    let level = 0; // how many groups deep the parser is
    let percentEnd = null; // where the last "%" was consumed, and at which level
    let termIsPercent = false; // did the term just parsed consist of one "x%"?

    const peek = () => tokens[pos];
    const peekOperator = (...texts) => peek()?.type === 'operator' && texts.includes(peek().text);

    function parseExpression() {
        let value = parseTerm();
        while (peekOperator('+', '-')) {
            const op = tokens[pos++].text;
            const rhs = parseTerm();
            // "a+b%" adds b% OF a (100+50% is 150), unlike "a*b%" where b% is just b/100.
            const amount = termIsPercent ? value * rhs : rhs;
            value = clean(op === '+' ? value + amount : value - amount);
        }
        return value;
    }

    function parseTerm() {
        let value = parseUnary();
        let isSingleFactor = true;
        while (peekOperator('*', '/')) {
            isSingleFactor = false;
            const op = tokens[pos++].text;
            const rhs = parseUnary();
            if (op === '/' && rhs === 0) {
                throw new RangeError(DIVIDE_BY_ZERO);
            }
            value = clean(op === '*' ? value * rhs : value / rhs);
        }
        termIsPercent = isSingleFactor && percentEnd?.pos === pos && percentEnd.level === level;
        return value;
    }

    function parseUnary() {
        if (peek()?.type === 'sign') {
            return (tokens[pos++].text === '-' ? -1 : 1) * parseUnary();
        }
        return parsePower();
    }

    function parsePower() {
        const base = parsePostfixed();
        if (!peekOperator('^')) {
            return base;
        }
        pos++;
        return base ** parseUnary();
    }

    function parsePostfixed() {
        let value = parseAtom();
        while (peek()?.type === 'postfix') {
            const text = tokens[pos++].text;
            value = POSTFIX[text](value);
            percentEnd = text === '%' ? { pos, level } : null;
        }
        return value;
    }

    function parseAtom() {
        const token = tokens[pos++];
        switch (token?.type) {
            case 'number':
                return parseFloat(token.text);
            case 'constant':
                return token.value;
            case 'open': {
                level++;
                const inner = parseExpression();
                level--;
                const value = FUNCTIONS[token.text](inner, angleMode);
                if (peek()?.type === 'close') {
                    pos++;
                }
                return value;
            }
            default:
                throw new SyntaxError('Expected a value');
        }
    }

    const value = parseExpression();
    if (pos < tokens.length) {
        throw new SyntaxError('Unexpected token');
    }
    if (!Number.isFinite(value)) {
        throw new RangeError(UNDEFINED_RESULT);
    }
    return value;
}
