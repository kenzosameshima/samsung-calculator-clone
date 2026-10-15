// The calculator's state and input rules, with no DOM access. The expression
// is a list of tokens (see evaluate.js); the display text, the "what did I
// just type" rules, and the parenthesis depth are all derived from that list
// instead of being tracked separately, so backspace is just "drop a token".
//
// Drive it with press({ type, value }):
//   digit, decimal, operator, paren, postfix, power, function, constant,
//   reciprocal, sign, backspace, clear, equals, angle
//
// It mirrors the phone's calculator: "=" on something it can't evaluate
// leaves the expression alone (and flags it as `invalid` with a `notice` to
// show), instead of wiping it with an error.

// Past this many characters new operators and operands are refused, but a number
// already being typed can still grow (up to the digit limits below).
const MAX_LENGTH = 81;
const MAX_DIGITS = 15;
const MAX_DECIMAL_DIGITS = 10;
const RESULT_DECIMALS = 10;
// Magnitudes at or past these are written in exponent form, e.g. 1.00000000E+22.
const EXPONENT_FROM = 1e15;
const EXPONENT_BELOW = 1e-6;
const TOO_MANY_DIGITS = "Can't enter more than 15 digits.";

const VALUE_TYPES = ['number', 'constant', 'close', 'postfix'];

const token = (type, text, extra) => ({ type, text, ...extra });
const textOf = (tokens) => tokens.map((t) => t.text).join('');

// A "value" is a complete operand that a trailing ")", an implicit "*", or a
// postfix operator can attach to. A bare sign or an operator isn't one.
const isValue = (t) => t !== undefined && VALUE_TYPES.includes(t.type);

const roundTo = (n, decimals) => (Number.isInteger(n) ? n : parseFloat(n.toFixed(decimals)));

const DISPLAY_SYMBOLS = { '*': '×', '/': '÷' };
const groupThousands = (number) => number.replace(/^\d+/, (digits) => digits.replace(/\B(?=(\d{3})+$)/g, ','));

// How a value is written: rounded to 10 decimals, or in exponent form when
// it is huge or tiny. The text is unsigned; the caller adds the sign.
function formatValue(value) {
    const magnitude = Math.abs(value);
    if (magnitude >= EXPONENT_FROM || (magnitude > 0 && magnitude < EXPONENT_BELOW)) {
        return { text: magnitude.toExponential(8).replace('e', 'E'), exponent: true };
    }
    return { text: String(Math.abs(roundTo(value, RESULT_DECIMALS))), exponent: false };
}

// The tokens for a finished calculation's result. Exponent-form results
// become one sealed constant so the "E" can never be mistaken for Euler's
// number or have digits appended to it.
function resultTokens(value) {
    const { text, exponent } = formatValue(value);
    const operand = exponent ? token('constant', text, { value: Math.abs(value) }) : token('number', text);
    return value < 0 ? [token('sign', '-'), operand] : [operand];
}

