// DOM wiring only: every button and key becomes an action for the calculator
// in calculator.js, and the display/preview are re-rendered from its state.

const display = document.querySelector('#display');
const preview = document.querySelector('#preview');
const themeToggleBtn = document.querySelector('.theme-toggler');
const calculator = document.querySelector('.calculator');
const keypad = document.querySelector('#keypad');
const sciToggleBtn = document.querySelector('#sci-toggle');
const sciPanel = document.querySelector('#scientific-buttons');
const sciShiftBtn = document.querySelector('#sci-shift');
const sciAngleBtn = document.querySelector('#sci-angle');

const calc = createCalculator();

function press(action) {
    calc.press(action);
    display.textContent = calc.text;
    preview.textContent = calc.preview;
}

keypad.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-type]');
    if (button) {
        press({ type: button.dataset.type, value: button.dataset.value });
    }
});

// ---- scientific keypad ----------------------------------------------------
// Each key is [normal, shifted]; the buttons are generated from this table so
// labels, aria text, and actions can't drift apart.

const sciKey = (label, aria, type, value) => ({ label, aria, action: { type, value } });
const signKey = sciKey('+/-', 'Toggle sign', 'sign');

const SCI_KEYS = {
    sqrt: [sciKey('√', 'Square root', 'wrap', '√('), sciKey('∛', 'Cube root', 'wrap', '∛(')],
    abs: [sciKey('|x|', 'Absolute value', 'wrap', 'abs('), sciKey('2^x', '2 to the power of x', 'wrap', '2^(')],
    sin: [sciKey('sin', 'Sine', 'function', 'sin('), sciKey('sin⁻¹', 'Inverse sine', 'function', 'sin⁻¹(')],
    cos: [sciKey('cos', 'Cosine', 'function', 'cos('), sciKey('cos⁻¹', 'Inverse cosine', 'function', 'cos⁻¹(')],
    tan: [sciKey('tan', 'Tangent', 'function', 'tan('), sciKey('tan⁻¹', 'Inverse tangent', 'function', 'tan⁻¹(')],
    pi: [sciKey('π', 'Pi', 'constant', 'π'), sciKey('x^3', 'x cubed', 'power', '3')],
    ln: [sciKey('ln', 'Natural log', 'function', 'ln('), sciKey('sinh', 'Hyperbolic sine', 'function', 'sinh(')],
    log: [sciKey('log', 'Log base 10', 'function', 'log('), sciKey('cosh', 'Hyperbolic cosine', 'function', 'cosh(')],
    reciprocal: [sciKey('1/x', 'Reciprocal', 'wrap', '1/('), sciKey('tanh', 'Hyperbolic tangent', 'function', 'tanh(')],
    econst: [sciKey('e', "Euler's number", 'constant', 'e'), sciKey('x!', 'Factorial', 'postfix', '!')],
    exp: [sciKey('e^x', 'e to the x', 'function', 'e^('), sciKey('sinh⁻¹', 'Inverse hyperbolic sine', 'function', 'sinh⁻¹(')],
    square: [sciKey('x²', 'x squared', 'power', '2'), sciKey('cosh⁻¹', 'Inverse hyperbolic cosine', 'function', 'cosh⁻¹(')],
    power: [sciKey('x^y', 'x to the y', 'power'), sciKey('tanh⁻¹', 'Inverse hyperbolic tangent', 'function', 'tanh⁻¹(')],
    sign: [signKey, signKey],
};

let isShifted = false;

const sciButtons = Object.keys(SCI_KEYS).map((id) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn-operator';
    button.dataset.sci = id;
    sciPanel.append(button);
    return button;
});

function updateScientificLabels() {
    sciButtons.forEach((button) => {
        const { label, aria } = SCI_KEYS[button.dataset.sci][isShifted ? 1 : 0];
        button.textContent = label;
        button.setAttribute('aria-label', aria);
    });
    sciShiftBtn.setAttribute('aria-pressed', String(isShifted));
}

function updateAngleLabel() {
    const isRadians = calc.angleMode === 'rad';
    sciAngleBtn.textContent = isRadians ? 'Rad' : 'Deg';
    sciAngleBtn.setAttribute('aria-label', isRadians ? 'Angle unit: radians' : 'Angle unit: degrees');
}

sciPanel.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-sci]');
    if (button) {
        press(SCI_KEYS[button.dataset.sci][isShifted ? 1 : 0].action);
    }
});

sciShiftBtn.addEventListener('click', () => {
    isShifted = !isShifted;
    updateScientificLabels();
});

sciAngleBtn.addEventListener('click', () => {
    press({ type: 'angle' });
    updateAngleLabel();
});

updateScientificLabels();
updateAngleLabel();

// ---- mode and theme toggles -----------------------------------------------

sciToggleBtn.addEventListener('click', () => {
    const isOpen = sciPanel.hidden;
    sciPanel.hidden = !isOpen;
    sciToggleBtn.setAttribute('aria-pressed', String(isOpen));
    // Keep the whole buttons area the same height it had in normal mode by
    // shrinking every button (both grids) into shorter, pill-shaped rows
    // instead of letting the calculator grow taller.
    calculator.classList.toggle('compact', isOpen);
});

document.querySelector('#rotate-toggle').addEventListener('click', (event) => {
    const isLandscape = calculator.classList.toggle('landscape');
    event.currentTarget.setAttribute('aria-pressed', String(isLandscape));
});

themeToggleBtn.addEventListener('click', () => {
    calculator.classList.toggle('dark');
    themeToggleBtn.classList.toggle('active');
});

// ---- keyboard input ---------------------------------------------------------

const PAREN = { type: 'paren' };
const EQUALS = { type: 'equals' };
const CLEAR = { type: 'clear' };

const KEY_ACTIONS = {
    '.': { type: 'decimal' },
    '+': { type: 'operator', value: '+' },
    '-': { type: 'operator', value: '-' },
    '*': { type: 'operator', value: '*' },
    '/': { type: 'operator', value: '/' },
    '%': { type: 'postfix', value: '%' },
    '(': PAREN,
    ')': PAREN,
    Enter: EQUALS,
    '=': EQUALS,
    Backspace: { type: 'backspace' },
    Escape: CLEAR,
    Delete: CLEAR,
};

document.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
    }
    const action = /^\d$/.test(event.key) ? { type: 'digit', value: event.key } : KEY_ACTIONS[event.key];
    if (action) {
        event.preventDefault();
        press(action);
    }
});
