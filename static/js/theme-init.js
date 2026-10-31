(function () {
    try {
        var theme = localStorage.getItem('cd-theme');
        if (theme !== 'day' && theme !== 'night') {
            theme = 'day';
        }
        if (theme === 'night') {
            document.documentElement.classList.add('dark');
            document.documentElement.style.setProperty('--night', '1');
        }
    } catch (error) {
        /* Storage can be blocked; day theme remains. */
    }
})();
