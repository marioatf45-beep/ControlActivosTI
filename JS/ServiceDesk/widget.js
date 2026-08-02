(function (global) {
    "use strict";

    const esc = valor => global.Auth?.escape(valor) || String(valor || "");
    const key = () => `ControlTI_SD_Leido_${global.Auth?.usuario?.id || "anon"}`;

    global.ServiceDeskMini = {
        timer: null,
        abierto: false,

        async iniciar() {
            if (!global.Auth?.usuario || !global.ServiceDesk) return;
            document.getElementById("sdMiniWidget")?.remove();
            const nodo = document.createElement("aside");
            nodo.id = "sdMiniWidget";
            nodo.className = "sd-mini";
            nodo.innerHTML = '<button class="sd-mini-toggle" id="sdMiniToggle" type="button" aria-label="Abrir chat ServiceDesk"><i class="fa-solid fa-comments"></i><span id="sdMiniBadge" hidden>0</span></button><section class="sd-mini-panel" id="sdMiniPanel" hidden><header><div><strong>ServiceDesk</strong><small><i class="fa-solid fa-circle"></i> Chat en tiempo real</small></div><button id="sdMiniCerrar" type="button" aria-label="Minimizar chat"><i class="fa-solid fa-minus"></i></button></header><div class="sd-mini-list" id="sdMiniLista"></div><footer><button id="sdMiniAbrirModulo" type="button">Abrir centro de soporte <i class="fa-solid fa-arrow-up-right-from-square"></i></button></footer></section>';
            document.body.appendChild(nodo);
            document.getElementById("sdMiniToggle").onclick = () => this.toggle();
            document.getElementById("sdMiniCerrar").onclick = () => this.toggle(false);
            document.getElementById("sdMiniAbrirModulo").onclick = () => this.abrirModulo();
            document.getElementById("sdMiniLista").onclick = event => {
                const boton = event.target.closest("button[data-ticket]");
                if (boton) this.abrirTicket(boton.dataset.ticket);
            };

            global.ServiceDesk.conectarTiempoReal();
            await global.ServiceDesk.sincronizar(false);
            this.renderizar();
            clearInterval(this.timer);
            this.timer = setInterval(() => global.ServiceDesk.sincronizar(false), 30000);
        },

        tickets() {
            return global.ServiceDesk?.tickets?.() || [];
        },

        mensajes() {
            return this.tickets()
                .flatMap(ticket => (ticket.mensajes || []).map(mensaje => ({
                    ...mensaje,
                    ticketId: ticket.id,
                    folio: ticket.folio,
                    asunto: ticket.asunto,
                    estado: ticket.estado
                })))
                .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        },

        renderizar() {
            if (!document.getElementById("sdMiniWidget") || !global.Auth?.usuario) return;
            const mensajes = this.mensajes();
            const ultimaLectura = localStorage.getItem(key()) || "1970-01-01T00:00:00.000Z";
            const nuevos = mensajes.filter(mensaje =>
                mensaje.autorId !== Auth.usuario.id && new Date(mensaje.fecha) > new Date(ultimaLectura)
            );
            const badge = document.getElementById("sdMiniBadge");
            badge.textContent = nuevos.length > 99 ? "99+" : nuevos.length;
            badge.hidden = !nuevos.length;
            document.getElementById("sdMiniToggle").classList.toggle("has-unread", nuevos.length > 0);
            document.title = nuevos.length ? `(${nuevos.length}) Control de Activos TI` : "Control de Activos TI";
            const ultimos = mensajes.slice(0, 6);
            document.getElementById("sdMiniLista").innerHTML = ultimos.length ? ultimos.map(mensaje =>
                `<button data-ticket="${esc(mensaje.ticketId)}"><span class="sd-mini-avatar"><i class="fa-solid ${mensaje.autorId === Auth.usuario.id ? "fa-user" : "fa-headset"}"></i></span><span><strong>${esc(mensaje.autor)}</strong><small>${esc(mensaje.folio)} · ${esc(mensaje.asunto)}</small><p>${esc(mensaje.texto)}</p><time>${new Date(mensaje.fecha).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</time></span></button>`
            ).join("") : '<div class="sd-mini-empty"><i class="fa-regular fa-comments"></i><span>No hay conversaciones todavía.</span></div>';
        },

        toggle(forzar) {
            this.abierto = typeof forzar === "boolean" ? forzar : !this.abierto;
            document.getElementById("sdMiniPanel").hidden = !this.abierto;
            if (this.abierto) {
                localStorage.setItem(key(), new Date().toISOString());
                this.renderizar();
            }
        },

        async abrirModulo() {
            this.toggle(false);
            await global.cargarPagina("servicedesk");
            document.querySelectorAll(".sidebar li").forEach(item => item.classList.remove("active"));
            document.querySelector('.sidebar a[data-page="servicedesk"]')?.closest("li")?.classList.add("active");
        },

        async abrirTicket(id) {
            await this.abrirModulo();
            global.ServiceDesk?.abrir(id);
            localStorage.setItem(key(), new Date().toISOString());
            this.renderizar();
        }
    };
})(window);
