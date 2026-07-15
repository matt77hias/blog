/**
 * layout.js — blog edition
 * Injects shared site chrome: icons sprite, header, nav, profile bar, footer.
 * Plain script (no ES modules) — Jekyll serves static HTML.
 * All paths are absolute from the site root so they work at /blog/YYYY/MM/DD/slug/.
 */

(function () {

    var ROOT = (document.querySelector('meta[name="main-site"]') || {}).content || 'https://matt77hias.github.io';
    var BASE = ROOT + '/blog';

    var NAV_ITEMS = [
        { id: 'home',         href: ROOT + '/index.html',       label: 'Home',         icon: 'icon-nav-home',         sw: '2' },
        { id: 'portfolio',    href: ROOT + '/portfolio.html',    label: 'Portfolio',    icon: 'icon-nav-portfolio',    sw: '2' },
        { id: 'blog',         href: ROOT + '/blog.html',         label: 'Blog',         icon: 'icon-nav-blog',         sw: '2' },
        { id: 'publications', href: ROOT + '/publications.html', label: 'Publications', icon: 'icon-nav-publications', sw: '1.75' },
        { id: 'resume',       href: ROOT + '/src/external/pdf.js/web/viewer.html?file=%2F../../assets/CV.pdf',
                                                                  label: 'Resume',       icon: 'icon-nav-resume',       sw: '2',
          external: true, ariaLabel: 'Resume (opens PDF in new tab)' },
    ];

    // ── Icon sprite ────────────────────────────────────────────────────────────

    function loadIconSprite() {
        var localUrl  = BASE + '/assets/icons.svg';
        var remoteUrl = ROOT + '/assets/icons.svg';
        function inject(svgText) {
            var tmp = document.createElement('div');
            tmp.innerHTML = svgText;
            var el = tmp.firstElementChild;
            if (el && el.tagName.toLowerCase() === 'svg') {
                el.setAttribute('aria-hidden', 'true');
                document.body.insertBefore(el, document.body.firstChild);
            }
        }
        function fetchRemote() {
            fetch(remoteUrl)
                .then(function (r) { return r.ok ? r.text() : null; })
                .then(function (text) { if (text) inject(text); })
                .catch(function () {});
        }
        fetch(localUrl)
            .then(function (r) { return r.ok ? r.text() : null; })
            .then(function (text) { if (text) inject(text); else fetchRemote(); })
            .catch(fetchRemote);
    }

    // ── Glitch toggle ──────────────────────────────────────────────────────────

    var GLITCH_KEY = 'glitchDisabled';

    function isGlitchDisabled() {
        try { return localStorage.getItem(GLITCH_KEY) === '1'; } catch (e) { return false; }
    }

    function applyGlitchState(btn, disabled) {
        document.body.classList.toggle('glitch-disabled', disabled);
        if (!btn) return;
        var label = disabled ? 'Enable glitch effect' : 'Disable glitch effect';
        btn.setAttribute('aria-pressed', String(disabled));
        btn.setAttribute('aria-label',   label);
        btn.setAttribute('title',        label);
        btn.setAttribute('data-tooltip', label);
        btn.classList.toggle('active', disabled);
    }

    function initGlitchToggle() {
        var btn = document.getElementById('glitch-toggle');
        if (!btn) return;
        applyGlitchState(btn, isGlitchDisabled());
        btn.addEventListener('click', function () {
            var disabled = !isGlitchDisabled();
            try {
                if (disabled) localStorage.setItem(GLITCH_KEY, '1');
                else          localStorage.removeItem(GLITCH_KEY);
            } catch (e) {}
            applyGlitchState(btn, disabled);
        });
    }

    // ── Header ─────────────────────────────────────────────────────────────────

    function buildHeader() {
        var header = document.createElement('header');

        var h1 = document.createElement('h1');
        h1.textContent = 'Matthias Moulin';
        header.appendChild(h1);

        var btns = document.createElement('div');
        btns.className = 'header-buttons';

        var glitchDisabled = isGlitchDisabled();
        var glitchBtn = document.createElement('button');
        glitchBtn.id = 'glitch-toggle';
        var glitchLabel = glitchDisabled ? 'Enable glitch effect' : 'Disable glitch effect';
        glitchBtn.setAttribute('aria-label',   glitchLabel);
        glitchBtn.setAttribute('title',        glitchLabel);
        glitchBtn.setAttribute('data-tooltip', glitchLabel);
        glitchBtn.setAttribute('aria-pressed', String(glitchDisabled));
        document.body.classList.toggle('glitch-disabled', glitchDisabled);
        glitchBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><use href="#icon-glitch-wave"/></svg>';
        btns.appendChild(glitchBtn);

        var themeBtn = document.createElement('button');
        themeBtn.id = 'theme-toggle';
        themeBtn.setAttribute('aria-label', 'Switch to light mode');
        themeBtn.setAttribute('title', 'Switch to light mode');
        themeBtn.setAttribute('data-tooltip', 'Switch to light mode');
        themeBtn.setAttribute('aria-pressed', 'false');
        themeBtn.innerHTML =
            '<span class="icon-sun"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-theme-sun"/></svg></span>' +
            '<span class="icon-moon"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-theme-moon"/></svg></span>';
        btns.appendChild(themeBtn);

        header.appendChild(btns);
        return header;
    }

    // ── Nav ────────────────────────────────────────────────────────────────────

    function buildNav() {
        var nav = document.createElement('nav');
        nav.id = 'navigationbar';
        nav.setAttribute('aria-label', 'Site navigation');

        var toggle = document.createElement('button');
        toggle.className = 'nav-toggle';
        toggle.setAttribute('aria-label', 'Toggle navigation');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-controls', 'nav-links-list');
        toggle.innerHTML = '<span aria-hidden="true"></span><span aria-hidden="true"></span><span aria-hidden="true"></span>';
        nav.appendChild(toggle);

        var list = document.createElement('div');
        list.className = 'nav-links';
        list.id = 'nav-links-list';

        for (var i = 0; i < NAV_ITEMS.length; i++) {
            var item = NAV_ITEMS[i];
            var a = document.createElement('a');
            a.className = item.id;
            a.href = item.href;
            if (item.external) {
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                a.setAttribute('aria-label', item.ariaLabel);
            }
            // blog pages use body id="blog-post"; highlight the Blog nav link
            if (item.id === 'blog') a.setAttribute('aria-current', 'page');
            a.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="' + item.sw + '" stroke-linecap="round" stroke-linejoin="round"><use href="#' + item.icon + '"/></svg>' + item.label;
            list.appendChild(a);
        }

        nav.appendChild(list);
        return nav;
    }

    // ── Profile ─────────────────────────────────────────────────────────────────

    function buildProfile() {
        var div = document.createElement('div');
        div.className = 'profile';
        return div;
    }

    // ── Footer ──────────────────────────────────────────────────────────────────

    function initFooter() {
        var avatar = document.querySelector('footer .footer-avatar');
        var copy   = document.querySelector('footer .copyright');
        var year   = new Date().getFullYear();

        if (avatar) {
            avatar.loading = 'lazy';
            avatar.src = ROOT + '/assets/Avatar.png';
            avatar.alt = 'Matthias Moulin';
        }

        fetch(ROOT + '/data/site.json')
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (site) {
                if (!site) {
                    if (copy) copy.textContent = 'Copyright © 2015–' + year + ' Matthias Moulin. All Rights Reserved.';
                    return;
                }
                if (avatar) avatar.alt = site.avatarAlt;
                if (copy) copy.textContent = 'Copyright © ' + site.copyrightStart + '–' + year + ' ' + site.author + '. All Rights Reserved.';
            })
            .catch(function () {
                if (copy) copy.textContent = 'Copyright © 2015–' + year + ' Matthias Moulin. All Rights Reserved.';
            });
    }

    // ── Theme ────────────────────────────────────────────────────────────────────

    function syncGiscusTheme(theme) {
        var iframe = document.querySelector('iframe.giscus-frame');
        if (!iframe) return;
        iframe.contentWindow.postMessage(
            { giscus: { setConfig: { theme: theme === 'light' ? 'light' : 'dark' } } },
            'https://giscus.app'
        );
    }

    function watchGiscusTheme() {
        var observer = new MutationObserver(function () {
            var iframe = document.querySelector('iframe.giscus-frame');
            if (!iframe) return;
            observer.disconnect();
            syncGiscusTheme(document.documentElement.dataset.theme || 'dark');
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    function initTheme() {
        var root = document.documentElement;
        var btn  = document.getElementById('theme-toggle');

        function applyTheme(theme) {
            root.dataset.theme = theme;
            if (btn) {
                var label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
                btn.setAttribute('aria-label', label);
                btn.setAttribute('title', label);
                btn.setAttribute('data-tooltip', label);
                btn.setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false');
            }
            var meta = document.querySelector('meta[name="theme-color"]');
            if (meta) {
                var accent = getComputedStyle(root).getPropertyValue('--color-accent').trim();
                if (accent) meta.setAttribute('content', accent);
            }
            syncGiscusTheme(theme);
        }

        applyTheme(root.dataset.theme || 'dark');

        if (btn) {
            btn.addEventListener('click', function () {
                var next = root.dataset.theme === 'dark' ? 'light' : 'dark';
                applyTheme(next);
                try { localStorage.setItem('theme', next); } catch (e) {}
            });
        }
    }

    // ── Nav toggle ────────────────────────────────────────────────────────────────

    function initNav() {
        var btn   = document.querySelector('.nav-toggle');
        var links = document.querySelector('#nav-links-list');
        var navEl = document.querySelector('#navigationbar');
        if (!btn || !links) return;

        function close() { links.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); btn.focus(); }
        function open()  { links.classList.add('open');    btn.setAttribute('aria-expanded', 'true');  var first = links.querySelector('a'); if (first) first.focus(); }

        btn.addEventListener('click', function () { links.classList.contains('open') ? close() : open(); });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && links.classList.contains('open')) close(); });
        document.addEventListener('click',   function (e) { if (links.classList.contains('open') && navEl && !navEl.contains(e.target)) close(); });
    }

    // ── Profile social links ───────────────────────────────────────────────────────

    var MAGIC = '__obf__';
    var NO_NEW_TAB = ['mailto:', 'skype:', 'tel:', 'sms:'];

    function initProfile() {
        var container = document.querySelector('.profile');
        if (!container) return;

        fetch(ROOT + '/data/profile-links.json')
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (links) {
                if (!links) return;
                var nav = document.createElement('nav');
                nav.setAttribute('aria-label', 'Social profiles');
                var ul = document.createElement('ul');
                ul.className = 'social-list';
                nav.appendChild(ul);

                var currentGroup = null;
                for (var i = 0; i < links.length; i++) {
                    var link = links[i];
                    if (link.group && link.group !== currentGroup) {
                        if (currentGroup !== null) {
                            var divider = document.createElement('li');
                            divider.className = 'social-divider';
                            divider.setAttribute('aria-hidden', 'true');
                            ul.appendChild(divider);
                        }
                        currentGroup = link.group;
                    }
                    var cleanUrl = link.url.split(MAGIC).join('');
                    if (/^javascript:/i.test(cleanUrl)) continue;
                    var li = document.createElement('li');
                    var a  = document.createElement('a');
                    a.href = cleanUrl;
                    a.className = 'social-link';
                    a.setAttribute('aria-label', link.label);
                    a.setAttribute('data-tooltip', link.label);
                    var rel = link.rel ? [link.rel, 'noopener', 'noreferrer'] : ['noopener', 'noreferrer'];
                    a.rel = rel.join(' ');
                    if (!NO_NEW_TAB.some(function (p) { return cleanUrl.indexOf(p) === 0; })) a.target = '_blank';
                    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                    svg.setAttribute('class', 'social-icon');
                    svg.setAttribute('aria-hidden', 'true');
                    var use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
                    use.setAttribute('href', '#icon-' + link.icon);
                    svg.appendChild(use);
                    a.appendChild(svg);
                    li.appendChild(a);
                    ul.appendChild(li);
                }
                container.appendChild(nav);
            })
            .catch(function () {});
    }

    // ── Bootstrap ─────────────────────────────────────────────────────────────────

    var skipLink = document.querySelector('.skip-link');
    function insertAfter(node, ref) { ref.parentNode.insertBefore(node, ref.nextSibling); }

    var headerEl  = buildHeader();
    var navEl     = buildNav();
    var profileEl = buildProfile();

    insertAfter(headerEl,  skipLink);
    insertAfter(navEl,     headerEl);
    insertAfter(profileEl, navEl);

    loadIconSprite();
    initTheme();
    initNav();
    initGlitchToggle();
    initFooter();
    initProfile();
    watchGiscusTheme();

}());
