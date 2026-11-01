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
    var clumpCount = 16;
    for (var clump = 0; clump < clumpCount; clump += 1) {
        var centerAngle = unit(clump + 1) * Math.PI * 2;
        var centerRadius = Math.pow(unit(clump + 2), 0.7) * 0.9;
        var members = 34 + Math.floor(unit(clump + 3) * 28);
        for (var member = 0; member < members; member += 1) {
            var index = clump * 70 + member;
            var leaf = unit(index + 10) > 0.84;
            blades.push({
                angle: centerAngle + (unit(index + 4) - 0.5) * 0.62,
                radius: Math.max(0.02, Math.min(0.98, centerRadius + (unit(index + 5) - 0.5) * 0.2)),
                height: leaf ? 0.4 + unit(index + 6) * 0.55 : 0.55 + unit(index + 6) * 1.25,
                lean: (unit(index + 7) - 0.5) * (leaf ? 0.45 : 1.05),
                shade: unit(index + 8),
                width: leaf ? 3.2 + unit(index + 9) * 2.4 : 1.15 + unit(index + 9) * 1.5,
                leaf: leaf,
                flower: !leaf && unit(index + 11) > 0.975 ? Math.floor(unit(index + 12) * 3) : -1
            });
        }
    }
    var tree = { angle: -0.65, radius: 0.34 };

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
                highlight: "rgba(186, 206, 170, 0.45)",
                flowers: ["#e08a68", "#efe8d4", "#8aa4b8"],
                bark: "#3a322c",
                canopy: ["#1c3326", "#2a4634", "#3d5c46", "#6e8c6c"]
            };
        }
        return {
            soil: "rgba(126, 158, 96, 0.5)",
            soilEdge: "rgba(250, 248, 242, 0)",
            greens: ["#3e5c38", "#5a7844", "#87a56a", "#d7e4bc"],
            highlight: "rgba(244, 248, 220, 0.55)",
            flowers: ["#c4532e", "#f7f3ea", "#6d92b0"],
            bark: "#6a4a32",
            canopy: ["#3d5c34", "#5d7c42", "#87a85a", "#c5d7a0"]
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
            rise: blade.height * height * (0.03 + near * 0.048),
            lean: blade.lean + sway,
            shade: blade.shade,
            width: blade.width * (1.6 + near * 1.4),
            leaf: blade.leaf,
            flower: blade.flower,
            depth: z
        };
    }

    function place(angle, radius) {
        var turned = angle + yaw;
        var x = Math.cos(turned) * radius;
        var z = Math.sin(turned) * radius;
        var span = Math.min(width, 920);
        return {
            x: width * 0.5 + x * span * 0.28,
            y: height * 0.78 + z * height * 0.11,
            near: (z + 1) / 2,
            depth: z
        };
    }

    function drawBlade(point, colors) {
        var tipX = point.x + point.lean * point.rise;
        var tipY = point.y - point.rise;
        var base = Math.max(2.4, point.width * 0.72);
        var bend = point.leaf ? 0.25 : 0.55;
        var midX = point.x + point.lean * point.rise * bend;
        var midY = point.y - point.rise * 0.62;
        var color = colors.greens[Math.min(colors.greens.length - 1, Math.floor(point.shade * colors.greens.length))];
        context.beginPath();
        context.moveTo(point.x - base * 0.55, point.y);
        context.quadraticCurveTo(midX - base * 0.2, midY, tipX, tipY);
        context.quadraticCurveTo(midX + base * 0.45, midY + point.rise * 0.05, point.x + base * 0.28, point.y);
        context.closePath();
        context.fillStyle = color;
        context.fill();
        if (point.shade > 0.62) {
            context.beginPath();
            context.moveTo(point.x - base * 0.08, point.y - 1);
            context.quadraticCurveTo(midX, midY, tipX, tipY);
            context.strokeStyle = colors.highlight;
            context.lineWidth = point.leaf ? 1.1 : 0.7;
            context.stroke();
        }
        if (point.flower >= 0) {
            context.beginPath();
            context.arc(tipX, tipY, 2.4 + point.shade * 1.4, 0, Math.PI * 2);
            context.fillStyle = colors.flowers[point.flower];
            context.fill();
        }
    }

    function drawTree(spot, colors) {
        var scale = 0.78 + spot.near * 0.45;
        var trunkHeight = height * 0.22 * scale;
        var trunkWidth = 11 * scale;
        var ground = spot.y;
        context.beginPath();
        context.moveTo(spot.x - trunkWidth * 0.62, ground + 4);
        context.bezierCurveTo(
            spot.x - trunkWidth * 0.35, ground - trunkHeight * 0.35,
            spot.x - trunkWidth * 0.2, ground - trunkHeight * 0.7,
            spot.x - trunkWidth * 0.12, ground - trunkHeight
        );
        context.lineTo(spot.x + trunkWidth * 0.22, ground - trunkHeight);
        context.bezierCurveTo(
            spot.x + trunkWidth * 0.28, ground - trunkHeight * 0.62,
            spot.x + trunkWidth * 0.4, ground - trunkHeight * 0.28,
            spot.x + trunkWidth * 0.5, ground + 2
        );
        context.closePath();
        context.fillStyle = colors.bark;
        context.fill();
        var crown = ground - trunkHeight;
        var blobs = [
            [2, 8, 70, 36, 0],
            [-6, -6, 62, 40, 1],
            [18, -2, 40, 30, 2],
            [-22, -4, 38, 28, 1],
            [0, -28, 36, 26, 3]
        ];
        blobs.forEach(function (blob) {
            context.beginPath();
            context.ellipse(
                spot.x + blob[0] * scale,
                crown + blob[1] * scale,
                blob[2] * scale,
                blob[3] * scale,
                0, 0, Math.PI * 2
            );
            context.fillStyle = colors.canopy[blob[4]];
            context.fill();
        });
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
        var layers = blades.map(function (blade) {
            var point = project(blade, time);
            return { y: point.y, draw: function () { drawBlade(point, colors); } };
        });
        var trunk = place(tree.angle, tree.radius);
        layers.push({
            y: trunk.y,
            draw: function () { drawTree(trunk, colors); }
        });
        layers.sort(function (a, b) {
            return a.y - b.y;
        });
        layers.forEach(function (layer) {
            layer.draw();
        });
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
