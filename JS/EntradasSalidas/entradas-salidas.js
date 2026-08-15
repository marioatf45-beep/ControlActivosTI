(function (global) {
    "use strict";

    const $ = id => document.getElementById(id);
    const escape = value => String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
    const client = () => global.ControlTISupabase?.client;
    const dateTime = value => new Intl.DateTimeFormat("es-MX", {
        dateStyle: "medium", timeStyle: "medium"
    }).format(new Date(value));

    global.EntradasSalidas = {
        eventos: [],
        estados: [],
        procesando: false,

        async iniciar() {
            if (!client()) return this.mostrarError("No está disponible la conexión central.");
            $("formEscaneo").addEventListener("submit", event => {
                event.preventDefault();
                this.escanear();
            });
            $("buscarMovimiento").addEventListener("input", () => this.renderizarHistorial());
            $("btnSincronizarActivos").addEventListener("click", () => this.sincronizarActivos(true));
            await this.sincronizarActivos(false);
            await this.cargar();
            $("codigoEscaneo").focus();
        },

        codigoLimpio(value) {
            const raw = String(value || "").trim();
            if (raw.startsWith("CONTROLTI|")) {
                const parts = raw.split("|");
                return parts[2] || parts[1] || raw;
            }
            return raw;
        },

        async sincronizarActivos(notificar) {
            const button = $("btnSincronizarActivos");
            const laptops = (global.obtenerActivos?.() || []).filter(asset => asset.categoria === "Laptop");
            if (!laptops.length) {
                if (notificar) Swal.fire("Sin laptops", "No hay laptops en el inventario de este navegador.", "info");
                return;
            }
            button.disabled = true;
            try {
                const rows = laptops.map(asset => ({
                    external_id: String(asset.id), asset_number: String(asset.activo || ""),
                    serial_number: String(asset.serie || ""), brand: String(asset.marca || ""),
                    model: String(asset.modelo || ""), assigned_to: String(asset.responsable || "")
                }));
                const { error } = await client().rpc("controlti_sync_gate_assets", { p_assets: rows });
                if (error) throw error;
                if (notificar) Swal.fire({ icon: "success", title: "Laptops sincronizadas", text: `${rows.length} equipos disponibles para escaneo.`, timer: 1800, showConfirmButton: false });
            } catch (error) {
                console.error(error);
                if (notificar) Swal.fire("No se pudo sincronizar", error.message || "Intenta nuevamente.", "error");
            } finally {
                button.disabled = false;
            }
        },

        async cargar() {
            const [{ data: events, error: eventError }, { data: states, error: stateError }] = await Promise.all([
                client().from("controlti_gate_events").select("*").order("occurred_at", { ascending: false }).limit(250),
                client().from("controlti_gate_state").select("asset_id,location")
            ]);
            if (eventError || stateError) throw eventError || stateError;
            this.eventos = events || [];
            this.estados = states || [];
            this.renderizar();
        },

        async escanear() {
            if (this.procesando) return;
            const input = $("codigoEscaneo");
            const code = this.codigoLimpio(input.value);
            if (!code) return input.focus();
            this.procesando = true;
            input.disabled = true;
            try {
                const { data, error } = await client().rpc("controlti_register_gate_scan", { p_code: code });
                if (error) throw error;
                const result = Array.isArray(data) ? data[0] : data;
                this.mostrarResultado(result);
                await this.cargar();
            } catch (error) {
                console.error(error);
                const message = error.message?.includes("ASSET_NOT_FOUND")
                    ? "No se encontró una laptop con ese activo o número de serie."
                    : error.message?.includes("DUPLICATE_SCAN")
                        ? "Lectura repetida: espera unos segundos antes de escanear nuevamente."
                        : "No fue posible registrar el movimiento.";
                this.mostrarError(message);
            } finally {
                input.value = "";
                input.disabled = false;
                input.focus();
                this.procesando = false;
            }
        },

        mostrarResultado(result) {
            const box = $("resultadoEscaneo");
            const direction = String(result.direction || "").toLowerCase();
            box.className = `gate-result mt-4 ${direction}`;
            box.hidden = false;
            box.innerHTML = `<strong><i class="fa-solid ${direction === "salida" ? "fa-arrow-right-from-bracket" : "fa-arrow-right-to-bracket"} me-2"></i>${escape(result.direction)}</strong><div>${escape(result.asset_number)} · ${escape(result.brand)} ${escape(result.model)}</div><small>${escape(dateTime(result.occurred_at))}</small>`;
        },

        mostrarError(message) {
            const box = $("resultadoEscaneo");
            if (!box) return;
            box.className = "gate-result mt-4 error";
            box.hidden = false;
            box.innerHTML = `<strong><i class="fa-solid fa-triangle-exclamation me-2"></i>No registrado</strong><div>${escape(message)}</div>`;
        },

        renderizar() {
            const outside = this.estados.filter(state => state.location === "FUERA").length;
            $("equiposFuera").textContent = outside;
            $("equiposDentro").textContent = Math.max(0, this.estados.length - outside);
            const today = new Date().toLocaleDateString("en-CA");
            $("movimientosHoy").textContent = this.eventos.filter(event => new Date(event.occurred_at).toLocaleDateString("en-CA") === today).length;
            this.renderizarHistorial();
        },

        renderizarHistorial() {
            const query = $("buscarMovimiento").value.trim().toLowerCase();
            const rows = this.eventos.filter(event => !query || [event.asset_number, event.serial_number, event.assigned_to, event.recorded_by_name]
                .some(value => String(value || "").toLowerCase().includes(query)));
            $("historialEntradasSalidas").innerHTML = rows.map(event => {
                const direction = event.direction.toLowerCase();
                return `<tr><td><span class="gate-movement ${direction}"><i class="fa-solid ${direction === "salida" ? "fa-arrow-up-right-from-square" : "fa-arrow-right-to-bracket"} me-1"></i>${escape(event.direction)}</span></td><td><strong>${escape(event.asset_number)}</strong><small class="d-block text-muted">${escape(event.brand)} ${escape(event.model)} · ${escape(event.serial_number)}</small></td><td>${escape(dateTime(event.occurred_at))}</td><td>${escape(event.recorded_by_name)}</td></tr>`;
            }).join("");
            $("historialVacio").hidden = rows.length > 0;
        }
    };
})(window);
