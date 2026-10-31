(function () {
    var button = document.querySelector('[data-theme-toggle]');
    if (!button) {
        return;
    }

    function isNight() {
        return document.documentElement.classList.contains('dark');
    }

    function label(night) {
        return night ? 'Switch to day' : 'Switch to night';
    }

    function paint() {
        var night = isNight();
        var text = label(night);
        button.setAttribute('aria-label', text);
        button.setAttribute('title', text);
        button.setAttribute('aria-pressed', night ? 'true' : 'false');
    }

    button.addEventListener('click', function () {
        var night = !isNight();
        document.documentElement.classList.toggle('dark', night);
        document.documentElement.style.setProperty('--night', night ? '1' : '0');
        try {
            localStorage.setItem('cd-theme', night ? 'night' : 'day');
        } catch (error) {
            /* The toggle still applies for this view. */
        }
        paint();
    });

    paint();
})();
