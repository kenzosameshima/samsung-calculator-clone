// DOM wiring only: every button and key becomes an action for the calculator
// in calculator.js, and the display, preview and angle label are re-rendered
// from its state.

import { createCalculator } from './calculator.js';
import { SCI_KEYS } from './scientific-keys.js';

const display = document.querySelector('#display');
const preview = document.querySelector('#preview');
const themeToggleBtn = document.querySelector('.theme-toggler');
const calculatorEl = document.querySelector('.calculator');
const keypad = document.querySelector('#keypad');
const sciToggleBtn = document.querySelector('#sci-toggle');
const sciPanel = document.querySelector('#scientific-buttons');
const sciShiftBtn = document.querySelector('#sci-shift');
const sciAngleBtn = document.querySelector('#sci-angle');

const calc = createCalculator();

function render() {
    display.textContent = calc.text;
    preview.textContent = calc.preview;

    const isRadians = calc.angleMode === 'rad';
    sciAngleBtn.textContent = isRadians ? 'Rad' : 'Deg';
    sciAngleBtn.setAttribute('aria-label', isRadians ? 'Angle unit: radians' : 'Angle unit: degrees');
}

function press(action) {
    calc.press(action);
    render();
}

keypad.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-type]');
    if (button) {
        press({ type: button.dataset.type, value: button.dataset.value });
    }
});

// ---- scientific keypad ----------------------------------------------------
// The buttons are generated from SCI_KEYS (scientific-keys.js), so labels,
// aria text, and actions can't drift apart.

let isShifted = false;

const activeKey = (keys) => keys[isShifted ? 1 : 0];

const sciButtons = SCI_KEYS.map((keys) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn-operator';
    button.addEventListener('click', () => press(activeKey(keys).action));
    sciPanel.append(button);
    return { button, keys };
});

function updateScientificLabels() {
    sciButtons.forEach(({ button, keys }) => {
        const { label, aria } = activeKey(keys);
        button.textContent = label;
        button.setAttribute('aria-label', aria);
    });
    sciShiftBtn.setAttribute('aria-pressed', String(isShifted));
}

sciShiftBtn.addEventListener('click', () => {
    isShifted = !isShifted;
    updateScientificLabels();
});

sciAngleBtn.addEventListener('click', () => {
    calc.toggleAngleMode();
    render();
});

updateScientificLabels();
render();

// ---- mode and theme toggles -----------------------------------------------

sciToggleBtn.addEventListener('click', () => {
    const willOpen = sciPanel.hidden;
    sciPanel.hidden = !willOpen;
    sciToggleBtn.setAttribute('aria-pressed', String(willOpen));
    // Keep the whole buttons area the same height it had in normal mode by
    // shrinking every button (both grids) into shorter, pill-shaped rows
    // instead of letting the calculator grow taller.
    calculatorEl.classList.toggle('compact', willOpen);
});

themeToggleBtn.addEventListener('click', () => {
    calculatorEl.classList.toggle('dark');
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
