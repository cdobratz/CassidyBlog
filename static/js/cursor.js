(function() {
    const cursor = document.querySelector('.cursor');
    const follower = document.querySelector('.cursor-follower');

    if (!cursor || !follower) return;

    let mouseX = 0, mouseY = 0;
    let cursorX = 0, cursorY = 0;
    let followerX = 0, followerY = 0;

    document.addEventListener('mousemove', function(e) {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });

    function animate() {
        cursorX += (mouseX - cursorX) * 0.2;
        cursorY += (mouseY - cursorY) * 0.2;
        followerX += (mouseX - followerX) * 0.1;
        followerY += (mouseY - followerY) * 0.1;

        cursor.style.transform = 'translate(' + (cursorX - 6) + 'px, ' + (cursorY - 6) + 'px)';
        follower.style.transform = 'translate(' + (followerX - 20) + 'px, ' + (followerY - 20) + 'px)';

        requestAnimationFrame(animate);
    }
    animate();

    var interactives = document.querySelectorAll('a, button, .btn, input, textarea');
    interactives.forEach(function(el) {
        el.addEventListener('mouseenter', function() {
            follower.style.width = '60px';
            follower.style.height = '60px';
            follower.style.transform = 'translate(' + (followerX - 30) + 'px, ' + (followerY - 30) + 'px)';
        });
        el.addEventListener('mouseleave', function() {
            follower.style.width = '40px';
            follower.style.height = '40px';
        });
    });
})();
