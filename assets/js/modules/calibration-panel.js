import { defaults, imageCalibrationSections } from './calibration.js';

function resetButton(label, onReset) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'parameter-reset';
  button.title = 'Restablecer ' + label;
  button.setAttribute('aria-label', button.title);
  button.innerHTML = '<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 7a6 6 0 1 1 0 6M4 3v4h4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  button.addEventListener('click', onReset);
  return button;
}

function section(label) {
  const details = document.createElement('details');
  details.className = 'calibration-section';
  details.open = true;
  const summary = document.createElement('summary');
  summary.textContent = label;
  details.append(summary);
  return details;
}

function normalize(value, control) {
  const clamped = Math.max(control.min, Math.min(control.max, value));
  return Number((Math.round(clamped / control.step) * control.step).toFixed(1));
}

// The panel emits changes. The Studio owns the single calibration state.
export class ImageCalibrationPanel {
  #container;
  #onChange;
  #fields = new Map();

  constructor(container, onChange) {
    this.#container = container;
    this.#onChange = onChange;
  }

  mount() {
    this.#fields.clear();
    this.#container.replaceChildren();
    this.#container.classList.add('advanced-calibration');
    for (const group of imageCalibrationSections) {
      const details = section(group.label);
      for (const control of group.controls) details.append(this.#parameter(control));
      this.#container.append(details);
    }

    const format = section('Formato SBS');
    const row = document.createElement('div');
    row.className = 'format-control';
    const label = document.createElement('label');
    label.htmlFor = 'sbsType';
    label.textContent = 'Tipo de SBS';
    const select = document.createElement('select');
    select.id = 'sbsType';
    select.setAttribute('aria-describedby', 'sbs-format-help');
    for (const [value, text] of [['full', 'Completo (Full-SBS)'], ['half', 'Medio (Half-SBS)']]) {
      select.add(new Option(text, value));
    }
    select.addEventListener('change', () => this.#onChange({ sbsType: select.value }));
    const help = document.createElement('p');
    help.id = 'sbs-format-help';
    help.className = 'parameter-help';
    help.textContent = 'Full conserva el formato por ojo. Half recupera el ancho de vistas comprimidas horizontalmente.';
    row.append(label, select, resetButton('Tipo de SBS', () => this.#onChange({ sbsType: 'full' })), help);
    this.#fields.set('sbsType', { select });
    format.append(row);

    const swapRow = document.createElement('div');
    swapRow.className = 'swap-control';
    const swapLabel = document.createElement('label');
    const swap = document.createElement('input');
    swap.type = 'checkbox';
    swap.id = 'swap';
    swap.title = 'Asigna la mitad derecha al ojo izquierdo y la izquierda al derecho.';
    swap.addEventListener('change', () => this.#onChange({ swap: swap.checked }));
    const swapText = document.createElement('span');
    swapText.textContent = 'Intercambiar L/R';
    swapLabel.append(swap, swapText);
    const eyeAssignment = document.createElement('p');
    eyeAssignment.id = 'eye-assignment';
    eyeAssignment.className = 'parameter-help';
    swap.setAttribute('aria-describedby', eyeAssignment.id);
    swapRow.append(swapLabel, resetButton('Intercambiar L/R', () => this.#onChange({ swap: false })), eyeAssignment);
    this.#fields.set('swap', { checkbox: swap });
    format.append(swapRow);
    this.#container.append(format);
  }

  #parameter(control) {
    const { key, label, min, max, step, basis, description } = control;
    const row = document.createElement('div');
    row.className = 'parameter';
    const name = document.createElement('label');
    name.htmlFor = key;
    name.textContent = label + ' (' + basis + ')';
    const slider = document.createElement('input');
    Object.assign(slider, { type: 'range', id: key, min, max, step, title: description });
    const value = document.createElement('input');
    Object.assign(value, { type: 'number', id: key + '-number', min, max, step, title: description });
    value.setAttribute('aria-label', label + ' (' + basis + '), valor numérico');
    const hint = document.createElement('span');
    hint.id = key + '-help';
    hint.className = 'sr-only';
    hint.textContent = description;
    slider.setAttribute('aria-describedby', hint.id);
    value.setAttribute('aria-describedby', hint.id);
    const valueWrap = document.createElement('span');
    valueWrap.className = 'parameter-value';
    const percent = document.createElement('span');
    percent.textContent = '%';
    percent.setAttribute('aria-hidden', 'true');
    valueWrap.append(value, percent);

    slider.addEventListener('input', () => this.#onChange({ [key]: slider.valueAsNumber }));
    value.addEventListener('input', () => {
      // Preserve partially typed signs and decimal separators until the user commits.
      if (Number.isFinite(value.valueAsNumber)) {
        this.#onChange({ [key]: normalize(value.valueAsNumber, control) });
      }
    });
    value.addEventListener('change', () => { value.value = slider.value; });
    value.addEventListener('blur', () => { value.value = slider.value; });
    row.append(name, slider, valueWrap,
      resetButton(label, () => this.#onChange({ [key]: defaults()[key] })), hint);
    this.#fields.set(key, { slider, number: value });
    return row;
  }

  update(settings, force = false) {
    for (const [key, field] of this.#fields) {
      if (field.slider) {
        field.slider.value = settings[key];
        field.slider.setAttribute('aria-valuetext', settings[key] + ' %');
        if (force || document.activeElement !== field.number) field.number.value = settings[key];
      }
      if (field.select) field.select.value = settings[key];
      if (field.checkbox) field.checkbox.checked = settings[key];
    }
    this.#container.querySelector('#eye-assignment').textContent = settings.swap
      ? 'Ojo IZQ ← vista derecha · Ojo DER ← vista izquierda'
      : 'Ojo IZQ ← vista izquierda · Ojo DER ← vista derecha';
  }
}
