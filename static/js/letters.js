(function () {
    var word = document.querySelector(".hero__word");
    if (!word) {
        return;
    }
    var aside = word.querySelector(".no");
    var typed = word.querySelector("[data-type]");
    if (!aside || !typed) {
        return;
    }
    var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var restLabel = "My Boring Portfolio";
    var hoverLabel = "Not My Boring Portfolio";

    function split(node, mode) {
        var text = node.textContent;
        node.textContent = "";
        var chars = [];
        text.split(/(\s+)/).forEach(function (part) {
            if (!part) {
                return;
            }
            if (/^\s+$/.test(part)) {
                chars.push(make(node, part, mode));
                return;
            }
            var wrap = document.createElement("span");
            wrap.className = "word";
            for (var i = 0; i < part.length; i += 1) {
                chars.push(make(wrap, part.charAt(i), mode));
            }
            node.appendChild(wrap);
        });
        return chars;
    }

    function make(parent, text, mode) {
        var span = document.createElement("span");
        span.className = "ch";
        span.textContent = text;
        span.dataset.hide = mode;
        parent.appendChild(span);
        show(span, false);
        return span;
    }

    function show(span, on) {
        if (span.dataset.hide === "box") {
            span.style.display = on ? "inline" : "none";
        } else {
            span.style.visibility = on ? "visible" : "hidden";
        }
        span.classList.toggle("is-on", on);
    }

    aside.hidden = false;
    var main = split(typed, "vis");
    var extra = split(aside, "box");
    var caret = document.createElement("i");
    caret.className = "caret";
    caret.setAttribute("aria-hidden", "true");
    word.appendChild(caret);
    word.tabIndex = 0;

    function placeCaret(span) {
        if (!span) {
            return;
        }
        caret.style.transform = "translate(" + (span.offsetLeft + span.offsetWidth) + "px," + span.offsetTop + "px)";
        caret.style.height = span.offsetHeight + "px";
    }

    function wait(ms) {
        return new Promise(function (resolve) {
            window.setTimeout(resolve, ms);
        });
    }

    function type(chars, beat) {
        var chain = Promise.resolve();
        chars.forEach(function (ch) {
            chain = chain.then(function () {
                show(ch, true);
                placeCaret(ch);
                var gap = beat * (0.72 + Math.random() * 0.45);
                if (!ch.textContent.trim()) {
                    gap += beat * 0.7;
                }
                return wait(gap);
            });
        });
        return chain;
    }

    function erase(chars, beat) {
        var chain = Promise.resolve();
        chars.slice().reverse().forEach(function (ch, index, list) {
            chain = chain.then(function () {
                show(ch, false);
                var previous = list[index + 1];
                if (previous) {
                    placeCaret(previous);
                } else if (main[0]) {
                    placeCaret(main[main.length - 1]);
                }
                return wait(beat * 0.42);
            });
        });
        return chain;
    }

    var ready = false;
    var hovering = false;
    var job = 0;

    function setLabel(hoveringNow) {
        word.setAttribute("aria-label", hoveringNow ? hoverLabel : restLabel);
    }

    function reveal(on) {
        var token = ++job;
        hovering = on;
        if (reduced) {
            extra.forEach(function (ch) {
                show(ch, on);
            });
            setLabel(on);
            return Promise.resolve();
        }
        caret.classList.add("caret--on");
        var run = on ? type(extra, 46) : erase(extra, 34);
        return run.then(function () {
            if (on && main.length) {
                placeCaret(main[main.length - 1]);
            }
            if (token !== job) {
                return;
            }
            setLabel(on);
            if (!on) {
                caret.classList.remove("caret--on");
            }
        });
    }

    function onEnter() {
        hovering = true;
        if (ready) {
            reveal(true);
        }
    }
    function onLeave() {
        hovering = false;
        if (ready) {
            reveal(false);
        }
    }

    // Reveal only when the cursor reaches the letters themselves; hide once it
    // leaves the whole title (which by then includes "Not").
    typed.addEventListener("pointerenter", onEnter);
    word.addEventListener("pointerleave", onLeave);
    word.addEventListener("focus", onEnter);
    word.addEventListener("blur", onLeave);

    if (reduced) {
        main.forEach(function (ch) {
            show(ch, true);
        });
        caret.remove();
        ready = true;
        setLabel(false);
        return;
    }

    // Intro types only "My Boring Portfolio". "Not" stays hidden until the
    // letters are hovered or the title is focused.
    caret.classList.add("caret--on");
    wait(640)
        .then(function () {
            return type(main, 52);
        })
        .then(function () {
            return wait(220);
        })
        .then(function () {
            ready = true;
            setLabel(false);
            if (hovering || typed.matches(":hover") || word.matches(":focus")) {
                return reveal(true);
            }
            caret.classList.remove("caret--on");
            window.setTimeout(function () {
                if (!hovering) {
                    caret.classList.remove("caret--on");
                }
            }, 360);
        });
})();
