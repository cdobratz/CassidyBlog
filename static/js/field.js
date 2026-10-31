(function () {
    var canvas = document.querySelector("[data-field]");
    if (!canvas) {
        return;
    }
    var context = canvas.getContext("2d");
    if (!context) {
        return;
    }

    var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var yaw = 0;
    var yawMin = -0.85;
    var yawMax = 0.85;
    var width = 0;
    var height = 0;
    var night = false;
    var dragging = null;
    var frame = 0;

    function unit(index) {
        var value = Math.sin(index * 127.1) * 43758.5453;
        return value - Math.floor(value);
    }

    var blades = [];
    var count = 900;
    for (var i = 0; i < count; i += 1) {
        blades.push({
            angle: unit(i + 1) * Math.PI * 2,
            radius: Math.pow(unit(i + 2), 0.48),
            height: 0.35 + Math.pow(unit(i + 3), 0.7) * 1.35,
            lean: (unit(i + 4) - 0.5) * 0.7,
            shade: unit(i + 5),
            width: 1.1 + unit(i + 6) * 2.4,
            flower: unit(i + 7) > 0.985 ? Math.floor(unit(i + 8) * 3) : -1
        });
    }

    function clampYaw(value) {
        return Math.max(yawMin, Math.min(yawMax, value));
    }

    function readNight() {
        night = document.documentElement.classList.contains("dark");
    }

    function resize() {
        var ratio = Math.min(window.devicePixelRatio || 1, 2);
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = Math.floor(width * ratio);
        canvas.height = Math.floor(height * ratio);
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    function palette() {
        if (night) {
            return {
                soil: "rgba(36, 58, 42, 0.55)",
                soilEdge: "rgba(20, 24, 28, 0)",
                greens: ["#1a2e22", "#24382c", "#3a5644", "#7d9a78"],
                flowers: ["#e08a68", "#efe8d4", "#8aa4b8"]
            };
        }
        return {
            soil: "rgba(126, 158, 96, 0.55)",
            soilEdge: "rgba(250, 248, 242, 0)",
            greens: ["#3e5c38", "#5a7844", "#87a56a", "#d5e2b8"],
            flowers: ["#c4532e", "#f7f3ea", "#6d92b0"]
        };
    }

    function project(blade, time) {
        var angle = blade.angle + yaw;
        var x = Math.cos(angle) * blade.radius;
        var z = Math.sin(angle) * blade.radius;
        var sway = reduced ? 0 : Math.sin(time * 0.0012 + blade.angle * 3) * 0.05;
        var near = (z + 1) / 2;
        return {
            x: width * 0.5 + x * Math.min(width, 920) * 0.28,
            y: height * 0.78 + z * height * 0.11,
            rise: blade.height * height * (0.045 + near * 0.07),
            lean: blade.lean + sway,
            shade: blade.shade,
            width: blade.width * (0.65 + near),
            flower: blade.flower,
            depth: z
        };
    }

    function drawBlade(point, colors) {
        var tipX = point.x + point.lean * point.rise;
        var tipY = point.y - point.rise;
        var base = Math.max(0.8, point.width * 0.55);
        var color = colors.greens[Math.min(colors.greens.length - 1, Math.floor(point.shade * colors.greens.length))];
        context.beginPath();
        context.moveTo(point.x - base, point.y);
        context.quadraticCurveTo(point.x + point.lean * point.rise * 0.3, point.y - point.rise * 0.55, tipX, tipY);
        context.quadraticCurveTo(point.x + point.lean * point.rise * 0.15, point.y - point.rise * 0.4, point.x + base * 0.35, point.y);
        context.closePath();
        context.fillStyle = color;
        context.fill();
        if (point.flower >= 0) {
            context.beginPath();
            context.arc(tipX, tipY, 2.2 + point.shade * 1.6, 0, Math.PI * 2);
            context.fillStyle = colors.flowers[point.flower];
            context.fill();
        }
    }

    function draw(time) {
        var colors = palette();
        context.clearRect(0, 0, width, height);
        var mound = context.createRadialGradient(width * 0.5, height * 0.82, 10, width * 0.5, height * 0.82, Math.min(width, 920) * 0.34);
        mound.addColorStop(0, colors.soil);
        mound.addColorStop(1, colors.soilEdge);
        context.fillStyle = mound;
        context.beginPath();
        context.ellipse(width * 0.5, height * 0.84, Math.min(width, 920) * 0.32, height * 0.1, 0, 0, Math.PI * 2);
        context.fill();
        var drawn = blades.map(function (blade) {
            return project(blade, time);
        });
        drawn.sort(function (a, b) {
            return a.y - b.y;
        });
        for (var i = 0; i < drawn.length; i += 1) {
            drawBlade(drawn[i], colors);
        }
    }

    function percent() {
        return (yaw - yawMin) / (yawMax - yawMin);
    }

    function paintTrack() {
        var mark = document.querySelector("[data-track-mark]");
        var bar = document.querySelector("[data-track]");
        var value = Math.round(percent() * 100);
        if (mark) {
            mark.style.left = value + "%";
        }
        if (bar) {
            bar.setAttribute("aria-valuenow", String(value));
        }
    }

    function render(time) {
        draw(time || 0);
        paintTrack();
    }

    function loop(time) {
        render(time);
        if (!reduced) {
            frame = window.requestAnimationFrame(loop);
        }
    }

    function setYaw(value) {
        yaw = clampYaw(value);
        if (reduced) {
            render(0);
        }
    }

    resize();
    readNight();
    loop(0);

    window.addEventListener("resize", function () {
        resize();
        if (reduced) {
            render(0);
        }
    });

    var observer = new MutationObserver(function () {
        readNight();
        if (reduced) {
            render(0);
        }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    function yawFromClientX(clientX, target) {
        var rect = target.getBoundingClientRect();
        var ratio = (clientX - rect.left) / rect.width;
        return yawMin + Math.max(0, Math.min(1, ratio)) * (yawMax - yawMin);
    }

    canvas.addEventListener("pointerdown", function (event) {
        dragging = { kind: "canvas", x: event.clientX, yaw: yaw, id: event.pointerId };
        canvas.setPointerCapture(event.pointerId);
        document.body.classList.add("is-turning");
    });
    canvas.addEventListener("pointermove", function (event) {
        if (!dragging || dragging.kind !== "canvas" || dragging.id !== event.pointerId) {
            return;
        }
        setYaw(dragging.yaw + (event.clientX - dragging.x) / Math.max(width, 1) * 1.4);
    });
    function endDrag(event) {
        if (!dragging || dragging.id !== event.pointerId) {
            return;
        }
        dragging = null;
        document.body.classList.remove("is-turning");
    }
    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);

    canvas.addEventListener("keydown", function (event) {
        if (event.key === "ArrowLeft") {
            setYaw(yaw - 0.08);
        } else if (event.key === "ArrowRight") {
            setYaw(yaw + 0.08);
        }
    });

    document.querySelectorAll("[data-turn]").forEach(function (button) {
        button.addEventListener("click", function () {
            setYaw(yaw + Number(button.getAttribute("data-turn")) * 0.12);
        });
    });

    var track = document.querySelector("[data-track]");
    if (track) {
        track.addEventListener("pointerdown", function (event) {
            dragging = { kind: "track", id: event.pointerId };
            track.setPointerCapture(event.pointerId);
            setYaw(yawFromClientX(event.clientX, track));
        });
        track.addEventListener("pointermove", function (event) {
            if (!dragging || dragging.kind !== "track" || dragging.id !== event.pointerId) {
                return;
            }
            setYaw(yawFromClientX(event.clientX, track));
        });
        track.addEventListener("pointerup", endDrag);
        track.addEventListener("pointercancel", endDrag);
        track.addEventListener("keydown", function (event) {
            if (event.key === "ArrowLeft") {
                setYaw(yaw - 0.08);
            } else if (event.key === "ArrowRight") {
                setYaw(yaw + 0.08);
            }
        });
    }
})();
