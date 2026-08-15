(function (global) {
    "use strict";

    const permisos = {
        Administrador: { modulos: "*", escritura: "*" },
        Tecnico: {
            modulos: ["dashboard", "inventario", "entradas-salidas", "empleados", "asignaciones", "gps", "mantenimiento", "reportes", "servicedesk"],
            escritura: ["entradas-salidas", "mantenimiento", "servicedesk"]
        },
        Inventario: {
            modulos: ["dashboard", "inventario", "entradas-salidas", "empleados", "asignaciones", "gps", "mantenimiento", "reportes", "depreciacion", "servicedesk"],
            escritura: ["inventario", "entradas-salidas", "empleados", "asignaciones", "gps"]
        },
        SoloLectura: {
            modulos: ["dashboard", "inventario", "entradas-salidas", "empleados", "asignaciones", "gps", "mantenimiento", "reportes", "depreciacion", "servicedesk"],
            escritura: []
        },
        ServiceDesk: { modulos: ["servicedesk"], escritura: ["servicedesk"] }
    };

    const client = () => global.ControlTISupabase?.client;
    let registro;

    function mapearPerfil(perfil) {
        return {
            id: perfil.id,
            nombre: perfil.full_name || perfil.login || perfil.email,
            nombres: perfil.full_name || "",
            apellidos: "",
            correo: perfil.email,
            area: perfil.area || "",
            login: perfil.login,
            rol: perfil.role,
            activo: perfil.active,
            fechaCambioClave: perfil.password_changed_at,
            creadoEn: perfil.created_at,
            ultimoAcceso: perfil.last_access_at || ""
        };
    }

    global.Auth = {
        usuario: null,
        permisos,
        listaUsuarios: [],

        usuarios() {
            return this.listaUsuarios;
        },

        async refrescarUsuarios() {
            if (!client() || !this.usuario) return [];
            if (!this.requiereAdmin()) {
                this.listaUsuarios = [this.usuario];
                return this.listaUsuarios;
            }
            const { data, error } = await client()
                .from("profiles")
                .select("*")
                .order("full_name", { ascending: true });
            if (error) throw error;
            this.listaUsuarios = (data || []).map(mapearPerfil);
            return this.listaUsuarios;
        },

        claveCumple(clave) {
            return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/.test(String(clave));
        },

        claveExpirada(usuario) {
            const base = usuario?.fechaCambioClave || usuario?.creadoEn;
            if (!base) return false;
            return Date.now() - new Date(base).getTime() >= 30 * 24 * 60 * 60 * 1000;
        },

        async iniciar() {
            if (!client()) {
                throw new Error("La conexión central de acceso no está disponible.");
            }

            const { data, error } = await client().auth.getSession();
            if (error) console.error(error);

            if (data?.session?.user) {
                try {
                    await this.cargarUsuario(data.session.user);
                    const esRecuperacion = location.hash.includes("type=recovery") || new URLSearchParams(location.search).get("type") === "recovery";
                    if (esRecuperacion) {
                        await this.mostrarPortal(true);
                    }
                    return;
                } catch (err) {
                    console.error(err);
                    await client().auth.signOut();
                }
            }

            await this.mostrarPortal();
        },

        async cargarUsuario(user) {
            const { data: perfil, error } = await client()
                .from("profiles")
                .select("*")
                .eq("id", user.id)
                .single();

            if (error || !perfil) throw error || new Error("Perfil no encontrado.");
            if (!perfil.active) throw new Error("La cuenta está desactivada.");

            this.usuario = mapearPerfil(perfil);
            await this.refrescarUsuarios();
            this.establecerSesion(this.usuario);

            client().from("profiles")
                .update({ last_access_at: new Date().toISOString() })
                .eq("id", user.id)
                .then(() => {});
        },

        mostrarPortal(forzarCambio = false) {
            return new Promise(resolve => {
                document.getElementById("portalAcceso")?.remove();
                const portal = document.createElement("div");
                portal.id = "portalAcceso";
                portal.className = "access-portal";
                portal.innerHTML = `<section class="access-brand"><img src="Assets/logo-dtroy-acceso.png" alt="D-Troy Logistics LLC"><div><span>CONTROL DE ACTIVOS TI</span><h1>Administración segura de equipos, unidades y servicios.</h1><p>Accede al portal corporativo para continuar.</p></div><small>© ${new Date().getFullYear()} D-Troy Logistics LLC</small></section><section class="access-panel"><div class="access-box"><div class="access-form-logo"><img src="Assets/logo-dtroy-acceso.png" alt="D-Troy Logistics LLC"></div><form id="formAcceso" class="access-form"><span class="access-kicker">PORTAL CORPORATIVO</span><h2>Bienvenido</h2><p>Ingresa tu usuario o correo y contraseña.</p><label>Usuario o correo<input id="accesoUsuario" autocomplete="username" required></label><label>Contraseña<div class="access-password"><input id="accesoClave" type="password" autocomplete="current-password" required><button type="button" data-ver="accesoClave" aria-label="Mostrar contraseña"><i class="fa-solid fa-eye"></i></button></div></label><div class="access-error" id="errorAcceso" hidden></div><button class="access-primary" type="submit">Iniciar sesión <i class="fa-solid fa-arrow-right"></i></button><button class="access-link" id="irRegistro" type="button">¿No tienes cuenta? Crear una nueva</button></form><form id="formRegistro" class="access-form" hidden><span class="access-kicker">NUEVA CUENTA</span><h2>Crear una cuenta</h2><p>Tu cuenta tendrá acceso inicial al portal ServiceDesk.</p><div class="access-grid"><label>Nombre<input id="registroNombre" autocomplete="given-name" required></label><label>Apellido<input id="registroApellido" autocomplete="family-name" required></label></div><label>Correo electrónico<input id="registroCorreo" type="email" autocomplete="email" required></label><label>Área o departamento<input id="registroArea" required></label><label>Nueva contraseña<div class="access-password"><input id="registroClave" type="password" minlength="12" autocomplete="new-password" required><button type="button" data-ver="registroClave" aria-label="Mostrar contraseña"><i class="fa-solid fa-eye"></i></button></div><small>12 caracteres, mayúscula, minúscula, número y signo especial.</small></label><label>Confirmar contraseña<input id="registroConfirmacion" type="password" minlength="12" autocomplete="new-password" required></label><div class="access-error" id="errorRegistro" hidden></div><button class="access-primary" type="submit">Crear cuenta <i class="fa-solid fa-user-plus"></i></button><button class="access-link" id="irAcceso" type="button">Ya tengo cuenta. Iniciar sesión</button></form><form id="formCambioClave" class="access-form" hidden><span class="access-kicker">SEGURIDAD DE ACCESO</span><h2>Actualiza tu contraseña</h2><p>Crea una contraseña nueva para continuar.</p><label>Nueva contraseña<div class="access-password"><input id="cambioClave" type="password" minlength="12" autocomplete="new-password" required><button type="button" data-ver="cambioClave" aria-label="Mostrar contraseña"><i class="fa-solid fa-eye"></i></button></div><small>12 caracteres, mayúscula, minúscula, número y signo especial.</small></label><label>Confirmar contraseña<input id="cambioConfirmacion" type="password" minlength="12" autocomplete="new-password" required></label><div class="access-error" id="errorCambioClave" hidden></div><button class="access-primary" type="submit">Actualizar y continuar <i class="fa-solid fa-shield-halved"></i></button></form></div></section>`;

                document.body.appendChild(portal);
                document.body.classList.add("access-locked");
                registro = portal.querySelector("#formRegistro");
                const login = portal.querySelector("#formAcceso");
                const cambio = portal.querySelector("#formCambioClave");
                const mostrar = (actual, ...otros) => {
                    actual.hidden = false;
                    otros.forEach(form => form.hidden = true);
                    actual.querySelector("input")?.focus();
                };

                if (forzarCambio) mostrar(cambio, login, registro);

                portal.querySelector("#irRegistro").onclick = () => mostrar(registro, login, cambio);
                portal.querySelector("#irAcceso").onclick = () => mostrar(login, registro, cambio);
                portal.querySelectorAll("button[data-ver]").forEach(boton => {
                    boton.onclick = () => {
                        const input = portal.querySelector("#" + boton.dataset.ver);
                        input.type = input.type === "password" ? "text" : "password";
                        boton.querySelector("i").className = input.type === "password" ? "fa-solid fa-eye" : "fa-solid fa-eye-slash";
                    };
                });

                login.onsubmit = async event => {
                    event.preventDefault();
                    const errorNodo = portal.querySelector("#errorAcceso");
                    const identifier = portal.querySelector("#accesoUsuario").value.trim().toLowerCase();
                    const password = portal.querySelector("#accesoClave").value;
                    errorNodo.hidden = true;

                    const boton = login.querySelector("button[type='submit']");
                    boton.disabled = true;
                    let data;
                    let error;
                    try {
                        ({ data, error } = await client().functions.invoke("login-with-identifier", {
                            body: { identifier, password }
                        }));
                    } catch (err) {
                        error = err;
                    } finally {
                        boton.disabled = false;
                    }

                    if (error || !data?.session?.access_token || !data?.session?.refresh_token) {
                        let message = data?.message || "Usuario, correo o contraseña incorrectos.";
                        if (error?.context?.json) {
                            try { message = (await error.context.json())?.message || message; } catch (_) {}
                        }
                        errorNodo.textContent = message;
                        errorNodo.hidden = false;
                        return;
                    }

                    const { data: sessionData, error: sessionError } = await client().auth.setSession({
                        access_token: data.session.access_token,
                        refresh_token: data.session.refresh_token
                    });
                    if (sessionError || !sessionData?.user) {
                        errorNodo.textContent = "No fue posible establecer la sesión.";
                        errorNodo.hidden = false;
                        return;
                    }

                    try {
                        await this.cargarUsuario(sessionData.user);
                        if (this.claveExpirada(this.usuario)) {
                            mostrar(cambio, login, registro);
                            return;
                        }
                        this.cerrarPortal(portal);
                        resolve();
                    } catch (err) {
                        await client().auth.signOut();
                        errorNodo.textContent = err.message || "No fue posible cargar el perfil.";
                        errorNodo.hidden = false;
                    }
                };

                registro.onsubmit = async event => {
                    event.preventDefault();
                    const errorNodo = portal.querySelector("#errorRegistro");
                    const nombres = portal.querySelector("#registroNombre").value.trim();
                    const apellidos = portal.querySelector("#registroApellido").value.trim();
                    const email = portal.querySelector("#registroCorreo").value.trim().toLowerCase();
                    const area = portal.querySelector("#registroArea").value.trim();
                    const password = portal.querySelector("#registroClave").value;
                    const confirmacion = portal.querySelector("#registroConfirmacion").value;
                    errorNodo.hidden = true;

                    if (!this.claveCumple(password) || password !== confirmacion) {
                        errorNodo.textContent = password !== confirmacion ? "Las contraseñas no coinciden." : "Usa 12 caracteres con mayúscula, minúscula, número y signo especial.";
                        errorNodo.hidden = false;
                        return;
                    }

                    const { data, error } = await client().auth.signUp({
                        email,
                        password,
                        options: { data: { full_name: `${nombres} ${apellidos}`.trim(), area, login: email.split("@")[0] } }
                    });

                    if (error) {
                        errorNodo.textContent = error.message;
                        errorNodo.hidden = false;
                        return;
                    }

                    if (!data?.session) {
                        await Swal.fire("Confirma tu correo", "Revisa tu bandeja de entrada para activar la cuenta.", "info");
                        mostrar(login, registro, cambio);
                        return;
                    }

                    await this.cargarUsuario(data.user);
                    this.cerrarPortal(portal);
                    resolve();
                };

                cambio.onsubmit = async event => {
                    event.preventDefault();
                    const errorNodo = portal.querySelector("#errorCambioClave");
                    const password = portal.querySelector("#cambioClave").value;
                    const confirmacion = portal.querySelector("#cambioConfirmacion").value;
                    errorNodo.hidden = true;

                    if (!this.claveCumple(password) || password !== confirmacion) {
                        errorNodo.textContent = password !== confirmacion ? "Las contraseñas no coinciden." : "Usa 12 caracteres con mayúscula, minúscula, número y signo especial.";
                        errorNodo.hidden = false;
                        return;
                    }

                    const { error } = await client().auth.updateUser({ password });
                    if (error) {
                        errorNodo.textContent = error.message;
                        errorNodo.hidden = false;
                        return;
                    }

                    await client().from("profiles")
                        .update({ password_changed_at: new Date().toISOString() })
                        .eq("id", this.usuario.id);
                    this.usuario.fechaCambioClave = new Date().toISOString();
                    history.replaceState({}, document.title, `${location.pathname}${location.search ? "?version=5.2.0" : ""}`);
                    this.cerrarPortal(portal);
                    resolve();
                };
            });
        },

        cerrarPortal(portal) {
            portal.classList.add("access-exit");
            document.body.classList.remove("access-locked");
            setTimeout(() => portal.remove(), 260);
        },

        establecerSesion(usuario) {
            this.usuario = usuario;
            const zona = document.querySelector(".user");
            if (zona) {
                zona.innerHTML = `<i class="fa-solid fa-user-circle"></i><span><strong>${this.escape(usuario.nombre)}</strong><small class="d-block text-muted">${this.nombreRol(usuario.rol)}</small></span><button class="btn btn-sm btn-link text-danger" id="btnCerrarSesion" title="Cerrar sesión"><i class="fa-solid fa-right-from-bracket"></i></button>`;
                document.getElementById("btnCerrarSesion").onclick = () => this.cerrarSesion();
            }
            this.aplicarMenu();
        },

        async cerrarSesion() {
            await client()?.auth.signOut();
            this.usuario = null;
            sessionStorage.clear();
            location.reload();
        },

        nombreRol(rol) {
            return rol === "Tecnico" ? "Técnico" : rol === "SoloLectura" ? "Solo lectura" : rol;
        },

        puede(modulo, accion = "leer") {
            if (!this.usuario) return false;
            const permiso = permisos[this.usuario.rol] || permisos.SoloLectura;
            return accion === "leer"
                ? permiso.modulos === "*" || permiso.modulos.includes(modulo)
                : permiso.escritura === "*" || permiso.escritura.includes(modulo);
        },

        aplicarMenu() {
            document.querySelectorAll(".sidebar a[data-page]").forEach(enlace => {
                enlace.closest("li").hidden = !this.puede(enlace.dataset.page);
            });
        },

        aplicarPagina(pagina) {
            this.aplicarMenu();
            if (this.puede(pagina, "escribir")) return;
            const contenido = document.getElementById("contenidoPrincipal");
            if (!contenido) return;
            const mutaciones = ["#btnNuevoActivo", "#btnNuevoEmpleado", "#btnNuevaAsignacion", "#btnNuevoMantenimiento", "#btnNuevaUnidad", "#btnGuardarConfiguracion", "#btnNuevoUsuario", "button[title^='Editar']", "button[title^='Eliminar']", "button[title='Credenciales del celular']", "button[data-action='edit']", "button[data-action='delete']", "button[data-action='close']"];
            contenido.querySelectorAll(mutaciones.join(",")).forEach(elemento => elemento.remove());
            contenido.querySelectorAll("form input, form select, form textarea").forEach(elemento => elemento.disabled = true);
        },

        requiereAdmin() {
            return this.usuario?.rol === "Administrador";
        },

        escape(valor) {
            return String(valor ?? "").replace(/[&<>"']/g, caracter => ({
                "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
            })[caracter]);
        }
    };
})(window);
