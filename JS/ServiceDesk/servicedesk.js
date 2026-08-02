(function (global) {
    "use strict";

    const $ = id => document.getElementById(id);
    const esc = valor => Auth.escape(valor);
    const normal = valor => String(valor || "").toLowerCase();
    const client = () => global.ControlTISupabase.client;

    function mapearMensaje(fila) {
        return {
            id: fila.id,
            autorId: fila.author_id,
            autor: fila.author_name,
            rol: fila.author_role,
            texto: fila.body,
            fecha: fila.created_at
        };
    }

    function mapearTicket(fila, mensajes) {
        return {
            id: fila.id,
            folio: fila.folio,
            usuarioId: fila.user_id,
            solicitante: {
                nombre: fila.requester_name,
                correo: fila.requester_email,
                area: fila.requester_area
            },
            activo: fila.asset,
            categoria: fila.category,
            prioridad: fila.priority,
            asunto: fila.subject,
            asignado: {
                rol: fila.assigned_role,
                usuarioId: fila.assigned_user_id || "",
                nombre: fila.assigned_name
            },
            estado: fila.status,
            creadoEn: fila.created_at,
            actualizadoEn: fila.updated_at,
            mensajes: mensajes.filter(mensaje => mensaje.ticket_id === fila.id).map(mapearMensaje)
        };
    }

    global.ServiceDesk = {
        modal: null,
        actualId: "",
        cache: [],
        canalRealtime: null,
        sincronizando: false,
        timerRespaldo: null,

        esStaff() {
            return ["Administrador", "Tecnico"].includes(Auth.usuario?.rol);
        },

        esAdmin() {
            return Auth.usuario?.rol === "Administrador";
        },

        tickets() {
            return this.cache;
        },

        async iniciar() {
            this.modal = bootstrap.Modal.getOrCreateInstance($("modalNuevoTicket"));
            this.eventos();
            this.conectarTiempoReal();
            await this.sincronizar(false);
            clearInterval(this.timerRespaldo);
            this.timerRespaldo = setInterval(() => this.sincronizar(false), 30000);
        },

        eventos() {
            $("btnNuevoTicket").onclick = () => this.nuevo();
            $("formNuevoTicket").onsubmit = event => this.crear(event);
            $("sdBuscar").oninput = () => this.renderizar();
            $("sdFiltroEstado").onchange = () => this.renderizar();
            $("sdListaTickets").onclick = event => {
                const boton = event.target.closest("button[data-id]");
                if (boton) this.abrir(boton.dataset.id);
            };
            $("sdFormRespuesta").onsubmit = event => this.responder(event);
            $("sdRespuesta").onkeydown = event => {
                if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    $("sdFormRespuesta").requestSubmit();
                }
            };
            $("sdCambiarEstado").onchange = () => this.cambiarEstado();
            $("sdAsignarA").onchange = () => this.canalizar();
        },

        conectarTiempoReal() {
            if (this.canalRealtime) return;
            this.canalRealtime = client()
                .channel(`controlti-servicedesk-${Auth.usuario.id}`)
                .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, () => this.sincronizar(true))
                .on("postgres_changes", { event: "*", schema: "public", table: "ticket_messages" }, () => this.sincronizar(true))
                .subscribe();
        },

        async cargarDatos() {
            const { data: tickets, error: errorTickets } = await client()
                .from("tickets")
                .select("*")
                .order("updated_at", { ascending: false });
            if (errorTickets) throw errorTickets;

            let mensajes = [];
            if (tickets?.length) {
                const { data, error } = await client()
                    .from("ticket_messages")
                    .select("*")
                    .in("ticket_id", tickets.map(ticket => ticket.id))
                    .order("created_at", { ascending: true });
                if (error) throw error;
                mensajes = data || [];
            }

            this.cache = (tickets || []).map(ticket => mapearTicket(ticket, mensajes));
            global.ServiceDeskMini?.renderizar();
        },

        async sincronizar(inmediato = false) {
            if (this.sincronizando) return;
            this.sincronizando = true;
            const borrador = $("sdRespuesta")?.value || "";
            const seleccion = this.actualId;

            try {
                await this.cargarDatos();
                if ($("sdListaTickets")) {
                    this.renderizar();
                    if (seleccion && this.cache.some(ticket => ticket.id === seleccion)) this.abrir(seleccion);
                    if ($("sdRespuesta")) $("sdRespuesta").value = borrador;
                    const estado = $("sdUltimaActualizacion");
                    if (estado) {
                        estado.classList.remove("sd-refresh-pulse");
                        void estado.offsetWidth;
                        estado.classList.add("sd-refresh-pulse");
                        estado.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${inmediato ? "Actualización recibida" : "Sincronizado"} ${new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
                    }
                }
            } catch (error) {
                console.error(error);
                const estado = $("sdUltimaActualizacion");
                if (estado) estado.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Sin conexión con ServiceDesk';
            } finally {
                this.sincronizando = false;
            }
        },

        nuevo() {
            const usuario = Auth.usuario;
            $("formNuevoTicket").reset();
            $("sdNombre").value = usuario.nombre || "";
            $("sdCorreo").value = usuario.correo || "";
            $("sdArea").value = usuario.area || "";
            const correo = normal(usuario.correo);
            const empleado = obtenerEmpleados().find(item => normal(item.correo) === correo);
            const activos = obtenerActivos().filter(activo =>
                (empleado && activo.empleadoId === empleado.id) || normal(activo.responsable) === normal(usuario.nombre)
            );
            $("sdActivo").innerHTML = '<option value="">Sin equipo relacionado</option>' + activos.map(activo =>
                `<option value="${esc(activo.id)}">${esc(activo.activo)} · ${esc(activo.categoria || "")} · ${esc(activo.serie || "Sin serie")}</option>`
            ).join("");
            this.modal.show();
        },

        async crear(event) {
            event.preventDefault();
            const boton = event.currentTarget.querySelector("button[type='submit']");
            boton.disabled = true;
            const activo = obtenerActivos().find(item => item.id === $("sdActivo").value);
            const asset = activo ? {
                id: activo.id,
                activo: activo.activo,
                serie: activo.serie,
                categoria: activo.categoria,
                marca: activo.marca,
                modelo: activo.modelo,
                estado: activo.estado
            } : null;

            try {
                const { data: ticket, error } = await client().from("tickets").insert({
                    user_id: Auth.usuario.id,
                    requester_name: $("sdNombre").value.trim(),
                    requester_email: $("sdCorreo").value.trim().toLowerCase(),
                    requester_area: $("sdArea").value.trim(),
                    asset,
                    category: $("sdCategoria").value,
                    priority: $("sdPrioridad").value,
                    subject: $("sdAsunto").value.trim(),
                    assigned_role: "Administrador",
                    assigned_user_id: null,
                    assigned_name: "Mesa de administradores",
                    status: "Abierto"
                }).select().single();
                if (error) throw error;

                const { error: errorMensaje } = await client().from("ticket_messages").insert({
                    ticket_id: ticket.id,
                    author_id: Auth.usuario.id,
                    author_name: Auth.usuario.nombre,
                    author_role: Auth.usuario.rol,
                    body: $("sdDescripcion").value.trim()
                });
                if (errorMensaje) throw errorMensaje;

                this.modal.hide();
                this.actualId = ticket.id;
                await this.sincronizar(true);
                this.abrir(ticket.id);
                Swal.fire({ icon: "success", title: "Ticket enviado al administrador", text: ticket.folio, timer: 1800, showConfirmButton: false });
            } catch (error) {
                Swal.fire("No se pudo crear el ticket", error.message, "error");
            } finally {
                boton.disabled = false;
            }
        },

        filtrados() {
            if (!$("sdBuscar")) return this.cache;
            const busqueda = normal($("sdBuscar").value);
            const estado = $("sdFiltroEstado").value;
            return this.cache.filter(ticket =>
                (!estado || ticket.estado === estado) &&
                (!busqueda || normal([ticket.folio, ticket.asunto, ticket.solicitante.nombre, ticket.activo?.activo].join(" ")).includes(busqueda))
            );
        },

        renderizar() {
            if (!$("sdListaTickets")) return;
            const items = this.filtrados();
            $("sdListaTickets").innerHTML = items.map(ticket => `<button class="sd-ticket ${ticket.id === this.actualId ? "active" : ""}" data-id="${ticket.id}"><div class="sd-ticket-top"><strong>${esc(ticket.folio)}</strong><span class="sd-state ${normal(ticket.estado).replaceAll(" ", "-")}">${esc(ticket.estado)}</span></div><p>${esc(ticket.asunto)}</p><small>${esc(ticket.solicitante.nombre)} · ${new Date(ticket.actualizadoEn).toLocaleString("es-MX")}</small></button>`).join("");
            $("sdSinTickets").hidden = items.length > 0;
            $("sdAbiertos").textContent = this.cache.filter(ticket => ticket.estado === "Abierto").length;
            $("sdAtencion").textContent = this.cache.filter(ticket => ticket.estado === "En atención").length;
            $("sdResueltos").textContent = this.cache.filter(ticket => ticket.estado === "Resuelto").length;
            $("sdTotal").textContent = this.cache.length;
        },

        abrir(id) {
            const ticket = this.cache.find(item => item.id === id);
            if (!ticket || !$("sdChat")) return;
            this.actualId = id;
            this.renderizar();
            $("sdChatVacio").hidden = true;
            $("sdChat").hidden = false;
            $("sdChatFolio").textContent = `${ticket.folio} · ${ticket.categoria} · Prioridad ${ticket.prioridad}`;
            $("sdChatAsunto").textContent = ticket.asunto;
            $("sdChatSolicitante").textContent = `${ticket.solicitante.nombre} · ${ticket.solicitante.correo} · ${ticket.solicitante.area || "Sin área"}`;
            $("sdCambiarEstado").value = ticket.estado;
            $("sdCambiarEstado").disabled = !this.esStaff();
            const asignado = ticket.asignado;
            const tecnicos = Auth.usuarios().filter(usuario => usuario.activo && usuario.rol === "Tecnico");
            $("sdAsignarA").innerHTML = '<option value="admin">Administrador</option>' + tecnicos.map(usuario =>
                `<option value="${esc(usuario.id)}">Técnico · ${esc(usuario.nombre)}</option>`
            ).join("");
            $("sdAsignarA").value = asignado.rol === "Tecnico" ? asignado.usuarioId : "admin";
            $("sdAsignarA").disabled = !this.esAdmin();
            $("sdEquipoDetalle").innerHTML = (ticket.activo
                ? `<i class="fa-solid fa-laptop me-2"></i><strong>${esc(ticket.activo.activo)}</strong> · ${esc(ticket.activo.categoria || "")} · Serie ${esc(ticket.activo.serie || "N/A")} · ${esc([ticket.activo.marca, ticket.activo.modelo].filter(Boolean).join(" "))} · Estado ${esc(ticket.activo.estado || "N/A")}`
                : '<i class="fa-solid fa-circle-info me-2"></i>Ticket sin equipo relacionado') +
                `<span class="sd-owner"><i class="fa-solid fa-user-check"></i> Responsable: ${esc(asignado.nombre)}</span>`;
            $("sdMensajes").innerHTML = ticket.mensajes.map(mensaje => `<article class="sd-message ${mensaje.autorId === Auth.usuario.id ? "mine" : ""}"><strong>${esc(mensaje.autor)} <small>${esc(Auth.nombreRol(mensaje.rol))}</small></strong><p>${esc(mensaje.texto)}</p><small>${new Date(mensaje.fecha).toLocaleString("es-MX")}</small></article>`).join("");
            $("sdFormRespuesta").hidden = ticket.estado === "Cerrado";
            $("sdMensajes").scrollTop = $("sdMensajes").scrollHeight;
        },

        async responder(event) {
            event.preventDefault();
            const texto = $("sdRespuesta").value.trim();
            const ticket = this.cache.find(item => item.id === this.actualId);
            if (!texto || !ticket) return;
            $("sdRespuesta").value = "";

            const { error } = await client().from("ticket_messages").insert({
                ticket_id: ticket.id,
                author_id: Auth.usuario.id,
                author_name: Auth.usuario.nombre,
                author_role: Auth.usuario.rol,
                body: texto
            });
            if (error) {
                $("sdRespuesta").value = texto;
                return Swal.fire("No se pudo enviar", error.message, "error");
            }

            if (this.esStaff() && ticket.estado === "Abierto") {
                await client().from("tickets").update({ status: "En atención" }).eq("id", ticket.id);
            }
            await this.sincronizar(true);
        },

        async canalizar() {
            if (!this.esAdmin() || !this.actualId) return;
            const valor = $("sdAsignarA").value;
            const tecnico = Auth.usuarios().find(usuario => usuario.id === valor && usuario.activo && usuario.rol === "Tecnico");
            const cambios = tecnico ? {
                assigned_role: "Tecnico",
                assigned_user_id: tecnico.id,
                assigned_name: tecnico.nombre,
                status: "En atención"
            } : {
                assigned_role: "Administrador",
                assigned_user_id: Auth.usuario.id,
                assigned_name: Auth.usuario.nombre
            };

            const { error } = await client().from("tickets").update(cambios).eq("id", this.actualId);
            if (error) return Swal.fire("No se pudo canalizar", error.message, "error");

            await client().from("ticket_messages").insert({
                ticket_id: this.actualId,
                author_id: Auth.usuario.id,
                author_name: "Sistema ServiceDesk",
                author_role: "Administrador",
                body: tecnico ? `El administrador canalizó el ticket al técnico ${tecnico.nombre}.` : "El administrador conservará la atención del ticket."
            });
            await this.sincronizar(true);
        },

        async cambiarEstado() {
            if (!this.esStaff() || !this.actualId) return;
            const { error } = await client().from("tickets")
                .update({ status: $("sdCambiarEstado").value })
                .eq("id", this.actualId);
            if (error) return Swal.fire("No se pudo cambiar el estado", error.message, "error");
            await this.sincronizar(true);
        }
    };
})(window);
