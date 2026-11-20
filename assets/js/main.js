/* ==========================================================================
   Northline Dental — shared behaviour
   Vanilla JS, no dependencies. The page works with JavaScript disabled;
   everything here is an enhancement.
   ========================================================================== */

(function () {
  'use strict';

  var root = document.documentElement;

  /* ---------- strings that only exist in JS ----------------------------- */

  var S = {
    en: {
      required: 'This field is required.',
      email: 'Please enter a valid email address.',
      phone: 'Please enter a phone number we can reach you on.',
      message: 'A sentence or two more will help us answer properly.',
      consent: 'Please tick this box so we can reply to you.',
      sending: 'Sending…',
      openNow: 'Open now',
      closedNow: 'Closed now',
      closed: 'Closed'
    },
    ru: {
      required: 'Это поле обязательно.',
      email: 'Введите корректный адрес электронной почты.',
      phone: 'Укажите телефон, по которому с вами можно связаться.',
      message: 'Ещё пара предложений поможет ответить по делу.',
      consent: 'Отметьте это поле, чтобы мы могли вам ответить.',
      sending: 'Отправляем…',
      openNow: 'Сейчас открыто',
      closedNow: 'Сейчас закрыто',
      closed: 'Выходной'
    },
    ka: {
      required: 'ეს ველი სავალდებულოა.',
      email: 'შეიყვანეთ სწორი ელფოსტის მისამართი.',
      phone: 'მიუთითეთ ტელეფონი, რომელზეც დაგიკავშირდებით.',
      message: 'კიდევ ერთი-ორი წინადადება დაგვეხმარება სწორად გიპასუხოთ.',
      consent: 'მონიშნეთ ეს ველი, რომ პასუხის გაცემა შევძლოთ.',
      sending: 'იგზავნება…',
      openNow: 'ახლა ღიაა',
      closedNow: 'ახლა დაკეტილია',
      closed: 'დაკეტილია'
    }
  };

  function lang() { return root.getAttribute('data-lang') || 'en'; }
  function s(key) { return (S[lang()] || S.en)[key] || S.en[key] || key; }

  window.ND = window.ND || {};
  window.ND.s = s;

  /* ---------- Theme ------------------------------------------------------ */

  function currentTheme() {
    var set = root.getAttribute('data-theme');
    if (set) return set;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  document.querySelectorAll('.theme-toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('nd-theme', next); } catch (e) {}
    });
  });

  /* ---------- Mobile menu ------------------------------------------------ */

  var navToggle = document.querySelector('.nav-toggle');
  var mobileMenu = document.getElementById('mobile-menu');

  if (navToggle && mobileMenu) {
    var setMenu = function (open) {
      mobileMenu.classList.toggle('is-open', open);
      navToggle.setAttribute('aria-expanded', String(open));
      document.body.style.overflow = open ? 'hidden' : '';
    };
    navToggle.addEventListener('click', function () {
      setMenu(!mobileMenu.classList.contains('is-open'));
    });
    mobileMenu.addEventListener('click', function (e) {
      if (e.target.closest('a')) setMenu(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && mobileMenu.classList.contains('is-open')) {
        setMenu(false); navToggle.focus();
      }
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth >= 900) setMenu(false);
    });
  }

  /* ---------- FAQ --------------------------------------------------------- */

  document.querySelectorAll('.faq__q').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var panel = document.getElementById(btn.getAttribute('aria-controls'));
      var open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!open));
      if (panel) panel.classList.toggle('is-open', !open);
    });
  });

  /* ---------- Scroll reveal ------------------------------------------------ */

  var revealables = document.querySelectorAll('.reveal');
  if (revealables.length) {
    if (!('IntersectionObserver' in window)) {
      revealables.forEach(function (el) { el.classList.add('is-in'); });
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        });
      }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
      revealables.forEach(function (el) { io.observe(el); });
    }
  }

  /* ---------- Opening hours ------------------------------------------------
     One schedule, used by the "open now" badge, the info bar and the hours
     table. Change it here and every place on the site follows.
     ------------------------------------------------------------------------ */

  var SCHEDULE = {           // day index → [openMinutes, closeMinutes] or null
    0: null,                 // Sunday
    1: [8 * 60, 18 * 60],
    2: [8 * 60, 18 * 60],
    3: [8 * 60, 18 * 60],
    4: [8 * 60, 18 * 60],
    5: [8 * 60, 18 * 60],
    6: [9 * 60, 14 * 60]     // Saturday
  };

  window.ND.SCHEDULE = SCHEDULE;

  function fmtRange(range) {
    if (!range) return s('closed');
    var f = function (m) {
      return String(Math.floor(m / 60)) + ':' + String(m % 60).padStart(2, '0');
    };
    return f(range[0]) + ' – ' + f(range[1]);
  }

  function paintHours() {
    var now = new Date();
    var day = now.getDay();
    var minutes = now.getHours() * 60 + now.getMinutes();
    var todayRange = SCHEDULE[day];
    var isOpen = Boolean(todayRange) && minutes >= todayRange[0] && minutes < todayRange[1];

    document.querySelectorAll('[data-today-hours]').forEach(function (el) {
      el.textContent = fmtRange(todayRange);
    });

    document.querySelectorAll('[data-open-badge]').forEach(function (el) {
      el.setAttribute('data-open', String(isOpen));
      var label = el.querySelector('span');
      if (label) label.textContent = isOpen ? s('openNow') : s('closedNow');
    });

    document.querySelectorAll('[data-hours] li').forEach(function (li) {
      li.setAttribute('data-today', String(Number(li.getAttribute('data-day')) === day));
    });
  }

  paintHours();
  document.addEventListener('languagechange', paintHours);
  setInterval(paintHours, 60000);

  /* ---------- Shared form validation --------------------------------------- */

  function showError(field, message) {
    var wrap = field.closest('.field');
    if (!wrap) return;
    wrap.classList.toggle('has-error', Boolean(message));
    var slot = wrap.querySelector('.error');
    if (slot) slot.textContent = message || '';
    field.setAttribute('aria-invalid', message ? 'true' : 'false');
  }

  function validateField(field) {
    var value = (field.value || '').trim();
    if (field.required && !value) { showError(field, s('required')); return false; }
    if (field.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
      showError(field, s('email')); return false;
    }
    if (field.type === 'tel' && field.required && value.replace(/\D/g, '').length < 7) {
      showError(field, s('phone')); return false;
    }
    if (field.name === 'message' && value && value.length < 15) {
      showError(field, s('message')); return false;
    }
    showError(field, '');
    return true;
  }

  window.ND.validateField = validateField;

  function wireLiveValidation(form) {
    form.querySelectorAll('input, textarea, select').forEach(function (field) {
      field.addEventListener('blur', function () {
        if (field.type !== 'checkbox') validateField(field);
      });
      field.addEventListener('input', function () {
        var wrap = field.closest('.field');
        if (wrap && wrap.classList.contains('has-error')) validateField(field);
      });
    });
    document.addEventListener('languagechange', function () {
      form.querySelectorAll('.field.has-error').forEach(function (wrap) {
        var f = wrap.querySelector('input, textarea, select');
        if (f) validateField(f);
      });
    });
  }

  window.ND.wireLiveValidation = wireLiveValidation;

  /* ---------- Contact form (contact.html) ----------------------------------- */

  var contactForm = document.getElementById('contact-form');
  if (contactForm) {
    wireLiveValidation(contactForm);

    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();

      var required = Array.prototype.slice.call(
        contactForm.querySelectorAll('input[required], textarea[required]')
      ).filter(function (f) { return f.type !== 'checkbox'; });

      var ok = required.map(validateField).every(Boolean);

      var consent = contactForm.querySelector('input[name="consent"]');
      var consentError = document.getElementById('consent-error');
      if (consent && !consent.checked) {
        if (consentError) consentError.textContent = s('consent');
        ok = false;
      } else if (consentError) {
        consentError.textContent = '';
      }

      if (!ok) {
        var firstBad = contactForm.querySelector('.has-error input, .has-error textarea');
        if (firstBad) firstBad.focus();
        return;
      }

      // Demo build: no backend. Point this at a form service or a PHP handler.
      var btn = contactForm.querySelector('[type="submit"]');
      var original = btn ? btn.textContent : '';
      if (btn) { btn.disabled = true; btn.textContent = s('sending'); }

      setTimeout(function () {
        contactForm.reset();
        if (btn) { btn.disabled = false; btn.textContent = original; }
        var success = document.getElementById('form-success');
        if (success) {
          success.hidden = false;
          success.setAttribute('tabindex', '-1');
          success.focus();
          success.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 650);
    });
  }

  /* ---------- Year ---------------------------------------------------------- */

  document.querySelectorAll('[data-year]').forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });
})();
