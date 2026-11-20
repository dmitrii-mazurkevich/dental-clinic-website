/* ==========================================================================
   Northline Dental — three-step booking flow
   --------------------------------------------------------------------------
   Deliberately built without a library so it stays small and fast:
     · one source of truth for opening hours (window.ND.SCHEDULE, main.js)
     · day and slot lists generated from that schedule
     · availability is deterministic per date, so a slot that looked taken
       is still taken when the visitor comes back
     · each step validates before it lets you move on, and going back keeps
       everything you already typed
   In a real build the slot list would come from the practice management
   system; swapping `slotsFor()` for a fetch is the only change needed.
   ========================================================================== */

(function () {
  'use strict';

  var form = document.getElementById('booking-form');
  if (!form) return;

  var root = document.documentElement;
  var DAYS_AHEAD = 14;
  var SLOT_STEP = 30; // minutes

  var TXT = {
    en: {
      treatment: 'Treatment', when: 'Date and time', duration: 'Expected length',
      clinician: 'Clinician', patient: 'Patient', name: 'Name', phone: 'Phone',
      minutes: 'minutes', pickTime: 'Please choose a day and a time.',
      noSlots: 'No free slots left on this day — try the next one.',
      sending: 'Sending…', today: 'Today', tomorrow: 'Tomorrow'
    },
    ru: {
      treatment: 'Услуга', when: 'Дата и время', duration: 'Длительность',
      clinician: 'Врач', patient: 'Пациент', name: 'Имя', phone: 'Телефон',
      minutes: 'минут', pickTime: 'Пожалуйста, выберите день и время.',
      noSlots: 'На этот день свободных слотов не осталось — попробуйте следующий.',
      sending: 'Отправляем…', today: 'Сегодня', tomorrow: 'Завтра'
    },
    ka: {
      treatment: 'მომსახურება', when: 'თარიღი და დრო', duration: 'სავარაუდო ხანგრძლივობა',
      clinician: 'ექიმი', patient: 'პაციენტი', name: 'სახელი', phone: 'ტელეფონი',
      minutes: 'წუთი', pickTime: 'გთხოვთ, აირჩიოთ დღე და დრო.',
      noSlots: 'ამ დღეს თავისუფალი დრო აღარ დარჩა — სცადეთ მომდევნო.',
      sending: 'იგზავნება…', today: 'დღეს', tomorrow: 'ხვალ'
    }
  };

  function lang() { return root.getAttribute('data-lang') || 'en'; }
  function t(key) { return (TXT[lang()] || TXT.en)[key] || TXT.en[key] || key; }

  /* Date names are shipped with the site rather than taken from Intl.
     Not every browser build carries Georgian locale data — where it's missing,
     Intl silently falls back to the browser's own language, which would put
     Russian month names on the Georgian page. These tables can't do that.
     Russian months are in the genitive, because they only ever follow a number. */
  var DATES = {
    en: {
      dowShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      dowLong: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      monShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      monLong: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    },
    ru: {
      dowShort: ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'],
      dowLong: ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'],
      monShort: ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
      monLong: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
    },
    ka: {
      dowShort: ['კვი', 'ორშ', 'სამ', 'ოთხ', 'ხუთ', 'პარ', 'შაბ'],
      dowLong: ['კვირა', 'ორშაბათი', 'სამშაბათი', 'ოთხშაბათი', 'ხუთშაბათი', 'პარასკევი', 'შაბათი'],
      monShort: ['იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ', 'ივლ', 'აგვ', 'სექ', 'ოქტ', 'ნოე', 'დეკ'],
      monLong: ['იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი', 'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი']
    }
  };

  function dates() { return DATES[lang()] || DATES.en; }
  function dowShort(d) { return dates().dowShort[d.getDay()]; }
  function monShort(d) { return dates().monShort[d.getMonth()]; }

  function longDate(d) {
    var n = dates();
    return n.dowLong[d.getDay()] + ', ' + d.getDate() + ' ' + n.monLong[d.getMonth()];
  }

  var state = { step: 1, date: null, time: null };

  /* ---------- availability ------------------------------------------------- */

  // Small deterministic hash so the same date always shows the same free slots.
  function seeded(dateKey, minutes) {
    var str = dateKey + ':' + minutes;
    var h = 0;
    for (var i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) | 0; }
    return Math.abs(h) % 100;
  }

  function dateKey(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function scheduleFor(d) {
    var sched = (window.ND && window.ND.SCHEDULE) || {};
    return sched[d.getDay()] || null;
  }

  function slotsFor(d, durationMin) {
    var range = scheduleFor(d);
    if (!range) return [];
    var out = [];
    var now = new Date();
    var isToday = dateKey(d) === dateKey(now);
    var nowMin = now.getHours() * 60 + now.getMinutes();

    for (var m = range[0]; m + durationMin <= range[1]; m += SLOT_STEP) {
      if (isToday && m < nowMin + 60) continue;   // no bookings inside the next hour
      out.push({ minutes: m, free: seeded(dateKey(d), m) > 38 });
    }
    return out;
  }

  function hhmm(m) {
    return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  }

  /* ---------- rendering ----------------------------------------------------- */

  var daysEl = document.getElementById('days');
  var slotsEl = document.getElementById('slots');
  var timeError = document.getElementById('time-error');

  function selectedTreatment() {
    return form.querySelector('input[name="treatment"]:checked');
  }

  function duration() {
    var t = selectedTreatment();
    return t ? Number(t.getAttribute('data-duration')) : 30;
  }

  function renderDays() {
    daysEl.innerHTML = '';
    var today = new Date();

    for (var i = 0; i < DAYS_AHEAD; i++) {
      var d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
      var open = Boolean(scheduleFor(d));
      var free = open && slotsFor(d, duration()).some(function (s) { return s.free; });

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'day';
      btn.setAttribute('aria-pressed', 'false');
      btn.setAttribute('data-date', dateKey(d));
      if (!free) btn.disabled = true;

      var label = i === 0 ? t('today') : (i === 1 ? t('tomorrow') : dowShort(d));
      btn.innerHTML =
        '<span class="day__dow"></span><span class="day__num"></span><span class="day__mon"></span>';
      btn.querySelector('.day__dow').textContent = label;
      btn.querySelector('.day__num').textContent = String(d.getDate());
      btn.querySelector('.day__mon').textContent = monShort(d);

      btn.addEventListener('click', (function (key) {
        return function () { state.date = key; state.time = null; paintDays(); renderSlots(); };
      })(dateKey(d)));

      daysEl.appendChild(btn);
    }

    if (!state.date) {
      var firstFree = daysEl.querySelector('.day:not([disabled])');
      if (firstFree) state.date = firstFree.getAttribute('data-date');
    }
    paintDays();
  }

  function paintDays() {
    daysEl.querySelectorAll('.day').forEach(function (btn) {
      btn.setAttribute('aria-pressed', String(btn.getAttribute('data-date') === state.date));
    });
  }

  function parseKey(key) {
    var p = key.split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }

  function renderSlots() {
    slotsEl.innerHTML = '';
    if (!state.date) return;

    var list = slotsFor(parseKey(state.date), duration());
    if (!list.length) {
      var p = document.createElement('p');
      p.className = 'muted';
      p.style.fontSize = '.9rem';
      p.textContent = t('noSlots');
      slotsEl.appendChild(p);
      return;
    }

    list.forEach(function (slot) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'slot';
      btn.textContent = hhmm(slot.minutes);
      btn.setAttribute('aria-pressed', String(state.time === slot.minutes));
      if (!slot.free) btn.disabled = true;
      btn.addEventListener('click', function () {
        state.time = slot.minutes;
        slotsEl.querySelectorAll('.slot').forEach(function (b) {
          b.setAttribute('aria-pressed', String(b === btn));
        });
        if (timeError) timeError.textContent = '';
      });
      slotsEl.appendChild(btn);
    });
  }

  /* ---------- summary --------------------------------------------------------- */

  function textOfChecked(name) {
    var input = form.querySelector('input[name="' + name + '"]:checked');
    if (!input) return '';
    var title = input.parentNode.querySelector('.choice__title');
    return title ? title.textContent.trim() : input.value;
  }

  function whenText() {
    if (!state.date || state.time === null) return '—';
    return longDate(parseKey(state.date)) + ', ' + hhmm(state.time);
  }

  function buildSummary(target, includeContact) {
    target.innerHTML = '';
    var rows = [
      [t('treatment'), textOfChecked('treatment')],
      [t('when'), whenText()],
      [t('duration'), duration() + ' ' + t('minutes')],
      [t('clinician'), form.querySelector('#clinician').selectedOptions[0].textContent.trim()],
      [t('patient'), textOfChecked('patient')]
    ];
    if (includeContact) {
      rows.push([t('name'), form.querySelector('#fullname').value.trim() || '—']);
      rows.push([t('phone'), form.querySelector('#phone').value.trim() || '—']);
    }
    rows.forEach(function (row) {
      var dt = document.createElement('dt');
      dt.textContent = row[0];
      var dd = document.createElement('dd');
      dd.textContent = row[1] || '—';
      target.appendChild(dt);
      target.appendChild(dd);
    });
  }

  /* ---------- step navigation --------------------------------------------------- */

  function showStep(n, scroll) {
    state.step = n;
    form.querySelectorAll('.bstep').forEach(function (sec) {
      sec.classList.toggle('is-active', Number(sec.getAttribute('data-step')) === n);
    });
    form.querySelectorAll('[data-step-indicator]').forEach(function (ind) {
      var i = Number(ind.getAttribute('data-step-indicator'));
      ind.setAttribute('data-state', i < n ? 'done' : (i === n ? 'current' : 'upcoming'));
    });
    if (n === 3) buildSummary(document.getElementById('live-summary'), false);

    if (scroll) {
      var head = document.querySelector('.booking');
      if (head) {
        window.scrollTo({ top: head.getBoundingClientRect().top + window.scrollY - 90, behavior: 'smooth' });
      }
      var focusable = form.querySelector('.bstep.is-active h2');
      if (focusable) { focusable.setAttribute('tabindex', '-1'); focusable.focus({ preventScroll: true }); }
    }
  }

  function validateStep(n) {
    if (n === 1) return true;
    if (n === 2) {
      if (!state.date || state.time === null) {
        if (timeError) timeError.textContent = t('pickTime');
        return false;
      }
      return true;
    }
    return true;
  }

  form.querySelectorAll('[data-next]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (!validateStep(state.step)) return;
      showStep(Math.min(state.step + 1, 3), true);
    });
  });

  form.querySelectorAll('[data-prev]').forEach(function (btn) {
    btn.addEventListener('click', function () { showStep(Math.max(state.step - 1, 1), true); });
  });

  /* ---------- treatment changes ---------------------------------------------------- */

  var emergencyNote = form.querySelector('[data-emergency-note]');

  form.querySelectorAll('input[name="treatment"]').forEach(function (input) {
    input.addEventListener('change', function () {
      if (emergencyNote) emergencyNote.hidden = input.value !== 'emergency' || !input.checked;
      state.time = null;
      renderDays();
      renderSlots();
    });
  });

  /* ---------- submit ----------------------------------------------------------------- */

  if (window.ND && window.ND.wireLiveValidation) window.ND.wireLiveValidation(form);

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var fields = [form.querySelector('#fullname'), form.querySelector('#phone'), form.querySelector('#email')];
    var ok = fields.map(function (f) {
      return window.ND && window.ND.validateField ? window.ND.validateField(f) : true;
    }).every(Boolean);

    var consent = form.querySelector('input[name="consent"]');
    var consentError = document.getElementById('consent-error');
    if (consent && !consent.checked) {
      if (consentError) consentError.textContent = (window.ND ? window.ND.s('consent') : 'Required');
      ok = false;
    } else if (consentError) {
      consentError.textContent = '';
    }

    if (!ok) {
      var firstBad = form.querySelector('.has-error input');
      if (firstBad) firstBad.focus();
      return;
    }

    // Demo build: nothing is sent anywhere. In a real project this posts to the
    // practice management system or a booking service.
    var btn = form.querySelector('[type="submit"]');
    var original = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = t('sending'); }

    setTimeout(function () {
      buildSummary(document.getElementById('confirm-summary'), true);
      form.hidden = true;
      var confirm = document.getElementById('confirm');
      confirm.classList.add('is-visible');
      confirm.setAttribute('tabindex', '-1');
      confirm.focus({ preventScroll: true });
      window.scrollTo({ top: confirm.getBoundingClientRect().top + window.scrollY - 100, behavior: 'smooth' });
      if (btn) { btn.disabled = false; btn.textContent = original; }
    }, 700);
  });

  /* ---------- language changes ------------------------------------------------------- */

  document.addEventListener('languagechange', function () {
    renderDays();
    renderSlots();
    if (state.step === 3) buildSummary(document.getElementById('live-summary'), false);
    if (timeError && timeError.textContent) timeError.textContent = t('pickTime');
  });

  /* ---------- init -------------------------------------------------------------------- */

  renderDays();
  renderSlots();
  showStep(1, false);
  window.scrollTo({ top: 0 });
})();
