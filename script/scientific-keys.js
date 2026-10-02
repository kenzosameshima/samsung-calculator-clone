// The scientific keypad as data: what each key is called and which calculator
// action it presses, in its normal and its shifted ("2nd") form. Function and
// constant keys name the exact text evaluate.js looks up, so that is checked
// when this module loads rather than failing later as a mystery "Error".

import { CONSTANTS, FUNCTIONS } from './evaluate.js';

const key = (label, aria, type, value) => ({ label, aria, action: { type, value } });
const signKey = key('+/-', 'Toggle sign', 'sign');

// Each entry is [normal, shifted], in display order.
export const SCI_KEYS = [
    [key('√', 'Square root', 'wrap', '√('), key('∛', 'Cube root', 'wrap', '∛(')],
    [key('|x|', 'Absolute value', 'wrap', 'abs('), key('2^x', '2 to the power of x', 'wrap', '2^(')],
    [key('sin', 'Sine', 'function', 'sin('), key('sin⁻¹', 'Inverse sine', 'function', 'sin⁻¹(')],
    [key('cos', 'Cosine', 'function', 'cos('), key('cos⁻¹', 'Inverse cosine', 'function', 'cos⁻¹(')],
    [key('tan', 'Tangent', 'function', 'tan('), key('tan⁻¹', 'Inverse tangent', 'function', 'tan⁻¹(')],
    [key('π', 'Pi', 'constant', 'π'), key('x^3', 'x cubed', 'power', '3')],
    [key('ln', 'Natural log', 'function', 'ln('), key('sinh', 'Hyperbolic sine', 'function', 'sinh(')],
    [key('log', 'Log base 10', 'function', 'log('), key('cosh', 'Hyperbolic cosine', 'function', 'cosh(')],
    [key('1/x', 'Reciprocal', 'wrap', '1/('), key('tanh', 'Hyperbolic tangent', 'function', 'tanh(')],
    [key('e', "Euler's number", 'constant', 'e'), key('x!', 'Factorial', 'postfix', '!')],
    [key('e^x', 'e to the x', 'function', 'e^('), key('sinh⁻¹', 'Inverse hyperbolic sine', 'function', 'sinh⁻¹(')],
    [key('x²', 'x squared', 'power', '2'), key('cosh⁻¹', 'Inverse hyperbolic cosine', 'function', 'cosh⁻¹(')],
    [key('x^y', 'x to the y', 'power'), key('tanh⁻¹', 'Inverse hyperbolic tangent', 'function', 'tanh⁻¹(')],
    [signKey, signKey],
];

const LOOKUP_TABLES = { function: FUNCTIONS, wrap: FUNCTIONS, constant: CONSTANTS };

for (const { label, action } of SCI_KEYS.flat()) {
    const table = LOOKUP_TABLES[action.type];
    if (table && !Object.hasOwn(table, action.value)) {
        throw new Error(`Scientific key "${label}" presses unknown ${action.type} "${action.value}"`);
    }
}
