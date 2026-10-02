// The calculator's state and input rules, with no DOM access. The expression
// is a list of tokens (see evaluate.js); the display text, the "what did I
// just type" rules, and the parenthesis depth are all derived from that list
// instead of being tracked separately, so backspace is just "drop a token".
//
// Drive it with press({ type, value }):
//   digit, decimal, operator, paren, postfix, power, function, constant,
//   wrap, sign, backspace, clear, equals, angle

const MAX_LENGTH = 32;
const RESULT_DECIMALS = 14;
const PREVIEW_DECIMALS = 10;

const VALUE_TYPES = ['number', 'constant', 'close', 'postfix'];

const token = (type, text, extra) => ({ type, text, ...extra });
const textOf = (tokens) => tokens.map((t) => t.text).join('');

// A "value" is a complete operand that a trailing ")", an implicit "*", or a
// postfix operator can attach to. A bare sign or an operator isn't one.
const isValue = (t) => t !== undefined && VALUE_TYPES.includes(t.type);

const roundTo = (n, decimals) => (Number.isInteger(n) ? n : parseFloat(n.toFixed(decimals)));

// The tokens for a finished calculation's result. Results that JS prints in
// exponent form ("1e-7") become one sealed constant so the "e" can never be
// mistaken for Euler's number or have digits appended to it.
function resultTokens(value) {
    const rounded = roundTo(value, RESULT_DECIMALS);
    const magnitude = String(Math.abs(rounded));
    const operand = magnitude.includes('e')
        ? token('constant', magnitude, { value: Math.abs(rounded) })
        : token('number', magnitude);
    return rounded < 0 ? [token('sign', '-'), operand] : [operand];
}

function createCalculator() {
    let tokens = [];
    let justEvaluated = false;
    let hasError = false;
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
        if (tail?.type === 'number') {
            if (room() >= 1) {
                tail.text += digit;
            }
        } else {
            pushOperand(token('number', digit));
        }
    }

    function typeDecimal() {
        const tail = last();
        if (tail?.type === 'number') {
            if (!tail.text.includes('.') && room() >= 1) {
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
            if (isSign) {
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

    // Wraps a number that was just typed in a function prefix, leaving the
    // closing paren to the auto-close at evaluation, e.g. "8" + "√(" -> "√(8".
    // Any other state just inserts the prefix, e.g. "√(" on a blank display.
    function wrapOperand(text) {
        if (last()?.type !== 'number') {
            typeFunction(text);
            return;
        }
        insertBeforeOperand([token('open', text)]);
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

    // +/- on a number or constant flips its sign. With no operand yet (blank
    // expression, right after an operator, ...) it toggles a "(-" opener:
    // press once to add it, again to remove it, back and forth.
    function toggleSign() {
        const tail = last();
        if (tail?.type === 'number' || tail?.type === 'constant') {
            const before = tokens[tokens.length - 2];
            if (before?.type === 'sign') {
                if (before.text === '-') {
                    tokens.splice(tokens.length - 2, 1);
                } else {
                    before.text = '-';
                }
            } else if (!before || before.type === 'open') {
                insertBeforeOperand([token('sign', '-')]);
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

    function equals() {
        if (tokens.length === 0) {
            return;
        }
        try {
            tokens = resultTokens(evaluate(tokens, angleMode));
            justEvaluated = true;
        } catch (error) {
            tokens = [];
            hasError = true;
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
        wrap: wrapOperand,
        sign: toggleSign,
        backspace,
        clear: () => { tokens = []; },
        equals,
    };

    const text = () => (hasError ? 'Error' : textOf(tokens));

    return {
        press({ type, value }) {
            // A mode switch, not an edit: leaves the expression (and whether
            // it's a fresh result) untouched.
            if (type === 'angle') {
                angleMode = angleMode === 'rad' ? 'deg' : 'rad';
                return;
            }
            // Anything pressed after an error, or a digit pressed after "=",
            // starts a fresh calculation; operators and the like build on a result.
            if (hasError || (justEvaluated && (type === 'digit' || type === 'decimal'))) {
                tokens = [];
            }
            hasError = false;
            justEvaluated = false;
            handlers[type](value);
        },

        get text() {
            return text();
        },

        get angleMode() {
            return angleMode;
        },

        // "= <result>" of the expression as typed so far, or '' when there's
        // nothing worth showing (incomplete expression, or it's already a result).
        get preview() {
            if (tokens.length === 0) {
                return '';
            }
            try {
                const result = roundTo(evaluate(tokens, angleMode), PREVIEW_DECIMALS);
                return String(result) === text() ? '' : '= ' + result;
            } catch (error) {
                return '';
            }
        },
    };
}