function createCalculator() {
    let tokens = [];
    let justEvaluated = false;
    let invalid = false;
    let notice = '';
    let angleMode = 'deg';

    const last = () => tokens[tokens.length - 1];
    const room = () => MAX_LENGTH - textOf(tokens).length;
    const depth = () => tokens.reduce((d, t) => d + (t.type === 'open') - (t.type === 'close'), 0);

    function push(...added) {
        if (textOf(added).length > room()) {
            return;
        }
        tokens.push(...added);
    }

    // Starts a new operand (number, constant, "(" or function), inserting an
    // implicit "*" when it directly follows a value, e.g. "8" then "(" -> "8*(".
    function pushOperand(...added) {
        push(...(isValue(last()) ? [token('operator', '*'), ...added] : added));
    }

    function typeDigit(digit) {
        const tail = last();
        if (tail?.type !== 'number') {
            pushOperand(token('number', digit));
            return;
        }
        const [integer, decimals = ''] = tail.text.split('.');
        if (integer.length + decimals.length >= MAX_DIGITS || decimals.length >= MAX_DECIMAL_DIGITS) {
            notice = TOO_MANY_DIGITS;
        } else if (tail.text === '0') {
            tail.text = digit; // no leading zeros: "0005" is "5"
        } else {
            tail.text += digit;
        }
    }

    function typeDecimal() {
        const tail = last();
        if (tail?.type === 'number') {
            if (!tail.text.includes('.') && tail.text.length < MAX_DIGITS) {
                tail.text += '.';
            }
        } else {
            pushOperand(token('number', '0.'));
        }
    }

    function typeOperator(op) {
        const tail = last();
        const isSign = op === '+' || op === '-';
        if (!tail || tail.type === 'open') {
            // A leading "+" is dropped ("+5" is "5"), but "(+" is kept.
            if (op === '-' || (op === '+' && tail)) {
                push(token('sign', op));
            }
        } else if (tail.type === 'sign') {
            if (isSign) {
                tail.text = op;
            } else {
                tokens.pop();
            }
        } else if (tail.type === 'operator') {
            // Samsung-calculator quirk: "*" or "/" followed by "-" opens a
            // parenthesis around the negative operand instead of just swapping
            // the operator, e.g. typing "5*-3" shows "5*(-3" and evaluates to -15.
            if (op === '-' && (tail.text === '*' || tail.text === '/')) {
                push(token('open', '('), token('sign', '-'));
            } else {
                tail.text = op;
            }
        } else {
            push(token('operator', op));
        }
    }

    function typeParenthesis() {
        if (depth() > 0 && isValue(last())) {
            push(token('close', ')'));
        } else {
            pushOperand(token('open', '('));
        }
    }

    // Postfix operators ("%", "!") stay as readable text after the value they
    // apply to; evaluate() applies them. "%" can't stack.
    function typePostfix(text) {
        const tail = last();
        if (isValue(tail) && !(text === '%' && tail.text === '%')) {
            push(token('postfix', text));
        }
    }

    // x^y, x², x³: appends "^(" -- plus "2)" / "3)" when the exponent is
    // fixed -- as ordinary tokens, so backspace peels it off one character at
    // a time and a half-deleted "8^(2" still evaluates via the auto-close.
    function typePower(exponent) {
        if (!isValue(last())) {
            return;
        }
        const fixedExponent = exponent ? [token('number', exponent), token('close', ')')] : [];
        push(token('operator', '^'), token('open', '('), ...fixedExponent);
    }

    function typeFunction(text) {
        pushOperand(token('open', text));
    }

    function typeConstant(text) {
        pushOperand(token('constant', text, { value: CONSTANTS[text] }));
    }

    // 1/x just starts "1/" (so "5" then 1/x is "5*1/"): the phone has no
    // reciprocal function, the operand is typed afterwards.
    function typeReciprocal() {
        pushOperand(token('number', '1'));
        push(token('operator', '/'));
    }

    // Inserts tokens in front of the number at the end of the expression
    // (and the sign attached to it, if any).
    function insertBeforeOperand(added) {
        if (textOf(added).length > room()) {
            return;
        }
        const operandStart = tokens[tokens.length - 2]?.type === 'sign' ? tokens.length - 2 : tokens.length - 1;
        tokens.splice(operandStart, 0, ...added);
    }

    // +/- on a number or constant wraps it in a "(-" opener, and removes that
    // again on the next press. With no operand yet (blank expression, right
    // after an operator, ...) it toggles a bare "(-" opener the same way.
    function toggleSign() {
        const tail = last();
        if (tail?.type === 'number' || tail?.type === 'constant') {
            const before = tokens[tokens.length - 2];
            if (before?.type === 'sign') {
                if (before.text === '-') {
                    tokens.splice(tokens.length - 2, 1);
                    if (tokens[tokens.length - 2]?.text === '(') {
                        tokens.splice(tokens.length - 2, 1);
                    }
                } else {
                    before.text = '-';
                }
            } else {
                insertBeforeOperand([token('open', '('), token('sign', '-')]);
            }
        } else if (tail?.type === 'sign') {
            tokens.pop();
            if (last()?.text === '(') {
                tokens.pop();
            }
        } else {
            pushOperand(token('open', '('), token('sign', '-'));
        }
    }

    function backspace() {
        const tail = last();
        if (tail?.type === 'number' && tail.text.length > 1) {
            tail.text = tail.text.slice(0, -1);
        } else {
            tokens.pop();
        }
    }

    // A lone number is already its own result, and an incomplete expression
    // ("5+") has none: "=" does nothing for either. One that can't be
    // evaluated (1/0, sqrt of a negative) stays as typed, flagged invalid.
    function equals() {
        if (tokens.length === 0 || (tokens.length === 1 && tokens[0].type === 'number')) {
            return;
        }
        try {
            tokens = resultTokens(evaluate(tokens, angleMode));
            justEvaluated = true;
        } catch (error) {
            if (error instanceof RangeError) {
                invalid = true;
                notice = error.message;
            }
        }
    }

    const handlers = {
        digit: typeDigit,
        decimal: typeDecimal,
        operator: typeOperator,
        paren: typeParenthesis,
        postfix: typePostfix,
        power: typePower,
        function: typeFunction,
        constant: typeConstant,
        reciprocal: typeReciprocal,
        sign: toggleSign,
        backspace,
        clear: () => { tokens = []; },
        equals,
    };

    const displayOf = (t) => {
        if (t.type === 'number') {
            return groupThousands(t.text);
        }
        return t.type === 'operator' ? (DISPLAY_SYMBOLS[t.text] ?? t.text) : t.text;
    };

    return {
        press({ type, value }) {
            notice = '';
            // A mode switch, not an edit: leaves the expression (and whether
            // it's a fresh result) untouched.
            if (type === 'angle') {
                angleMode = angleMode === 'rad' ? 'deg' : 'rad';
                return;
            }
            // A digit or backspace pressed after "=" starts a fresh
            // calculation; operators and the like build on the result.
            if (justEvaluated && (type === 'digit' || type === 'decimal' || type === 'backspace')) {
                tokens = [];
            }
            invalid = false;
            justEvaluated = false;
            handlers[type](value);
        },

        get text() {
            return tokens.map(displayOf).join('');
        },

        // The display as pieces, so the UI can highlight the arithmetic
        // operators and "%" (the phone shows them in the accent color).
        get segments() {
            return tokens.map((t) => ({
                text: displayOf(t),
                highlight: (t.type === 'operator' && '+-*/'.includes(t.text)) || (t.type === 'postfix' && t.text === '%'),
            }));
        },

        // True after "=" on an expression with no defined result; cleared by
        // the next key.
        get invalid() {
            return invalid;
        },

        // A short message the UI should flash for the key just pressed, or ''.
        get notice() {
            return notice;
        },

        get angleMode() {
            return angleMode;
        },

        // The result of the expression as typed so far, or '' when there's
        // nothing worth showing (incomplete expression, a lone number, or a
        // finished result).
        get preview() {
            if (tokens.length === 0 || justEvaluated || (tokens.length === 1 && tokens[0].type === 'number')) {
                return '';
            }
            try {
                const value = evaluate(tokens, angleMode);
                const { text, exponent } = formatValue(value);
                return (value < 0 ? '−' : '') + (exponent ? text : groupThousands(text));
            } catch (error) {
                return '';
            }
        },
    };
}
