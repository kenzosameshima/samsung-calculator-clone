// Evaluates a calculator token list to a number. Pure -- no DOM, no eval().
//
// Tokens are { type, text } (constants also carry a numeric `value`), where
// type is one of: number, constant, operator, sign, open, close, postfix.
// An "open" token is either a bare "(" or a function prefix such as "sin(".
//
// Grammar, lowest precedence first. A group still open at the end of the
// input is closed implicitly, which is how "=" auto-closes parentheses.
//
//   expression := term (("+" | "-") term)*
//   term       := unary (("*" | "/") unary)*
//   unary      := sign unary | power
//   power      := postfixed ("^" unary)?
//   postfixed  := atom postfix*
//   atom       := number | constant | open expression close?

export const CONSTANTS = {
    'π': Math.PI,
    e: Math.E,
};

// Thrown inside the parser for input that has no value (incomplete expression,
// division by zero, ...) and caught in evaluate(). Anything else that throws is
// a bug and is left to surface.
class InvalidExpression extends Error {}

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
export const FUNCTIONS = {
    'sin(': (x, angleMode) => Math.sin(toRadians(x, angleMode)),
    'cos(': (x, angleMode) => Math.cos(toRadians(x, angleMode)),
    'tan(': (x, angleMode) => Math.tan(toRadians(x, angleMode)),
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
    '1/(': (x) => 1 / x,
};

const POSTFIX = {
    '%': (x) => x / 100,
    '!': factorial,
};

// Returns the value of the tokens, or null if they aren't a complete
// expression or the result isn't a finite number (division by zero, sqrt of a
// negative, ...).
export function evaluate(tokens, angleMode) {
    try {
        return parse(tokens, angleMode);
    } catch (error) {
        if (error instanceof InvalidExpression) {
            return null;
        }
        throw error;
    }
}

function parse(tokens, angleMode) {
    let pos = 0;

    const peek = () => tokens[pos];
    const peekOperator = (...texts) => peek()?.type === 'operator' && texts.includes(peek().text);

    function parseExpression() {
        let value = parseTerm();
        while (peekOperator('+', '-')) {
            const op = tokens[pos++].text;
            const rhs = parseTerm();
            value = op === '+' ? value + rhs : value - rhs;
        }
        return value;
    }

    function parseTerm() {
        let value = parseUnary();
        while (peekOperator('*', '/')) {
            const op = tokens[pos++].text;
            const rhs = parseUnary();
            value = op === '*' ? value * rhs : value / rhs;
        }
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
            value = POSTFIX[tokens[pos++].text](value);
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
                const inner = parseExpression();
                const value = token.text === '(' ? inner : FUNCTIONS[token.text](inner, angleMode);
                if (peek()?.type === 'close') {
                    pos++;
                }
                return value;
            }
            default:
                throw new InvalidExpression('Expected a value');
        }
    }

    const value = parseExpression();
    if (pos < tokens.length) {
        throw new InvalidExpression('Unexpected token');
    }
    if (!Number.isFinite(value)) {
        throw new InvalidExpression('Result is not a finite number');
    }
    return value;
}
