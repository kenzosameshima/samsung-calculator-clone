# Web Calculator

A calculator built with semantic HTML, CSS, and vanilla JavaScript, modeled after Samsung's calculator app — both its keypad behavior and its scientific mode.

## Features

- Standard arithmetic (`+`, `-`, `×`, `÷`), percentage, and backspace
- A live preview of the current expression's result, shown in smaller gray text below the expression and updated as you type; a lone number has no preview. In the expression, `+ - × ÷ %` are highlighted in the accent color (teal in basic mode, blue in scientific)
- Parentheses with Samsung-calculator-style behavior:
  - repeated `(` only opens further until a number is typed, then it starts closing
  - `+`/`-` right after `(` are sign marks, not closing triggers
  - a value followed by `(` inserts an implicit `×`, e.g. `8(` becomes `8×(`
  - `×` or `÷` followed by `-` opens a parenthesis around the negative operand, e.g. `5×-3` becomes `5×(-3`
  - unmatched `(` are closed automatically when you press `=`
- Operators that build the expression as readable text rather than computing immediately, e.g. typing `8%` shows `8%` and previews `0.08`; `8` then `x²` shows `8^(2)`; `%` also works after a closed group, e.g. `(5+3)%`
- `%` follows the phone's rule: after `+` or `-` it is a percentage *of everything to its left* (`100+50%` is `150`, `100+50%+10%` is `165`, `2+3×4+10%` is `15.4`), while after `×` or `÷` it is just ÷100 (`50×10%` is `5`)
- Keyboard input: digits, `+ - * / ( ) . %`, Enter/`=` to evaluate, Backspace, and Escape/Delete to clear
- A scientific mode (toggled with the `fx` button) with a `2nd` shift key, independent radian/degree switching, trig (with inverses), hyperbolic functions, `ln`/`log`, `√`/`∛`, `|x|`/`2^x`, `1/x`, `π`/`e`, `x²`/`x³`, `x^y` (inserts `^(`, e.g. `2` then `x^y` shows `2^(`), `x!`, and `+/-` — toggling it shrinks every button into a compact pill-shaped layout inside a fixed-height keypad area, so the calculator itself never changes size
- Function keys (`√`, `sin`, `ln`, `|x|`, ...) only open the function: pressing one after a number multiplies, so `9` then `√` shows `9×√(` and the operand is typed afterwards (`√(9`). `1/x` likewise just types `1÷`, so `5` then `1/x` then `4` is `5×1÷4`. `sin`, `cos` and `tan` snap float dust to zero, so `sin(180°)` is `0`
- Pressing an operator right after `=` continues from the previous result; typing a digit starts a fresh calculation, and Backspace wipes the result
- Backspace removes an entire function prefix (`sin(`, `log(`, `√(`, ...) in one step instead of leaving a broken partial name behind, and steps through `^(2)` one character at a time — a half-deleted expression such as `(8^(2` still evaluates (to `64`) because unclosed parentheses are closed automatically
- `+/-` wraps the number or constant you just entered in a `(-` opener (`8` becomes `(-8`) and pressing it again removes it; on a blank expression or after an operator it toggles a `(-` opener
- Results are rounded to 10 decimals, and written in exponent form when huge or tiny (`1.00000000E+22`, `3.33333333E-7`, from 1e15 and below 1e-6); arithmetic is cleaned to 15 significant digits so `0.1+0.2-0.3` is `0`. An exponent-form result is kept as a single value, so you can keep calculating with it
- Input limits: 15 digits per number (10 after the decimal point; the 16th digit is refused with a "Can't enter more than 15 digits." toast), no leading zeros (`0005` is `5`), thousands separators in the display and preview, and a text that shrinks to fit as the expression grows
- `=` never wipes your work: an incomplete expression (`5+`) and a lone number are left alone, and one with no defined result (`1/0`, `√` of a negative, `171!`) stays on the display in red with a toast ("Can't divide by zero." / "Can't show undefined result.")
- A history button (top left) in the phone's position; it is a placeholder for now and does nothing yet
- Light/dark theme toggle, with colors matched to the phone's calculator (green accent in basic mode, blue in scientific)
- A rotate button (↻) that switches to a landscape layout: the keypad fills the width, or with `fx` on, scientific keys sit beside it; the rotation animates smoothly

## Running it

Open `index.html` in a browser — no build step or dependencies required.

## Structure

- `index.html` — markup
- `style/style.css` — styling: the CSS-variable palette (both themes), the compact scientific-mode layout, and the landscape layout
- `script/evaluate.js` — evaluates a token list to a number (a small recursive-descent parser; no `eval`)
- `script/calculator.js` — calculator state and input rules as a token list, with no DOM access
- `script/script.js` — DOM wiring: buttons, keyboard, the scientific keypad table, and rendering
- `media/` — favicon
