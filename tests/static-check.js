const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const references = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
    .map((match) => match[1].split("?")[0])
    .filter((value) => !/^https?:|^#/.test(value));
const missing = references.filter((value) => !fs.existsSync(path.join(root, value)));

if (missing.length) {
    console.error("Referencias locales faltantes:", missing.join(", "));
    process.exit(1);
}

for (const required of [
    "supabase/config.toml",
    "supabase/03_auth_hardening.sql",
    "supabase/functions/login-with-identifier/index.ts",
    "supabase/functions/admin-manage-user/index.ts"
]) {
    if (!fs.existsSync(path.join(root, required))) {
        console.error("Archivo de producción faltante:", required);
        process.exit(1);
    }
}

console.log(`OK: ${references.length} referencias locales y archivos de producción.`);
