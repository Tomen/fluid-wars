// Utility functions for Fluid Wars
// Vector operations
export function distance(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
}
export function length(vx, vy) {
    return Math.sqrt(vx * vx + vy * vy);
}
export function normalize(vx, vy) {
    const len = length(vx, vy);
    if (len === 0) {
        return { x: 0, y: 0 };
    }
    return {
        x: vx / len,
        y: vy / len
    };
}
export function dot(v1, v2) {
    return v1.x * v2.x + v1.y * v2.y;
}
// Utility functions
export function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}
export function lerp(a, b, t) {
    return a + (b - a) * t;
}
export function randomRange(min, max) {
    return min + Math.random() * (max - min);
}
export function randomInt(min, max) {
    return Math.floor(randomRange(min, max + 1));
}
//# sourceMappingURL=utils.js.map