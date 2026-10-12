(function () {
	'use strict';

	var root = document.documentElement;
	var media = window.matchMedia('(prefers-color-scheme: dark)');
	var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

	/* ------------------------------------------------------------------
	   Theme: follow the system until the visitor picks one explicitly
	   ------------------------------------------------------------------ */
	var toggle = document.getElementById('theme-toggle');

	function storedTheme() {
		try { return localStorage.getItem('theme'); } catch (e) { return null; }
	}

	function applyTheme(theme) {
		root.dataset.theme = theme;
		toggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
	}

	function switchTheme(theme, origin) {
		if (reduceMotion.matches) return applyTheme(theme);

		// Circular reveal from the toggle button where supported
		if (document.startViewTransition && origin) {
			var rect = origin.getBoundingClientRect();
			var x = rect.left + rect.width / 2;
			var y = rect.top + rect.height / 2;
			var r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
			var transition = document.startViewTransition(function () { applyTheme(theme); });
			transition.ready.then(function () {
				root.animate(
					{ clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + r + 'px at ' + x + 'px ' + y + 'px)'] },
					{ duration: 550, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)', pseudoElement: '::view-transition-new(root)' }
				);
			});
			return;
		}

		// Fallback: cross-fade colours
		root.classList.add('theme-fading');
		applyTheme(theme);
		setTimeout(function () { root.classList.remove('theme-fading'); }, 450);
	}

	applyTheme(root.dataset.theme || (media.matches ? 'dark' : 'light'));

	toggle.addEventListener('click', function () {
		var next = root.dataset.theme === 'dark' ? 'light' : 'dark';
		var system = media.matches ? 'dark' : 'light';
		try {
			// Picking the system theme again returns to "follow system"
			if (next === system) localStorage.removeItem('theme');
			else localStorage.setItem('theme', next);
		} catch (e) {}
		switchTheme(next, toggle);
	});

	media.addEventListener('change', function (e) {
		if (!storedTheme()) switchTheme(e.matches ? 'dark' : 'light', null);
	});

	/* ------------------------------------------------------------------
	   Mobile menu
	   ------------------------------------------------------------------ */
	var nav = document.getElementById('site-nav');
	var menuBtn = document.getElementById('menu-toggle');

	function setMenu(open) {
		nav.classList.toggle('open', open);
		menuBtn.setAttribute('aria-expanded', String(open));
		menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
	}
	menuBtn.addEventListener('click', function () { setMenu(!nav.classList.contains('open')); });
	nav.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
	document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });

	/* ------------------------------------------------------------------
	   Header border on scroll + active nav link
	   ------------------------------------------------------------------ */
	var header = document.querySelector('.site-header');
	function onScroll() { header.classList.toggle('scrolled', scrollY > 8); }
	addEventListener('scroll', onScroll, { passive: true });
	onScroll();

	if ('IntersectionObserver' in window) {
		var links = {};
		nav.querySelectorAll('a').forEach(function (a) { links[a.getAttribute('href').slice(1)] = a; });
		var spy = new IntersectionObserver(function (entries) {
			entries.forEach(function (entry) {
				var link = links[entry.target.id];
				if (link && entry.isIntersecting) {
					nav.querySelectorAll('a.active').forEach(function (a) { a.classList.remove('active'); });
					link.classList.add('active');
				}
			});
		}, { rootMargin: '-45% 0px -50% 0px' });
		document.querySelectorAll('main section[id]').forEach(function (s) { spy.observe(s); });

		/* Scroll reveal */
		var revealer = new IntersectionObserver(function (entries) {
			entries.forEach(function (entry) {
				if (entry.isIntersecting) {
					entry.target.classList.add('visible');
					revealer.unobserve(entry.target);
				}
			});
		}, { rootMargin: '0px 0px -8% 0px' });
		document.querySelectorAll('.section-head, .card, .gallery figure, .stats').forEach(function (el) {
			el.classList.add('reveal');
			revealer.observe(el);
		});
	}

	/* ------------------------------------------------------------------
	   Experience: role durations + career-at-a-glance chart
	   ------------------------------------------------------------------ */
	var now = new Date();
	var nowMonths = now.getFullYear() * 12 + now.getMonth();

	function toMonths(ym) {
		if (!ym) return nowMonths;
		var parts = ym.split('-');
		return Number(parts[0]) * 12 + Number(parts[1]) - 1;
	}

	function formatDuration(months) {
		var y = Math.floor(months / 12);
		var m = months % 12;
		var out = [];
		if (y) out.push(y + (y === 1 ? ' yr' : ' yrs'));
		if (m) out.push(m + ' mo');
		return out.join(' ') || '< 1 mo';
	}

	var jobs = Array.prototype.slice.call(document.querySelectorAll('.timeline-item[data-start]'));
	jobs.forEach(function (job) {
		var span = toMonths(job.dataset.end) - toMonths(job.dataset.start);
		job.querySelector('.duration').textContent = formatDuration(span);
	});

	var chart = document.getElementById('career-chart');
	if (chart && jobs.length) {
		var first = Math.min.apply(null, jobs.map(function (j) { return toMonths(j.dataset.start); }));
		var startYear = Math.floor(first / 12);
		var endYear = now.getFullYear() + 1;
		var total = (endYear - startYear) * 12;
		var rows = chart.querySelector('.chart-rows');
		var axis = chart.querySelector('.chart-axis');

		// Oldest first reads left-to-right like a Gantt chart
		jobs.slice().sort(function (a, b) { return toMonths(a.dataset.start) - toMonths(b.dataset.start); })
			.forEach(function (job) {
				var from = toMonths(job.dataset.start) - startYear * 12;
				var span = toMonths(job.dataset.end) - toMonths(job.dataset.start);
				var row = document.createElement('button');
				row.type = 'button';
				row.className = 'chart-row';
				row.tabIndex = -1;
				row.dataset.kind = job.dataset.kind;
				row.innerHTML = '<span></span><span class="chart-track"><span class="chart-bar"></span></span>';
				row.firstChild.textContent = job.dataset.label;
				var bar = row.querySelector('.chart-bar');
				bar.style.setProperty('--from', (from / total * 100) + '%');
				bar.style.setProperty('--span', (span / total * 100) + '%');
				if (!job.dataset.end) bar.classList.add('ongoing');
				bar.title = job.dataset.label + ' · ' + formatDuration(span);
				row.addEventListener('click', function () {
					job.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'center' });
					job.classList.remove('flash');
					void job.offsetWidth;
					job.classList.add('flash');
				});
				rows.appendChild(row);
			});

		for (var y = startYear; y <= endYear; y++) {
			var tick = document.createElement('span');
			tick.textContent = "'" + String(y).slice(2);
			tick.style.left = ((y - startYear) * 12 / total * 100) + '%';
			axis.appendChild(tick);
		}
		chart.classList.add('ready');
	}

	/* ------------------------------------------------------------------
	   Gallery lightbox
	   ------------------------------------------------------------------ */
	var lightbox = document.getElementById('lightbox');
	if (lightbox && lightbox.showModal) {
		var lbImg = lightbox.querySelector('img');
		var lbCaption = lightbox.querySelector('.lightbox-caption');

		document.querySelectorAll('.gallery figure button').forEach(function (btn) {
			btn.addEventListener('click', function () {
				var img = btn.querySelector('img');
				lbImg.src = img.src;
				lbImg.alt = img.alt;
				lbCaption.textContent = btn.parentElement.querySelector('figcaption').textContent;
				lightbox.showModal();
			});
		});
		lightbox.querySelector('.lightbox-close').addEventListener('click', function () { lightbox.close(); });
		lightbox.addEventListener('click', function (e) { if (e.target === lightbox) lightbox.close(); });
	}

	/* ------------------------------------------------------------------
	   Misc
	   ------------------------------------------------------------------ */
	document.getElementById('print-btn').addEventListener('click', function () { print(); });
	document.getElementById('year').textContent = new Date().getFullYear();
})();
