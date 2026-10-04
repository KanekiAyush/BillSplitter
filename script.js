/**
 * Bill Splitter - Pure Vanilla JavaScript Implementation
 * Meets all ZeroCode requirements:
 * 1. Takes occasion name, bill amount, number of people, and currency
 * 2. Supported currencies: USD ($), INR (₹), EUR (€), GBP (£) with exact subunit handling (cents, paise, pence)
 * 3. Shows each person's share; individual shares add up EXACTLY to the bill without rounding discrepancies
 * 4. Shows clear error message and suppresses results if bill or people is empty, zero, or negative
 * 5. Restores inputs, currency, and results upon page reload via localStorage
 * 6. Working Clear / Reset functionality and clipboard copy
 * 7. Export Invoice button that opens a print-friendly invoice view via window.print()
 * Works offline, no frameworks, native browser APIs only.
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'zerocode_bill_splitter_data';

  const CURRENCIES = {
    USD: {
      code: 'USD',
      symbol: '$',
      name: 'US Dollar',
      subunitSingular: 'cent',
      subunitPlural: 'cents',
      locale: 'en-US'
    },
    INR: {
      code: 'INR',
      symbol: '₹',
      name: 'Indian Rupee',
      subunitSingular: 'paisa',
      subunitPlural: 'paise',
      locale: 'en-IN'
    },
    EUR: {
      code: 'EUR',
      symbol: '€',
      name: 'Euro',
      subunitSingular: 'cent',
      subunitPlural: 'cents',
      locale: 'de-DE'
    },
    GBP: {
      code: 'GBP',
      symbol: '£',
      name: 'British Pound',
      subunitSingular: 'penny',
      subunitPlural: 'pence',
      locale: 'en-GB'
    }
  };

  // DOM Elements
  const form = document.getElementById('splitterForm');
  const currencySelect = document.getElementById('currencySelect');
  const currencySymbol = document.getElementById('currencySymbol');
  const occasionInput = document.getElementById('occasionInput');
  const billInput = document.getElementById('billInput');
  const peopleInput = document.getElementById('peopleInput');
  const calculateBtn = document.getElementById('calculateBtn');
  const resetBtn = document.getElementById('resetBtn');
  const messageBox = document.getElementById('messageBox');
  const messageText = document.getElementById('messageText');
  const resultContainer = document.getElementById('resultContainer');
  const resultOccasionBadge = document.getElementById('resultOccasionBadge');
  const resultOccasionTitle = document.getElementById('resultOccasionTitle');
  const summaryTotalBill = document.getElementById('summaryTotalBill');
  const summaryPeopleCount = document.getElementById('summaryPeopleCount');
  const summaryAverageShare = document.getElementById('summaryAverageShare');
  const summaryCheckSum = document.getElementById('summaryCheckSum');
  const sharesCounter = document.getElementById('sharesCounter');
  const sharesList = document.getElementById('sharesList');
  const savedTimeNotice = document.getElementById('savedTimeNotice');
  const exportInvoiceBtn = document.getElementById('exportInvoiceBtn');
  const copyBtn = document.getElementById('copyBtn');
  const toastNotification = document.getElementById('toastNotification');

  // Printable Invoice DOM Elements
  const invDate = document.getElementById('invDate');
  const invOccasion = document.getElementById('invOccasion');
  const invCurrency = document.getElementById('invCurrency');
  const invPeople = document.getElementById('invPeople');
  const invTotalBill = document.getElementById('invTotalBill');
  const invSharesTableBody = document.getElementById('invSharesTableBody');
  const invTableTotal = document.getElementById('invTableTotal');
  const invTableSum = document.getElementById('invTableSum');

  function getActiveCurrency() {
    const code = currencySelect ? currencySelect.value : 'USD';
    return CURRENCIES[code] || CURRENCIES.USD;
  }

  function formatCurrency(amount, curr) {
    const activeCurr = curr || getActiveCurrency();
    const num = Number(amount);
    const formatted = num.toLocaleString(activeCurr.locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return activeCurr.symbol + formatted;
  }

  function updateCurrencySymbol() {
    const active = getActiveCurrency();
    if (currencySymbol) {
      currencySymbol.textContent = active.symbol;
    }
  }

  function showError(msg) {
    messageText.textContent = msg;
    messageBox.style.display = 'flex';
    resultContainer.style.display = 'none';
    sharesList.innerHTML = '';
  }

  function hideError() {
    messageBox.style.display = 'none';
    messageText.textContent = '';
  }

  function validateInputs() {
    const rawBill = billInput.value.trim();
    const rawPeople = peopleInput.value.trim();

    if (rawBill === '') {
      showError('Please enter the total bill amount.');
      return null;
    }

    const bill = parseFloat(rawBill);

    if (isNaN(bill) || bill <= 0) {
      showError('Bill amount must be a number greater than 0.');
      return null;
    }

    if (bill > 1000000000) {
      showError('Bill amount cannot exceed 1,000,000,000.');
      return null;
    }

    if (rawPeople === '') {
      showError('Please enter the number of people sharing the bill.');
      return null;
    }

    const people = parseFloat(rawPeople);

    if (isNaN(people) || people <= 0) {
      showError('Number of people must be at least 1.');
      return null;
    }

    if (!Number.isInteger(people)) {
      showError('Number of people must be a whole number (e.g. 1, 2, 3...).');
      return null;
    }

    if (people > 1000) {
      showError('Number of people cannot exceed 1,000.');
      return null;
    }

    const occasion = occasionInput.value.trim() || 'Dinner';
    const currency = getActiveCurrency();

    return {
      occasion: occasion,
      bill: bill,
      people: people,
      currency: currency
    };
  }

  function calculateSplit(bill, people, currency) {
    const curr = currency || getActiveCurrency();
    const totalSubunits = Math.round(bill * 100);
    const baseSubunits = Math.floor(totalSubunits / people);
    const remainderSubunits = totalSubunits % people;

    const shares = [];
    let sumSubunits = 0;

    for (let i = 0; i < people; i++) {
      const personSubunits = i < remainderSubunits ? baseSubunits + 1 : baseSubunits;
      sumSubunits += personSubunits;

      shares.push({
        personIndex: i + 1,
        name: 'Person ' + (i + 1),
        amount: personSubunits / 100,
        subunits: personSubunits,
        adjusted: i < remainderSubunits && remainderSubunits > 0
      });
    }

    return {
      totalBill: totalSubunits / 100,
      totalSubunits: totalSubunits,
      peopleCount: people,
      average: bill / people,
      shares: shares,
      sumCheck: sumSubunits / 100,
      remainderSubunits: remainderSubunits,
      currency: curr
    };
  }

  function renderResults(occasion, data, isRestoredFromStorage) {
    hideError();
    const curr = data.currency || getActiveCurrency();

    resultOccasionBadge.textContent = occasion;
    resultOccasionTitle.textContent = occasion + ' Split';

    summaryTotalBill.textContent = formatCurrency(data.totalBill, curr);
    summaryPeopleCount.textContent = data.peopleCount;
    summaryAverageShare.textContent = formatCurrency(data.average, curr);
    summaryCheckSum.textContent = formatCurrency(data.sumCheck, curr);

    sharesCounter.textContent = data.peopleCount + (data.peopleCount === 1 ? ' person' : ' people');

    sharesList.innerHTML = '';
    const fragment = document.createDocumentFragment();

    data.shares.forEach(function (person) {
      const card = document.createElement('div');
      card.className = 'person-card';

      const left = document.createElement('div');
      left.className = 'person-left';

      const avatar = document.createElement('div');
      avatar.className = 'person-avatar';
      avatar.textContent = person.personIndex;

      const meta = document.createElement('div');
      meta.className = 'person-meta';

      const name = document.createElement('span');
      name.className = 'person-name';
      name.textContent = person.name;

      const tag = document.createElement('span');
      tag.className = 'person-tag' + (person.adjusted ? ' adjusted' : '');
      if (person.adjusted) {
        tag.textContent = 'Includes +' + curr.symbol + '0.01 (1 ' + curr.subunitSingular + ') to match total';
      } else {
        tag.textContent = 'Exact share';
      }

      meta.appendChild(name);
      meta.appendChild(tag);
      left.appendChild(avatar);
      left.appendChild(meta);

      const right = document.createElement('div');
      right.className = 'person-right';

      const amount = document.createElement('span');
      amount.className = 'person-amount';
      amount.textContent = formatCurrency(person.amount, curr);

      right.appendChild(amount);

      card.appendChild(left);
      card.appendChild(right);
      fragment.appendChild(card);
    });

    sharesList.appendChild(fragment);

    if (isRestoredFromStorage) {
      savedTimeNotice.textContent = 'Restored from previous session \u2022 persists on reload';
    } else {
      savedTimeNotice.textContent = 'Saved to browser memory \u2022 persists on reload';
    }

    resultContainer.style.display = 'flex';
  }

  function saveState(currencyCode, occasion, bill, people) {
    try {
      const payload = {
        currency: currencyCode,
        occasion: occasion,
        bill: bill,
        people: people,
        savedAt: new Date().toISOString()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  }

  function clearState() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn('LocalStorage remove failed:', e);
    }
  }

  function handleCalculate(e) {
    if (e) {
      e.preventDefault();
    }

    const validated = validateInputs();
    if (!validated) {
      clearState();
      return;
    }

    const resultData = calculateSplit(validated.bill, validated.people, validated.currency);
    renderResults(validated.occasion, resultData, false);
    saveState(validated.currency.code, validated.occasion, validated.bill, validated.people);
  }

  function handleReset() {
    form.reset();
    currencySelect.value = 'USD';
    updateCurrencySymbol();
    hideError();
    resultContainer.style.display = 'none';
    sharesList.innerHTML = '';
    clearState();
    occasionInput.focus();
  }

  function handleCurrencyChange() {
    updateCurrencySymbol();
    const rawBill = billInput.value.trim();
    const rawPeople = peopleInput.value.trim();
    if (resultContainer.style.display !== 'none' && rawBill !== '' && rawPeople !== '') {
      handleCalculate();
    }
  }

  // Populate Printable Invoice and trigger window.print()
  function handleExportInvoice() {
    let validated = validateInputs();
    if (!validated) {
      return;
    }

    const curr = validated.currency;
    const data = calculateSplit(validated.bill, validated.people, curr);

    // Formatted current date and time
    const now = new Date();
    const formattedDate = now.toLocaleDateString(curr.locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }) + ' at ' + now.toLocaleTimeString(curr.locale, {
      hour: '2-digit',
      minute: '2-digit'
    });

    invDate.textContent = formattedDate;
    invOccasion.textContent = validated.occasion;
    invCurrency.textContent = curr.code + ' (' + curr.symbol + ') - ' + curr.name;
    invPeople.textContent = data.peopleCount;
    invTotalBill.textContent = formatCurrency(data.totalBill, curr);
    invTableTotal.textContent = formatCurrency(data.totalBill, curr);
    invTableSum.textContent = formatCurrency(data.sumCheck, curr);

    // Build invoice table rows
    invSharesTableBody.innerHTML = '';
    const trFragment = document.createDocumentFragment();

    data.shares.forEach(function (person) {
      const tr = document.createElement('tr');

      const tdNum = document.createElement('td');
      tdNum.className = 'col-num';
      tdNum.textContent = person.personIndex;

      const tdPerson = document.createElement('td');
      tdPerson.className = 'col-person';
      tdPerson.innerHTML = '<strong>' + person.name + '</strong>';

      const tdNotes = document.createElement('td');
      tdNotes.className = 'col-notes';
      if (person.adjusted) {
        tdNotes.textContent = 'Includes +' + curr.symbol + '0.01 (1 ' + curr.subunitSingular + ') exact balancing adjustment';
      } else {
        tdNotes.textContent = 'Exact base share';
      }

      const tdShare = document.createElement('td');
      tdShare.className = 'col-share';
      tdShare.textContent = formatCurrency(person.amount, curr);

      tr.appendChild(tdNum);
      tr.appendChild(tdPerson);
      tr.appendChild(tdNotes);
      tr.appendChild(tdShare);
      trFragment.appendChild(tr);
    });

    invSharesTableBody.appendChild(trFragment);

    // Trigger native browser print
    window.print();
  }

  function handleCopy() {
    const rawBill = billInput.value.trim();
    const rawPeople = peopleInput.value.trim();
    const occasion = occasionInput.value.trim() || 'Dinner';
    const bill = parseFloat(rawBill);
    const people = parseInt(rawPeople, 10);
    const curr = getActiveCurrency();

    if (isNaN(bill) || isNaN(people) || people <= 0) {
      return;
    }

    const data = calculateSplit(bill, people, curr);
    let text = '=== ' + occasion.toUpperCase() + ' - BILL SPLIT (' + curr.code + ') ===\n';
    text += 'Total Bill: ' + formatCurrency(data.totalBill, curr) + '\n';
    text += 'Total People: ' + data.peopleCount + '\n';
    text += 'Average Share: ' + formatCurrency(data.average, curr) + '\n';
    text += '------------------------------------\n';

    data.shares.forEach(function (person) {
      text += person.name + ': ' + formatCurrency(person.amount, curr);
      if (person.adjusted) {
        text += ' (+' + curr.symbol + '0.01 / 1 ' + curr.subunitSingular + ' balanced)';
      }
      text += '\n';
    });

    text += '------------------------------------\n';
    text += 'Sum of Shares: ' + formatCurrency(data.sumCheck, curr) + ' (Exact Match)\n';

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(showToast).catch(fallbackCopy.bind(null, text));
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      showToast();
    } catch (err) {
      console.warn('Copy command failed', err);
    }
    document.body.removeChild(ta);
  }

  let toastTimer = null;
  function showToast() {
    if (toastTimer) {
      clearTimeout(toastTimer);
    }
    toastNotification.classList.add('show');
    toastTimer = setTimeout(function () {
      toastNotification.classList.remove('show');
    }, 2400);
  }

  function restoreSavedState() {
    try {
      const savedRaw = localStorage.getItem(STORAGE_KEY);
      if (!savedRaw) {
        updateCurrencySymbol();
        return;
      }

      const saved = JSON.parse(savedRaw);
      if (!saved || typeof saved !== 'object') {
        updateCurrencySymbol();
        return;
      }

      if (saved.currency && CURRENCIES[saved.currency]) {
        currencySelect.value = saved.currency;
      }
      updateCurrencySymbol();

      if (saved.occasion !== undefined && saved.occasion !== null) {
        occasionInput.value = saved.occasion;
      }
      if (saved.bill !== undefined && saved.bill !== null) {
        billInput.value = saved.bill;
      }
      if (saved.people !== undefined && saved.people !== null) {
        peopleInput.value = saved.people;
      }

      const bill = parseFloat(saved.bill);
      const people = parseInt(saved.people, 10);
      const occasion = (saved.occasion && saved.occasion.trim()) ? saved.occasion.trim() : 'Dinner';
      const curr = getActiveCurrency();

      if (!isNaN(bill) && bill > 0 && !isNaN(people) && people >= 1) {
        const resultData = calculateSplit(bill, people, curr);
        renderResults(occasion, resultData, true);
      }
    } catch (e) {
      console.warn('Failed to restore saved bill state:', e);
      updateCurrencySymbol();
    }
  }

  form.addEventListener('submit', handleCalculate);
  resetBtn.addEventListener('click', handleReset);
  exportInvoiceBtn.addEventListener('click', handleExportInvoice);
  copyBtn.addEventListener('click', handleCopy);
  currencySelect.addEventListener('change', handleCurrencyChange);

  billInput.addEventListener('input', function () {
    if (messageBox.style.display !== 'none') {
      hideError();
    }
  });

  peopleInput.addEventListener('input', function () {
    if (messageBox.style.display !== 'none') {
      hideError();
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', restoreSavedState);
  } else {
    restoreSavedState();
  }
})();
