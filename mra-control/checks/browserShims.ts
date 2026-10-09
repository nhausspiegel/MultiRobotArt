// Browser globals the stores use at import or on Run Sim. Import before them.
globalThis.requestAnimationFrame ??= () => 0;
globalThis.sessionStorage ??= {getItem: () => null, setItem() {}, removeItem() {}} as unknown as Storage;
