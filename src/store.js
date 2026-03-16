import fs from "fs";

const FILE = "./store.json";

function load() {
    try {
        return JSON.parse(fs.readFileSync(FILE, "utf8"));
    } catch {
        return {};
    }
}

function save(data) {
    fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

export function set(cartId, data) {
    const store = load();
    store[cartId] = { ...store[cartId], ...data };
    save(store);
}

export function get(cartId) {
    return load()[cartId];
}

export function del(cartId) {
    const store = load();
    delete store[cartId];
    save(store);
}
